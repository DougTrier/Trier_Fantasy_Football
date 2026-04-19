# Trier Fantasy Football — Code Stats

**Version:** v3.3.0  
**Last Updated:** 2026-04-19  
**Project Started:** 2026-04-14  

---

## Source Code Summary

| Metric | Count |
|---|---|
| TypeScript / TSX files | 76 |
| Rust files | 2 |
| Total TS/TSX lines | 25,390 |
| Total Rust lines | 861 |
| Relay server (JS) | 328 |
| **Total application code** | **~26,579 lines** |

---

## Code Composition (TS/TSX)

| Metric | Count |
|---|---|
| Code lines | 21,924 |
| Comment lines | 1,382 |
| Blank lines | 2,084 |
| **Comment density** | **~5.4%** |

---

## Architecture Breakdown

| Layer | Files | Notes |
|---|---|---|
| React components | 40 | `.tsx` files in `/src/components` |
| Services | 14 | P2P, Identity, Scoreboard, Relay, etc. |
| Utilities | 13 | ScoringEngine, H2HEngine, EventStore, etc. |
| Exported types / interfaces | 112 | Across all files |
| Exported functions / constants | 113 | |

---

## React Internals

| Metric | Count |
|---|---|
| Hook usages (useState / useEffect / useCallback / useMemo / useRef) | 383 |
| React functional components (React.FC) | 67 |
| Singleton service objects | 15 |

---

## Largest Files

| File | Lines |
|---|---|
| `src/App.tsx` | 2,359 |
| `src/services/P2PService.ts` | 1,185 |
| `src/components/DraftSimulator.tsx` | 982 |
| `src/components/SettingsPage.tsx` | 860 |
| `src/components/WaiverPage.tsx` | 806 |
| `src/components/Layout_Dashboard.tsx` | 788 |
| `src-tauri/src/main.rs` | 771 |
| `src/components/FieldGoalKicker.tsx` | 680 |
| `src/components/Roster.tsx` | 669 |
| `src/components/LeagueTable.tsx` | 651 |
| `src/components/SchedulePage.tsx` | 624 |
| `src/services/IdentityService.ts` | 587 |
| `src/components/player/CardBackFace.tsx` | 584 |
| `src/components/H2HPage.tsx` | 552 |
| `src/services/ScoreboardService.ts` | 529 |

---

## Data & Assets

| Asset | Size |
|---|---|
| Player pool JSON (`all_players_pool.json`) | 391,877 lines |
| Public assets | 2,636 files |
| Screenshots (`docs/screenshots/`) | 9 files |
| Total project size (excl. node_modules / target) | ~1.3 GB |

---

## Git History

| Metric | Value |
|---|---|
| Total commits | 89 |
| Project started | 2026-04-14 |
| Latest commit | 2026-04-19 |
| Current version | v3.3.0 |
| Days of development | 5 |

---

## Tech Stack Reference

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v1 (Rust) |
| Frontend | React 19 + TypeScript |
| Bundler | Vite |
| P2P transport | WebRTC via simple-peer |
| Peer authentication | ECDSA P-256 (Web Crypto API) |
| Session encryption | ECDH P-256 → AES-GCM-256 per connection |
| Password hashing | PBKDF2-SHA256, 100k iterations |
| Secret storage | AES-GCM-256 encrypted localStorage |
| Peer discovery | Rust mDNS (Tauri invoke) |
| Internet discovery | WebSocket relay + DHT (Trystero) |
| Local tab sync | BroadcastChannel |
| Animations | Framer Motion |
| CI | GitHub Actions — typecheck, lint, security audit, E2E tests |

---

*Generated 2026-04-19 · Trier Fantasy Football v3.3.0*
