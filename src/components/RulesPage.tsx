import React from 'react';
import { Target, Users, Zap, Shield, HelpCircle, BookOpen, Lock, Wifi, ArrowLeftRight } from 'lucide-react';
import leatherTexture from '../assets/leather_texture.png';

export const RulesPage: React.FC = () => {
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
                        Official guidelines and technical protocols for the 2025 Season
                    </p>
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
                        "Safety: 2 pts",
                        "Defensive / Return TD: 6 pts",
                        "Note: Points-allowed brackets and fumble",
                        "recoveries are not yet in the scoring engine"
                    ]}
                />

                {/* Kicker Scoring */}
                <RuleCard
                    icon={<Target size={32} color="#eab308" />}
                    title="Kicker Scoring"
                    content={[
                        "FG 0–39 yds: 3 pts (planned)",
                        "FG 40–49 yds: 4 pts (planned)",
                        "FG 50+ yds: 5 pts (planned)",
                        "Extra Point: 1 pt (planned)",
                        "Note: Kicker scoring is not yet automated",
                        "in the scoring engine — kickers score 0"
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
                        "FUTURE: Season not yet started — scores blocked",
                        "ACTIVE_UNOFFICIAL: Live provisional scoring",
                        "COMPLETED_OFFICIAL: All scores final & frozen",
                        "SCANNED: Raw play-by-play data ingested",
                        "VALIDATED: Official box scores verified"
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
                            <li><strong>FUTURE:</strong> Scoring blocked — "Season has not started" enforced until the data pipeline is activated.</li>
                            <li><strong>ACTIVE_UNOFFICIAL:</strong> Live "Provisional" scoring active. Totals update in real time but are not yet finalized.</li>
                            <li><strong>COMPLETED_OFFICIAL:</strong> Data is frozen. Final badges issued; results archived as official league records.</li>
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
                    <strong>Protocol Note:</strong> This app uses a local-first architecture. All franchise data is stored on your device in browser local storage — nothing is sent to a central server. Roster move events are signed with your node's private key and verified by peers before being accepted.
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
