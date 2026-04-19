/**
 * Layout_Dashboard — Application Shell with Sidebar Navigation
 * =============================================================
 * Provides the full-screen layout: a fixed sidebar on the left and a
 * scrollable content area on the right. All page navigation routes through
 * the sidebar items, which report back via onNavigate.
 *
 * SIDEBAR DESIGN:
 *   - Turf background texture + repeating yard-marker lines for stadium feel.
 *   - Each nav item uses a gel/leather material effect when active, simulating
 *     a dimensional placard on the field wall.
 *   - Dashboard and My Team items are disabled (pointer-events: none) for guests
 *     who haven't selected a team yet.
 *
 * STATUS BAR:
 *   Shows season state and data validation status from ScoringEngine so managers
 *   always know whether scores are provisional or officially verified.
 *
 * TRADE BADGE:
 *   Red dot appears on Trade Center nav item when hasNewOffers is true,
 *   alerting the user to pending incoming offers without disrupting flow.
 */
// External imports — lucide-react icons are tree-shaken at build time so only
// the imported names contribute to bundle size. Each icon is ~1KB gzipped.
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Trophy, User, Settings, LogOut, BookOpen, Swords, Wallet, Zap, ArrowRightLeft, Wifi, ClipboardList, Gavel, TrendingUp, Archive, ChevronDown, Plus, Trash2, Star } from 'lucide-react';
// ScoringEngine is read-only here (getOrchestrationStatus); no mutation occurs.
// It is imported as a module-level singleton — no React state needed for status.
import { ScoringEngine } from '../utils/ScoringEngine';
import type { FantasyTeam } from '../types';
import type { LeagueSlot } from '../services/MultiLeagueService';
// Static assets — resolved to hashed filenames by Vite at build time.
import turfBg from '../assets/turf1.jpg';
import leatherTexture from '../assets/leather_texture.png';
import brandedFootball from '../assets/branded_football_on_grass.png';

// ─── Sub-Component: SidebarItem ───────────────────────────────────────────────
// Each nav link uses a gel/leather material effect when active. The high-gloss
// reflection div is a purely decorative pseudo-element implemented as a real
// DOM node because CSS ::before is unavailable on inline-styled elements.

interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
    title?: string;
}

// SidebarItem renders a single navigation entry with stadium-themed styling.
// The hover handlers mutate inline styles directly to avoid re-render overhead
// on rapid mouse events (dozens of items × each mouse move = noisy state diff).
const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, isActive, onClick, title }) => (
    <div
        onClick={onClick}
        title={title || label}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 18px',
            margin: '0',
            borderRadius: '50px', // STADIUM OVAL
            cursor: 'pointer',
            // leather_texture.png is the dark pebbled hide — cover fills the oval pill.
            backgroundImage: isActive ? `url(${leatherTexture})` : 'none',
            backgroundColor: isActive ? '#1a0a03' : 'rgba(0,0,0,0.3)',
            backgroundBlendMode: 'normal',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: isActive ? '#fff' : 'white', // White text for contrast on dark leather
            fontWeight: isActive ? 800 : 600,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease',
            willChange: 'transform',
            // Inset highlights simulate a convex surface catching overhead light.
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
        // onMouseEnter: lift up + intensify shadow for active, lighten bg for inactive.
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            if (!isActive) {
                // Hover: same leather texture as active — feels tactile before clicking
                e.currentTarget.style.backgroundImage = `url(${leatherTexture})`;
                e.currentTarget.style.backgroundColor = '#1a0a03';
                e.currentTarget.style.backgroundBlendMode = 'normal';
                e.currentTarget.style.backgroundSize = 'cover';
                e.currentTarget.style.backgroundPosition = 'center';
                e.currentTarget.style.borderColor = 'rgba(234, 179, 8, 0.4)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)';
            } else {
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.5)';
            }
        }}
        // onMouseLeave: restore resting state — translate back, reset leather.
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            if (!isActive) {
                e.currentTarget.style.backgroundImage = 'none';
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.3)';
                e.currentTarget.style.backgroundSize = '';
                e.currentTarget.style.backgroundPosition = '';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)';
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
                textShadow: '0 1px 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.7)',
                letterSpacing: '0.02em',
                fontSize: '0.95rem',
                fontFamily: "'Inter', sans-serif",
                color: isActive ? '#fff' : '#e5e7eb'
            }}>{label}</span>
        </div>
    </div>
);

// ─── Main Component Props ──────────────────────────────────────────────────────
// hasNewOffers drives the red notification dot on the Trade Center nav item.
// onSaveAndClose triggers Tauri persist + window.close(); it bypasses normal
// React navigation so it lives here rather than in the settings page.

interface LayoutDashboardProps {
    children: React.ReactNode;
    activeView: string;
    onNavigate: (view: string) => void;
    userTeams: FantasyTeam[];
    activeTeamId: string;
    onSelectTeam: (id: string) => void;
    onSaveAndClose: () => void;
    hasNewOffers?: boolean;
    // Multi-league
    leagues?: LeagueSlot[];
    activeLeagueId?: string;
    onSwitchLeague?: (id: string) => void;
    onCreateLeague?: () => void;
    onDeleteLeague?: (id: string) => void;
    // Dynasty
    dynastyEnabled?: boolean;
}

/**
 * Layout_Dashboard — top-level app shell.
 * Renders the fixed sidebar and the scrollable main content area. The KPI
 * header (Total Production / Trade Points Used / Balance) is only injected
 * when activeView === 'dashboard'; all other views receive a plain {children}
 * slot so they can control their own padding and layout.
 */
export const Layout_Dashboard: React.FC<LayoutDashboardProps> = ({
    children,
    activeView,
    onNavigate,
    userTeams,
    activeTeamId,
    onSelectTeam,
    onSaveAndClose,
    hasNewOffers,
    leagues = [],
    activeLeagueId = '',
    onSwitchLeague,
    onCreateLeague,
    onDeleteLeague,
    dynastyEnabled = false,
}) => {
    const [leagueMenuOpen, setLeagueMenuOpen] = useState(false);

    // Find the active team from the userTeams array for KPI display.
    // Linear scan is fine — leagues rarely exceed 20 teams.
    const activeTeam = userTeams.find(t => t.id === activeTeamId);

    // Guest Mode: when no team is selected (e.g. first launch or after team deletion),
    // render a stub so the layout doesn't crash on missing team properties.
    const displayTeam = activeTeam || {
        name: 'Guest User',
        ownerName: 'Read Only Mode',
        id: 'guest',
        roster: {}, bench: [], transactions: [],
        total_production_pts: 0, points_escrowed: 0, points_spent: 0
    } as unknown as FantasyTeam;

    // Sidebar zoom scale — proportional to window height, clamped to [0.72, 1.0].
    // At 900px tall the sidebar renders at 100%; at 720px it scales to 0.80×.
    const calcScale = () => Math.max(0.72, Math.min(window.innerHeight / 900, 1.0));
    const [sidebarScale, setSidebarScale] = useState(calcScale);
    useEffect(() => {
        const onResize = () => setSidebarScale(calcScale());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // overflow:hidden on the outer wrapper prevents the sidebar from causing
    // horizontal scroll; only the <main> element scrolls vertically.
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
                flexShrink: 0,
                zoom: sidebarScale,
                transformOrigin: 'top left',
            }}>
                {/* Yard Markers Overlay — repeating white stripes at 40px intervals
                    simulate sideline yard-marker lines; purely decorative */}
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
                <div style={{ marginBottom: 'clamp(2px, 0.4vw, 6px)', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                    <h1 style={{
                        fontSize: 'clamp(0.9rem, 2.4vw, 2.6rem)',
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
                    margin: '0 0 clamp(3px, 0.5vh, 8px) 0',
                    paddingLeft: '30px', // Offset for Yard Markers
                    position: 'relative',
                    zIndex: 10,
                    minHeight: '40px',
                    flexShrink: 0
                }}>
                    <div style={{
                        width: 'clamp(80px, 12vh, 140px)',
                        height: 'clamp(80px, 12vh, 140px)',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '4px solid rgba(234, 179, 8, 0.4)',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                        // Radial gradient mask fades the football image to transparent
                        // at the edges, blending it naturally into the sidebar background.
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

                {/* ── League Switcher ───────────────────────────────────────────
                    Compact dropdown: shows active league name, lists others, allows
                    creating or deleting leagues. Rendered above the status bar. */}
                {leagues.length > 0 && (
                    <div style={{ position: 'relative', marginBottom: 'clamp(3px, 0.5vh, 7px)', zIndex: 30 }}>
                        <button
                            onClick={() => setLeagueMenuOpen(v => !v)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '5px 10px', background: 'rgba(234,179,8,0.12)',
                                border: '1px solid rgba(234,179,8,0.4)', borderRadius: '8px',
                                color: '#eab308', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                                letterSpacing: '0.04em', gap: '6px',
                            }}
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {leagues.find(l => l.id === activeLeagueId)?.name || 'Select League'}
                            </span>
                            <ChevronDown size={12} style={{ flexShrink: 0, transform: leagueMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>

                        {leagueMenuOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                background: 'rgba(10,14,26,0.97)', backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(234,179,8,0.35)', borderRadius: '8px',
                                overflow: 'hidden', zIndex: 100,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
                            }}>
                                {leagues.map(slot => (
                                    <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px', background: slot.id === activeLeagueId ? 'rgba(234,179,8,0.15)' : 'transparent', cursor: 'pointer' }}
                                        onClick={() => { onSwitchLeague?.(slot.id); setLeagueMenuOpen(false); }}>
                                        <span style={{ flex: 1, fontSize: '0.78rem', color: slot.id === activeLeagueId ? '#eab308' : '#d1d5db', fontWeight: slot.id === activeLeagueId ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {slot.name}
                                        </span>
                                        {slot.id === activeLeagueId && (
                                            <span style={{ fontSize: '0.6rem', color: '#eab308', fontWeight: 800, flexShrink: 0 }}>●</span>
                                        )}
                                        {leagues.length > 1 && (
                                            <button
                                                onClick={e => { e.stopPropagation(); onDeleteLeague?.(slot.id); setLeagueMenuOpen(false); }}
                                                title="Delete league"
                                                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '5px 8px' }}>
                                    <button
                                        onClick={() => { onCreateLeague?.(); setLeagueMenuOpen(false); }}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '3px 0' }}
                                    >
                                        <Plus size={12} /> New League
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Orchestration Status Bar — green dot = VALIDATED (cross-checked),
                    red dot = any other state (in-progress, provisional, or missing).
                    Tooltip expands abbreviations for non-technical commissioners. */}
                <div
                    title={`Season: ${ScoringEngine.getOrchestrationStatus().season_state} | Data: ${ScoringEngine.getOrchestrationStatus().data_status}\n\n- COMPLETED_OFFICIAL: All games finished and verified.\n- VALIDATED: Points cross-checked against official box scores.`}
                    style={{
                        marginBottom: 'clamp(3px, 0.6vh, 8px)',
                        padding: '5px 10px',
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
                        letterSpacing: '0.05em',
                        textShadow: '0 1px 3px rgba(0,0,0,1)'
                    }}>
                        {String(ScoringEngine.getOrchestrationStatus().season_state ?? '')}: {String(ScoringEngine.getOrchestrationStatus().data_status ?? '')}
                    </span>
                </div>

                {/* ── Navigation Links ──────────────────────────────────────────────
                    justifyContent:'space-evenly' distributes items without hard-coded
                    pixel gaps, so the sidebar scales cleanly on short screens. */}
                <nav style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: '0', zIndex: 10, overflowY: 'hidden', minHeight: 0 }}>

                    {/* Dashboard & My Team: Disabled for guests.
                        Opacity 0.3 + pointer-events:none visually greys out and
                        prevents click without removing the element from the DOM. */}
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
                    <SidebarItem icon={<div style={{ width: 20 }}><TrendingUp size={20} /></div>} label="Projections" isActive={activeView === 'projections'} onClick={() => onNavigate('projections')} title="Season projections vs actuals — position rankings, boom/bust, scatter analysis." />
                    <SidebarItem icon={<div style={{ width: 20 }}><Archive size={20} /></div>} label="Archive" isActive={activeView === 'archive'} onClick={() => onNavigate('archive')} title="Browse past league seasons — champion banners, final standings, top scorers." />
                    <SidebarItem icon={<div style={{ width: 20 }}><ClipboardList size={20} /></div>} label="Draft Simulator" isActive={activeView === 'draft'} onClick={() => onNavigate('draft')} title="Run a mock snake draft against AI opponents." />
                    <SidebarItem icon={<div style={{ width: 20 }}><Gavel size={20} /></div>} label="Waiver Wire" isActive={activeView === 'waiver'} onClick={() => onNavigate('waiver')} title="Browse free agents and place blind FAAB bids." />
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
                    {dynastyEnabled && (
                        <SidebarItem icon={<div style={{ width: 20 }}><Star size={20} /></div>} label="Dynasty" isActive={activeView === 'dynasty'} onClick={() => onNavigate('dynasty')} title="Keeper selection, draft picks, and dynasty standings." />
                    )}
                    <SidebarItem icon={<div style={{ width: 20 }}><BookOpen size={20} /></div>} label="Rules & Info" isActive={activeView === 'rules'} onClick={() => onNavigate('rules')} title="View league constitution, scoring rules, and version info." />
                    <SidebarItem icon={<div style={{ width: 20 }}><Wifi size={20} /></div>} label="Network" isActive={activeView === 'network'} onClick={() => onNavigate('network')} title="Find and connect to other Trier Fantasy managers. Configure P2P and TURN settings." />
                </nav>

                {/* LOGO WAS HERE - Moved Up */}

                <div style={{ paddingTop: 'clamp(4px, 0.8vh, 10px)', borderTop: '1px solid rgba(255,255,255,0.2)', zIndex: 10 }}>
                    <SidebarItem icon={<div style={{ width: 20 }}><Settings size={20} /></div>} label="Settings / Create Team" isActive={activeView === 'settings'} onClick={() => onNavigate('settings')} title="Franchise administration and league commissioner settings." />

                    {/* Log Out clears the active team — onSelectTeam('') signals
                        the parent (App.tsx) to drop back to the team-selection screen */}
                    {displayTeam.id !== 'guest' && (
                        <SidebarItem icon={<div style={{ width: 20 }}><LogOut size={20} /></div>} label="Log Out" isActive={false} onClick={() => onSelectTeam('')} title="Sign out of your currently active franchise." />
                    )}
                </div>

                {/* ── Save and Close Button ─────────────────────────────────────────
                    Placed below Settings/Logout so it's never accidentally clicked
                    during normal navigation. Red leather treatment signals "exit". */}
                <div
                    onClick={onSaveAndClose}
                    title="Persist all changes to disk and exit the application safely."
                    style={{
                        marginTop: '6px',
                        padding: '9px 20px',
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
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease',
                        willChange: 'transform',
                        position: 'relative',
                        zIndex: 10,
                        overflow: 'hidden'
                    }}
                    // brightness(1.1) on hover gives tactile "press about to happen" feedback.
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4)';
                        e.currentTarget.style.filter = 'brightness(1.1)';
                    }}
                    // Restore resting state on leave — no lingering hover effects.
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

                {/* ── Creator Branding + Donate ─────────────────────────────────────
                    Anchored to the sidebar bottom via marginTop:'auto'.
                    The donate link uses Tauri shell.open() when running as a desktop
                    app, falling back to window.open() in browser previews. */}
                <div
                    style={{
                        marginTop: 'auto',
                        padding: 'clamp(6px, 1vh, 12px) 10px',
                        textAlign: 'center',
                        borderTop: '2px solid #eab308',
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: '12px',
                        margin: 'clamp(4px, 0.7vh, 10px) 0 4px 0',
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
                        fontSize: '0.6rem',
                        color: '#eab308',
                        marginTop: '3px',
                        fontWeight: 700,
                        letterSpacing: '1.5px',
                        opacity: 0.85,
                        textTransform: 'uppercase',
                        fontFamily: "'Graduate', sans-serif"
                    }}>
                        a Trier OS product
                    </div>

                    {/* SPONSOR BUTTON — uses Tauri shell.open for desktop, window.open as browser fallback */}
                    <a
                        href="https://github.com/sponsors/DougTrier"
                        onClick={(e) => {
                            e.preventDefault();
                            import('@tauri-apps/api/shell').then(({ open }) =>
                                open('https://github.com/sponsors/DougTrier')
                            ).catch(() =>
                                window.open('https://github.com/sponsors/DougTrier', '_blank')
                            );
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            marginTop: '8px',
                            padding: '7px 14px',
                            background: 'linear-gradient(135deg, #2d333b 0%, #1c2128 100%)',
                            borderRadius: '50px',
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: '0.72rem',
                            textDecoration: 'none',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            fontFamily: "'Graduate', sans-serif",
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px) scale(1.04)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.15)';
                            e.currentTarget.style.filter = 'brightness(1.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)';
                            e.currentTarget.style.filter = 'brightness(1)';
                        }}
                    >
                        <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>♥</span>
                        SPONSOR ON GITHUB
                    </a>

                    <div style={{
                        fontSize: '0.65rem',
                        color: '#ffffff',
                        marginTop: '6px',
                        fontWeight: 800,
                        letterSpacing: '2px',
                        opacity: 1
                    }}>
                        © 2026 OFFICIAL
                    </div>
                </div>
            </aside>

            {/* ── Main Content Area ────────────────────────────────────────────── */}
            {/* Scrollable right-hand panel. All page components render here as  */}
            {/* children, passed from App.tsx based on activeView.               */}
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
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* ── Dashboard Overview — 3-metric KPI header ──────────────────── */}
                    {/* Shown only on the dashboard view; other views render just {children} */}
                    {/* KPI panel is injected before {children} on the dashboard view.
                        Other views skip this entirely and receive unobstructed {children}. */}
                    {activeView === 'dashboard' && (
                        // 3-column grid keeps the KPIs at equal width regardless of values.
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
                            {/* Total Production Points — sum of all actual fantasy points earned */}
                            <div style={{
                                background: 'rgba(0,0,0,0.6)',
                                padding: '24px',
                                borderRadius: '16px',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                backdropFilter: 'blur(16px)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981' }}>
                                    <Trophy size={20} />
                                    <span style={{
                                        fontSize: '0.9rem',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        textShadow: '0 1px 3px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.8)'
                                    }}>Total Team Production</span>
                                </div>
                                <div style={{
                                    fontSize: '3.6rem',
                                    fontWeight: 900,
                                    fontFamily: "'Orbitron', sans-serif",
                                    color: '#10b981',
                                    textShadow: '0 0 20px rgba(16,185,129,0.5), 0 2px 4px rgba(0,0,0,0.9)',
                                    letterSpacing: '2px',
                                    lineHeight: '1.2'
                                }}>
                                    {(displayTeam.total_production_pts || 0).toLocaleString()} <span style={{ fontSize: '1.2rem', color: '#d1d5db', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,1)' }}>PTS</span>
                                </div>
                            </div>

                            {/* Trade Points Used — escrowed + spent (both reduce available balance) */}
                            <div style={{
                                background: 'rgba(0,0,0,0.6)',
                                padding: '24px',
                                borderRadius: '16px',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                backdropFilter: 'blur(16px)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
                                    <Wallet size={20} />
                                    <span style={{
                                        fontSize: '0.9rem',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        textShadow: '0 1px 3px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.8)'
                                    }}>Trade Points Used</span>
                                </div>
                                <div style={{
                                    fontSize: '3.6rem',
                                    fontWeight: 900,
                                    fontFamily: "'Orbitron', sans-serif",
                                    color: '#ef4444',
                                    textShadow: '0 0 20px rgba(239,68,68,0.5), 0 2px 4px rgba(0,0,0,0.9)',
                                    letterSpacing: '2px',
                                    lineHeight: '1.2'
                                }}>
                                    {/* Escrowed = held for pending offers; Spent = finalized trades.
                                        Both reduce the usable balance so they're summed here. */}
                                    {((displayTeam.points_escrowed || 0) + (displayTeam.points_spent || 0)).toLocaleString()} <span style={{ fontSize: '1.2rem', color: '#d1d5db', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,1)' }}>PTS</span>
                                </div>
                            </div>

                            {/* Available Balance = total_production_pts - points_escrowed - points_spent */}
                            <div style={{
                                background: 'rgba(0,0,0,0.65)',
                                padding: '24px',
                                borderRadius: '16px',
                                border: '2px solid #eab308',
                                backdropFilter: 'blur(16px)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                boxShadow: '0 0 25px rgba(234,179,8,0.2), 0 8px 24px rgba(0,0,0,0.6)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#eab308' }}>
                                    <Zap size={20} />
                                    <span style={{
                                        fontSize: '0.9rem',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        textShadow: '0 1px 3px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.8)'
                                    }}>Actual League Balance</span>
                                </div>
                                <div style={{
                                    fontSize: '3.6rem',
                                    fontWeight: 900,
                                    fontFamily: "'Orbitron', sans-serif",
                                    color: '#eab308',
                                    textShadow: '0 0 25px rgba(234,179,8,0.6), 0 2px 4px rgba(0,0,0,0.9)',
                                    letterSpacing: '2px',
                                    lineHeight: '1.2'
                                }}>
                                    {/* Escrowed points are NOT subtracted here because they're
                                        only reserved; the balance becomes final on trade accept. */}
                                    {((displayTeam.total_production_pts || 0) - (displayTeam.points_spent || 0)).toLocaleString()} <span style={{ fontSize: '1.2rem', color: '#d1d5db', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,1)' }}>PTS</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* All non-dashboard views render their full page component here */}
                    {children}
                </div>
            </main>
        </div>
    );
};
