# Trier Fantasy Football — Product Roadmap

> Last updated: 2026-04-19  
> Current release: v1.3.0

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

## Phase 2 — Core Feature Expansion
*Target: v1.4.x – v1.5.x — 2–4 months*

Significant new features that build directly on the existing architecture.

### 2.1 NFL Intelligence Panel **[Partial]** ⭐
AFC/NFC team columns flanking the League Standings page. Live records, scores, and per-team snapshots.

**Completed ✅**
- `ScoreboardService.ts` — ESPN standings + scoreboard APIs, subscriber pattern, 60s polling
- AFC/NFC vertical columns with team logos, W-L records, live score badges, pulse animation
- Division headers: neon red (AFC) / neon blue (NFC) with dark pill for readability
- `TeamSnapshotPanel` — last game result, next game, "View on NFL.com" button
- Columns sized to match League Standings panel height exactly

**Remaining:**
- Scoreboard strip showing all active games (score / quarter / time) above the standings
- Game detail modal — box score, scoring summary, YouTube highlights
- Fantasy dot indicators on standing rows (green = scoring now, yellow = active, grey = bye)
- "Last scoring play" ticker

### 2.2 Draft Simulator
The player pool, ADP data, and roster structure are all already modeled — no new data needed.
- Snake draft with configurable number of teams (2–16)
- AI auto-pick opponents that follow ADP with configurable "reach" variance
- Live pick clock with configurable timer (30s / 60s / 90s)
- Draft board view showing all picks by round and team
- Auto-save draft results directly to a new FantasyTeam
- Mock draft mode (no consequences — just practice)

### 2.4 Waiver Wire
Currently players are added/dropped freely. A real waiver system adds competitive integrity.
- FAAB (Free Agent Acquisition Budget) waiver model — each team starts with 100 FAAB, bids blind
- Priority waiver fallback for undrafted free agents (no cost)
- Weekly waiver processing window (Tuesday night → Wednesday morning)
- Commissioner can override and force-process waivers at any time
- Waiver history log per team (visible in Settings > Transaction History)

### 2.5 Head-to-Head Weekly Schedule
The H2H engine scores matchups but there's no concept of weekly opponents.
- Commissioner generates a full-season schedule (14 or 16 regular-season weeks)
- Each week shows your matchup opponent and live point differential
- Win/loss record tracked on each FantasyTeam
- Playoff bracket (top 4 teams by record, weeks 15–17)
- Tiebreaker: total points scored (already tracked)

### 2.6 Trade Analyzer
The Production Points economy is unique — give managers better tools to evaluate it.
- Fairness score: compares points-per-game of players being traded (last 4 weeks)
- Historical trade log browser (all completed trades in league history)
- Trade veto system: commissioner can block a trade within 24 hours of acceptance
- "Counter offer" button directly from an incoming offer

### 2.7 Push Notifications (Tauri Native)
- Trade offer received
- Trade offer accepted or declined
- Peer connection established
- Gameday lock triggered
- Configurable per-event in Settings

---

## Phase 3 — Analytics & Intelligence
*Target: v1.6.x – v1.8.x — 4–8 months*

Deeper data features that make Trier stand out as a research platform.

### 3.1 Season Projections Dashboard
The player model already has `projectedStats` fields — surface them visually.
- Week-by-week projected points chart for any player (line chart, current week highlighted)
- Rest-of-season ranking by position (sortable, filterable)
- Schedule strength overlay — remaining opponents by defensive ranking
- "Boom/bust" variance indicator based on historical weekly spread

### 3.2 Waiver Wire Intelligence
- AI-ranked add candidates each week based on projected points and roster need
- "Handcuff" suggestions — identify the backup RB for every starter on your roster
- Injury report integration (pull from Sleeper API, already in the data pipeline)
- Trending players widget on the dashboard (biggest ownership changes week-over-week)

### 3.3 IDP Full Mode
The data models support LB/DL/DB — just the scoring UI and roster slots need extending.
- Add IDP roster slots to FantasyTeam (LB, DL, DB starters)
- IDP scoring: tackles, sacks, INTs, forced fumbles
- IDP-specific filtering in the player pool browser
- H2H matchup analysis for defensive players

### 3.4 Season Archive Browser
- Browse all past seasons stored in the League history array
- Champion banner with winning team, record, and top scorer
- Season-by-season standings table with sortable columns
- Per-player "best season" career stat in the player card back face
- Export a season summary as a shareable image

### 3.5 Expanded Scouting Intel
The IntelligenceStore has curated reports for ~20 players. Extend coverage.
- Scripted intel generation using real player stats (injury history, target share, snap count)
- Beat reporter social feed per player (pull recent mentions from a curated source list)
- Sentiment trend: is the scout community bullish or bearish this week?

---

## Phase 4 — Platform Expansion
*Target: v2.0.x — 8–18 months*

Larger architectural investments that expand who can use the app and how.

### 4.1 Multi-League Support
Currently one active league per install. Expand to manage multiple leagues simultaneously.
- League switcher in the sidebar (similar to Discord server list)
- Per-league identity — different nodeId and team per league
- Separate EventStore per league (no cross-contamination)
- "Guest view" — join a league as observer without a roster

### 4.2 Commissioner Web Dashboard
A lightweight web companion (could be a simple hosted page or local server) for the commissioner.
- View all team rosters and standings without needing the desktop app
- Approve/veto trades from a browser
- Send league-wide announcements
- Schedule management and lock overrides
- Exposes a local-only HTTP API via Tauri; accessible only from localhost

### 4.3 Federated Relay Network
Currently one default relay server at Railway. Federate it.
- Self-hosted relay — single `docker run` command that anyone can deploy
- Relay discovery — clients can find nearby relays by region for lower latency
- Relay health monitoring in the Network page
- Fallback chain: custom relay → default relay → DHT only

### 4.4 Custom Scoring Formats
Currently PPR / Half-PPR / Standard. Let commissioners go deeper.
- Fully custom per-stat weights (e.g., 6-pt passing TDs, bonus for 300-yard games)
- TEP (Tight End Premium) scoring
- IDP scoring weight editor
- Save and share custom rulesets as `.tffr` files

### 4.5 Dynasty Mode
Season-to-season roster continuity — a completely different long-term game.
- Keepers: retain up to N players into next season
- Prospect tracking: college players added to the pool pre-draft
- Rookie draft each season (after NFL draft)
- Contract years and aging curves applied to projections
- Dynasty trade market: trading future draft picks

### 4.6 Mobile Companion (Read-Only)
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
