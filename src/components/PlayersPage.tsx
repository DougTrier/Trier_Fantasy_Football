/**
 * PlayersPage — Full League Player Database Browser
 * ===================================================
 * Displays the entire player pool with rich filtering and sorting.
 * Unlike PlayerSelector (which is scoped to a single slot), this page shows
 * all players regardless of roster status and is used for scouting and
 * trade target research.
 *
 * PERFORMANCE DIFFERENTIAL SORT:
 *   PERF_DIFF sorts by (actual_pts - projected_pts) sourced from the Sleeper
 *   pipeline. Positive = outperforming; negative = underperforming. Players
 *   without pipeline data sort to the bottom (null maps to -Infinity).
 *
 * INFINITE SCROLL:
 *   Uses window scroll events (not IntersectionObserver) because the page
 *   content is in the document body, not an overflow container.
 *   visibleCount grows by 50 per trigger.
 */
// useMemo: playersWithTotals (historical stat sums), filteredPlayers (sort+filter).
// useState: teamFilter, posFilter, search text, sortBy mode, visibleCount.
// useEffect: window scroll listener for infinite load + visibleCount reset on filter change.
import React, { useMemo, useState, useEffect } from 'react';
import type { Player } from '../types';
import { PlayerCard } from './PlayerCard';
import { NFL_TEAMS } from '../utils/constants';
import { Users, Filter, TrendingUp } from 'lucide-react';
import { PlayerTradingCard } from './PlayerTradingCard';
import leatherTexture from '../assets/leather_texture.png';
// ScoringEngine calculates actual points for the PERF_DIFF badge on each card.
import { ScoringEngine } from '../utils/ScoringEngine';
import { scrapePlayerPhoto } from '../utils/scraper';

interface PlayersPageProps {
    players: Player[];
    onAddPlayers: (newPlayers: Player[]) => void;
    onMakeOffer?: (player: Player) => void;
    // Called after a successful photo refresh so the parent can persist the update
    onUpdatePlayer?: (updated: Player) => void;
}

type SortOption = 'PROJ' | 'ADP' | 'PASS_YDS' | 'RUSH_YDS' | 'REC_YDS' | 'GAMES' | 'NAME' | 'PERF_DIFF';

/**
 * PlayersPage — scouting and research browser.
 * Read-only display; onMakeOffer is the only mutation pathway (opens TradeOfferModal).
 */
// Offensive + IDP position groups for the filter bar
const POSITION_GROUPS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST', 'LB', 'DL', 'DB'] as const;
const POS_COLORS: Record<string, string> = {
    QB: '#eab308', RB: '#10b981', WR: '#3b82f6', TE: '#a855f7',
    K: '#6b7280', DST: '#ef4444', LB: '#f97316', DL: '#ec4899', DB: '#06b6d4',
};

export const PlayersPage: React.FC<PlayersPageProps> = ({ players, onMakeOffer, onUpdatePlayer }) => {
    const [teamFilter, setTeamFilter] = useState('ALL');
    const [posFilter, setPosFilter] = useState('ALL');
    // viewingPlayer: when set, opens PlayerTradingCard full-screen overlay.
    const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);
    const [search, setSearch] = useState('');
    // Default sort is ADP (average draft position) — most relevant for waiver decisions.
    const [sortBy, setSortBy] = useState<SortOption>('ADP');
    const [visibleCount, setVisibleCount] = useState(100);

    // Calculate Totals for sorting
    const playersWithTotals = useMemo(() => {
        return players.map(p => {
            const totals = (p.historicalStats || []).reduce((acc, h) => ({
                passYds: acc.passYds + (h.passingYards || 0),
                rushYds: acc.rushYds + (h.rushingYards || 0),
                recYds: acc.recYds + (h.receivingYards || 0),
                games: acc.games + (h.gamesPlayed || 0)
            }), { passYds: 0, rushYds: 0, recYds: 0, games: 0 });

            return { ...p, totals };
        });
    }, [players]);

    const filteredPlayers = useMemo(() => {
        let base = [...playersWithTotals];

        if (teamFilter !== 'ALL') {
            base = base.filter(p => p.team === teamFilter);
        }

        if (posFilter !== 'ALL') {
            base = base.filter(p => p.position === posFilter);
        }

        if (search) {
            const s = search.toLowerCase();
            base = base.filter(p =>
                p.lastName.toLowerCase().includes(s) ||
                p.firstName.toLowerCase().includes(s) ||
                (p.firstName && p.lastName && `${p.firstName} ${p.lastName}`.toLowerCase().includes(s))
            );
        }

        // Apply Sorting
        return base.sort((a, b) => {
            switch (sortBy) {
                case 'PROJ': return (b.projectedPoints || 0) - (a.projectedPoints || 0);
                case 'ADP': return (a.adp || 999) - (b.adp || 999);
                case 'PASS_YDS': return b.totals.passYds - a.totals.passYds;
                case 'RUSH_YDS': return b.totals.rushYds - a.totals.rushYds;
                case 'REC_YDS': return b.totals.recYds - a.totals.recYds;
                case 'GAMES': return b.totals.games - a.totals.games;
                case 'PERF_DIFF': {
                    // Players without pipeline data (null) sink to the bottom
                    const valA = a.performance_differential ?? -Infinity;
                    const valB = b.performance_differential ?? -Infinity;
                    return valB - valA;
                }
                case 'NAME': return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
                default: return 0;
            }
        });
    }, [playersWithTotals, teamFilter, posFilter, search, sortBy]);

    // Infinite Scroll Implementation
    useEffect(() => {
        const handleScroll = () => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800) {
                if (visibleCount < filteredPlayers.length) {
                    setVisibleCount(prev => prev + 50);
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [visibleCount, filteredPlayers.length]);

    // Reset visible count when filters change
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisibleCount(100);
    }, [teamFilter, search, sortBy]);

    return (
        <div style={{ color: 'white', maxWidth: '1200px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* Header */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: '20px',
                marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <Users size={32} color="#eab308" />
                        <h1 style={{
                            fontSize: '2.5rem',
                            fontWeight: 900,
                            margin: 0,
                            textTransform: 'uppercase',
                            color: 'transparent',
                            backgroundImage: `url(${leatherTexture})`,
                            backgroundSize: '150px',
                            backgroundPosition: 'center',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            fontFamily: "'Graduate', 'Impact', sans-serif",
                            WebkitTextStroke: '1px rgba(255,255,255,0.95)',
                            textShadow: '0 5px 15px rgba(0,0,0,0.9)'
                        }}>
                            League Players
                        </h1>
                        <span style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', padding: '4px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 700 }}>
                            {filteredPlayers.length} Total
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Search Name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{
                                    padding: '10px 15px', paddingLeft: '35px', borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white',
                                    width: '250px'
                                }}
                            />
                            <Filter size={16} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                        </div>
                    </div>
                </div>

                {/* Position filter tabs — includes IDP positions */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {POSITION_GROUPS.map(pos => (
                        <button key={pos} onClick={() => { setPosFilter(pos); setVisibleCount(100); }} style={{
                            padding: '5px 13px', borderRadius: '20px', cursor: 'pointer', border: 'none',
                            fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.5px',
                            background: posFilter === pos ? (POS_COLORS[pos] || '#eab308') : 'rgba(255,255,255,0.08)',
                            color: posFilter === pos ? '#fff' : '#9ca3af',
                            outline: posFilter === pos ? 'none' : 'none',
                            transition: 'all 0.12s',
                        }}>{pos}</button>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Filter size={18} color="#9ca3af" />
                            <select
                                value={teamFilter}
                                onChange={(e) => setTeamFilter(e.target.value)}
                                style={{
                                    padding: '8px 12px', borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.1)', background: '#1f2937', color: 'white', fontWeight: 600
                                }}
                            >
                                <option value="ALL">ALL TEAMS</option>
                                {NFL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <TrendingUp size={18} color="#9ca3af" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                style={{
                                    padding: '8px 12px', borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.1)', background: '#1f2937', color: 'white', fontWeight: 600
                                }}
                            >
                                <option value="ADP">Sort by: ADP / Rank</option>
                                <option value="PROJ">Sort by: {ScoringEngine.getOrchestrationStatus().season} Projected Pts</option>
                                <option value="PASS_YDS">Sort by: Career Passing Yards</option>
                                <option value="RUSH_YDS">Sort by: Career Rushing Yards</option>
                                <option value="REC_YDS">Sort by: Career Receiving Yards</option>
                                <option value="GAMES">Sort by: Career Games Played</option>
                                <option value="PERF_DIFF">Sort by: Performance Differential</option>
                                <option value="NAME">Sort by: Alphabetical</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                        Showing {Math.min(visibleCount, filteredPlayers.length)} of {filteredPlayers.length}
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: 'clamp(10px, 1.5vw, 30px)' }}>
                {filteredPlayers.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>No players found for {teamFilter}.</div>
                    </div>
                ) : (
                    filteredPlayers.slice(0, visibleCount).map((p, index) => {
                        // Extract stat to highlight for Top 20
                        let highlight = undefined;
                        if (index < 20 && sortBy !== 'NAME' && sortBy !== 'ADP') {
                            const labels: Record<string, string> = {
                                'PROJ': 'PROJ PTS',
                                'PASS_YDS': 'PASS YDS',
                                'RUSH_YDS': 'RUSH YDS',
                                'REC_YDS': 'REC YDS',
                                'GAMES': 'GAMES',
                                'PERF_DIFF': 'PERF DIFF'
                            };

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const values: Record<string, any> = {
                                'PROJ': p.projectedPoints,
                                'PASS_YDS': p.totals.passYds,
                                'RUSH_YDS': p.totals.rushYds,
                                'REC_YDS': p.totals.recYds,
                                'GAMES': p.totals.games,
                                'PERF_DIFF': p.performance_differential
                            };

                            if (values[sortBy]) {
                                highlight = { label: labels[sortBy], value: values[sortBy] };
                            }
                        }

                        return (
                            <div key={p.id} onClick={() => setViewingPlayer(p)} style={{ cursor: 'pointer' }}>
                                <PlayerCard
                                    player={p}
                                    onAction={() => setViewingPlayer(p)}
                                    actionLabel="View Details"
                                    highlightStat={sortBy === 'PERF_DIFF' ? { label: 'PERF DIFF', value: p.performance_differential || 0 } : highlight}
                                    onMakeOffer={onMakeOffer ? () => onMakeOffer(p) : undefined}
                                    onRefreshPhoto={onUpdatePlayer ? async (target) => {
                                        // Try Wikipedia first for a high-res shot; fall back to Sleeper CDN
                                        const freshUrl = await scrapePlayerPhoto(`${target.firstName} ${target.lastName}`)
                                            || `https://sleepercdn.com/content/nfl/players/thumb/${target.id}.jpg`;
                                        onUpdatePlayer({ ...target, photoUrl: freshUrl });
                                    } : undefined}
                                />
                            </div>
                        );
                    })
                )}
            </div>

            {/* Load More Trigger (Manual fallback if scroll fails) */}
            {visibleCount < filteredPlayers.length && (
                <div style={{ textAlign: 'center', marginTop: '40px' }}>
                    <button
                        onClick={() => setVisibleCount(prev => prev + 200)}
                        title="Load next 50 players from database."
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            padding: '12px 30px',
                            borderRadius: '30px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        Load More Players
                    </button>
                </div>
            )}

            {/* Modal */}
            {viewingPlayer && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
                    zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center'
                }} onClick={() => setViewingPlayer(null)}>
                    <div onClick={e => e.stopPropagation()}>
                        <PlayerTradingCard
                            player={viewingPlayer}
                            onClose={() => setViewingPlayer(null)}
                            actionLabel="View Only"
                            isDrafted={true}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
