# Game-Day Locking

Applies to Trier Fantasy Football 3.3.2 and later.

## Before kickoff

1. Open the app while online so it can load the NFL schedule.
2. The commissioner can open **Settings → Commissioner Center → LOG IN**, then choose **LIVE SCHEDULE** to refresh and verify the current lock list.
3. Check the roster's locked-team count and player badges. Manual restrictions are optional additions to automatic game locks.

## Automatic and manual locks

| Lock type | How it starts | How it clears |
|---|---|---|
| Automatic | ESPN reports a game in progress, or a cached scheduled kickoff time is reached | A successful schedule refresh updates the game status; finished games no longer contribute automatic locks |
| Manual | A logged-in commissioner uses **LOCK ALL** or an individual team toggle | The commissioner clears that team's manual lock or chooses **CLEAR MANUAL LOCKS** |

The app uses both lists together. Clearing manual locks cannot remove an automatic lock for an active game. A team controlled solely by an automatic lock has a disabled manual toggle until that game ends. Tray and commissioner-dashboard lock actions also require the commissioner to remain logged in to the app.

Manual restrictions and the last successful schedule survive restarts. Existing lock lists from earlier versions are retained as manual locks on first upgrade; review and clear any that are no longer needed.

## Refreshes and outages

- The schedule refreshes immediately when the app opens, then every 60 seconds on every day of the week.
- Cached kickoff times are checked locally, including between network requests. Returning focus to the app also refreshes the view and schedule.
- Failed requests and malformed responses retain the previous schedule and locks. **LIVE SCHEDULE** reports a failure without clearing them.
- The app must have loaded a game's schedule to enforce its kickoff during an outage. It cannot discover a new or rescheduled game without a successful refresh.
- During an outage, a game may remain locked after it has finished until the schedule can be refreshed successfully.

## Peer synchronization

Incoming roster moves are checked against the receiving app's roster and current locks before entering its event log. Full-team snapshots are also checked so they cannot relocate or remove an already-known locked player. Signature validation and duplicate-event checks still apply.

These checks use the receiver's current state. A move rejected while a player is locked is not applied merely because another peer sent it. This is not a centralized league authority or a reconstruction of historical lock state.

## GitHub reminders

The daily workflow checks for games scheduled within the next 24 hours. It groups upcoming games by their Eastern calendar date, labels kickoff times with the correct daylight-saving offset, skips games that have already started, and searches both open and closed reminders before creating an advisory for that date.

GitHub Actions can run late. The reminder is an advisory, not the mechanism that locks players. GitHub cannot inspect your local app or confirm that the commissioner took an action. Close a reminder after reviewing it; the app continues enforcing locks independently.

## Implementation and regression checks

- `src/services/GameLockStore.ts`: separate persistent manual locks and schedule snapshots.
- `src/hooks/useGameLocks.ts`: request handling, polling, kickoff timers, and commissioner control guard.
- `src/utils/gamedayLogic.ts`: scoreboard parsing and time-based lock calculation.
- `src/utils/rosterMoves.ts`: roster-event and full-snapshot validation.
- `scripts/gameday_reminder.mjs`: reminder filtering, labels, and deduplication.
- `tests/unit/gameLockStore.test.ts`, `rosterMoves.test.ts`, and `gamedayReminder.test.ts`: focused unit coverage.
- `tests/e2e/18_gameday_locks.spec.ts` and `08_admin_commissioner.spec.ts`: browser permission, login, persistence, outage, and kickoff checks.
