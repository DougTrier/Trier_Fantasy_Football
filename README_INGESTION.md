
# Data Ingestion System (Bears Pilot)

This system replaces the manual mock data with real-world roster data from ESPN's hidden API.

## Architecture

1.  **Source**: ESPN API (`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{TEAM_ID}/roster`)
    *   Provides high-quality JSON data including IDs, Headshots, Physics, and Active Status.
    *   Prioritizes JSON over HTML scraping for resilience.

2.  **Ingestion Script**: `scripts/ingest_roster.js`
    *   Fetches data from the source.
    *   Normalizes it into our **Canonical Data Model** (`CanonicalPlayer` in `src/types/Ingestion.ts`).
    *   Maps raw position names ("Cornerback") to abbreviations ("DB").
    *   Saves the result to `src/data/rosters/CHI.json`.

3.  **Application Integration**: `src/data/mockDB.ts`
    *   Imports the JSON file directly.
    *   Merges it with the legacy mock database.
    *   Overrides any fake players with the same Team ID.

## Canonical Data Model

Located in `src/types/Ingestion.ts`, the model ensures we only store what matters:
- `sourceId`: Persistent ID from ESPN.
- `position`: Normalized (QB, RB, WR, TE, OL, DL, DB, LB, K, P, LS).
- `headshotUrl`: High-res PNG.
- `isActive`: Boolean flag.

## How to Scale

To add another team (e.g., Green Bay Packers):

1.  Find the Team ID (Packers = 9).
2.  Run the script with the new ID:
    *   Modify `TEAM_ID` in `scripts/ingest_roster.js` (or parameterize it).
3.  Add `GB.json` import to `mockDB.ts`.

## Validation
The system currently includes basic validation:
- Checks for HTTP 200 OK.
- Parses JSON safely.
- Filters out non-active players (optional, currently importing all active).
- Maps unknown positions to 'UNKNOWN' but robustly handles all standard NFL positions.
