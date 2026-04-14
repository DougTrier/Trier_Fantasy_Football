import React from 'react';
import { Target, Users, Zap, Shield, HelpCircle, BookOpen, Lock } from 'lucide-react';
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
                    color: 'transparent', // Restored to show texture
                    backgroundImage: `url(${leatherTexture})`,
                    backgroundSize: '150px',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    fontFamily: "'Russo One', sans-serif",
                    // Double Stroke Effect: White inner (simulated by text color) + Heavy Black outer
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
                    title="Proprietary Security"
                    content={[
                        "Franchise passwords are MANDATORY",
                        "Secures team data & roster integrity",
                        "Owners verify identity for all moves",
                        "Admin-only password reset bypass",
                        "Encrypted local-first storage"
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
                        "1 FLEX (RB/WR/TE)",
                        "1 Kicker (K)",
                        "1 Defense/Special Teams (D/ST)",
                        "7 Bench Slots (Strategic Utility)"
                    ]}
                />

                {/* System Display Requirements */}
                <RuleCard
                    icon={<BookOpen size={32} color="#eab308" />}
                    title="Display Optimization"
                    content={[
                        "Optimal resolution: 1024x768+",
                        "Designed for 13\"+ laptop displays",
                        "High-fidelity holographic rendering",
                        "Scaled for standard desktop usage",
                        "Mobile view: Optimized for tablet+"
                    ]}
                />

                {/* Scoring System */}
                <RuleCard
                    icon={<Zap size={32} color="#eab308" />}
                    title="Scoring System (PPR)"
                    content={[
                        "Passing TD: 4 pts",
                        "Rushing/Receiving TD: 6 pts",
                        "Reception: 1.0 pt (Full PPR)",
                        "Passing Yds: 1 pt per 25 yds",
                        "Rush/Rec Yds: 1 pt per 10 yds",
                        "Interceptions: -2 pts",
                        "Fumbles Lost: -2 pts"
                    ]}
                />

                {/* D/ST Scoring */}
                <RuleCard
                    icon={<Shield size={32} color="#eab308" />}
                    title="Defense/ST Scoring"
                    content={[
                        "Sacks: 1 pt",
                        "Interceptions/Fumbles: 2 pts",
                        "Safeties: 2 pts",
                        "Defensive/Return TD: 6 pts",
                        "0 Pts Allowed: 10 pts",
                        "1-6 Pts Allowed: 7 pts",
                        "7-13 Pts Allowed: 4 pts"
                    ]}
                />

                {/* Kicker Scoring */}
                <RuleCard
                    icon={<Target size={32} color="#eab308" />}
                    title="Kicker Scoring"
                    content={[
                        "Field Goal (0-39 yds): 3 pts",
                        "Field Goal (40-49 yds): 4 pts",
                        "Field Goal (50+ yds): 5 pts",
                        "Extra Point: 1 pt"
                    ]}
                />

                {/* Bench Mechanics */}
                <RuleCard
                    icon={<BookOpen size={32} color="#eab308" />}
                    title="Bench Mechanics"
                    content={[
                        "7 Bench Slots in total",
                        "No points for bench players",
                        "Swap bench with starters anytime",
                        "Recruit players to bench slots",
                        "Drop players from card view"
                    ]}
                />

                {/* Season Protocols */}
                <RuleCard
                    icon={<Zap size={32} color="#eab308" />}
                    title="Season Protocol"
                    content={[
                        "FUTURE: Season not yet started",
                        "ACTIVE_UNOFFICIAL: Livescoring",
                        "COMPLETED_OFFICIAL: All final",
                        "SCANNED: Raw play-by-play data",
                        "VALIDATED: Official box verified"
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
                            <li><strong>Create Franchise:</strong> Click the <strong>"Settings / Create Team"</strong> button in the sidebar and launch the "ESTABLISH FRANCHISE" modal. A personalized team name, coach ID, and security password are required.</li>
                            <li><strong>Strategic Lock:</strong> The "Dashboard" and "My Team" portals remain tactically locked until you've established or logged into a franchise.</li>
                        </ul>

                        <h3 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Teko', sans-serif", textTransform: 'uppercase' }}>
                            <Shield size={22} /> Season State Protocol
                        </h3>
                        <ul style={{ paddingLeft: '20px', marginBottom: '24px' }}>
                            <li><strong>FUTURE:</strong> Access is blocked; "Season has not started" warning is enforced until API orchestration begins.</li>
                            <li><strong>ACTIVE_UNOFFICIAL:</strong> Real-time "Provisional" scoring is active. Point totals are live but pending final league validation.</li>
                            <li><strong>COMPLETED_OFFICIAL:</strong> Data is frozen. "Golden Final" badges are issued, and results are archived as official league records.</li>
                        </ul>
                    </div>

                    <div style={{ color: '#d1d5db', lineHeight: '1.6', fontSize: '1.1rem' }}>
                        <h3 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Teko', sans-serif", textTransform: 'uppercase' }}>
                            <Lock size={22} /> Doug Trier Provenance
                        </h3>
                        <ul style={{ paddingLeft: '20px', marginBottom: '24px' }}>
                            <li><strong>Deterministic Engine:</strong> Scoring is calculated using a strict deterministic sum of official NFL box score data (No inferred or sample stats).</li>
                            <li><strong>2026 Copyright:</strong> This platform is a Doug Trier original project. All logic, UI design, and orchestration protocols are © 2026.</li>
                            <li><strong>Audit Trace:</strong> Every point total can be audited back to the raw JSON payload in the "Fantasy Ledger" view.</li>
                        </ul>

                        <h3 style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Teko', sans-serif", textTransform: 'uppercase' }}>
                            <Users size={22} /> Roster Moves
                        </h3>
                        <ul style={{ paddingLeft: '20px' }}>
                            <li><strong>Swapping:</strong> Drag and drop (or click-to-swap) players between Starters and Bench.</li>
                            <li><strong>Player View:</strong> Click any name to open the detailed "Trading Card" holographic view.</li>
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
                    <strong>Protocol Tip:</strong> The app uses a Local-First architecture. All franchise data is encrypted in-browser, while roster performance is verified in real-time against official NFL endpoints.
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
                    color: '#e5e7eb',
                    fontSize: '0.95rem'
                }}>
                    • {item}
                </li>
            ))}
        </ul>
    </div>
);
