import React from 'react';
import { LayoutDashboard, Users, Trophy, User, Settings, LogOut, BookOpen, Swords, Wallet, Zap, ArrowRightLeft } from 'lucide-react';
import { ScoringEngine } from '../utils/ScoringEngine';
import type { FantasyTeam } from '../types';
import turfBg from '../assets/turf1.jpg';
import leatherTexture from '../assets/leather_texture.png';
import brandedFootball from '../assets/branded_football_on_grass.png';

interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
    title?: string;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, isActive, onClick, title }) => (
    <div
        onClick={onClick}
        title={title || label}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 24px',
            margin: '8px 0',
            borderRadius: '50px', // STADIUM OVAL
            cursor: 'pointer',
            // GEL LOOK BASE - Realistic Leather Active State (Matched to Standings)
            backgroundImage: isActive
                ? `url(/leather_panel_large.png), linear-gradient(135deg, rgba(120, 53, 15, 0.4) 0%, rgba(69, 26, 3, 0.4) 100%)`
                : 'none',
            backgroundColor: isActive ? 'transparent' : 'rgba(0,0,0,0.3)',
            backgroundBlendMode: 'normal',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: isActive ? '#fff' : 'white', // White text for contrast on dark leather
            fontWeight: isActive ? 800 : 600,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            // 3D PLACARD SHADOWS
            boxShadow: isActive
                ? '0 10px 25px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.5)'
                : '0 4px 6px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
            border: isActive ? '1.5px solid rgba(234, 179, 8, 0.6)' : '1px solid rgba(255,255,255,0.05)', // Gold rim for active
            backdropFilter: 'blur(8px)',
            position: 'relative',
            zIndex: 5,
            overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            if (!isActive) {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(234, 179, 8, 0.4)';
            } else {
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.5)';
            }
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            if (!isActive) {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.3)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
            } else {
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4)';
            }
        }}
    >
        {/* HIGH-GLOSS GEL REFLECTION */}
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '48%', // Slightly sharper split
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 95%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 1
        }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
                color: isActive ? '#eab308' : '#fff', // Gold icon for active
                display: 'flex',
                alignItems: 'center',
                filter: isActive ? 'drop-shadow(0 0 8px rgba(234, 179, 8, 0.4))' : 'none'
            }}>
                {icon}
            </div>
            <span style={{
                textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                letterSpacing: '0.02em',
                fontSize: '0.95rem',
                fontFamily: "'Inter', sans-serif",
                color: isActive ? '#fff' : '#d1d5db'
            }}>{label}</span>
        </div>
    </div>
);

interface LayoutDashboardProps {
    children: React.ReactNode;
    activeView: string;
    onNavigate: (view: string) => void;
    userTeams: FantasyTeam[];
    activeTeamId: string;
    onSelectTeam: (id: string) => void;
    onSaveAndClose: () => void;
    hasNewOffers?: boolean;
}

export const Layout_Dashboard: React.FC<LayoutDashboardProps> = ({
    children,
    activeView,
    onNavigate,
    userTeams,
    activeTeamId,
    onSelectTeam,
    onSaveAndClose,
    hasNewOffers
}) => {
    const activeTeam = userTeams.find(t => t.id === activeTeamId);


    // Guest Mode Fallback
    const displayTeam = activeTeam || {
        name: 'Guest User',
        ownerName: 'Read Only Mode',
        id: 'guest',
        roster: {}, bench: [], transactions: [],
        total_production_pts: 0, points_escrowed: 0, points_spent: 0
    } as any;

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            background: '#111827',
            color: 'white',
            overflow: 'hidden'
        }}>
            {/* Sidebar */}
            <aside style={{
                width: 'clamp(220px, 18vw, 280px)',
                background: `url(${turfBg})`,
                backgroundSize: '150px',
                backgroundRepeat: 'repeat',
                borderRight: '4px solid #eab308',
                display: 'flex',
                flexDirection: 'column',
                padding: 'clamp(8px, 1.5vh, 24px) clamp(12px, 2vw, 24px)',
                zIndex: 20,
                boxShadow: '4px 0 15px rgba(0,0,0,0.5)',
                position: 'relative',
                flexShrink: 0
            }}>
                {/* Yard Markers Overlay */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '15px',
                    width: '40px',
                    height: '100%',
                    background: 'repeating-linear-gradient(to bottom, transparent, transparent 40px, rgba(255,255,255,0.7) 40px, rgba(255,255,255,0.7) 43px)',
                    zIndex: 1,
                    pointerEvents: 'none',
                    opacity: 0.8
                }} />

                {/* Top: Title */}
                <div style={{ marginBottom: 'clamp(5px, 1vw, 15px)', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                    <h1 style={{
                        fontSize: 'clamp(1.2rem, 3.5vw, 3.6rem)',
                        fontWeight: 900,
                        margin: 0,
                        color: 'transparent',
                        backgroundImage: `url(${leatherTexture})`,
                        backgroundSize: '150px',
                        backgroundPosition: 'center',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        fontFamily: "'Graduate', 'Impact', sans-serif",
                        WebkitTextStroke: '1px rgba(255,255,255,0.95)',
                        textShadow: '0 5px 15px rgba(0,0,0,0.9)',
                        lineHeight: '0.85',
                        transform: 'rotate(-5deg)'
                    }}>
                        TRIER<br />FANTASY<br />FOOTBALL
                    </h1>
                </div>

                {/* Team Selector REMOVED per user request */}

                {/* LOGO MOVED UP & CENTERED VISUALLY */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 0 clamp(10px, 2vh, 20px) 0',
                    paddingLeft: '30px', // Offset for Yard Markers
                    position: 'relative',
                    zIndex: 10,
                    minHeight: '60px',
                    flexShrink: 0
                }}>
                    <div style={{
                        width: 'clamp(100px, 15vh, 180px)',
                        height: 'clamp(100px, 15vh, 180px)',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '4px solid rgba(234, 179, 8, 0.4)',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                        // Vignette for the image itself
                        maskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)',
                        WebkitMaskImage: 'radial-gradient(circle at center, black 60%, transparent 100%)'
                    }}>
                        <img
                            src={brandedFootball}
                            alt="Branded Football"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                </div>

                {/* Orchestration Status Bar (Moved and Enhanced with Tooltip) */}
                <div
                    title={`Season: ${ScoringEngine.getOrchestrationStatus().season_state} | Data: ${ScoringEngine.getOrchestrationStatus().data_status}\n\n- COMPLETED_OFFICIAL: All games finished and verified.\n- VALIDATED: Points cross-checked against official box scores.`}
                    style={{
                        marginBottom: 'clamp(8px, 1.5vh, 16px)',
                        padding: '8px 12px',
                        background: 'rgba(0,0,0,0.4)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'help',
                        zIndex: 11
                    }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: ScoringEngine.getOrchestrationStatus().data_status === 'VALIDATED' ? '#10b981' : '#ef4444',
                        boxShadow: ScoringEngine.getOrchestrationStatus().data_status === 'VALIDATED' ? '0 0 8px #10b981' : '0 0 8px #ef4444'
                    }} />
                    <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 900,
                        color: '#fff',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {ScoringEngine.getOrchestrationStatus().season_state}: {ScoringEngine.getOrchestrationStatus().data_status}
                    </span>
                </div>

                {/* Middle: Navigation - Evenly Spaced */}
                <nav style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: '4px', zIndex: 10, overflowY: 'auto', minHeight: '100px' }}>

                    {/* Dashboard & My Team: Disabled for guests */}
                    <div style={{ opacity: displayTeam.id === 'guest' ? 0.3 : 1, pointerEvents: displayTeam.id === 'guest' ? 'none' : 'auto', cursor: displayTeam.id === 'guest' ? 'not-allowed' : 'pointer' }}>
                        <SidebarItem
                            icon={<div style={{ width: 20 }}><LayoutDashboard size={20} /></div>}
                            label={displayTeam.id === 'guest' ? "Dashboard (Locked)" : "Dashboard"}
                            isActive={activeView === 'dashboard'}
                            onClick={() => onNavigate('dashboard')}
                            title="View your team's main overview, key metrics, and league updates."
                        />
                    </div>

                    <div style={{ opacity: displayTeam.id === 'guest' ? 0.3 : 1, pointerEvents: displayTeam.id === 'guest' ? 'none' : 'auto', cursor: displayTeam.id === 'guest' ? 'not-allowed' : 'pointer' }}>
                        <SidebarItem
                            icon={<div style={{ width: 20 }}><User size={20} /></div>}
                            label={displayTeam.id === 'guest' ? "My Team (Locked)" : "My Team"}
                            isActive={activeView === 'roster'}
                            onClick={() => onNavigate('roster')}
                            title="Manage your active roster, bench, and lineup configuration."
                        />
                    </div>

                    <SidebarItem icon={<div style={{ width: 20 }}><Trophy size={20} /></div>} label="League" isActive={activeView === 'league'} onClick={() => onNavigate('league')} title="View league standings, schedule, and team performance tables." />
                    <SidebarItem icon={<div style={{ width: 20 }}><Swords size={20} /></div>} label="Head to Head" isActive={activeView === 'h2h'} onClick={() => onNavigate('h2h')} title="Matchup preview and live scoring comparison between teams." />
                    <SidebarItem icon={<div style={{ width: 20 }}><Users size={20} /></div>} label="Players" isActive={activeView === 'players'} onClick={() => onNavigate('players')} title="Browse active player pool, free agents, and detailed stats." />
                    <SidebarItem
                        icon={
                            <div style={{ width: 20, position: 'relative' }}>
                                <ArrowRightLeft size={20} />
                                {hasNewOffers && (
                                    <div style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: '#ef4444', borderRadius: '50%', border: '2px solid rgba(0,0,0,0.5)', boxShadow: '0 0 5px #ef4444' }} />
                                )}
                            </div>
                        }
                        label="Trade Center"
                        isActive={activeView === 'trade'}
                        onClick={() => onNavigate('trade')}
                        title="Propose and review trade offers with other teams."
                    />
                    <SidebarItem icon={<div style={{ width: 20 }}><BookOpen size={20} /></div>} label="Rules & Info" isActive={activeView === 'rules'} onClick={() => onNavigate('rules')} title="View league constitution, scoring rules, and version info." />
                </nav>

                {/* LOGO WAS HERE - Moved Up */}

                <div style={{ paddingTop: 'clamp(10px, 2vh, 20px)', borderTop: '1px solid rgba(255,255,255,0.2)', zIndex: 10 }}>
                    <SidebarItem icon={<div style={{ width: 20 }}><Settings size={20} /></div>} label="Settings / Create Team" isActive={activeView === 'settings'} onClick={() => onNavigate('settings')} title="Franchise administration and league commissioner settings." />

                    {displayTeam.id !== 'guest' && (
                        <SidebarItem icon={<div style={{ width: 20 }}><LogOut size={20} /></div>} label="Log Out" isActive={false} onClick={() => onSelectTeam('')} title="Sign out of your currently active franchise." />
                    )}
                </div>

                {/* SAVE AND CLOSE BUTTON */}
                <div
                    onClick={onSaveAndClose}
                    title="Persist all changes to disk and exit the application safely."
                    style={{
                        marginTop: '15px',
                        padding: '14px 20px',
                        borderRadius: '50px',
                        cursor: 'pointer',
                        backgroundImage: `url(${leatherTexture}), linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)`,
                        backgroundBlendMode: 'overlay',
                        backgroundSize: 'cover',
                        color: 'white',
                        fontWeight: 900,
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        fontFamily: "'Graduate', sans-serif",
                        letterSpacing: '1px',
                        boxShadow: '0 8px 15px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                        border: '2px solid #ef4444',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        zIndex: 10,
                        overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4)';
                        e.currentTarget.style.filter = 'brightness(1.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
                        e.currentTarget.style.filter = 'brightness(1)';
                    }}
                >
                    {/* GLOSS REFLECTION */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '45%',
                        background: 'linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, transparent 100%)',
                        pointerEvents: 'none'
                    }} />
                    <span style={{ position: 'relative', zIndex: 1 }}>Save and Close</span>
                </div>

                {/* CREATOR BRANDING */}
                <div
                    onMouseEnter={(e) => {
                        const target = e.currentTarget;
                        target.style.transform = 'scale(1.1)';
                        target.style.background = 'rgba(0,0,0,0.85)';
                        target.style.boxShadow = '0 0 20px rgba(234, 179, 8, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        const target = e.currentTarget;
                        target.style.transform = 'scale(1)';
                        target.style.background = 'rgba(0,0,0,0.6)';
                        target.style.boxShadow = 'none';
                    }}
                    style={{
                        marginTop: 'auto',
                        padding: 'clamp(6px, 1vh, 12px) 10px',
                        textAlign: 'center',
                        borderTop: '2px solid #eab308',
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: '12px',
                        margin: 'clamp(10px, 1.5vh, 20px) 0 10px 0',
                        cursor: 'default',
                        transition: 'all 0.3s ease',
                        zIndex: 10
                    }}
                >
                    <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 900,
                        color: '#eab308',
                        fontFamily: "'Graduate', sans-serif",
                        letterSpacing: '1px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                        textTransform: 'uppercase'
                    }}>
                        CREATED BY: DOUG TRIER
                    </div>
                    <div style={{
                        fontSize: '0.65rem',
                        color: '#ffffff',
                        marginTop: '4px',
                        fontWeight: 800,
                        letterSpacing: '2px',
                        opacity: 1
                    }}>
                        © 2026 OFFICIAL
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{
                flex: 1,
                overflowY: 'auto',
                position: 'relative',
                background: `url(/chalkboard-bg.png)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}>
                <div style={{
                    padding: 'clamp(16px, 3vw, 32px) clamp(20px, 4vw, 40px)',
                    maxWidth: '1400px',
                    margin: '0 auto',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {activeView === 'dashboard' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
                            {/* Total Production Points */}
                            <div style={{
                                background: 'rgba(255,255,255,0.05)',
                                padding: '24px',
                                borderRadius: '16px',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                backdropFilter: 'blur(10px)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981' }}>
                                    <Trophy size={20} />
                                    <span style={{
                                        fontSize: '0.9rem',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                                    }}>Total Team Production</span>
                                </div>
                                <div style={{
                                    fontSize: '3.6rem',
                                    fontWeight: 900,
                                    fontFamily: "'Orbitron', sans-serif",
                                    color: '#10b981',
                                    textShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
                                    letterSpacing: '2px',
                                    lineHeight: '1.2'
                                }}>
                                    {(displayTeam.total_production_pts || 0).toLocaleString()} <span style={{ fontSize: '1.2rem', color: '#9ca3af', fontWeight: 600 }}>PTS</span>
                                </div>
                            </div>

                            {/* Trade Points Used */}
                            <div style={{
                                background: 'rgba(255,255,255,0.05)',
                                padding: '24px',
                                borderRadius: '16px',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                backdropFilter: 'blur(10px)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
                                    <Wallet size={20} />
                                    <span style={{
                                        fontSize: '0.9rem',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                                    }}>Trade Points Used</span>
                                </div>
                                <div style={{
                                    fontSize: '3.6rem',
                                    fontWeight: 900,
                                    fontFamily: "'Orbitron', sans-serif",
                                    color: '#ef4444',
                                    textShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
                                    letterSpacing: '2px',
                                    lineHeight: '1.2'
                                }}>
                                    {((displayTeam.points_escrowed || 0) + (displayTeam.points_spent || 0)).toLocaleString()} <span style={{ fontSize: '1.2rem', color: '#9ca3af', fontWeight: 600 }}>PTS</span>
                                </div>
                            </div>

                            {/* Actual League Balance */}
                            <div style={{
                                background: 'rgba(0,0,0,0.4)',
                                padding: '24px',
                                borderRadius: '16px',
                                border: '2px solid #eab308',
                                backdropFilter: 'blur(10px)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                boxShadow: '0 0 20px rgba(234, 179, 8, 0.2)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#eab308' }}>
                                    <Zap size={20} />
                                    <span style={{
                                        fontSize: '0.9rem',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                                    }}>Actual League Balance</span>
                                </div>
                                <div style={{
                                    fontSize: '3.6rem',
                                    fontWeight: 900,
                                    fontFamily: "'Orbitron', sans-serif",
                                    color: '#eab308',
                                    textShadow: '0 0 25px rgba(234, 179, 8, 0.5)',
                                    letterSpacing: '2px',
                                    lineHeight: '1.2'
                                }}>
                                    {((displayTeam.total_production_pts || 0) - (displayTeam.points_spent || 0)).toLocaleString()} <span style={{ fontSize: '1.2rem', color: '#9ca3af', fontWeight: 600 }}>PTS</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {children}
                </div>
            </main>
        </div>
    );
};
