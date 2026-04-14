import React, { useMemo } from 'react';
import type { FantasyTeam, Player } from '../types';
// import turfBg from '../assets/turf1.jpg'; // Removed
import leatherTexture from '../assets/leather_texture.png';
import { Plus, Lock, Twitter, Instagram, Activity } from 'lucide-react';
import { MiniPlayerCard } from './MiniPlayerCard';
import { ScoringEngine } from '../utils/ScoringEngine';

interface RosterProps {
    team: FantasyTeam;
    lockedTeams: string[];
    onSelectSlot?: (slotId: string) => void;
    onSelectPlayer?: (player: Player) => void;
    swapCandidate?: Player | null;
}

import { getTeamTheme } from '../utils/teamThemes';
import { isPlayerLocked } from '../utils/gamedayLogic';

const RosterSlot = ({
    label,
    player,
    onClick,
    isLocked,
    isSwapTarget
}: {
    label: string;
    player: Player | null;
    onClick: () => void;
    isLocked?: boolean;
    isSwapTarget?: boolean;
}) => {
    const theme = player ? getTeamTheme(player.team) : null;
    return (
        <div
            onClick={onClick}
            title={player ? `View details for ${player.firstName} ${player.lastName}` : `Select a player for the ${label} slot`}
            style={{
                display: 'flex',
                alignItems: 'center',
                // Ultra-Gloss: High contrast top shine vs dark bottom
                background: player
                    ? `linear-gradient(to bottom, 
                    rgba(255,255,255,0.25) 0%, 
                    rgba(255,255,255,0.05) 48%, 
                    rgba(255,255,255,0.0) 49%, 
                    rgba(0,0,0,0.1) 50%, 
                    rgba(0,0,0,0.3) 100%),
                   linear-gradient(135deg, ${theme?.primary} 0%, ${theme?.primary}D9 100%)`
                    : 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(10px)',
                // Crisp Glass Rim: Very bright top edge
                boxShadow: player
                    ? `0 10px 20px rgba(0,0,0,0.5), 
                   inset 0 1px 0 rgba(255,255,255,0.6), 
                   inset 0 0 20px rgba(0,0,0,0.2)`
                    : 'none',
                border: player
                    ? `1px solid rgba(255,255,255,0.15)`
                    : '2px dashed rgba(255, 255, 255, 0.2)',
                borderLeft: player ? `6px solid ${theme?.secondary}` : '2px dashed rgba(255, 255, 255, 0.2)',
                padding: '12px 20px',
                borderRadius: '12px',
                marginBottom: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                ...(isSwapTarget && {
                    border: '2px solid #eab308',
                    boxShadow: '0 0 20px rgba(234, 179, 8, 0.4)',
                    animation: 'pulse 2s infinite'
                })
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
                if (player) {
                    e.currentTarget.style.borderColor = 'rgba(234, 179, 8, 0.6)';
                } else {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = player ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none';
                if (player) {
                    e.currentTarget.style.borderColor = isLocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)';
                } else {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                    e.currentTarget.style.borderColor = isLocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.15)';
                }
            }}
        >
            {/* Lock Indicator */}
            {isLocked && (
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#ef4444',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    zIndex: 20,
                    background: 'rgba(0,0,0,0.4)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    letterSpacing: '1px'
                }}>
                    <Lock size={12} />
                    LOCKED
                </div>
            )}
            {isSwapTarget && (
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '20px',
                    background: '#eab308',
                    color: '#000',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    padding: '4px 10px',
                    borderRadius: '20px',
                    zIndex: 30,
                    letterSpacing: '1px'
                }}>
                    SWAP TARGET
                </div>
            )}
            {/* Glow Effect for Active Players */}
            {player && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(234, 179, 8, 0.5), transparent)',
                }} />
            )}

            {/* Slot Icon Area / Mini Card */}
            <div style={{ marginRight: '24px', flexShrink: 0 }}>
                {player ? (
                    <MiniPlayerCard player={player} slotLabel={label} />
                ) : (
                    /* Empty Slot Placeholder (Maintains same size for alignment) */
                    <div style={{
                        width: '64px',
                        height: '96px',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '2px dashed rgba(255,255,255,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                    }}>
                        <span style={{
                            color: 'rgba(255,255,255,0.3)',
                            fontFamily: "'Graduate', sans-serif",
                            fontSize: '0.9rem',
                            fontWeight: 900
                        }}>{label}</span>
                        <Plus size={16} color="rgba(255,255,255,0.2)" />
                    </div>
                )}
            </div>

            {/* Player Content */}
            <div style={{ flex: 1 }}>
                {player ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{
                                fontWeight: '800',
                                color: '#fff',
                                fontSize: '1.4rem',
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                fontFamily: "'Graduate', sans-serif",
                                letterSpacing: '0.5px'
                            }}>
                                {player.firstName} {player.lastName}
                            </div>
                            <div style={{
                                fontSize: '0.9rem',
                                color: '#eab308',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '2px',
                                fontWeight: 600
                            }}>
                                <span>{player.team}</span>
                                <span style={{ color: '#4b5563' }}>•</span>
                                <span>{player.position}</span>
                            </div>
                            {/* Social Media Icons */}
                            {player.socials && (
                                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                    {player.socials.twitter && (
                                        <a
                                            href={`https://twitter.com/${player.socials.twitter}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#1DA1F2', display: 'flex', alignItems: 'center', transition: 'transform 0.2s', zIndex: 50 }}
                                            title={`@${player.socials.twitter}`}
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <Twitter size={14} />
                                        </a>
                                    )}
                                    {player.socials.instagram && (
                                        <a
                                            href={`https://instagram.com/${player.socials.instagram}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#E1306C', display: 'flex', alignItems: 'center', transition: 'transform 0.2s', zIndex: 50 }}
                                            title={`@${player.socials.instagram}`}
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <Instagram size={14} />
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', opacity: 0.6 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#fff', fontFamily: "'Graduate', sans-serif" }}>{player.projectedPoints.toFixed(2)}</div>
                                <div style={{ fontSize: '0.55rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}>PROJ PTS</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: '4px' }}>
                                <div style={{
                                    fontSize: '1.8rem',
                                    fontWeight: '900',
                                    color: ScoringEngine.getOrchestrationStatus().season_state === 'COMPLETED_OFFICIAL' ? '#eab308' : '#10b981',
                                    fontFamily: "'Graduate', sans-serif",
                                    textShadow: `0 0 15px ${ScoringEngine.getOrchestrationStatus().season_state === 'COMPLETED_OFFICIAL' ? 'rgba(234, 179, 8, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                                    lineHeight: 1
                                }}>{((ScoringEngine.calculatePoints(player).total ?? 0).toFixed(2))}</div>
                                <div style={{
                                    fontSize: '0.65rem',
                                    color: ScoringEngine.getOrchestrationStatus().season_state === 'COMPLETED_OFFICIAL' ? '#eab308' : '#10b981',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    fontWeight: 900
                                }}>
                                    {ScoringEngine.getOrchestrationStatus().season_state === 'COMPLETED_OFFICIAL' ? 'Final Pts' : 'Provisional'}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6b7280' }}>
                        <span style={{ fontStyle: 'italic', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.5px' }}>ADD PLAYER TO {label}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export const Roster: React.FC<RosterProps> = ({ team, onSelectSlot, onSelectPlayer, lockedTeams, swapCandidate }) => {
    // Explicit list of slots to verify type safety and order
    const starters = [
        { key: 'qb', label: 'QB' },
        { key: 'rb1', label: 'RB' },
        { key: 'rb2', label: 'RB' },
        { key: 'wr1', label: 'WR' },
        { key: 'wr2', label: 'WR' },
        { key: 'te', label: 'TE' },
        { key: 'flex', label: 'FLEX' },
        { key: 'k', label: 'K' },
        { key: 'dst', label: 'DEF' },
    ] as const;

    const { teamProjection, teamActual } = useMemo(() => {
        const proj = starters.reduce((acc, slot) => {
            const p = team.roster[slot.key];
            return acc + (p?.projectedPoints || 0);
        }, 0);

        const actual = ScoringEngine.calculateTeamTotal(team).total;

        return { teamProjection: proj, teamActual: actual };
    }, [team]);

    const checkPos = (p: Player, slotLabel: string) => {
        const s = slotLabel.toUpperCase();
        if (s.startsWith('QB')) return p.position === 'QB';
        if (s.startsWith('RB')) return p.position === 'RB';
        if (s.startsWith('WR')) return p.position === 'WR';
        if (s.startsWith('TE')) return p.position === 'TE';
        if (s.startsWith('K')) return p.position === 'K';
        if (s.startsWith('DEF') || s.startsWith('DST')) return p.position === 'DST';
        if (s.startsWith('FLEX')) return ['RB', 'WR', 'TE'].includes(p.position);
        return true; // Bench
    };

    const handleSlotClick = (slotKey: string, player: Player | null) => {
        if (player && onSelectPlayer) {
            onSelectPlayer(player);
        } else if (onSelectSlot) {
            onSelectSlot(slotKey);
        }
    };

    return (
        <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            // Main container style
            background: `url(/field-background.png)`,
            backgroundSize: 'cover', // Span the whole panel
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            borderRadius: '24px',
            border: '4px solid #eab308',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 100px rgba(0,0,0,0.7)', // Deep vignette
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Dark Overlay to make text legible on turf */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.65)',
                padding: '40px'
            }}>

                {/* Header */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: '40px',
                    position: 'relative'
                }}>
                    <h2 style={{
                        fontSize: '3rem',
                        fontWeight: 900,
                        fontFamily: "'Graduate', sans-serif",
                        margin: 0,
                        color: 'transparent',
                        backgroundImage: `url(${leatherTexture})`,
                        backgroundSize: '150px',
                        backgroundPosition: 'center',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextStroke: '1.5px rgba(255,255,255,0.9)',
                        textShadow: '0 4px 10px rgba(0,0,0,0.8)',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        display: 'inline-block'
                    }}>
                        Starting Lineup
                    </h2>
                    <div style={{
                        height: '4px',
                        width: '100px',
                        background: '#eab308',
                        margin: '10px auto 15px',
                        borderRadius: '2px',
                        boxShadow: '0 0 10px rgba(234, 179, 8, 0.5)'
                    }} />
                    <div style={{
                        background: swapCandidate ? 'rgba(234, 179, 8, 0.2)' : 'rgba(234, 179, 8, 0.1)',
                        border: swapCandidate ? '2px solid #eab308' : '1px solid rgba(234, 179, 8, 0.3)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '10px 30px',
                        backdropFilter: 'blur(5px)',
                        position: 'relative'
                    }}>
                        {swapCandidate ? (
                            <>
                                <div style={{ fontSize: '0.7rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800 }}>Swapping {swapCandidate.lastName}</div>
                                <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 900 }}>Select Valid Target</div>
                                <button
                                    onClick={() => handleSlotClick('', swapCandidate)} // Hack to trigger cancel in App
                                    title="Cancel the current player swap operation."
                                    style={{
                                        marginTop: '10px',
                                        background: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '4px 8px',
                                        fontSize: '0.7rem',
                                        fontWeight: 900,
                                        cursor: 'pointer'
                                    }}
                                >
                                    CANCEL SWAP
                                </button>
                            </>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800 }}>Roster Projection</div>
                                    <div style={{ fontSize: '1.8rem', color: 'rgba(234, 179, 8, 0.6)', fontWeight: 900, fontFamily: "'Graduate', sans-serif" }}>{teamProjection.toFixed(2)}</div>
                                </div>
                                <div style={{ width: '1px', height: '100%', background: 'rgba(255,255,255,0.1)' }} />
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                        <Activity size={12} /> ACT SCORE (YTD)
                                    </div>
                                    <div style={{ fontSize: '2.4rem', color: '#10b981', fontWeight: 900, fontFamily: "'Graduate', sans-serif", textShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>{teamActual.toFixed(2)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                    {/* Starters Section */}
                    <div style={{
                        background: 'rgba(0,0,0,0.2)',
                        padding: '24px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        {starters.map((slot) => {
                            const player = team.roster[slot.key];
                            const isLocked = isPlayerLocked(player, lockedTeams);
                            return (
                                <RosterSlot
                                    key={slot.key}
                                    label={slot.label}
                                    player={player}
                                    isLocked={isLocked}
                                    isSwapTarget={!!swapCandidate && !isLocked && checkPos(swapCandidate, slot.label) && player?.id !== swapCandidate.id}
                                    onClick={() => {
                                        if (isLocked) return;
                                        handleSlotClick(slot.key, player);
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* Bench Section - More compact */}
                    <div style={{ marginTop: '20px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '20px',
                            paddingLeft: '10px'
                        }}>
                            <div style={{ width: '4px', height: '24px', background: '#9ca3af', borderRadius: '2px' }} />
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e5e7eb', fontFamily: "'Graduate', sans-serif" }}>
                                BENCH <span style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 500 }}>({team.bench.length}/7)</span>
                            </h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                            {team.bench.map((player: Player) => {
                                const isSwapTarget = !!swapCandidate && player.id !== swapCandidate.id;
                                return (
                                    <div
                                        key={player.id}
                                        onClick={() => onSelectPlayer?.(player)}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            backdropFilter: 'blur(5px)',
                                            padding: '16px',
                                            borderRadius: '12px',
                                            border: isSwapTarget ? '2px solid #eab308' : '1px solid rgba(255,255,255,0.05)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            position: 'relative',
                                            ...(isSwapTarget && {
                                                boxShadow: '0 0 15px rgba(234, 179, 8, 0.3)',
                                                animation: 'pulse 2s infinite'
                                            })
                                        }}
                                        onMouseEnter={e => {
                                            if (!isSwapTarget) {
                                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                                e.currentTarget.style.borderColor = 'rgba(234, 179, 8, 0.4)';
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (!isSwapTarget) {
                                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                            }
                                        }}
                                    >
                                        {isSwapTarget && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-10px',
                                                right: '10px',
                                                background: '#eab308',
                                                color: '#000',
                                                fontSize: '0.6rem',
                                                fontWeight: 900,
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                zIndex: 30
                                            }}>
                                                SWAP
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontWeight: '700', color: '#e5e7eb' }}>{player.firstName} {player.lastName}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '2px' }}>{player.position} • {player.team}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)' }}>{player.projectedPoints.toFixed(1)} <span style={{ fontSize: '0.6rem' }}>PRJ</span></div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>{(ScoringEngine.calculatePoints(player).total || 0).toFixed(1)} <span style={{ fontSize: '0.6rem' }}>ACT</span></div>
                                        </div>
                                    </div>
                                );
                            })}
                            {Array.from({ length: Math.max(0, 7 - team.bench.length) }).map((_, i) => {
                                const slotId = `bench-${i}`;
                                // Empty bench slots are never 'locked' in the sense they can't be filled,
                                // but the player BEING added might be locked (handled in App.tsx)
                                return (
                                    <div
                                        key={slotId}
                                        onClick={() => {
                                            if (swapCandidate) onSelectSlot?.(slotId);
                                            else onSelectSlot?.(slotId);
                                        }}
                                        style={{
                                            height: '74px',
                                            background: swapCandidate ? 'rgba(234, 179, 8, 0.1)' : 'rgba(0, 0, 0, 0.6)', // Dark background for contrast
                                            backdropFilter: 'blur(4px)',
                                            border: swapCandidate
                                                ? '2px solid #eab308'
                                                : '2px dashed rgba(255, 255, 255, 0.3)', // Lighter border
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: swapCandidate ? '#eab308' : '#fff', // White text
                                            fontSize: '0.9rem',
                                            fontWeight: 800, // Bolder text
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            gap: '8px',
                                            ...(swapCandidate && {
                                                boxShadow: '0 0 15px rgba(234, 179, 8, 0.3)',
                                                animation: 'pulse 2s infinite'
                                            })
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!swapCandidate) {
                                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                                e.currentTarget.style.borderColor = '#fff';
                                                e.currentTarget.style.color = '#fff';
                                                e.currentTarget.style.transform = 'scale(1.02)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!swapCandidate) {
                                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                                                e.currentTarget.style.color = '#fff';
                                                e.currentTarget.style.transform = 'scale(1)';
                                            }
                                        }}
                                    >
                                        <Plus size={16} />
                                        <span>{swapCandidate ? 'MOVE TO BENCH' : 'Add to Bench'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
