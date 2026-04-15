import React from 'react';
import { Target, Users, Zap, Shield, HelpCircle, BookOpen, Lock, Wifi, ArrowLeftRight, Github, Database } from 'lucide-react';
import leatherTexture from '../assets/leather_texture.png';

/** Returns the NFL season year currently in focus.
 * Logic: January–mid-Feb → previous year's season (playoffs/Super Bowl).
 *        Mid-Feb onward → upcoming/active season (off-season or current year).
 * After the Super Bowl (~Feb 15) the next season year becomes the display year.
 */
function getDisplaySeason(): number {
    const now = new Date();
    const month = now.getMonth(); // 0 = Jan
    const year = now.getFullYear();
    if (month === 0) return year - 1;                   // January: playoffs for prior season
    if (month === 1 && now.getDate() <= 15) return year - 1; // Early Feb: Super Bowl
    return year;                                          // Feb 16+ through Dec: upcoming/active
}

export const RulesPage: React.FC = () => {
    const displaySeason = getDisplaySeason();
    return (
        <div style={{
            color: 'white',
            maxWidth: '1000px',
            margin: '0 auto',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Header Section */}
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <h1 style={{
                    fontSize: '4.5rem',
                    fontWeight: 900,
                    margin: 0,
                    color: 'transparent',
                    backgroundImage: `url(${leatherTexture})`,
                    backgroundSize: '150px',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    fontFamily: "'Russo One', sans-serif",
                    WebkitTextStroke: '2px #000',
                    textShadow: '0 8px 30px rgba(0,0,0,0.9), 0 -1px 0 rgba(255,255,255,0.2)',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    transform: 'rotate(-2deg)'
                }}>
                    Trier Rules & Info
                </h1>
                <div style={{
                    height: '6px',
                    width: '140px',
                    background: 'linear-gradient(90deg, #eab308, #d97706)',
                    margin: '12px auto 0',
                    borderRadius: '3px',
                    boxShadow: '0 0 20px rgba(234, 179, 8, 0.6)'
                }} />
                <div style={{
                    marginTop: '25px',
                    display: 'inline-block',
                    padding: '8px 24px',
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    borderRadius: '50px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                }}>
                    <p style={{
                        margin: 0,
                        fontSize: '1.4rem',
                        color: '#fff',
                        fontWeight: 700,
                        fontFamily: "'Teko', sans-serif",
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        Official guidelines and technical protocols for the {displaySeason} Season
                    </p>
                </div>

                {/* Developer Credit — under subtitle, dark pill for readability */}
                <div style={{
                    marginTop: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 18px',
                    background: 'rgba(0,0,0,0.72)',
                    backdropFilter: 'blur(6px)',
                    borderRadius: '50px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.5)'
                }}>
                    <span style={{ color: '#9ca3af', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Built by</span>
                    <strong style={{ color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Doug Trier</strong>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>·</span>
                    <a
                        href="https://github.com/DougTrier"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: '#eab308',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap',
                            transition: 'color 0.2s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#fde047'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#eab308'; }}
                    >
                        <Github size={13} />
                        github.com/DougTrier
                    </a>
                </div>
            </div>

            {/* Content Grid */}
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
                        "Auto-saves on every change; logout on close"
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
                        "7 Bench Slots"
                    ]}
                />

                {/* Scoring System */}
                <RuleCard
                    icon={<Zap size={32} color="#eab308" />}
                    title="Scoring System (Full PPR)"
                    content={[
                        "Passing TD: 4 pts",
                        "Rushing / Receiving TD: 6 pts",
                        "Reception: 1 pt (Full PPR)",
                        "Passing Yards: 1 pt per 25 yds",
                        "Rush / Rec Yards: 1 pt per 10 yds",
                        "Interception thrown: -2 pts",
                        "Fumble lost: -2 pts"
                    ]}
                />

                {/* D/ST Scoring */}
                <RuleCard
                    icon={<Shield size={32} color="#eab308" />}
                    title="Defense / ST Scoring"
                    content={[
                        "Sack: 1 pt",
                        "Interception: 2 pts",
                        "Fumble Recovery: 2 pts",
                        "Safety: 2 pts",
                        "Defensive / Return TD: 6 pts",
                        "0 pts allowed: +10 pts",
                        "1–6 pts allowed: +7 pts",
                        "7–13 pts allowed: +4 pts",
                        "14–20 pts allowed: +1 pt",
                        "21–27 pts allowed: 0 pts",
                        "28–34 pts allowed: -1 pt",
                        "35+ pts allowed: -4 pts"
                    ]}
                />

                {/* Kicker Scoring */}
                <RuleCard
                    icon={<Target size={32} color="#eab308" />}
                    title="Kicker Scoring"
                    content={[
                        "FG 0–39 yds: 3 pts",
                        "FG 40–49 yds: 4 pts",
                        "FG 50+ yds: 5 pts",
                        "Extra Point made: 1 pt",
                        "Missed Extra Point: -1 pt"
                    ]}
                />

                {/* Game Day Locking */}
                <RuleCard
                    icon={<Lock size={32} color="#eab308" />}
                    title="Game Day Locking"
                    content={[
                        "Commissioner locks NFL teams during live games",
                        "Locked players cannot be swapped or dropped",
                        "Live Schedule button fetches ESPN scoreboard",
                        "Lock state persists across sessions",
                        "Individual team toggles in Commissioner Center",
                        "Prevents lineup changes after kickoff"
                    ]}
                />

                {/* Trade Center */}
                <RuleCard
                    icon={<ArrowLeftRight size={32} color="#eab308" />}
                    title="Trade Center"
                    content={[
                        "Points-based trade system (no salary cap)",
                        "Buyer escrows points before offer is sent",
                        "Seller confirms player + points received",
                        "Escrow returned if offer is declined",
                        "Commissioner can force accept or cancel any trade",
                        "All trades logged in transaction history"
                    ]}
                />

                {/* P2P Networking */}
                <RuleCard
                    icon={<Wifi size={32} color="#eab308" />}
                    title="P2P League Sync"
                    content={[
                        "LAN discovery via mDNS (same network)",
                        "Internet peers via WebRTC relay signaling",
                        "ECDSA mutual auth before any data flows",
                        "All game data is peer-to-peer — relay sees nothing",
                        "Event signatures verified on every inbound move",
                        "Delta sync on reconnect (no full re-download)"
                    ]}
                />

                {/* Season Protocol */}
                <RuleCard
                    icon={<BookOpen size={32} color="#eab308" />}
                    title="Season State Protocol"
                    content={[
                        "FUTURE: Off-season — no scoring data available",
                        "PRESEASON: Aug 1 – Sep 4 — scouting only, no fantasy points",
                        "ACTIVE_UNOFFICIAL: Sep 5 → Super Bowl — live provisional scoring",
                        "COMPLETED_OFFICIAL: Post-Super Bowl — all scores final & frozen",
                        "Note: Data status — SCANNED = raw play-by-play ingested; VALIDATED = official box scores confirmed"
                    ]}
                />

                {/* NFL Data Pipeline */}
                <RuleCard
                    icon={<Database size={32} color="#eab308" />}
                    title="NFL Data Pipeline"
                    content={[
                        "Powered by Sleeper API — free, no auth required",
                        "Post-draft (May 1): rookies + UDFA signings settled",
                        "Training camp (Jul 25): depth charts + camp cuts",
                        "Final cuts (Aug 27): official 53-man rosters locked",
                        "In-season Mon / Wed / Fri: trades, injuries, IR moves",
                        "Off-season Mondays: free agent signings, retirements",
                        "Note: Fully automated via GitHub Actions — zero maintenance"
                    ]}
                />
            </div>

            {/* FAQ / HOW TO SECTION */}
            <div style={{
                marginTop: '60px',
                background: 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(12px)',
                borderRadius: '24px',
                padding: '40px',
                border: '2px solid rgba(234, 179, 8, 0.3)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '30px' }}>
                    <HelpCircle size={40} color="#eab308" />
                    <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, fontFamily: "'Russo One', sans-serif", color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>App Guide & FAQ</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
                    <div style={{ color: '#d1d5db', lineHeight: '1.6', fontSize: '1.1rem' }}>
                        <h3 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Teko', sans-serif", textTransform: 'uppercase' }}>
                            <Zap size={22} /> Managing Your Team
                        </h3>
                        <ul style={{ paddingLeft: '20px', marginBottom: '24px' }}>
                            <li><strong>Create Franchise:</strong> Open <strong>Settings</strong> in the sidebar and use the "ESTABLISH FRANCHISE" section. Team name and coach name are required; a password is optional but recommended.</li>
                            <li><strong>Access Lock:</strong> The Dashboard and My Team views are locked until you select or create a franchise.</li>
                            <li><strong>Roster Moves:</strong> Click any starter or bench slot to select a player, then click a target slot to swap. Locked players (game in progress) cannot be moved.</li>
                            <li><strong>Player Cards:</strong> Click any player name to open their full trading card with stats, projections, and social links.</li>
                        </ul>

                        <h3 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Teko', sans-serif", textTransform: 'uppercase' }}>
                            <Shield size={22} /> Season State Protocol
                        </h3>
                        <ul style={{ paddingLeft: '20px', marginBottom: '24px' }}>
                            <li><strong>FUTURE</strong> (Feb 16 – Jul 31): Off-season. No scoring data. Use this window to build rosters via the player pool.</li>
                            <li><strong>PRESEASON</strong> (Aug 1 – Sep 4): Hall of Fame + 3 preseason weeks. Stats visible for scouting but do not count toward fantasy scoring. Roster moves unrestricted.</li>
                            <li><strong>ACTIVE_UNOFFICIAL</strong> (Sep 5 → Super Bowl): Regular season + playoffs live. Provisional scoring updates weekly.</li>
                            <li><strong>COMPLETED_OFFICIAL</strong> (Feb 16+): Season complete. Data frozen; results archived. Rollover to next season begins.</li>
                        </ul>
                    </div>

                    <div style={{ color: '#d1d5db', lineHeight: '1.6', fontSize: '1.1rem' }}>
                        <h3 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Teko', sans-serif", textTransform: 'uppercase' }}>
                            <ArrowLeftRight size={22} /> Trades & Points
                        </h3>
                        <ul style={{ paddingLeft: '20px', marginBottom: '24px' }}>
                            <li><strong>Making an Offer:</strong> Open Trade Center, select a player from another team, set your points offer, and submit. Points are escrowed immediately.</li>
                            <li><strong>Accepting / Declining:</strong> The receiving team sees the offer in Trade Center. Accepting completes the trade; declining refunds the escrowed points.</li>
                            <li><strong>Commissioner Override:</strong> Admins can force-accept or force-cancel any trade from the Commissioner panel.</li>
                        </ul>

                        <h3 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Teko', sans-serif", textTransform: 'uppercase' }}>
                            <Database size={22} /> Player Pool & Live Data
                        </h3>
                        <ul style={{ paddingLeft: '20px', marginBottom: '24px' }}>
                            <li><strong>Data Source:</strong> All player and stat data comes from the Sleeper API — the same backend used by Sleeper fantasy apps. Free, no API key required.</li>
                            <li><strong>Post-Draft (May 1):</strong> Full player pool refresh after the NFL Draft and UDFA signings settle. Rookies, position changes, and team assignments are all updated.</li>
                            <li><strong>Training Camp (Jul 25):</strong> Depth chart positions and practice squad designations updated as camps open.</li>
                            <li><strong>Final Cuts (Aug 27):</strong> Official 53-man rosters locked in just before the regular season.</li>
                            <li><strong>In-Season (Mon / Wed / Fri):</strong> Rolling updates for trades, injuries, IR designations, and waiver wire moves throughout the season.</li>
                            <li><strong>Automation:</strong> All pulls run via GitHub Actions on a schedule — no manual intervention needed. Only commits when data actually changed.</li>
                        </ul>

                        <h3 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Teko', sans-serif", textTransform: 'uppercase' }}>
                            <Wifi size={22} /> P2P Networking
                        </h3>
                        <ul style={{ paddingLeft: '20px' }}>
                            <li><strong>LAN:</strong> Peers on the same network are discovered automatically via mDNS. No configuration needed.</li>
                            <li><strong>Internet:</strong> Use the Network page to connect via the global relay. WebRTC handles the actual data channel — the relay never sees your game data.</li>
                            <li><strong>Trust:</strong> Every peer must complete a 3-message ECDSA handshake before any game data is exchanged. Roster move events are cryptographically signed and verified.</li>
                        </ul>
                    </div>
                </div>
                <p style={{
                    marginTop: '30px',
                    background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.15) 0%, transparent 100%)',
                    padding: '20px',
                    borderRadius: '12px',
                    borderLeft: '6px solid #eab308',
                    color: '#fff',
                    fontSize: '1.1rem',
                    fontWeight: 600
                }}>
                    <strong>Protocol Note:</strong> This app uses a local-first architecture. All franchise data is stored on your device in browser local storage — nothing is sent to a central server. Roster move events are signed with your node's private key and verified by peers before being accepted. NFL player and stat data is fetched from the Sleeper API on a calendar-aware schedule and committed directly to the app — no runtime API calls, no rate limits, no outages.
                </p>

            </div>
        </div>
    );
};

const RuleCard: React.FC<{ icon: React.ReactNode, title: string, content: string[] }> = ({ icon, title, content }) => (
    <div style={{
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid rgba(234, 179, 8, 0.2)',
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
