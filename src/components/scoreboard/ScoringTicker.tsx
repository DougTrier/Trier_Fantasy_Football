/**
 * ScoringTicker — fixed bottom bar: game scores + notable plays
 * =============================================================
 * Scrolls all today's games and live play events (scoring plays, big plays
 * ≥20 yds, red zone alerts) left continuously. Hidden when no games today.
 */
import React from 'react';
import { type LiveGame, type TickerEvent } from '../../services/ScoreboardService';
import { getTeamTheme } from '../../utils/teamThemes';

interface ScoringTickerProps {
    games: LiveGame[];
    events: TickerEvent[];
}

// ─── Game score item ──────────────────────────────────────────────────────────

const ScoreItem: React.FC<{ game: LiveGame }> = ({ game }) => {
    const homeTheme = getTeamTheme(game.homeTeam);
    const awayTheme = getTeamTheme(game.awayTeam);
    const isLive    = game.status === 'in';
    const showScore = game.status !== 'pre';

    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            gap: '5px', padding: '0 22px', whiteSpace: 'nowrap',
        }}>
            <img src={awayTheme.logoUrl} alt={game.awayTeam}
                style={{ width: 20, height: 20, objectFit: 'contain' }} />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#e5e7eb' }}>{game.awayTeam}</span>
            {showScore && (
                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fff' }}>{game.awayScore}</span>
            )}
            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>—</span>
            {showScore && (
                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fff' }}>{game.homeScore}</span>
            )}
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#e5e7eb' }}>{game.homeTeam}</span>
            <img src={homeTheme.logoUrl} alt={game.homeTeam}
                style={{ width: 20, height: 20, objectFit: 'contain' }} />
            <span style={{
                fontSize: '0.58rem', fontWeight: 700, marginLeft: '4px', textTransform: 'uppercase',
                color: isLive ? '#ef4444' : '#6b7280',
            }}>
                {isLive && (
                    <span style={{
                        display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                        background: '#ef4444', marginRight: '4px', verticalAlign: 'middle',
                        animation: 'pulse 1.5s infinite',
                    }} />
                )}
                {game.statusDetail}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.9rem', marginLeft: '10px' }}>|</span>
        </span>
    );
};

// ─── Play event item ──────────────────────────────────────────────────────────

const EventItem: React.FC<{ event: TickerEvent }> = ({ event }) => {
    const theme = getTeamTheme(event.teamAbbr);
    const badgeColor = event.type === 'score'   ? '#10b981'
                     : event.type === 'redzone' ? '#ef4444'
                     :                            '#f59e0b';

    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            gap: '5px', padding: '0 22px', whiteSpace: 'nowrap',
        }}>
            {/* Type badge */}
            <span style={{
                fontSize: '0.52rem', fontWeight: 900, letterSpacing: '0.8px',
                color: badgeColor, textTransform: 'uppercase',
                background: `${badgeColor}22`,
                padding: '1px 5px', borderRadius: '3px', flexShrink: 0,
            }}>
                {event.label}
            </span>
            {/* Team logo */}
            <img src={theme.logoUrl} alt={event.teamAbbr}
                style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }} />
            {/* Play description */}
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#d1d5db' }}>
                {event.text}
            </span>
            {/* Score context */}
            <span style={{ fontSize: '0.58rem', color: '#6b7280', marginLeft: '2px' }}>
                ({event.awayTeam} {event.awayScore}–{event.homeScore} {event.homeTeam})
            </span>
            <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.9rem', marginLeft: '8px' }}>|</span>
        </span>
    );
};

// ─── Ticker strip ─────────────────────────────────────────────────────────────

export const ScoringTicker: React.FC<ScoringTickerProps> = ({ games, events }) => {
    if (games.length === 0) return null;

    // Scroll speed: each item is ~200px wide; full pass should take ~8s per item
    const itemCount  = games.length + events.length;
    const scrollDuration = Math.max(itemCount * 8, 30);

    // Scroll content rendered twice for a seamless CSS loop
    const content = (
        <>
            {games.map(g  => <ScoreItem key={g.id}      game={g}   />)}
            {events.map((e, i) => <EventItem key={`${e.gameId}-${i}`} event={e} />)}
        </>
    );

    return (
        <div style={{
            width: '100%',
            height: '38px',
            background: 'rgba(0,0,0,0.90)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center',
            overflow: 'hidden',
            borderRadius: '6px',
        }}>
            {/* Pinned "NFL SCORES" label */}
            <div style={{
                flexShrink: 0, padding: '0 12px',
                borderRight: '1px solid rgba(255,255,255,0.15)',
                fontSize: '0.5rem', fontWeight: 900,
                letterSpacing: '1.5px', lineHeight: 1.2,
                color: '#ef4444', textTransform: 'uppercase',
                height: '100%', display: 'flex', alignItems: 'center',
                background: 'rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
            }}>
                NFL<br />SCORES
            </div>

            {/* Scrolling lane — doubled for seamless wrap */}
            <div style={{ overflow: 'hidden', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    animation: `tickerScroll ${scrollDuration}s linear infinite`,
                    whiteSpace: 'nowrap',
                }}>
                    {content}
                    {content}
                </div>
            </div>
        </div>
    );
};
