/**
 * PlayerCard — Stylised NFL Trading Card Component
 * ==================================================
 * Renders a player as a collectible-style trading card with a layered
 * background (leather top 55% / turf bottom 45%), team color stripe,
 * player photo, stats, and optional action buttons.
 *
 * VISUAL LAYERS (bottom to top):
 *   1. Leather texture (top half)
 *   2. Turf texture (bottom half)
 *   3. Horizon gradient overlay — sky/stands/turf transition
 *   4. 6px team color stripe at the very top
 *   5. Info panel — paper-white card inset with player name and stats
 *   6. Golden Seal watermark (shown when showSeal=true)
 *
 * The 9:14 aspect ratio matches standard sports card proportions.
 * Font sizes scale fluidly via clamp() so the card works at any grid size.
 *
 * highlightStat: optional floating badge (rotated "sticker") shown for
 * top-ranked players in the PlayerSelector — drives at-a-glance sorting context.
 */
// PlayerCard.tsx — no React import needed because JSX is handled by the
// project's Vite plugin with automatic JSX transform (react-jsx runtime).
// TypeScript will infer React.FC types from @types/react global declarations.
import type { Player } from '../types';
import { Twitter, Instagram } from 'lucide-react';

// GoldenSeal — SVG ownership badge shown in the top-right corner when showSeal=true.
// The metalEmbossPC SVG filter adds specular highlight to simulate a stamped medal.
const GoldenSeal: React.FC<{ size?: number }> = ({ size = 40 }) => (
    <div style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
        flexShrink: 0,
        zIndex: 5
    }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
                <linearGradient id="goldPlatePC" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff9c4" />
                    <stop offset="25%" stopColor="#fde047" />
                    <stop offset="50%" stopColor="#ca8a04" />
                    <stop offset="75%" stopColor="#a16207" />
                    <stop offset="100%" stopColor="#713f12" />
                </linearGradient>
                <filter id="metalEmbossPC">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
                    <feSpecularLighting in="blur" surfaceScale="10" specularConstant="1.2" specularExponent="40" lightingColor="#fff" result="specular">
                        <fePointLight x="-5000" y="-10000" z="20000" />
                    </feSpecularLighting>
                    <feComposite in="specular" in2="SourceAlpha" operator="in" />
                    <feComposite in="SourceGraphic" in2="specular" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
                </filter>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#goldPlatePC)" stroke="#713f12" strokeWidth="2" filter="url(#metalEmbossPC)" />
            <path id="sealPathPC" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
            <text fill="#422006" style={{ fontSize: '8px', fontWeight: 900 }}>
                <textPath href="#sealPathPC">TFF • TRIER FANTASY FOOTBALL • TFF •</textPath>
            </text>
            <text x="50" y="62" textAnchor="middle" fill="#422006" style={{ fontSize: '24px', fontWeight: 950, fontFamily: "'Graduate', serif" }}>TFF</text>
        </svg>
    </div>
);

// ─── Props ─────────────────────────────────────────────────────────────────────
// variant: 'small' is used in PlayerSelector grid; 'large' in standalone views.
// showSeal: true when the card belongs to the currently active team — adds
//   the GoldenSeal badge to visually mark owned players.
interface PlayerCardProps {
    player: Player;
    onAction?: () => void;
    actionLabel?: string;
    variant?: 'small' | 'large';
    highlightStat?: {
        label: string;
        value: string | number;
    };
    onMakeOffer?: () => void;
    showSeal?: boolean;
}

/**
 * PlayerCard renders the physical card. Hover effects are applied inline via
 * event handlers so they degrade gracefully if CSS classes are absent.
 * All font sizes use clamp() for fluid scaling across the card grid.
 */
export const PlayerCard: React.FC<PlayerCardProps> = ({ player, onAction, actionLabel, variant = 'large', highlightStat, onMakeOffer, showSeal }) => {
    // isLarge drives clamp() size ranges throughout the component.
    const isLarge = variant === 'large';

    return (
        <div className={`player-card ${variant}`} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: '#1a1a1a',
            border: '4px solid #fff',
            borderRadius: '16px',
            padding: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
            cursor: onAction ? 'pointer' : 'default',
            width: '100%',
            aspectRatio: '9/14', // TARGET LOCKING REQUIREMENT
            boxSizing: 'border-box',
            fontSize: 'clamp(0.8rem, 1.5vw, 1.1rem)' // FLUID SCALING
        }}
            // onAction guard prevents hover animation when card is display-only.
        onMouseEnter={(e) => {
                if (onAction) {
                    e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)'; // Slight scale up
                    e.currentTarget.style.zIndex = '10';
                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)';
                    e.currentTarget.style.borderColor = '#fff';
                }
            }}
            // Restore card to resting state — must match initial inline style values.
            onMouseLeave={(e) => {
                if (onAction) {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.zIndex = '1';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)';
                    e.currentTarget.style.borderColor = '#fff';
                }
            }}
        >
            {/* BACKGROUND LAYERS */}

            {/* 1. Leather Layer (Top 55%) */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, height: '55%',
                backgroundImage: 'url(/football-leather.png)',
                backgroundSize: '150px auto',
                backgroundRepeat: 'repeat',
                zIndex: 0
            }} />

            {/* 2. Turf Layer (Bottom 45%) */}
            <div style={{
                position: 'absolute',
                top: '55%', left: 0, right: 0, bottom: 0,
                backgroundImage: 'url(/turf-texture.png)',
                backgroundSize: '100px auto', // Finer scale for grass
                backgroundRepeat: 'repeat',
                zIndex: 0
            }} />

            {/* 3. Horizon & Stands Gradient Overlay */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: `
                    radial-gradient(circle at 50% 10%, rgba(255,255,255,0.3) 0%, transparent 60%), /* Sun */
                    linear-gradient(to bottom, 
                        rgba(0,0,0,0.1) 0%,
                        rgba(0,0,0,0) 45%,        
                        rgba(0,0,0,0.4) 50%,      /* Horizon Shadow */
                        #94a3b8 50%,              /* Distant Stands Top */
                        #64748b 55%,              /* Distant Stands Bottom */
                        rgba(21, 128, 61, 0.1) 55%, /* Subtle Green Tint over Turf */
                        rgba(0,0,0,0.3) 100%      /* Vignette at bottom */
                    )
                `,
                zIndex: 1, // Above textures
                pointerEvents: 'none'
            }} />

            {/* Team Color Stripe — hardcoded for top 3 teams; others default to #333.
                Full theme palette is available via teamThemes.ts but not used here
                to keep the PlayerCard self-contained without a heavy lookup. */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: player.team === 'KC' ? '#E31837' : player.team === 'BUF' ? '#00338D' : player.team === 'CHI' ? '#0B162A' : '#333',
                zIndex: 1
            }} />

            {/* HEADER AREA: Photo (Left) + Stat (Right) */}
            <div style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingTop: '8px',
                position: 'relative',
                zIndex: 2
            }}>
                {/* Photo (Left Aligned) */}
                <div style={{
                    width: isLarge ? 'clamp(44px, 8vh, 74px)' : 'clamp(32px, 5vh, 44px)',
                    height: isLarge ? 'clamp(44px, 8vh, 74px)' : 'clamp(32px, 5vh, 44px)',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: '#fff',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    border: 'clamp(1px, 0.3vh, 3px) solid #fff', // Inner white border
                    outline: `clamp(1px, 0.2vh, 2px) solid ${player.team === 'KC' ? '#E31837' : '#333'}`, // Outer team color ring
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    flexShrink: 0
                }}>
                    {player.photoUrl ? (
                        <img src={player.photoUrl} alt={player.lastName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#e5e7eb', borderRadius: '50%' }}>
                            <span style={{ fontSize: isLarge ? '1.2rem' : '0.7rem', fontWeight: 800, color: '#9ca3af' }}>{player.firstName[0]}{player.lastName[0]}</span>
                        </div>
                    )}
                </div>

                {/* Highlight Stat (Right Aligned) */}
                {highlightStat && (
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        color: highlightStat.label === 'PERF DIFF'
                            ? (Number(highlightStat.value) >= 0 ? '#059669' : '#dc2626')
                            : '#b45309',
                        padding: 'clamp(2px, 0.5vh, 6px) clamp(4px, 1vw, 10px)',
                        borderRadius: '0.8vh',
                        textAlign: 'center',
                        minWidth: 'clamp(40px, 8vw, 70px)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        border: highlightStat.label === 'PERF DIFF'
                            ? (Number(highlightStat.value) >= 0 ? '1px solid #059669' : '1px solid #dc2626')
                            : '1px solid #fcd34d',
                        transform: 'rotate(-2deg)' // Slight "sticker" skew
                    }}>
                        <div style={{ fontSize: 'clamp(8px, 0.8vh, 10px)', color: highlightStat.label === 'PERF DIFF' ? (Number(highlightStat.value) >= 0 ? '#065f46' : '#991b1b') : '#78350f', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>{highlightStat.label}</div>
                        <div style={{ fontSize: 'clamp(10px, 1.5vh, 16px)', fontWeight: 900, lineHeight: 1 }}>{typeof highlightStat.value === 'number' ? (highlightStat.value > 0 ? `+${highlightStat.value}` : highlightStat.value) : highlightStat.value}</div>
                    </div>
                )}
            </div>

            {/* INFO AREA: Name, Team, Proj (Centered) */}
            <div style={{
                flex: 1,
                textAlign: 'center',
                width: '100%',
                background: 'rgba(255, 255, 255, 0.92)', // High quality paper-white
                borderRadius: '10px',
                padding: '10px 6px',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid rgba(255,255,255,1)',
                position: 'relative',
                zIndex: 2
            }}>
                {/* Watermark Seal - OFFICIAL TFF WATERMARK */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-15deg)',
                    width: '80%',
                    height: '80%',
                    opacity: 0.08,
                    pointerEvents: 'none',
                    zIndex: 0
                }}>
                    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                        <circle cx="50" cy="50" r="48" fill="none" stroke="#111827" strokeWidth="2" />
                        <path id="wmPathCard" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
                        <text fill="#111827" style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>
                            <textPath href="#wmPathCard" startOffset="50%" textAnchor="middle">OFFICIAL TRIER FANTASY FOOTBALL SEAL •</textPath>
                        </text>
                        <text x="50" y="60" textAnchor="middle" fill="#111827" style={{ fontSize: '28px', fontWeight: 950, fontFamily: "'Graduate', serif" }}>TFF</text>
                    </svg>
                </div>

                {/* Ownership Seal Overlay — rendered above the watermark when showSeal=true.
                    Positioned slightly outside the card boundary for a "sticker" effect. */}
                {showSeal && (
                    <div style={{ position: 'absolute', top: '-10px', right: '-5px', zIndex: 10 }}>
                        <GoldenSeal size={isLarge ? 45 : 30} />
                    </div>
                )}
                <div style={{ fontWeight: 800, fontSize: '1.2em', color: '#111827', marginBottom: '4px', lineHeight: 1.2, letterSpacing: '-0.02em', position: 'relative', zIndex: 1 }}>
                    {player.firstName} {player.lastName}
                </div>
                <div style={{ fontSize: '0.9em', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                    <span style={{ fontWeight: 800, color: '#111827', background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '0.8em' }}>{player.position}</span>
                    <span style={{ fontSize: '0.8em', color: '#9ca3af' }}>•</span>
                    <span style={{ fontWeight: 700, color: '#4b5563' }}>{player.team}</span>
                </div>
                <div style={{ marginTop: '2px', fontWeight: 800, color: '#059669', fontSize: '1.4em', letterSpacing: '-0.03em', position: 'relative', zIndex: 1 }}>
                    {player.projectedPoints} <span style={{ fontSize: '0.6em', color: '#6b7280', fontWeight: 600, letterSpacing: '0' }}>proj</span>
                </div>

                {/* Social Media Icons */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px', minHeight: isLarge ? '16px' : '12px', alignItems: 'center' }}>
                    {player.socials?.twitter && (
                        <a href={`https://twitter.com/${player.socials.twitter}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1DA1F2', display: 'flex', alignItems: 'center', transition: 'transform 0.2s' }} title={`@${player.socials.twitter}`}>
                            <Twitter size={isLarge ? 16 : 12} />
                        </a>
                    )}
                    {player.socials?.instagram && (
                        <a href={`https://instagram.com/${player.socials.instagram}`} target="_blank" rel="noopener noreferrer" style={{ color: '#E1306C', display: 'flex', alignItems: 'center', transition: 'transform 0.2s' }} title={`@${player.socials.instagram}`}>
                            <Instagram size={isLarge ? 16 : 12} />
                        </a>
                    )}
                    {onMakeOffer && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMakeOffer(); }}
                            title={`Initiate a trade offer for ${player.lastName}`}
                            style={{
                                background: '#eab308',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.6rem',
                                fontWeight: 900,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                            }}
                        >
                            OFFER
                        </button>
                    )}
                </div>
            </div>

            {/* ACTION AREA */}
            {/* ACTION AREA: rendered only when onAction is provided.
                e.stopPropagation() prevents the card's own onClick from firing too. */}
            {onAction && (
                <button
                    onClick={(e) => { e.stopPropagation(); onAction(); }}
                    title={actionLabel || "View player profile"}
                    className="btn"
                    style={{
                        fontSize: '0.75rem',
                        padding: '8px 12px',
                        width: '100%',
                        marginTop: '12px',
                        background: '#1f2937', // Dark button
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        position: 'relative',
                        zIndex: 2
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#000';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#1f2937';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    {actionLabel || 'Select Player'}
                </button>
            )}
        </div>
    );
};
