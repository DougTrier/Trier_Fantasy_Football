import React from 'react';
import {
    Target, Users, Zap, Shield, HelpCircle, BookOpen, Lock, Wifi,
    ArrowLeftRight, Github, Database, Calendar, Trophy, TrendingUp, Star, Layers
} from 'lucide-react';
import leatherTexture from '../assets/leather_texture.png';
import { ScoringEngine } from '../utils/ScoringEngine';

/** Returns the NFL season year currently in focus.
 * Jan–mid-Feb → prior season (playoffs/Super Bowl).
 * Mid-Feb onward → upcoming/active season.
 */
function getDisplaySeason(): number {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    if (month === 0) return year - 1;
    if (month === 1 && now.getDate() <= 15) return year - 1;
    return year;
}

export const RulesPage: React.FC = () => {
    const displaySeason = getDisplaySeason();
    const r = ScoringEngine.getRuleset();
    return (
        <div style={{ color: 'white', maxWidth: '1000px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <h1 style={{
                    fontSize: '4.5rem', fontWeight: 900, margin: 0, color: 'transparent',
                    backgroundImage: `url(${leatherTexture})`, backgroundSize: '150px',
                    WebkitBackgroundClip: 'text', backgroundClip: 'text',
                    fontFamily: "'Russo One', sans-serif", WebkitTextStroke: '2px #000',
                    textShadow: '0 8px 30px rgba(0,0,0,0.9), 0 -1px 0 rgba(255,255,255,0.2)',
                    textTransform: 'uppercase', letterSpacing: '2px', transform: 'rotate(-2deg)'
                }}>
                    Trier Rules & Info
                </h1>
                <div style={{ height: '6px', width: '140px', background: 'linear-gradient(90deg, #eab308, #d97706)', margin: '12px auto 0', borderRadius: '3px', boxShadow: '0 0 20px rgba(234,179,8,0.6)' }} />
                <div style={{ marginTop: '25px', display: 'inline-block', padding: '8px 24px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                    <p style={{ margin: 0, fontSize: '1.4rem', color: '#fff', fontWeight: 700, fontFamily: "'Teko', sans-serif", textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Official guidelines and technical protocols for the {displaySeason} Season
                    </p>
                </div>

                {/* Developer credit */}
                <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '6px 18px', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Built by</span>
                    <strong style={{ color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Doug Trier</strong>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>·</span>
                    <a
                        href="https://github.com/DougTrier"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#eab308', textDecoration: 'none', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', transition: 'color 0.2s ease' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#fde047'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#eab308'; }}
                    >
                        <Github size={13} />
                        github.com/DougTrier
                    </a>
                </div>

                {/* About the Developer */}
                <div style={{
                    marginTop: '20px',
                    maxWidth: '600px',
                    margin: '20px auto 0',
                    background: 'rgba(10,14,26,0.82)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '16px',
                    padding: '20px 28px',
                    border: '1px solid rgba(234,179,8,0.2)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    textAlign: 'center'
                }}>
                    <p style={{ margin: '0 0 14px', color: '#d1d5db', fontSize: '0.95rem', lineHeight: '1.6' }}>
                        I built <strong style={{ color: '#fff' }}>Trier Fantasy Football</strong> from scratch as a passion project and released it completely free. If you enjoy it and want to support future development, any contribution means a lot — even a coffee goes a long way.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <a
                            href="https://github.com/sponsors/DougTrier"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: 'linear-gradient(135deg, #2d333b 0%, #1c2128 100%)', color: '#fff', borderRadius: '50px', fontWeight: 800, fontSize: '0.78rem', textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 4px 10px rgba(0,0,0,0.4)', transition: 'all 0.2s ease' }}
                            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.25)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <Github size={14} /> Sponsor on GitHub
                        </a>
                        <a
                            href="https://buymeacoffee.com/dougtrier"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: 'linear-gradient(135deg, #FFDD00 0%, #FF9500 100%)', color: '#1a0800', borderRadius: '50px', fontWeight: 800, fontSize: '0.78rem', textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 4px 10px rgba(255,149,0,0.4)', transition: 'all 0.2s ease' }}
                            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            ☕ Buy Me a Coffee
                        </a>
                    </div>
                </div>
            </div>

            {/* Rule Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>

                {/* Team Security */}
                <RuleCard
                    icon={<Lock size={32} color="#eab308" />}
                    title="Team Security"
                    content={[
                        "Optional franchise password protects team access",
                        "Commissioner password gates all admin functions",
                        "ECDSA P-256 cryptographic peer identity",
                        "Admin-only password reset for locked-out owners",
                        "Local-first storage — all data stays on your device",
                        "Auto-saves on every change; session persists through reload",
                        "Logout only occurs when the app is closed",
                    ]}
                />

                {/* Roster Composition */}
                <RuleCard
                    icon={<Users size={32} color="#eab308" />}
                    title="Roster Composition"
                    content={[
                        "1 Quarterback (QB)",
                        "2 Running Backs (RB)",
                        "2 Wide Receivers (WR)",
                        "1 Tight End (TE)",
                        "1 FLEX (RB / WR / TE)",
                        "1 Kicker (K)",
                        "1 Defense / Special Teams (D/ST)",
                        "7 Bench Slots",
                        "Note: Optional IDP slots (LB / DL / DB) can be enabled by the commissioner in Settings → Dynasty & Scoring.",
                    ]}
                />

                {/* Scoring System */}
                <RuleCard
                    icon={<Zap size={32} color="#eab308" />}
                    title={`Scoring System (${r.name})`}
                    content={[
                        `Passing TD: ${r.passingTDPoints} pts`,
                        `Rush TD: ${r.rushingTDPoints} pts`,
                        `Rec TD: ${r.receivingTDPoints} pts`,
                        `Reception: ${r.receptionPoints} pt`,
                        ...(r.tepBonus > 0 ? [`TE Reception bonus: +${r.tepBonus} pt`] : []),
                        `Passing Yards: 1 pt per ${r.passingYardsPerPoint} yds`,
                        `Rush Yards: 1 pt per ${r.rushingYardsPerPoint} yds`,
                        `Rec Yards: 1 pt per ${r.receivingYardsPerPoint} yds`,
                        ...(r.passing300YardBonus > 0 ? [`300-yd game bonus: +${r.passing300YardBonus} pts`] : []),
                        ...(r.passing400YardBonus > 0 ? [`400-yd game bonus: +${r.passing400YardBonus} pts`] : []),
                        ...(r.rushing100YardBonus > 0 ? [`100-yd rush bonus: +${r.rushing100YardBonus} pts`] : []),
                        `INT thrown: ${r.passingINTPoints} pts`,
                        `Fumble lost: ${r.fumbleLostPoints} pts`,
                        "Note: Commissioner can set fully custom weights in Settings → Scoring Format.",
                    ]}
                />

                {/* D/ST Scoring */}
                <RuleCard
                    icon={<Shield size={32} color="#eab308" />}
                    title="Defense / ST Scoring"
                    content={[
                        `Sack: ${r.dstSackPoints} pt`,
                        `Interception: ${r.dstINTPoints} pts`,
                        `Fumble Recovery: ${r.dstFumbleRecPoints} pts`,
                        `Safety: ${r.dstSafetyPoints} pts`,
                        `Defensive / Return TD: ${r.dstTDPoints} pts`,
                        "0 pts allowed: +10 pts",
                        "1–6 pts allowed: +7 pts",
                        "7–13 pts allowed: +4 pts",
                        "14–20 pts allowed: +1 pt",
                        "21–27 pts allowed: 0 pts",
                        "28–34 pts allowed: -1 pt",
                        "35+ pts allowed: -4 pts",
                    ]}
                />

                {/* Kicker Scoring */}
                <RuleCard
                    icon={<Target size={32} color="#eab308" />}
                    title="Kicker Scoring"
                    content={[
                        `FG 0–39 yds: ${r.fgUnder40Points} pts`,
                        `FG 40–49 yds: ${r.fg40to49Points} pts`,
                        `FG 50+ yds: ${r.fg50plusPoints} pts`,
                        `Extra Point made: ${r.xpPoints} pt`,
                        `Missed Extra Point: ${r.missedXPPoints} pt`,
                    ]}
                />

                {/* Waiver Wire */}
                <RuleCard
                    icon={<TrendingUp size={32} color="#eab308" />}
                    title="Waiver Wire"
                    content={[
                        "FAAB model — each team starts with $100 blind-bid budget",
                        "Bids are sealed until the waiver window closes",
                        "Highest bidder wins; ties broken by waiver priority order",
                        "$0 bids use priority order only (no budget spent)",
                        "Waivers process every Tuesday at 2:00 AM",
                        "Commissioner can force-process waivers at any time",
                        "Rolling priority — winner drops to bottom of order",
                        "Optional drop player when submitting a claim",
                        "Note: INTEL tab shows AI top picks, handcuff targets, and trending adds.",
                    ]}
                />

                {/* Head-to-Head & Playoffs */}
                <RuleCard
                    icon={<Calendar size={32} color="#eab308" />}
                    title="Head-to-Head & Playoffs"
                    content={[
                        "Commissioner generates full 14 or 16-week schedule",
                        "Each week you face one opponent — win/loss/tie tracked",
                        "Tiebreaker: total points scored across the season",
                        "Top 4 teams by record advance to playoffs (weeks 15–17)",
                        "Playoff bracket: semi-finals week 15, finals week 17",
                        "Commissioner can override scores before completing a week",
                        "Full schedule visible in Head to Head → My Schedule tab",
                        "Live matchup and standings in This Week and Standings tabs",
                    ]}
                />

                {/* Draft Simulator */}
                <RuleCard
                    icon={<Trophy size={32} color="#eab308" />}
                    title="Draft Simulator"
                    content={[
                        "Snake draft format — pick order reverses each round",
                        "2–16 configurable teams",
                        "AI opponents follow ADP with positional need awareness",
                        "Pick clock: Off / 30s / 60s / 90s",
                        "Mock Draft: practice with no consequences",
                        "Real Draft: results save directly to a new franchise",
                        "Draft board shows all picks by round and team",
                        "Results screen grades your draft A+ → C based on projected points",
                    ]}
                />

                {/* Dynasty Mode */}
                <RuleCard
                    icon={<Star size={32} color="#eab308" />}
                    title="Dynasty Mode"
                    content={[
                        "Commissioner-enabled in Settings → Dynasty Mode",
                        "Managers designate keepers before each new season",
                        "Commissioner sets max keepers per team (1–10)",
                        "Optional 3-year contract limit — players expire after 3 seasons",
                        "Year badge on each keeper: green (yr 1) / yellow (yr 2) / red (yr 3)",
                        "Rollover: keepers stay, all others return to free agency",
                        "Draft pick inventory tracked with traded-pick support",
                        "Manage keepers and picks in the Dynasty page",
                    ]}
                />

                {/* Trade Center */}
                <RuleCard
                    icon={<ArrowLeftRight size={32} color="#eab308" />}
                    title="Trade Center"
                    content={[
                        "Points-based trade system (no salary cap)",
                        "Buyer escrows points before offer is sent",
                        "Seller accepts or declines; escrow returned if declined",
                        "Fairness badge on every incoming offer: GREAT / FAIR / LOW",
                        "Fairness compares PPG vs 4-week value benchmark",
                        "Counter Offer: seller proposes a new price instead of declining",
                        "Commissioner can force-accept or force-cancel any trade",
                        "Full trade history log visible in Trade Center",
                    ]}
                />

                {/* Game Day Locking */}
                <RuleCard
                    icon={<Lock size={32} color="#ef4444" />}
                    title="Game Day Locking"
                    content={[
                        "Commissioner locks NFL teams during live games",
                        "Locked players cannot be swapped or dropped",
                        "Live Schedule button auto-locks active games via ESPN",
                        "Individual team toggles or Lock All / Unlock All",
                        "Lock state persists across sessions",
                        "System tray notification fires when teams lock",
                        "Prevents lineup changes after kickoff",
                    ]}
                />

                {/* NFL Intelligence */}
                <RuleCard
                    icon={<Layers size={32} color="#eab308" />}
                    title="NFL Intelligence Panel"
                    content={[
                        "Live AFC / NFC standings with W-L records and logos",
                        "Live scoreboard strip — in-progress games with quarter and score",
                        "Game detail modal: box score, scoring plays, ESPN deep link",
                        "Fantasy dot indicators: green = scoring now, yellow = pregame",
                        "Scoring ticker: scrolling strip of live scores and big plays",
                        "Team Snapshot: last game result, next game, NFL.com link",
                        "Scoreboard updates every 60 seconds on gameday",
                    ]}
                />

                {/* Multi-League */}
                <RuleCard
                    icon={<Layers size={32} color="#a78bfa" />}
                    title="Multi-League Support"
                    content={[
                        "Manage multiple independent leagues from one install",
                        "League switcher in the sidebar below the logo",
                        "Each league has separate teams, settings, and event history",
                        "Create or delete leagues with confirmation",
                        "One-time automatic migration from legacy single-league data",
                        "Note: Each league is fully isolated — switching leagues changes all data.",
                    ]}
                />

                {/* P2P Networking */}
                <RuleCard
                    icon={<Wifi size={32} color="#eab308" />}
                    title="P2P League Sync"
                    content={[
                        "LAN discovery via mDNS (same network, zero config)",
                        "Internet peers via WebRTC relay signaling",
                        "ECDSA mutual auth — handshake required before any data flows",
                        "All game data is peer-to-peer — relay only brokers the connection",
                        "Roster move events are cryptographically signed and verified",
                        "Delta sync on reconnect — no full re-download needed",
                        "Relay network: add custom self-hosted relays in Network page",
                        "Commissioner Dashboard: ask your Commissioner for the secure URL (Settings → Commissioner Center)",
                    ]}
                />

                {/* Season Protocol */}
                <RuleCard
                    icon={<BookOpen size={32} color="#eab308" />}
                    title="Season State Protocol"
                    content={[
                        "FUTURE: Feb 16 – Jul 31 — off-season, no scoring data",
                        "PRESEASON: Aug 1 – Sep 4 — scouting only, points don't count",
                        "ACTIVE_UNOFFICIAL: Sep 5 → Super Bowl — live provisional scoring",
                        "COMPLETED_OFFICIAL: Post-Super Bowl — scores final and frozen",
                        "Season Archive: past champions, standings, and per-player career bests",
                        "Commissioner archives the current season via Settings when complete",
                        "Note: SCANNED = raw play-by-play ingested; VALIDATED = official box scores confirmed.",
                    ]}
                />

                {/* NFL Data Pipeline */}
                <RuleCard
                    icon={<Database size={32} color="#eab308" />}
                    title="NFL Data Pipeline"
                    content={[
                        "Powered by Sleeper API — free, no auth required",
                        "Post-draft (May 1): rookies, UDFA signings, position changes",
                        "Training camp (Jul 25): depth charts, camp cuts",
                        "Final cuts (Aug 27): official 53-man rosters locked",
                        "In-season Mon / Wed / Fri: trades, injuries, IR moves",
                        "Off-season Mondays: free agent signings, retirements",
                        "Note: Fully automated via GitHub Actions — zero maintenance required.",
                    ]}
                />
            </div>

            {/* FAQ / Guide Section */}
            <div style={{
                marginTop: '60px',
                background: 'rgba(15,23,42,0.9)',
                backdropFilter: 'blur(12px)',
                borderRadius: '24px',
                padding: '40px',
                border: '2px solid rgba(234,179,8,0.3)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '30px' }}>
                    <HelpCircle size={40} color="#eab308" />
                    <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, fontFamily: "'Russo One', sans-serif", color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>App Guide & FAQ</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>

                    {/* Left column */}
                    <div style={{ color: '#d1d5db', lineHeight: '1.6', fontSize: '1.1rem' }}>

                        <FaqSection icon={<BookOpen size={22} />} title="Getting Started">
                            <li><strong>Default Team:</strong> Every fresh install includes a <strong>Default Team</strong> with no password — just click it to enter the app. It is a placeholder; delete it once real franchises are set up.</li>
                            <li><strong>Commissioner Setup:</strong> Go to <strong>Settings</strong>, then click the <strong>Commissioner Mode</strong> toggle. On first run the app detects no password and walks you through creating one — no prior password needed. Once set, that password gates all admin functions.</li>
                            <li><strong>Add Franchises:</strong> While in Commissioner Mode, go to <strong>Settings → Manage Franchises → ADD FRANCHISE</strong>. Each team needs a name, owner name, and franchise password the owner will use to log in.</li>
                            <li><strong>Remove Default Team:</strong> Once all real franchises are created, delete the Default Team from <strong>Settings → Manage Franchises</strong>. Any players on it return to the free agent pool automatically.</li>
                            <li><strong>Share the App:</strong> Other league members install on their own machine and connect via the Network page (LAN auto-discovers; internet uses the relay). Their app syncs team data from yours on connect.</li>
                        </FaqSection>

                        <FaqSection icon={<Zap size={22} />} title="Managing Your Team">
                            <li><strong>Create Franchise:</strong> Open <strong>Settings</strong> in the sidebar. Use "ADD FRANCHISE" in Manage Franchises. Team name, coach name, and a password are required.</li>
                            <li><strong>Roster Moves:</strong> Click any starter or bench slot to select a player, then click a target slot to swap. Locked players (game in progress) cannot be moved.</li>
                            <li><strong>Player Cards:</strong> Click any player name to open their full scouting card — stats, projections, beat reporter feed, and BULLISH / BEARISH / NEUTRAL sentiment.</li>
                            <li><strong>Session:</strong> Your login persists through reloads. The app only signs you out when it is fully closed.</li>
                        </FaqSection>

                        <FaqSection icon={<TrendingUp size={22} />} title="Waiver Wire">
                            <li><strong>Placing a Bid:</strong> Open Waiver Wire, find a free agent, enter your FAAB bid, and optionally select a drop player. Bids are sealed until processing.</li>
                            <li><strong>Processing:</strong> Waivers run every Tuesday at 2:00 AM. The countdown timer is shown at the top of the Waiver Wire page. Admins can force-process early.</li>
                            <li><strong>INTEL Tab:</strong> Switch to INTEL for AI-ranked top pickups, handcuff targets (free-agent RBs on the same NFL team as your rostered RBs), and trending adds by ownership percentage.</li>
                            <li><strong>Budget:</strong> Each team starts with $100 FAAB. Unspent budget does not roll over between seasons unless the commissioner resets it.</li>
                        </FaqSection>

                        <FaqSection icon={<Trophy size={22} />} title="Draft Simulator">
                            <li><strong>Mock Draft:</strong> Practice a snake draft with AI opponents following real ADP. Grades your picks at the end — no data is saved.</li>
                            <li><strong>Real Draft:</strong> Results are automatically saved as a new franchise with the drafted roster. Use this at the start of your season.</li>
                            <li><strong>Pick Clock:</strong> Set a time limit (30s / 60s / 90s) or Off. The clock auto-picks with ADP when it expires.</li>
                            <li><strong>AI Behavior:</strong> Opponents follow ADP rankings but adjust for positional need — they won't stack four QBs early.</li>
                        </FaqSection>

                    </div>

                    {/* Right column */}
                    <div style={{ color: '#d1d5db', lineHeight: '1.6', fontSize: '1.1rem' }}>

                        <FaqSection icon={<Calendar size={22} />} title="Head-to-Head Schedule & Playoffs">
                            <li><strong>Generating a Schedule:</strong> The commissioner uses Head to Head → My Schedule to generate a full-season matchup schedule (14 or 16 weeks).</li>
                            <li><strong>Weekly Scoring:</strong> Each week compares your total fantasy points against your opponent. Higher score wins. Ties are possible.</li>
                            <li><strong>Playoffs:</strong> The top 4 teams by win-loss record advance. Week 15 is the semi-finals; week 17 is the championship. Tiebreaker is total points scored.</li>
                            <li><strong>Score Overrides:</strong> Commissioners can edit any score before completing a week using the override controls in the schedule view.</li>
                        </FaqSection>

                        <FaqSection icon={<ArrowLeftRight size={22} />} title="Trades & Points">
                            <li><strong>Making an Offer:</strong> Open Trade Center, select a player from another team, set your points offer, and submit. Points are escrowed immediately.</li>
                            <li><strong>Counter Offer:</strong> The seller can propose a different price instead of accepting or declining outright. The buyer sees the counter in their Trade Center.</li>
                            <li><strong>Fairness Score:</strong> Every incoming offer shows a GREAT / FAIR / LOW badge based on PPG and 4-week projected value vs what's being offered.</li>
                            <li><strong>Commissioner Override:</strong> Admins can force-accept or force-cancel any trade from the Commissioner Center.</li>
                        </FaqSection>

                        <FaqSection icon={<Star size={22} />} title="Dynasty Mode">
                            <li><strong>Enabling:</strong> Commissioner toggles Dynasty Mode on in Settings → Commissioner Center → Dynasty Mode.</li>
                            <li><strong>Keepers:</strong> Before each new season, every manager designates up to the commissioner-set maximum of players to retain. All others return to the free agent pool.</li>
                            <li><strong>Contract Years:</strong> If enabled, players can only be kept for 3 seasons. The year badge turns red in their final contracted year.</li>
                            <li><strong>Draft Picks:</strong> Each team's pick inventory is visible in Dynasty → Draft Picks. Traded picks are tracked and attributed to the new owner.</li>
                        </FaqSection>

                        <FaqSection icon={<Wifi size={22} />} title="P2P Networking">
                            <li><strong>LAN:</strong> Peers on the same network are found automatically via mDNS — no configuration needed.</li>
                            <li><strong>Internet:</strong> Use the Network page to connect via the relay. WebRTC handles the data channel; the relay only brokers the initial handshake.</li>
                            <li><strong>Trust:</strong> Every peer must complete a 3-message ECDSA handshake. Roster moves are signed with your node's private key and verified before being accepted.</li>
                            <li><strong>Self-Hosted Relay:</strong> Run your own relay with a single <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px', fontSize: '0.9rem' }}>docker run</code> command using the Dockerfile in relay-server/.</li>
                        </FaqSection>

                    </div>
                </div>

                <p style={{
                    marginTop: '30px',
                    background: 'linear-gradient(90deg, rgba(234,179,8,0.15) 0%, transparent 100%)',
                    padding: '20px', borderRadius: '12px', borderLeft: '6px solid #eab308',
                    color: '#fff', fontSize: '1.1rem', fontWeight: 600
                }}>
                    <strong>Protocol Note:</strong> Trier Fantasy is local-first. All franchise data lives on your device — nothing is sent to a central server. Roster moves are signed with your node's ECDSA private key and cryptographically verified by every peer before being accepted. NFL player and stat data is pulled from the Sleeper API on a calendar-aware schedule via GitHub Actions and committed directly to the app — no runtime API calls, no rate limits, no outages.
                </p>
            </div>
        </div>
    );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const RuleCard: React.FC<{ icon: React.ReactNode; title: string; content: string[] }> = ({ icon, title, content }) => (
    <div style={{
        background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(10px)',
        borderRadius: '20px', padding: '24px',
        border: '1px solid rgba(234,179,8,0.2)',
        transition: 'transform 0.2s ease',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            {icon}
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#eab308', textTransform: 'uppercase' }}>{title}</h3>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {content.map((item, i) => (
                <li key={i} style={{
                    padding: '8px 0',
                    borderBottom: i === content.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    color: item.startsWith('Note:') ? '#9ca3af' : '#e5e7eb',
                    fontSize: item.startsWith('Note:') ? '0.82rem' : '0.95rem',
                    fontStyle: item.startsWith('Note:') ? 'italic' : 'normal'
                }}>
                    {item.startsWith('Note:') ? item : `• ${item}`}
                </li>
            ))}
        </ul>
    </div>
);

// FaqSection — collapsible-style header + bullet list used in the FAQ panel.
const FaqSection: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <>
        <h3 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Teko', sans-serif", textTransform: 'uppercase' }}>
            {icon} {title}
        </h3>
        <ul style={{ paddingLeft: '20px', marginBottom: '24px' }}>
            {children}
        </ul>
    </>
);
