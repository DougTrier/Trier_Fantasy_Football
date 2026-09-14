# Trier Fantasy Football — Roadmap

All v1.0.0 features are complete. See git log for history.

## Completed in v3.3.2

- [x] Automatic schedule refresh on every day, including Thursday and Saturday games.
- [x] Kickoff timers, persistent manual locks, and lock preservation during API outages.
- [x] Commissioner-only manual controls and lock validation for incoming roster changes.
- [x] Schedule-aware, deduplicated GitHub reminders; historical reminder issues #15–#24 closed.
- [x] Regression coverage: 92 unit tests and 16 targeted browser tests pass.

See [CHANGELOG.md](CHANGELOG.md) and the [locking guide](docs/gameday-locking.md).

## Post-v1.0 Ideas

- **Kicker FG miss penalty** — add `-1 pt` for missed field goals (currently only missed XP is penalized).
- **D/ST sack yardage bonus** — some leagues award bonus points for sacks > 3 in a game.
- **Mobile companion view** — read-only roster/standings for phones (Tauri mobile target).
- **Push notifications** — trade offer alerts when peer is offline at time of offer.
- **Historical season browser** — UI to browse `src/data/archive/` past seasons.
