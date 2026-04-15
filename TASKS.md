# Trier Fantasy Football — Roadmap

All v1.0.0 features are complete. See git log for history.

## Post-v1.0 Ideas

- **Thursday Night Football auto-lock** — wire `fetchLiveLockedTeams()` to a scheduled
  pull so the commissioner doesn't need to remember TNF locks manually.
- **Kicker FG miss penalty** — add `-1 pt` for missed field goals (currently only missed XP is penalized).
- **D/ST sack yardage bonus** — some leagues award bonus points for sacks > 3 in a game.
- **Mobile companion view** — read-only roster/standings for phones (Tauri mobile target).
- **Push notifications** — trade offer alerts when peer is offline at time of offer.
- **Historical season browser** — UI to browse `src/data/archive/` past seasons.
