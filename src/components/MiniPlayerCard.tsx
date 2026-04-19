/**
 * MiniPlayerCard — Compact 64×96 px Trading Card Visual
 * =======================================================
 * Renders a miniaturised version of the player card for use inside roster
 * slot rows (Roster.tsx). Mirrors the full PlayerTradingCard visual language
 * — team colors, gradient, photo — at a fraction of the size so it doesn't
 * dominate the lineup view.
 *
 * The slot banner uses a diagonal clip-path to mimic a folded card tab.
 * Player photos are displayed with a fade-to-transparent mask at the bottom
 * so they blend naturally into the team-color gradient beneath.
 */
// MiniPlayerCard uses the same teamThemes color system as the full card but
// renders at 64×96 px — fixed dimensions so roster rows stay uniformly aligned.
import React from 'react';
import type { Player } from '../types';
import { getTeamTheme } from '../utils/teamThemes';
import { Shield } from 'lucide-react';

interface MiniPlayerCardProps {
    player: Player;
    slotLabel: string; // Positional label displayed in the banner (e.g. "QB", "FLEX")
}

export const MiniPlayerCard: React.FC<MiniPlayerCardProps> = ({ player, slotLabel }) => {
    // Drives the color palette — falls back to generic NFL theme for unknown teams
    const theme = getTeamTheme(player.team);

    return (
        <div style={{
            width: '64px',
            height: '96px',
            background: '#fff',
            borderRadius: '6px',
            border: `2px solid ${theme.primary}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6), inset 0 0 10px rgba(0,0,0,0.1)',
            position: 'relative',
            flexShrink: 0
        }}>
            {/* Slot Banner */}
            <div style={{
                height: '18px',
                background: theme.secondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)'
            }}>
                <span style={{
                    color: theme.primary,
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    fontFamily: "'Graduate', sans-serif",
                    textShadow: '0 0.5px 0px rgba(0,0,0,0.3)'
                }}>
                    {slotLabel}
                </span>
            </div>

            {/* Player Image Area */}
            <div style={{
                flex: 1,
                background: `linear-gradient(to bottom, #d1d5db 0%, ${theme.primary} 100%)`,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                position: 'relative'
            }}>
                {/* Pattern Overlay */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `radial-gradient(${theme.secondary} 0.5px, transparent 0.5px)`,
                    backgroundSize: '6px 6px',
                    opacity: 0.15
                }} />

                <div style={{ width: '100%', height: '100%', zIndex: 5, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                    {player.photoUrl ? (
                        <img
                            src={player.photoUrl}
                            alt={player.lastName}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'top center',
                                filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.5)) contrast(1.1)',
                                maskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)'
                            }}
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : (
                        <Shield size={28} color="#fff" style={{ marginBottom: '12px', opacity: 0.6 }} />
                    )}
                </div>
            </div>

            {/* Name Strip Base */}
            <div style={{
                background: theme.primary,
                padding: '3px 0',
                textAlign: 'center',
                borderTop: `1px solid ${theme.secondary}`,
                zIndex: 10
            }}>
                <div style={{
                    color: '#fff',
                    fontSize: '0.5rem',
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    padding: '0 2px',
                    fontFamily: "'Graduate', sans-serif",
                    letterSpacing: '0.5px'
                }}>
                    {player.lastName.toUpperCase()}
                </div>
            </div>

            {/* Gloss Overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 40%, rgba(255,255,255,0.1) 60%, transparent 100%)',
                zIndex: 15,
                pointerEvents: 'none'
            }} />
        </div>
    );
};
