# Trier Fantasy Football — Task Backlog

## In Progress

- [x] ECDSA P-256 mutual authentication handshake (3-message, VERIFIED gating)
- [x] League chat (trash talk window on League page — P2P + BroadcastChannel)
- [x] Polished README with screenshots and YouTube demos

---

## High Priority

### Global P2P — Relay Signaling Server ✅
- [x] Build a lightweight WebSocket relay server (Node.js + ws, deployed on Railway)
- [x] Lobby system: peers self-register with league/region metadata, LIST returns grouped view
- [x] Relay brokers WebRTC offer/answer only — game data stays P2P after handshake
- [x] RelayService.ts client: connect/disconnect, heartbeat, peer discovery bridge to DiscoveryService
- [x] P2PService relay hooks: `addRelayPeer()`, `setRelaySender()`, signal routing bifurcation
- [x] Global Network panel on NetworkPage: status, online count, connect/disconnect, lobby list
- [x] TURN server config UI on Network page (URL/username/credential, stored in localStorage)
- [x] P2P version negotiation: peers agree on min(our_version, their_version), reject below MIN_PROTOCOL_VERSION

### EventStore Persistence ✅
- [x] Hydrate EventStore from localStorage on app start (currently starts empty each session)
- [x] Flush EventStore to localStorage on each `add()` call
- [x] Cap stored events at a reasonable limit (e.g. last 500 per node)

### Security ✅
- [x] Hash the admin password (currently stored plaintext in localStorage as `adminPassword`)
- [x] Rotate node keypair option (for "lost device" recovery)

---

## Medium Priority

### Trade Center ✅
- [x] Validate points balance before accepting a trade offer (shows escrow status in confirmation)
- [x] Confirmation dialog on ACCEPT (show player name, points received, buyer balance check)
- [x] Dispute resolution / commissioner override (FORCE ACCEPT / FORCE CANCEL in admin panel)

### Real Video Integration ✅
- [x] Wire `VideoPipelineService` to real YouTube Data API v3 (`trier_yt_api_key` in localStorage)
- [x] Replace `MockSearchRunner` with `SearchRunner` (real API when key present, mock fallback)
- [x] Twitter/X: embed-from-URL mock (X API requires paid tier; documented limitation)

### Game Day Locking ✅
- [x] UI control in SettingsPage Commissioner Center — all 32 NFL team toggles (admin-only)
- [x] ESPN public scoreboard API auto-fetch (`fetchLiveLockedTeams`) wired to LIVE SCHEDULE button
- [x] Lock state persisted to localStorage; existing executeSwap validation enforces locks

---

## Low Priority / Future

### Delta Sync via EventStore ✅
- [x] Implement `getEventsSince(vector)` for efficient peer sync (send only missing events)
- [x] `SYNC_REQ` / `SYNC_RESP` message flow on VERIFIED connect

### UI Polish ✅
- [x] Animate new chat messages sliding in (Framer Motion)
- [x] Toast notifications for incoming chat messages when not on League page
- [x] Player card shake/bounce animation on game day lock attempt

### Infrastructure ✅
- [x] CI pipeline (GitHub Actions: typecheck + lint on PR)
- [x] Auto-build release with `tauri build` on tag push

---

## Security Hardening

### P2P Event Integrity ✅
- [x] Verify event signatures on ingest — `EventStore.validate()` currently only checks presence; wire in `IdentityService.verifySignature()` against a peer key registry
- [x] Build `knownPeerKeys` registry in `P2PService` — populated at VERIFIED, keyed by `nodeId → publicKey`
- [x] Reject `unsigned` events — abort `executeSwap` broadcast if signing fails; refuse events with `signature === 'unsigned'` in EventStore
- [x] Cap inbound SYNC_RESPONSE batch at 500 events before processing

### Admin / Credential Security ✅
- [x] Remove hardcoded default admin password (`'Elliot126d9u2'`) — force first-run setup prompt if no password is set
- [x] Warn and re-hash any `plain:` stored passwords on app start (can persist from HTTP dev sessions)

---

## Architecture Notes

### Why the relay doesn't compromise local-first
The relay only sees WebRTC offer/answer packets (a few hundred bytes). Once the
WebRTC data channel opens, the relay is out of the picture. All game data — roster
moves, scores, event log — flows peer-to-peer and never touches the relay.

### Version compatibility strategy
`PROTOCOL_VERSION` bumps on breaking wire-format changes. The handshake should
negotiate: "I support [1,2], you support [1], let's use 1." Peers on incompatible
versions log a clear warning and decline gracefully instead of hard-terminating.
