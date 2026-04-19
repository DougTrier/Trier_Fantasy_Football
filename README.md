<div align="center">

# Trier Fantasy Football

**A local-first, peer-to-peer fantasy football manager — built for real commissioners who don't need the cloud.**

[![Latest Release](https://img.shields.io/github/v/release/DougTrier/Trier_Fantasy_Football?label=version&color=gold)](https://github.com/DougTrier/Trier_Fantasy_Football/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/DougTrier/Trier_Fantasy_Football/ci.yml?label=CI)](https://github.com/DougTrier/Trier_Fantasy_Football/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[![Watch the Demo](https://img.youtube.com/vi/M6KrnePOt8s/maxresdefault.jpg)](https://youtu.be/M6KrnePOt8s)

*Click to watch the full demo on YouTube*

</div>

---

## What It Is

Trier Fantasy Football is a desktop fantasy football application built with **Tauri + React + TypeScript**. It runs entirely on your local network — no accounts, no cloud, no subscriptions. Peers find each other via **LAN mDNS**, authenticate via **ECDSA P-256 mutual handshake**, and sync roster state directly over **WebRTC data channels**.

This is not a wrapper around ESPN or Yahoo. It is a fully self-contained league management system with enterprise-grade security.

---

## Screenshots

<table>
  <tr>
    <td align="center">
      <img src="docs/screenshots/players.jpg" width="420" alt="Players Page"/>
      <br/><sub><b>Players & Free Agent Pool</b></sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/draft-simulator.jpg" width="420" alt="Draft Simulator"/>
      <br/><sub><b>Draft Simulator</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/screenshots/trade-center.jpg" width="420" alt="Trade Center"/>
      <br/><sub><b>Trade Center</b></sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/waiver-wire.jpg" width="420" alt="Waiver Wire"/>
      <br/><sub><b>Waiver Wire & FAAB Bidding</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/screenshots/projections.jpg" width="420" alt="Season Projections"/>
      <br/><sub><b>Season Projections Dashboard</b></sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/settings.jpg" width="420" alt="Settings & Franchise Management"/>
      <br/><sub><b>Settings & Franchise Management</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/screenshots/rules-and-info.jpg" width="420" alt="Rules & Info"/>
      <br/><sub><b>Rules, Info & Getting Started Guide</b></sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/head-to-head.jpg" width="420" alt="Head to Head"/>
      <br/><sub><b>Head to Head Matchup</b></sub>
    </td>
  </tr>
</table>

---

## Card Flip Animation

[![Card Flip](https://img.youtube.com/vi/iq3YG__1Euk/maxresdefault.jpg)](https://youtu.be/iq3YG__1Euk)

*Player cards feature a tactile 3D flip animation — click to see it in action.*

---

## Features

### League Management
- Full roster management with starting lineup and bench slots
- League standings, head-to-head matchup analysis with 0–100 advantage scoring
- Trade center with Production Points economy and escrow protection
- Waiver wire with sealed FAAB bidding — processes every Tuesday at 2AM
- Commissioner admin mode with password-protected controls and game day lock overrides
- Encrypted `.tff` backup files — export and import your entire league
- Dynasty mode with keeper tracking, contract years, and draft pick trading

### Local-First P2P Networking
- **LAN peer discovery** via Rust-backed mDNS — peers appear automatically on the same network
- **Internet play** via WebSocket relay server + DHT (Trystero) fallback
- **Invite codes** for cross-network play — generate a code, share it out-of-band
- **ECDSA P-256 mutual authentication** — every peer connection goes through a 3-message cryptographic handshake before any game data flows
- **Forward-secret session encryption** — ephemeral ECDH P-256 key exchange derives a per-connection AES-GCM-256 session key; compromising long-term identity keys cannot expose past sessions
- **Deterministic event log** — every roster move is signed, deduplicated, and replayed identically on all peers

### Security (v3.3.0)
- **PBKDF2-SHA256** password hashing (100,000 iterations, random salt) — team and commissioner passwords
- **CSPRNG session tokens** — commissioner dashboard token uses OS cryptographic RNG via `rand::thread_rng()`
- **AES-GCM-256 encryption at rest** — ECDSA private key, YouTube API key, and TURN credentials encrypted in localStorage
- **Session-only secrets** — P2P restart secret lives in memory only, never written to localStorage
- **Schema-validated P2P messages** — type guards verify all handshake fields before processing; malformed messages terminate the connection
- **Single-handshake enforcement** — re-HANDSHAKE on a verified connection is rejected, preventing public key substitution
- **No plaintext encryption fallback** — ECDH session key derivation failure terminates the connection rather than downgrading to plaintext
- **Hardened Content Security Policy** — `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` prevent clickjacking and plugin injection
- **Input sanitization** — all user-supplied strings stripped of HTML and control characters before storage
- **Admin brute-force protection** — exponential backoff (5s → 30s → 5min) after failed login attempts
- **Relay rate limiting** — 120 messages/min per IP, 16KB message cap, nodeId ownership validation
- Full security audit documented in [Code Audit.md](Code%20Audit.md)

### Player Research & Scouting
- 1,000+ player database with projected points, ADP, combine metrics, and career stats
- Player trading cards with 3D flip animation revealing detailed stats and bio
- Scouting report modal with written intelligence and video highlights
- Multi-tier YouTube video pipeline — finds game film and highlights per player automatically
- Head-to-head matchup engine: projected points, season PPG trend, and performance differential
- Season projections dashboard with projected vs actual comparison

### Anti-Cheat
- **Game day locking** — players on active NFL teams cannot be moved in or out of starting lineups while their game is in progress
- Commissioner can lock teams manually or auto-fetch the live NFL schedule

### NFL Data Pipeline
- Automated GitHub Actions pipeline refreshes player pool and live stats weekly via Sleeper API
- Scoring engine validates data provenance — only `VALIDATED` status stats count toward fantasy points

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri](https://tauri.app) v1 (Rust) |
| Frontend | React 19 + TypeScript |
| Bundler | Vite |
| P2P Transport | WebRTC via [simple-peer](https://github.com/feross/simple-peer) |
| Peer Authentication | ECDSA P-256 (Web Crypto API) |
| Session Encryption | ECDH P-256 → AES-GCM-256 per connection |
| Password Hashing | PBKDF2-SHA256, 100k iterations |
| Secret Storage | AES-GCM-256 encrypted localStorage |
| Peer Discovery | Rust mDNS (Tauri invoke) |
| Internet Discovery | WebSocket relay + DHT (Trystero) |
| Local tab sync | BroadcastChannel |
| Animations | Framer Motion |
| CI | GitHub Actions — typecheck, lint, security audit, E2E tests |

---

## Architecture

### Connection State Machine
```
IDLE → REQUESTING → NEGOTIATING → CONNECTED → VERIFYING → VERIFIED
```

`CONNECTED` means the WebRTC transport is open. No game data flows until `VERIFIED`.

### 3-Message Handshake (Mutual Auth + Forward Secrecy)
```
Initiator → Responder : HANDSHAKE          { publicKey, nonce_A, ephemeralPublicKey_A }
Responder → Initiator : HANDSHAKE_ACK      { publicKey, sign(nonce_A + ephKey_B), nonce_B, ephemeralPublicKey_B }
Initiator → Responder : HANDSHAKE_COMPLETE { sign(nonce_B + ephKey_A) }
```
Both sides verify the other's ECDSA signature before the connection is trusted. Ephemeral keys are bound into the signed payloads to prevent key substitution attacks. After `VERIFIED`, both peers independently derive the same AES-GCM-256 session key via ECDH — all subsequent messages are encrypted.

### Event System
Every roster mutation is represented as a signed `EventLogEntry` — not a raw state mutation. Peers exchange events, not snapshots. The `applyRosterMoveEvent()` function is a pure transformer: same event in → same state out, on every peer.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Development
```bash
npm install
npm run tauri dev
```

### Build
```bash
npm run tauri build
```

> **Note:** P2P networking requires the Tauri desktop build. Running as a plain browser (`npm run dev`) disables Discovery and P2P — the UI still works in that mode for roster and UI testing.

### First Run
1. Launch the app — a **Default Team** is pre-loaded with no password required.
2. Go to **Settings** and click the **Commissioner Mode** toggle. On first run it will prompt you to create your commissioner password.
3. Use **Settings → Manage Franchises → ADD FRANCHISE** to create teams for each league member.
4. Delete the Default Team once all real franchises are set up — its players return to the free agent pool automatically.
5. Other league members connect via the **Network** page (LAN auto-discovers; internet uses the relay).

---

## Project Structure

```
src/
  services/
    IdentityService.ts      — ECDSA keypair, PBKDF2 passwords, AES-GCM secret storage
    P2PService.ts           — WebRTC transport, mutual auth, ECDH session encryption
    DiscoveryService.ts     — LAN mDNS peer discovery + invite codes
    RelayService.ts         — WebSocket relay for internet peer discovery
    DHTService.ts           — DHT fallback (Trystero) for peer discovery
    EventStore.ts           — Append-only canonical event log
    VideoPipelineService.ts — Multi-tier YouTube video search for scouting
  utils/
    SyncService.ts          — Sideband sync (BroadcastChannel + P2P broadcast)
    gamedayLogic.ts         — Game day locking rules
    ScoringEngine.ts        — Live stat validation and fantasy point calculation
    H2HEngine.ts            — Head-to-head advantage scoring algorithm
  types/
    P2P.ts                  — Wire protocol types, handshake messages, constants
  components/
    NetworkPage.tsx          — P2P connection UI
    Layout_Dashboard.tsx     — Main app shell and navigation
    LeagueTable.tsx          — Standings, H2H, and league chat
    ScoutingReportModal.tsx  — Player intelligence and video highlights
relay-server/
  server.js                 — WebSocket signaling relay (deploy to Railway/Render)
```

---

## Security

A full enterprise security audit was completed in v3.3.0 covering authentication, P2P trust, cryptographic key management, session security, input validation, and CSP hardening. See [Code Audit.md](Code%20Audit.md) for the complete audit log with severity ratings and regression risk analysis.

To report a vulnerability, open a GitHub issue marked `[SECURITY]`.

---

## Support the Project

Trier Fantasy Football is built and maintained for free. If you find it useful, any support goes a long way:

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-GitHub-black?logo=github)](https://github.com/sponsors/DougTrier)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-☕-orange)](https://buymeacoffee.com/dougtrier)

---

## License

MIT © 2026 Doug Trier

*"Trier OS" and "Trier Fantasy Football" are trademarks of Doug Trier.*

---

<div align="center">
  <sub>A Trier OS product · Built with Tauri, React, and WebRTC · Free and open source</sub>
</div>
