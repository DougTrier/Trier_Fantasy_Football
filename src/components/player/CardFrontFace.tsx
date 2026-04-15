import React from 'react';
import { Shield } from 'lucide-react';
import { Twitter, Facebook } from 'lucide-react';
import type { Player } from '../../types';
import { ScoringEngine } from '../../utils/ScoringEngine';
import { getTeamTheme } from '../../utils/teamThemes';
import { getTopSocials } from './cardUtils';
import tffLogo from '../../assets/tff_logo_v6_clean.png';

interface CardFrontFaceProps {
    player: Player;
    isFlipped: boolean;
    frontRef: React.RefObject<HTMLDivElement | null>;
}

export const CardFrontFace: React.FC<CardFrontFaceProps> = ({ player, isFlipped, frontRef }) => {
    const theme = getTeamTheme(player.team);
    const activeSocials = getTopSocials(player.socials);
    const leftSocial = activeSocials[0];
    const rightSocial = activeSocials[1];

    return (
        <div
            ref={frontRef}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                border: `8px solid ${theme.primary}`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: isFlipped ? 'none' : 'auto',
                boxSizing: 'border-box'
            }}>
            {/* TOP HEADER */}
            <div style={{
                height: '12%',
                minHeight: '40px',
                background: theme.secondary,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 5%',
                clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)', zIndex: 2
            }}>
                <div style={{ color: theme.primary, fontFamily: "'Graduate', sans-serif", fontSize: 'clamp(1rem, 5vw, 2rem)', fontWeight: 900 }}>{player.position}</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div style={{ color: '#fff', fontFamily: "'Graduate', sans-serif", fontSize: 'clamp(0.6rem, 2.5vw, 1.2rem)', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{theme.fullName.toUpperCase()}</div>
                </div>
            </div>

            {/* IMAGE */}
            <div style={{
                flex: 1, position: 'relative', background: `linear-gradient(to bottom, #d1d5db 0%, ${theme.primary} 100%)`,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(${theme.secondary} 1px, transparent 1px)`, backgroundSize: '20px 20px', opacity: 0.2 }} />
                <img src={theme.logoUrl} style={{ position: 'absolute', top: '5%', right: '5%', width: '20%', opacity: 0.8, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                <div style={{ width: '100%', height: '100%', zIndex: 5, marginBottom: '-5%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                    {player.photoUrl ? (
                        <img src={player.photoUrl} alt={player.lastName} style={{ width: 'auto', maxWidth: '140%', height: '110%', objectFit: 'contain', objectPosition: 'bottom center', maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)', filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5)) contrast(1.1)' }} />
                    ) : (
                        <Shield size={100} color="#fff" />
                    )}
                </div>
            </div>

            {/* NAME STRIP */}
            <div style={{ background: theme.primary, padding: '8px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `4px solid ${theme.secondary}`, borderBottom: `4px solid ${theme.secondary}`, zIndex: 10 }}>
                <div style={{ width: '40px', display: 'flex', justifyContent: 'flex-start' }}>
                    {leftSocial && (
                        <a
                            href={leftSocial.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }}
                            title={leftSocial.title}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <leftSocial.icon size={20} fill={leftSocial.icon === Twitter ? "white" : "none"} strokeWidth={leftSocial.icon === Twitter ? 0 : 2} />
                        </a>
                    )}
                </div>

                <h2 style={{
                    margin: 0,
                    color: '#fff',
                    fontFamily: "'Graduate', sans-serif",
                    fontSize: 'clamp(1rem, 4vw, 1.8rem)',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    letterSpacing: '1px',
                    textAlign: 'center',
                    lineHeight: '0.9',
                    width: '100%',
                    wordBreak: 'break-word',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {player.firstName} {player.lastName}
                </h2>

                <div style={{ width: '40px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    {rightSocial && (
                        <a
                            href={rightSocial.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }}
                            title={rightSocial.title}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <rightSocial.icon size={20} fill={rightSocial.icon === Facebook ? "white" : "none"} strokeWidth={rightSocial.icon === Facebook ? 0 : 2} />
                        </a>
                    )}
                </div>
            </div>

            {/* STATS */}
            <div style={{ background: '#f3f4f6', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', background: '#fff', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666' }}>PROJECTED</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: theme.primary }}>{player.projectedPoints}</div>
                    </div>
                    <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', background: '#fff', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666' }}>AVG DRAFT POS</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#333' }}>#{player.adp ? player.adp.toFixed(0) : 'N/A'}</div>
                    </div>
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    marginTop: '5px'
                }}>
                    {/* Left: Score */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{
                            fontWeight: 900,
                            color: theme.primary,
                            fontSize: '1.2rem',
                            fontStyle: 'italic',
                            fontFamily: 'Impact, sans-serif',
                            lineHeight: 1
                        }}>
                            {(ScoringEngine.calculatePoints(player).total ?? 0).toFixed(1)}
                        </div>
                        <div style={{
                            fontSize: '0.45rem',
                            fontWeight: 900,
                            color: ScoringEngine.getOrchestrationStatus().season_state === 'COMPLETED_OFFICIAL' ? '#eab308' : '#10b981',
                            textTransform: 'uppercase'
                        }}>
                            {ScoringEngine.getOrchestrationStatus().season_state === 'COMPLETED_OFFICIAL' ? 'SEASON FINAL' : 'PROVISIONAL'}
                        </div>
                    </div>

                    {/* Center: Sporty Text */}
                    <div style={{
                        fontFamily: "'Graduate', sans-serif",
                        fontSize: '0.9rem',
                        fontWeight: 900,
                        fontStyle: 'italic',
                        color: '#d1d5db',
                        letterSpacing: '1px',
                        textShadow: '0 1px 1px rgba(0,0,0,0.1)',
                        transform: 'skewX(-10deg)',
                        textTransform: 'uppercase',
                        justifySelf: 'center',
                        whiteSpace: 'nowrap'
                    }}>
                        TRIER FANTASY FOOTBALL
                    </div>

                    {/* Right: Panini + Logo */}
                    <div style={{
                        display: 'flex',
                        gap: '5px',
                        alignItems: 'center',
                        justifySelf: 'end'
                    }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>PANINI</span>
                        <img src={tffLogo} style={{ height: '24px' }} alt="League Logo" />
                    </div>
                </div>
            </div>
        </div>
    );
};
