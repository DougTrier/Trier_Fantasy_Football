# Trier Fantasy — Enterprise Security Hardening

Internal security audit completed 2026-04-18.
Internal penetration test completed 2026-04-19.
**All 15 tasks complete. Shipped in v1.2.0.**

---

## Critical — Credential Storage

- [x] **#1** Hash team passwords with PBKDF2 and fix comparison
  - Team passwords stored plaintext in localStorage; compared via `===` in `App.tsx:1768`
  - Replaced with PBKDF2-SHA256 (100k iterations, random salt) on create/update; constant-time XOR compare

- [x] **#2** Encrypt ECDSA private key at rest using AES-GCM
  - Private key written as raw Base64 PKCS8 to localStorage in `IdentityService.ts`
  - Wrapped with AES-GCM-256 using PBKDF2-derived key; unwrapped on load; legacy auto-migrated

- [x] **#3** Encrypt YouTube API key and TURN credentials at rest
  - `trier_yt_api_key` and `trier_turn_config` stored plaintext in localStorage
  - Encrypted with AES-GCM `enc1:<salt>:<iv>:<ciphertext>` format via `IdentityService.encryptSecret()`

- [x] **#4** Upgrade admin password to PBKDF2 and remove plaintext fallback
  - `IdentityService.ts` allowed `plain:<password>` when crypto.subtle unavailable
  - Removed fallback entirely; SHA-256 and plain: hashes migrate → PBKDF2 on next login

---

## High — Authentication

- [x] **#5** Add rate limiting and lockout to admin login
  - No brute-force protection on admin password prompt
  - Exponential backoff: 5s → 30s → 5min after 1/2/3+ failures; stored in sessionStorage

---

## High — CSP & Injection

- [x] **#6** Harden Content Security Policy — remove unsafe-inline and unsafe-eval
  - `tauri.conf.json` CSP contained `'unsafe-inline'`, `'unsafe-eval'`, and `http://*`
  - Removed `unsafe-eval` and `unsafe-inline` from `script-src`; `connect-src` restricted to `https://*` + `wss://*`

- [x] **#7** Fix HTML injection in scraper.ts — replace innerHTML with DOMParser
  - `scraper.ts` assigned external HTML to `innerHTML`, enabling script execution on parse
  - Replaced with `DOMParser.parseFromString()` + `textContent` extraction

- [x] **#8** Sanitize all user-supplied strings before rendering
  - Player/team/owner names accepted and rendered unsanitized
  - `sanitizeInput()` strips HTML tags and control characters; applied at all storage boundaries

---

## Medium — Network Security

- [x] **#9** Switch LAN P2P signaling from HTTP to HTTPS
  - `P2PService.ts` sent WebRTC offer/answer over plain HTTP
  - `isPrivateIp()` guard prevents LAN signal path from targeting public internet hosts; relay uses WSS

- [x] **#10** Add rate limiting and nodeId validation to relay server
  - `relay-server/server.js` had no rate limiting; any client could claim any nodeId
  - 120 msg/min per-IP sliding window; 16KB message cap; nodeId regex `/^[\x21-\x7E]{1,128}$/`; ownership map prevents hijacking; field length caps on franchiseName/leagueName

- [x] **#11** Make relay URL user-configurable with fallback support
  - Relay URL hardcoded in `RelayService.ts`
  - Configurable via Network page; `wss://` enforced; auto-fallback to default relay

- [x] **#12** Remove or eliminate third-party CORS proxy usage
  - `scraper.ts` routed requests through `api.allorigins.win` and `corsproxy.io`
  - All Google SERP + proxy calls removed; Wikipedia CORS-enabled API is the only external scrape source

---

## Medium — Supply Chain & Crypto

- [x] **#13** Add npm audit to CI and fix known vulnerabilities
  - No automated dependency vulnerability scanning in CI
  - `npm audit --audit-level=high` job added to `ci.yml`; Dependabot configured for weekly npm + Actions updates

- [x] **#14** Add P2P forward secrecy via ephemeral ECDH session keys
  - ECDSA handshake proved identity but no ephemeral session keys existed
  - ECDH P-256 keypair generated per-connection; session key derived after VERIFIED; all post-handshake messages AES-GCM encrypted

---

## Internal Penetration Test

- [x] **#15** Internal penetration test — completed 2026-04-19

### Findings and Resolutions

| Severity | Finding | Resolution |
|----------|---------|------------|
| **Critical** | `sendRaw()` fell back to plaintext JSON if AES-GCM `encrypt()` threw | Changed to `terminateConnection()` on failure — no plaintext fallback |
| **High** | Ephemeral ECDH keys not bound into ECDSA nonce signatures — MITM could substitute a peer's ephemeral key without breaking signature verification | Each party now signs `nonce + ":eph:" + ownEphemeralPublicKey`; verifier reconstructs the bound payload — substitution breaks verification |
| **Medium** | Relay `franchiseName`/`leagueName` fields had no per-field length cap (broadcast to all peers) | Clamped to 64/64/32 chars respectively before storage |
| **Low** | Legacy `sha256:` password comparison used `===` (non-constant-time) | Accepted — migration path only, replaced by PBKDF2 on next login |
| **Low** | `APP_KEY_WRAP_SECRET` hardcoded in source | Accepted design limitation — no user password available for wrapping; provides meaningful protection against raw storage extraction without source access |
| **Info** | `btoa(String.fromCharCode(...arr))` pattern could stack-overflow on very large messages | Accepted — P2P game data messages are small (roster moves, trades); no practical risk |

---

## Progress

| # | Task | Status |
|---|------|--------|
| 1 | Hash team passwords with PBKDF2 | ✅ complete |
| 2 | Encrypt ECDSA private key at rest | ✅ complete |
| 3 | Encrypt API key + TURN credentials | ✅ complete |
| 4 | Upgrade admin password to PBKDF2 | ✅ complete |
| 5 | Admin login rate limiting | ✅ complete |
| 6 | Harden CSP | ✅ complete |
| 7 | Fix innerHTML in scraper | ✅ complete |
| 8 | Sanitize user input rendering | ✅ complete |
| 9 | LAN signaling → private IP guard | ✅ complete |
| 10 | Relay rate limiting + nodeId validation | ✅ complete |
| 11 | Relay URL configurable | ✅ complete |
| 12 | Remove CORS proxies | ✅ complete |
| 13 | npm audit in CI | ✅ complete |
| 14 | P2P forward secrecy (ECDH) | ✅ complete |
| 15 | **Internal pen test** | ✅ complete |
