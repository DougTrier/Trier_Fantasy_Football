# Changelog

## 3.3.2 — 2026-09-14

### Fixed

- Restricted manual game-lock controls to logged-in commissioners, including tray and dashboard actions.
- Separated manual locks from live-game locks so schedule refreshes cannot erase commissioner restrictions.
- Preserved the last successful schedule and existing locks when requests fail or return malformed data.
- Added cached kickoff-time enforcement and schedule polling every 60 seconds on every day, including sessions crossing midnight.
- Validated incoming roster moves before adding them to the event log, and checked full-team snapshots against receiver-side locks.
- Added direct lock checks to player recruitment, release, and trade acceptance paths.
- Replaced repeated kickoff reminders with date-specific advisories based on upcoming NFL games. Existing open and closed advisories prevent duplicate reminders.

### Changed

- Renamed **UNLOCK ALL** to **CLEAR MANUAL LOCKS**. Live-game locks continue to follow the schedule.
- Updated the README, roadmap, task status, contributor instructions, security follow-up, game-day guide, and in-app Rules & Info.
- Included the latest player-pool and statistics data from `master`.
- Synchronized npm, Cargo, installer, and displayed application versions. Build-info generation now reads `package.json`.
- Applied compatible dependency updates; the high-severity npm audit gate passes. Six low-severity browser crypto polyfill findings remain.

### Validation

- 92 unit tests and 16 targeted browser tests passed after the dependency update.
- TypeScript checks, lint, and the production frontend build passed.
- Windows release packaging produces MSI and EXE setup installers through the tagged GitHub workflow.

Older release history is available in [GitHub Releases](https://github.com/DougTrier/Trier_Fantasy_Football/releases) and the repository commit history.
