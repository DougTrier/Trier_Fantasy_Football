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
                width: '128px',
                flexShrink: 0,
                background: isLive ? 'rgba(239,68,68,0.09)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isLive ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.09)'}`,
                borderRadius: '8px',
                padding: '8px 9px',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.09)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background =
                    isLive ? 'rgba(239,68,68,0.09)' : 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLDivElement).style.borderColor =
                    isLive ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.09)';
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
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                <span style={{
                    fontSize: '0.52rem', fontWeight: 900, letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: liveCount > 0 ? '#ef4444' : '#6b7280',
                }}>
                    {liveCount > 0 ? `${liveCount} Live` : "Today's Games"}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
            </div>

            {/* Horizontally scrollable card row */}
            <div style={{
                display: 'flex', gap: '8px',
                overflowX: 'auto', paddingBottom: '4px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#eab308 rgba(0,0,0,0.2)',
            }}>
                {games.map(game => (
                    <GameCard key={game.id} game={game} onClick={() => onGameClick(game.id)} />
                ))}
            </div>
        </div>
    );
};
