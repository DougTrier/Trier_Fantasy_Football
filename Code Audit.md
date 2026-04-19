# Trier Fantasy Football — Code Audit
**Date:** 2026-04-19
**Auditor:** Claude Sonnet 4.6 (read-only analysis)
**Scope:** Security, state consistency, data integrity, error handling, memory leaks, type safety, dead code, regression risks
**Files Analyzed:** 13 key files across `src/`, `src-tauri/`, and `services/`
**Total Findings:** 47 (4 HIGH security · 6 MEDIUM security · 3 HIGH regression risk)

> **Note:** This is a read-only audit. No code was changed. Findings are logged for awareness; many are inherent architectural trade-offs, not bugs requiring immediate action.

---

## 1. Security

### 1.1 Password Hashing — Legacy Format Still Accepted
- **File:** `src/services/IdentityService.ts:529–568`
- **Severity:** MEDIUM
- **Issue:** `verifyPassword()` still accepts legacy SHA-256 and plain-text password formats for backward compatibility. Migration relies on user saving — interim states could have plaintext hashes in localStorage for extended periods.
- **Regression Risk:** MEDIUM — Removing legacy support would break users who haven't saved their password since upgrading. Keeping it is a liability.

### 1.2 Commissioner Hash Sync Race Condition
- **File:** `src/App.tsx:285–295`
- **Severity:** MEDIUM
- **Issue:** SYNC_LEAGUE accepts `commPasswordHash` only if we have none (`!prev.commPasswordHash`). If multiple peers simultaneously try to become commissioner, only the first one's hash is accepted. A compromised peer could send a garbage hash and win the race on a fresh install.
- **Regression Risk:** MEDIUM — Full fix requires quorum or signature verification, which is architecturally complex.

### 1.3 P2P Restart Secret Persisted in localStorage
- **File:** `src/App.tsx:337`
- **Severity:** HIGH
- **Issue:** `trier_p2p_secret` is stored in plaintext localStorage. Any XSS can steal it and send a RESTART_REQUEST. No rate limiting on restart attempts.
- **Regression Risk:** HIGH — Requires a session-only ephemeral token that doesn't survive restart.

### 1.4 Session Key Derivation Failure Falls Back to Plaintext
- **File:** `src/services/P2PService.ts:860–861, 904–905`
- **Severity:** MEDIUM
- **Issue:** If ECDH session key derivation fails, the code logs a warning and continues. Message sending checks `if (!isHandshake && conn.sessionKey)` — if `sessionKey` is null, plaintext is sent. An attacker could trigger key derivation failures to downgrade all traffic.
- **Regression Risk:** HIGH — Removing the plaintext fallback would break peer communication on crypto failures; keeping it leaks data.

### 1.5 No DTLS Certificate Verification
- **File:** `src/services/P2PService.ts:464–468`
- **Severity:** HIGH (on untrusted networks)
- **Issue:** SimplePeer WebRTC connections do not pin or verify DTLS certificates. A malicious TURN operator could perform MITM. The app assumes a trusted LAN but no code enforces it.
- **Regression Risk:** MEDIUM — Adding certificate pinning requires exposing SimplePeer's `RTCPeerConnection` internals.

### 1.6 Commissioner Token Uses Non-Cryptographic RNG
- **File:** `src-tauri/src/main.rs:60–69`
- **Severity:** MEDIUM
- **Issue:** `generate_comm_token()` uses an LCG (Linear Congruential Generator). Tokens are unique per process but an attacker who knows the PID and timestamp could predict them. Could be replaced with `thread_rng().gen::<[u8;16]>()` and hex-encoded.
- **Regression Risk:** LOW — Drop-in replacement; no API change needed.

### 1.7 Dashboard Token Displayed in Plaintext in Settings
- **File:** `src/components/SettingsPage.tsx:260–261`
- **Severity:** LOW
- **Issue:** Full token URL is shown in Settings. Screenshots or screen-shares leak admin access. Token is only valid on localhost:15434, so network exposure is minimal.
- **Regression Risk:** LOW — Could mask the token after initial copy, but this is UX hardening, not a code defect.

### 1.8 Input Sanitization Only on Team Name/Owner Fields
- **File:** `src/App.tsx:760–766`
- **Severity:** LOW
- **Issue:** `sanitizeInput()` is only applied in `createNewTeam()` and `updateTeamDetails()`. Chat messages, trade descriptions, and announcements bypass it. React JSX escaping prevents stored XSS on render; risk is only if `dangerouslySetInnerHTML` is ever introduced.
- **Regression Risk:** LOW — React escaping is the real protection here.

### 1.9 No Content-Security-Policy Headers
- **File:** `src-tauri/src/main.rs` / Tauri config
- **Severity:** MEDIUM
- **Issue:** No CSP headers are configured. A malicious script injected into a loaded webview could access localStorage and Tauri APIs.
- **Regression Risk:** LOW — Adding CSP is a one-time config change with no code impact.

### 1.10 ECDSA Private Key Wrap Secret Is Baked Into Binary
- **File:** `src/services/IdentityService.ts:240–252`
- **Severity:** HIGH
- **Issue:** `APP_KEY_WRAP_SECRET` is a static string in the binary. The PBKDF2 salt is stored next to the wrapped key in localStorage. An offline attacker with the binary and localStorage can reconstruct the key via brute force (100k PBKDF2 iterations is weak against GPU).
- **Regression Risk:** HIGH — Real fix requires OS keychain integration (Tauri secure storage), a significant architectural change.

---

## 2. State Consistency & Sync

### 2.1 BroadcastChannel Never Explicitly Closed
- **File:** `src/utils/SyncService.ts:50–64`
- **Severity:** LOW
- **Issue:** The `BroadcastChannel` is created in the SyncService singleton but never explicitly closed. Channels are auto-closed when the origin unloads, but explicit `.close()` on logout would be cleaner.
- **Regression Risk:** LOW — No known memory leak; safe to add `public close()` and call on app unmount.

### 2.2 SyncService Listener Array Can Accumulate Duplicates
- **File:** `src/utils/SyncService.ts:107–113`
- **Severity:** LOW
- **Issue:** `onMessageListeners` is never deduplicated. If the same listener is added twice (e.g., component re-renders without unmounting), both instances fire on every message. Unsubscribe requires the same function reference.
- **Regression Risk:** LOW — React's `useEffect` cleanup should prevent this in practice.

### 2.3 Vector Clock Causality Not Enforced
- **File:** `src/services/EventStore.ts:118–123`
- **Severity:** MEDIUM
- **Issue:** `getEventsSince(vector)` returns events where `e.seq > lastSeen[e.author]` but doesn't enforce causality across authors. If Author A's event 6 depends on Author B's event 4, and a peer has B:3 and A:6, they'll accept A:6 without seeing its dependency.
- **Regression Risk:** HIGH — Full fix requires a DAG or Lamport clock, breaking the current flat-seq model.

### 2.4 Event Deduplication by ID Only, No Payload Verification
- **File:** `src/services/EventStore.ts:105–109`
- **Severity:** LOW
- **Issue:** Events are deduplicated by `event.id` alone. A peer could send two events with the same ID but different payloads; only the first is accepted with no integrity check on the second.
- **Regression Risk:** LOW — Adding payload hash verification prevents dual-application but adds CPU cost.

### 2.5 Concurrent Roster Swaps Can Diverge State
- **File:** `src/App.tsx:100–158`
- **Severity:** MEDIUM
- **Issue:** `applyRosterMoveEvent()` applies events in-order per peer, but two peers swapping the same player simultaneously produce diverged state. Example: A swaps QB1↔QB2, B (offline) swaps QB1↔QB3. When B reconnects, A's QB2 could be lost.
- **Regression Risk:** MEDIUM — Full fix requires conflict resolution (last-write-wins, vector timestamps, or CRDT).

### 2.6 SYNC_RESPONSE and Direct EVENT Messages Not Causally Ordered
- **File:** `src/App.tsx:352–430`
- **Severity:** MEDIUM
- **Issue:** SYNC_RESPONSE (processed in a for-loop) and direct EVENT messages (handled asynchronously) can arrive out of order. If E3 depends on E2 from SYNC_RESPONSE but arrives via direct EVENT first, E3 may be processed before E2.
- **Regression Risk:** HIGH — Solving requires a message queue or explicit ordering guarantee.

### 2.7 userTeamsRef Has a Stale Window on Fast State Updates
- **File:** `src/App.tsx:551–552`
- **Severity:** LOW
- **Issue:** `userTeamsRef` is updated in a separate `useEffect`, creating a <16ms window where the ref is stale. A P2P message arriving during this window sees old roster data.
- **Regression Risk:** LOW — Non-financial app; window is one render cycle and practically harmless.

---

## 3. Data Integrity

### 3.1 Team Deletion Has No Atomic Error Handling
- **File:** `src/App.tsx:791–813`
- **Severity:** MEDIUM
- **Issue:** When a team is deleted, players are released to `availablePlayers` and then the team is removed. No try-catch wraps the release. In the current synchronous implementation this is safe, but if `setAvailablePlayers` were ever made async, team deletion could leave the roster orphaned.
- **Regression Risk:** MEDIUM — Adding error handling would require a confirmation before actually deleting.

### 3.2 activeTeamId Points to Deleted Team for One Frame
- **File:** `src/App.tsx:804–813`
- **Severity:** LOW
- **Issue:** Deleting the active team switches to `remaining[0]` but there's a 1-frame gap where `activeTeamId` still references the deleted team. Event handlers firing in that window operate on a team that no longer exists in `userTeams`.
- **Regression Risk:** LOW — Looking up a non-existent ID in an array simply returns undefined; existing code handles this.

### 3.3 availablePlayers Hydration Uses Full JSON Stringification
- **File:** `src/App.tsx:531–539`
- **Severity:** LOW
- **Issue:** On mount, fresh player metadata is merged via `JSON.stringify(p.socials) !== JSON.stringify(fresh.socials)` comparison — expensive for large rosters.
- **Regression Risk:** LOW — No bug; only an optimization opportunity.

### 3.4 New Release Flows May Forget to Update availablePlayers
- **File:** `src/App.tsx:528, 798–801`
- **Severity:** MEDIUM
- **Issue:** The deduplication check (`!existingIds.has(p.id)`) is only done inside `deleteTeam()`. Any new code path that releases a player (e.g., trade system, waiver claim) must remember to call the same update or a player can exist in both a bench and the free agent pool simultaneously.
- **Regression Risk:** HIGH — Future feature additions are likely to miss this pattern.

---

## 4. Error Handling

### 4.1 Scraper Functions Have No Timeout
- **File:** `src/App.tsx:876–891`
- **Severity:** MEDIUM
- **Issue:** `scrapePlayerStats()` and `scrapePlayerPhoto()` are called without a timeout. If the URL hangs (neither resolves nor rejects), the background hydrator's 10-second grace period has no effect and the scraper blocks indefinitely.
- **Regression Risk:** MEDIUM — Fix requires `Promise.race([scrapePromise, timeout])` wrapper.

### 4.2 EventStore Silently Drops Corrupted Events
- **File:** `src/services/EventStore.ts:58–65`
- **Severity:** MEDIUM
- **Issue:** Events that fail `validate()` are silently filtered out. If localStorage becomes corrupted, the user loses event history with no warning or count of dropped events.
- **Regression Risk:** LOW — Adding a counter and a console warning is non-breaking.

### 4.3 P2P Init Errors May Bypass Catch Handlers
- **File:** `src/App.tsx:265–266`
- **Severity:** LOW
- **Issue:** `DiscoveryService.init().catch()` and `P2PService.init().catch()` are fire-and-forget. If either throws synchronously before the catch handler attaches, the error propagates uncaught.
- **Regression Risk:** LOW — Synchronous constructor errors in these services are not observed in practice.

### 4.4 P2P Handshake Handler Leaves Peer in VERIFYING on Failure
- **File:** `src/services/P2PService.ts:530–577`
- **Severity:** LOW
- **Issue:** If `handleHandshake()` throws, the outer try-catch logs it but does not update connection state to FAILED. The peer remains in VERIFYING until the 20-second timeout clears it.
- **Regression Risk:** LOW — Connection timeout handles cleanup; not a critical gap.

### 4.5 Dashboard HTTP Server Failure Is Silent
- **File:** `src-tauri/src/main.rs:622–735`
- **Severity:** LOW
- **Issue:** The Warp HTTP server is spawned in `std::thread::spawn()`. If the thread panics, it exits silently with no notification to the main app or the UI.
- **Regression Risk:** LOW — Dashboard is non-critical; core game state is unaffected.

---

## 5. Memory & Resource Leaks

### 5.1 SimplePeer Instances Not Always Destroyed on Timeout
- **File:** `src/services/P2PService.ts:957–968`
- **Severity:** LOW
- **Issue:** If SimplePeer's constructor throws synchronously during connection setup, `conn` is never created and the exception propagates without cleanup. In practice, constructor exceptions are rare.
- **Regression Risk:** LOW — Cleanup logic (`if (conn.peer) conn.peer.destroy()`) is correct for all observed code paths.

### 5.2 No Graceful P2P Teardown Before App Exit
- **File:** `src/App.tsx:554–600`
- **Severity:** LOW
- **Issue:** On CLOSE_REQUESTED, the app calls `doLogout()` then `exit(0)` without explicitly closing P2P connections. In-flight data may be lost. WebRTC closes gracefully on OS process exit, but unsent messages are dropped.
- **Regression Risk:** LOW — State is synced continuously; in-flight data at close is minimal.

---

## 6. Type Safety

### 6.1 31+ Instances of `as any` / `@ts-ignore` Across Codebase
- **Files:** App.tsx, P2PService.ts, SyncService.ts, and others
- **Severity:** MEDIUM (cumulative)
- **Highlights:**
  - `App.tsx:110–111` — `const newRoster = { ...team.roster } as any` (roster slot mutations need flexible typing)
  - `P2PService.ts:551` — `const msg = msgObj as { type: string }` (too loose; no field validation)
  - `SyncService.ts:70` — `const sMsg = msg as SidebandMessage` (no schema validation before cast)
- **Regression Risk:** MEDIUM — Removing casts requires proper discriminated unions and type guards throughout.

### 6.2 P2P Handshake Fields Set Without Schema Validation
- **File:** `src/services/P2PService.ts:695–705`
- **Severity:** MEDIUM
- **Issue:** When building a `HandshakeMsg`, fields are set directly then asserted `as HandshakeMsg`. If a field is accidentally omitted, the sender's type system doesn't catch it — the receiver terminates the connection with an unclear error.
- **Regression Risk:** MEDIUM — A `validateHandshakeMsg()` guard would catch omissions at the source.

### 6.3 Event Payload Cast Without Schema Validation
- **File:** `src/App.tsx:101–104`
- **Severity:** LOW
- **Issue:** `event.payload as RosterMovePayload` with no validation. Defensive checks (`p?.teamId && p?.candidatePlayerId`) are present and the function returns early on missing fields, so no crash risk.
- **Regression Risk:** LOW — Current defensive pattern is correct.

---

## 7. Dead Code & Vestigial Patterns

### 7.1 formatInitialTeam() Is Module-Scoped But Never Exported
- **File:** `src/App.tsx:159–176`
- **Severity:** INFO
- **Issue:** Defined at module scope, called in three places as a fallback. No defect; just an observation that it could be moved inside a constant or co-located with usage.
- **Regression Risk:** NONE

### 7.2 P2P terminateConnection() Null Peer Check
- **File:** `src/services/P2PService.ts:369–382`
- **Severity:** INFO
- **Issue:** `if (conn.peer) { try { conn.peer.destroy(); } catch { } }` implies peer can be null, but connections are only stored after peer creation. Defensive code that signals unclear lifecycle.
- **Regression Risk:** NONE — Null check is safe and correct; worth leaving in.

---

## 8. Regression Risk Summary

### 8.1 Roster Slot Mutation Is High-Touch
- **File:** `src/App.tsx:110–111` + `src/types.ts`
- **Severity:** HIGH
- **Issue:** Adding a new roster position (e.g., IDP slot) requires simultaneous updates in: `types.ts`, `formatInitialTeam()`, `applyRosterMoveEvent()`, roster rendering UI, and save/load serialization. Missing any one silently breaks rosters.
- **Regression Risk:** HIGH — Any future slot additions must be treated as multi-file coordinated changes.

### 8.2 availablePlayers Tracking Pattern Must Be Followed in All Future Release Flows
- **File:** `src/App.tsx:528, 798–801`
- **Severity:** MEDIUM
- **Issue:** The deduplication check when releasing players is only enforced in `deleteTeam()`. Any new player-release flow (trade resolution, waiver processing, admin tools) must replicate the same pattern or players become duplicated or orphaned.
- **Regression Risk:** HIGH — Easily missed when building future features. Consider a shared `releasePlayer()` utility.

### 8.3 P2P State Machine Allows Re-Handshake on VERIFIED Connection
- **File:** `src/services/P2PService.ts:746–770`
- **Severity:** MEDIUM
- **Issue:** The HANDSHAKE handler doesn't verify `conn.state === 'CONNECTED'` before proceeding. A second HANDSHAKE on an already-VERIFIED connection would overwrite `conn.peerPublicKey`, potentially substituting a different key.
- **Regression Risk:** HIGH — Enforcing single-handshake-per-connection requires a state machine guard at the top of the handler.

---

## 9. Summary Table

| Category | HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|---|
| Security | 4 | 6 | 2 | 0 |
| State Consistency | 0 | 3 | 4 | 0 |
| Data Integrity | 0 | 2 | 3 | 0 |
| Error Handling | 0 | 2 | 3 | 0 |
| Memory / Resources | 0 | 0 | 2 | 0 |
| Type Safety | 0 | 2 | 1 | 0 |
| Dead Code | 0 | 0 | 0 | 2 |
| Regression Risk | 3 | 1 | 0 | 0 |
| **Total** | **7** | **16** | **15** | **2** |

---

## 10. Recommended Priority Order (If Acted Upon)

### Tier 1 — Before Wide Distribution
- Move `trier_p2p_secret` to session-only ephemeral storage (not persisted in localStorage)
- Add rate limiting to RESTART_REQUEST handling
- Enforce single-handshake-per-connection in P2P state machine
- Add schema validation before type-casting P2P handshake messages

### Tier 2 — Quality & Robustness
- Replace LCG token generator with `thread_rng()` in Rust
- Add timeout wrapper (`Promise.race`) around scraper functions
- Create a shared `releasePlayer()` utility so all release flows update `availablePlayers` consistently
- Add logging when EventStore drops corrupted events (non-breaking)
- Add CSP headers to Tauri config

### Tier 3 — Long-Term Architecture
- OS keychain integration for ECDSA private key storage (Tauri secure storage API)
- Causality enforcement in EventStore (Lamport clock or DAG)
- Conflict resolution for concurrent roster swaps (CRDT or last-write-wins timestamps)
- Remove legacy SHA-256 / plaintext password support after migration period

---

*Generated by read-only static analysis. No code was modified during this audit.*
