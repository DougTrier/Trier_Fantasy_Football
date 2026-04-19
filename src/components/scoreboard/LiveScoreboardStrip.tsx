/**
 * LiveScoreboardStrip — horizontal scrollable game card row
 * ==========================================================
 * Renders one compact card per NFL game returned by ScoreboardService.
 * Live games glow red; clicking any card fires onGameClick so the parent
 * can open the GameDetailModal. Hidden entirely when there are no games.
 */
import React from 'react';
import { type LiveGame } from '../../services/ScoreboardService';
import { getTeamTheme } from '../../utils/teamThemes';

interface LiveScoreboardStripProps {
    games: LiveGame[];
    onGameClick: (eventId: string) => void;
}

// ─── Single game card ─────────────────────────────────────────────────────────

const GameCard: React.FC<{ game: LiveGame; onClick: () => void }> = ({ game, onClick }) => {
    const homeTheme = getTeamTheme(game.homeTeam);
    const awayTheme = getTeamTheme(game.awayTeam);
    const isLive  = game.status === 'in';
    const isFinal = game.status === 'post';

    return (
        <div
            onClick={onClick}
            style={{
                width: '100%',
                // Dark base ensures readability over the leather texture background
                background: isLive ? 'rgba(60,0,0,0.75)' : 'rgba(0,0,0,0.65)',
                border: `1px solid ${isLive ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: '8px',
                padding: '8px 9px',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.15)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.3)';
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background =
                    isLive ? 'rgba(60,0,0,0.75)' : 'rgba(0,0,0,0.65)';
                (e.currentTarget as HTMLDivElement).style.borderColor =
                    isLive ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)';
            }}
        >
            {/* Away team row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                <img src={awayTheme.logoUrl} alt={game.awayTeam}
                    style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.68rem', fontWeight: 800, color: '#d1d5db' }}>
                    {game.awayTeam}
                </span>
                {/* Score shown only once game has started */}
                {game.status !== 'pre' && (
                    <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#fff' }}>
                        {game.awayScore}
                    </span>
                )}
            </div>

            {/* Home team row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <img src={homeTheme.logoUrl} alt={game.homeTeam}
                    style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '0.68rem', fontWeight: 800, color: '#d1d5db' }}>
                    {game.homeTeam}
                </span>
                {game.status !== 'pre' && (
                    <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#fff' }}>
                        {game.homeScore}
                    </span>
                )}
            </div>

            {/* Status line — pulsing red dot when live */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                fontSize: '0.55rem', fontWeight: 700,
                color: isLive ? '#ef4444' : isFinal ? '#6b7280' : '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.4px',
            }}>
                {isLive && (
                    <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: '#ef4444', flexShrink: 0,
                        animation: 'pulse 1.5s infinite',
                    }} />
                )}
                {game.statusDetail}
            </div>
        </div>
    );
};

// ─── Strip container ──────────────────────────────────────────────────────────

export const LiveScoreboardStrip: React.FC<LiveScoreboardStripProps> = ({ games, onGameClick }) => {
    if (games.length === 0) return null;

    const liveCount = games.filter(g => g.status === 'in').length;

    return (
        <div style={{ marginBottom: '14px' }}>
            {/* Header bar with live game count */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '8px',
            }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.35)' }} />
                <span style={{
                    fontSize: '1.2rem', fontWeight: 900, letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: liveCount > 0 ? '#ef4444' : '#9ca3af',
                    background: 'rgba(0,0,0,0.65)',
                    padding: '3px 14px',
                    borderRadius: '6px',
                }}>
                    {liveCount > 0 ? `${liveCount} Live` : "Today's Games"}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.35)' }} />
            </div>

            {/* 3-column wrapping grid — new row every 3 games, scrolls vertically with standings */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px',
            }}>
                {games.map(game => (
                    <GameCard key={game.id} game={game} onClick={() => onGameClick(game.id)} />
                ))}
            </div>
        </div>
    );
};
