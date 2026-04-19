# Trier Fantasy Football — Product Roadmap

> Last updated: 2026-04-19  
> Current release: v2.0.0-dev

This roadmap is organized into four phases based on complexity and dependency order.
Items marked **[Partial]** have architecture already in place — they just need completion.

---

## Phase 1 — Complete What's Started ✅ DONE
*Shipped: v1.3.0*

### 1.1 WAN Invite Codes — Full Flow Polish ✅
- ✅ QR code generation (qrcode.react QRCodeSVG, 180px)
- ✅ Expiry countdown displayed on the invite modal (10-min TTL with live timer)
- ✅ Better error messaging when a code is stale or already redeemed
- ⏭ Deep-link support (`trierfantasy://join/<code>`) — deferred; requires OS URL scheme registration

### 1.2 Live Schedule Auto-Locking ✅
- ✅ Hourly gameday polling via useEffect (Sun/Mon/Thu only)
- ✅ System tray notification when teams lock
- ✅ Game status string on locked player badges ("LOCKED · Q3 7:42")

### 1.3 System Tray Integration ✅
- ✅ Badge count for pending trade offers (update_tray_badge command)
- ✅ Notification when a peer connects or disconnects
- ✅ Lock All / Unlock All actions from tray menu on gameday

---

## Phase 2 — Core Feature Expansion ✅ DONE
*Shipped: v1.4.0*

Significant new features that build directly on the existing architecture.

### 2.1 NFL Intelligence Panel ✅
*Shipped: v1.4.0*
- ✅ `ScoreboardService.ts` — ESPN standings + scoreboard APIs, subscriber pattern, 60s polling
- ✅ AFC/NFC vertical columns with team logos, W-L records, live score badges, pulse animation
- ✅ Division headers: neon red (AFC) / neon blue (NFC) with dark pill for readability
- ✅ `TeamSnapshotPanel` — last game result, next game, "View on NFL.com" button
- ✅ Columns sized to match League Standings panel height exactly
- ✅ Scoreboard strip — 3-column game cards with live scores, quarter, dark overlay
- ✅ Game detail modal — box score, scoring plays, ESPN deep link
- ✅ Fantasy dot indicators on standing rows (green = scoring now, yellow = pregame)
- ✅ `ScoringTicker` — bottom scrolling strip with live scores + scoring/big play/red zone events

### 2.1.1 Sidebar Responsive Scaling ✅
- ✅ `zoom: sidebarScale` on `<aside>` — proportional to window height, clamped 0.72–1.0
- ✅ Nav items use leather_texture.png on hover and active state
- ✅ No-scroll layout — margins/gaps tightened so all items fit without overflow
- ✅ Football image sized to fill sidebar without crowding nav

### 2.2 Draft Simulator ✅
*Shipped: v1.4.0*
- ✅ Snake draft with configurable number of teams (2–16)
- ✅ AI auto-pick opponents that follow ADP with positional need awareness
- ✅ Live pick clock with configurable timer (Off / 30s / 60s / 90s)
- ✅ Draft board view showing all picks by round and team
- ✅ Auto-save draft results directly to a new FantasyTeam (Real Draft mode)
- ✅ Mock draft mode (no consequences — just practice)
- ✅ Results screen with draft grade (A+→C) based on projected points
- ✅ HOW TO USE help overlay
- ✅ Auto-fills team/owner name from logged-in user
- ✅ Responsive zoom scaling with window size

### 2.4 Waiver Wire ✅
*Shipped: v1.4.0*
- ✅ FAAB (Free Agent Acquisition Budget) waiver model — each team starts with $100, bids blind
- ✅ Priority waiver fallback — $0 bid uses waiver priority order
- ✅ Weekly waiver processing window (Tuesday 02:00 AM countdown timer)
- ✅ Commissioner can override and force-process waivers at any time
- ✅ Waiver history log per team (transaction log entries)
- ✅ Rolling waiver priority — winner drops to bottom of order
- ✅ Optional drop player on claim submission
- ✅ HOW TO USE help overlay

### 2.5 Head-to-Head Weekly Schedule ✅
*Shipped: v1.4.0*
- ✅ Commissioner generates a full-season schedule (14 or 16 regular-season weeks)
- ✅ Each week shows your matchup opponent and score differential
- ✅ Win/loss/tie record tracked on each FantasyTeam
- ✅ Playoff bracket (top 4 teams by record, weeks 15–17)
- ✅ Tiebreaker: total points scored
- ✅ Merged into Head to Head page as Scout / This Week / My Schedule / Standings / Playoffs tabs
- ✅ Commissioner score overrides before completing a week
- ✅ League schedule persists to localStorage

### 2.6 Trade Analyzer ✅
*Shipped: v1.4.0*
- ✅ Fairness score badge (GREAT/FAIR/LOW) on every incoming offer — PPG vs 4-week value benchmark
- ✅ Fairness detail row showing PPG, 4-wk value, and % of value offered
- ✅ Counter Offer modal — seller proposes a new price, updates buyer's offer in place
- ✅ League Trade History panel — all TRADE_ACCEPT entries across every team
- ✅ No veto system — market self-regulates

### 2.7 Push Notifications (Tauri Native) ✅
*Shipped: v1.4.0*
- ✅ Trade offer received
- ✅ Trade offer accepted or declined
- ✅ Peer connection established
- ✅ Gameday lock triggered
- ✅ Configurable per-event in Settings (toggle panel in SettingsPage)

---

## Phase 3 — Analytics & Intelligence
*Target: v1.6.x – v1.8.x — 4–8 months*

Deeper data features that make Trier stand out as a research platform.

### 3.1 Season Projections Dashboard ✅
- ✅ Position filter tabs (ALL / QB / RB / WR / TE / K / DST)
- ✅ Sortable rankings table — projected, actual, diff, inline bar, boom/bust badge
- ✅ Projected vs Actual scatter chart — colored by position, diagonal breakeven line
- ✅ Avg points by position bar chart (projected gold vs actual green)
- ✅ Recharts installed for chart rendering

### 3.2 Waiver Wire Intelligence ✅
- ✅ INTEL tab in Waiver Wire — toggles from list view to intelligence panel
- ✅ AI Top Picks — composite score (projected pts × boom bonus × ownership %)
- ✅ Handcuff Targets — free agent RBs on same NFL team as user's rostered RBs
- ✅ Trending Now — free agents ranked by platform ownership % with inline bar
- ⏭ Injury report integration — requires Sleeper API pipeline extension (deferred)

### 3.3 IDP Full Mode ✅
- ✅ Optional lb/dl/db roster slots added to FantasyTeam (backward-compatible)
- ✅ ScoringEngine IDP branch: solo tkl×1, ast×0.5, sack×2, TFL×1, passDef×1, QBhit×0.5, FF×2, blkKick×3
- ✅ PlayersPage position filter tabs: ALL QB RB WR TE K DST LB DL DB
- ✅ Roster.tsx IDP slot rendering + checkPos eligibility for LB/DL/DB

### 3.4 Season Archive Browser ✅
- ✅ Browse all past seasons stored in the League history array
- ✅ Champion banner with winning team, record, and top scorer
- ✅ Season-by-season standings table with rank medals (🥇🥈🥉)
- ✅ Per-player "best season" row highlighted (gold star) in the card back career stats
- ✅ Export a season summary as a shareable PNG (html-to-image)
- ✅ Admin: Archive Current Season button captures live standings snapshot into history

### 3.5 Expanded Scouting Intel ✅
- ✅ Curated IntelligenceStore expanded from 2 → 25 players (top QBs, RBs, WRs, TEs, K)
- ✅ `generateIntelForPlayer()` — auto-generates contextual intel for ALL players using injury status, depth chart order, performance differential, and ADP; never returns null
- ✅ `deriveSentimentTrend()` — BULLISH / BEARISH / NEUTRAL derived from perf diff + injury
- ✅ Beat reporter feed per player (2-3 sourced quotes with outlet, reporter, timestamp, sentiment)
- ✅ ScoutingReportModal: BULLISH/BEARISH/NEUTRAL banner + BEAT REPORTER FEED section

---

## Phase 4 — Platform Expansion
*Target: v2.0.x — 8–18 months*

Larger architectural investments that expand who can use the app and how.

### 4.1 Multi-League Support ✅
Currently one active league per install. Expand to manage multiple leagues simultaneously.
- ✅ League switcher in the sidebar (compact dropdown below logo)
- ✅ Per-league data storage — separate teams, league object, and event log per slot
- ✅ Separate EventStore per league (setLeagueId() switches partition)
- ✅ One-time migration from legacy single-league keys
- ✅ Create / delete leagues with confirmation
- ⏭ Per-league identity (different nodeId per league) — deferred; requires P2PService re-init
- ⏭ "Guest view" — join as observer without a roster

### 4.2 Commissioner Web Dashboard ✅
A lightweight web companion (could be a simple hosted page or local server) for the commissioner.
- ✅ View all team rosters and standings without needing the desktop app
- ✅ Approve/veto trades from a browser
- ✅ Send league-wide announcements
- ✅ Schedule management and lock overrides
- ✅ Exposes a local-only HTTP API via Tauri; accessible only from localhost:15434

### 4.3 Federated Relay Network ✅
Currently one default relay server at Railway. Federate it.
- ✅ Self-hosted relay — single `docker run` command (Dockerfile in relay-server/)
- ✅ Relay discovery — health grid with latency badges, add custom relays
- ✅ Relay health monitoring in the Network page (Relay Network section)
- ✅ Fallback chain: pinned URL → best-health relay → default built-in

### 4.4 Custom Scoring Formats ✅
Currently PPR / Half-PPR / Standard. Let commissioners go deeper.
- ✅ Fully custom per-stat weights (e.g., 6-pt passing TDs, bonus for 300-yard games)
- ✅ TEP (Tight End Premium) scoring
- ✅ IDP scoring weight editor
- ✅ Save and share custom rulesets as `.tffr` files

### 4.5 Dynasty Mode ✅
Season-to-season roster continuity — a completely different long-term game.
- ✅ Keepers: designate up to N players per team to retain each season
- ✅ Contract years: 3-year limit when enabled; Year badge on each player (green/yellow/red)
- ✅ DynastyService: rolloverRosters() preserves keepers, releases the rest to free agent pool
- ✅ Draft picks: per-team pick inventory with traded-pick tracking
- ✅ DynastyPage: Keepers tab + Draft Picks tab in dedicated sidebar page
- ✅ Settings: dynasty enable/disable toggle, max keepers stepper, contract years toggle
- ⏭ Prospect tracking (college players) — requires external data pipeline
- ⏭ Rookie draft simulator — deferred (DraftSimulator can be reused in a future pass)
- ⏭ Aging curves on projections — deferred (requires actuarial data model)

### 4.6 Football Mini-Game (League Page — Below Ticker) ✅
A fun, football-themed interactive game embedded at the bottom of the League page,
below the scoring ticker. Meant to keep managers engaged between score updates.
- ✅ **Field Goal Kicker** — aim with arrow keys, power bar charges on hold, release to kick
- ✅ Wind direction and speed shown above the uprights (color-coded by intensity)
- ✅ Progressive difficulty: uprights narrow as you chain successful kicks
- ✅ Best streak stored locally (`trier_fg_streak`); shown in game header next to team name
- ⏭ Additional mini-games (QB accuracy challenge, punt distance meter) — deferred
- ✅ Runs only on gameday (Sun/Mon/Thu); shows "check back on gameday" placeholder off-season

### 4.8 Mobile Companion (Read-Only)
Full Tauri desktop stays the primary experience. A lightweight mobile companion for on-the-go.
- View roster, standings, and live scores from a phone
- Approve/decline trade offers on mobile
- Receive push notifications natively
- Built with Tauri Mobile (currently in beta) — same Rust core, React frontend

---

## Ongoing / Always Active

| Area | What |
|------|------|
| **Comment density** | Maintain ≥10% comment density across all source files |
| **Security** | Quarterly dependency audit; upgrade protocol version on breaking changes |
| **Player pool** | Weekly GitHub Actions pipeline refreshes `live_stats_current.json` and `all_players_pool.json` |
| **Node.js actions** | Migrate `actions/checkout` and `actions/setup-node` to Node.js 24 before Sept 2026 deadline |
| **Dependabot PRs** | Review weekly; merge patch/minor updates; manually evaluate major-version bumps |

---

## What Won't Be Built

These are intentional non-goals to keep the app focused:

- **Centralized server backend** — the app is local-first P2P by design. No cloud database.
- **Paid subscription tiers** — this is a personal/league tool, not a SaaS product.
- **Public leaderboards** — no data leaves the P2P mesh without user consent.
- **Real-money gambling integration** — out of scope by design.
- **iOS/Android native ports** — Tauri Mobile when stable; no React Native rewrite.
