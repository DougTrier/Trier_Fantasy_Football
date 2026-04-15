/**
 * PlayerSelector — Full-Screen Draft/Add Player Modal
 * =====================================================
 * Opened when a manager clicks an empty roster slot or the bench add button.
 * Provides a filtered, sorted, and virtually-scrolled grid of available players.
 *
 * POSITION FILTERING:
 *   AUTO mode: derives allowed positions from the target slot using
 *   getAllowedPositionsForSlot (e.g. FLEX slot allows RB/WR/TE).
 *   Manual override lets users browse all positions if desired.
 *
 * VIRTUAL SCROLL:
 *   Renders only the first visibleCount cards; loads 40 more when the user
 *   scrolls within 400px of the bottom. Prevents rendering 500+ cards at once.
 *
 * HIGHLIGHT BADGES:
 *   Top 20 players in non-NAME sort modes display a rotated stat badge
 *   ("sticker") to surface the ranking context at a glance.
 *
 * Creates a custom player via CreatePlayerForm when "Create Custom" is clicked.
 */
// useMemo: allowedPositions, filteredAndSorted, scoredPlayers.
// useState: search, filter controls, visibleCount for virtual scroll.
// useEffect: window scroll listener for infinite-load trigger.
import React, { useMemo, useState, useEffect } from 'react';
import type { Player } from '../types';
import { PlayerCard } from './PlayerCard';
import { PlayerTradingCard } from './PlayerTradingCard';
import { CreatePlayerForm } from './CreatePlayerForm';
// getAllowedPositionsForSlot converts a slot key (e.g. "flex") into position list.
import { getAllowedPositionsForSlot } from '../utils/positionLogic';
import { NFL_TEAMS } from '../utils/constants';
import { X, Plus } from 'lucide-react';
import { ScoringEngine } from '../utils/ScoringEngine';

interface PlayerSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (player: Player) => void;
    availablePlayers: Player[];
    targetSlotId: string | null; // The slot being filled — drives AUTO position filter
}

type SortOption = 'PROJ' | 'ADP' | 'PASS_YDS' | 'RUSH_YDS' | 'REC_YDS' | 'GAMES' | 'NAME';

export const PlayerSelector: React.FC<PlayerSelectorProps> = ({
    isOpen, onClose, onSelect, availablePlayers, targetSlotId
}) => {
    const [showCreate, setShowCreate] = useState(false);
    const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);
    const [teamFilter, setTeamFilter] = useState('ALL');
    const [posFilter, setPosFilter] = useState<string>('AUTO');
    const [sortBy, setSortBy] = useState<SortOption>('ADP');
    const [visibleCount, setVisibleCount] = useState(60);

    // Resolve the allowed position list from slot context or manual override
    const allowedPositions = useMemo(() => {
        if (posFilter !== 'AUTO') {
            if (posFilter === 'ALL') return [];
            return [posFilter];
        }
        return targetSlotId ? getAllowedPositionsForSlot(targetSlotId) : [];
    }, [targetSlotId, posFilter]);

    // Calculate Totals for sorting
    const playersWithTotals = useMemo(() => {
        return availablePlayers.map(p => {
            const totals = (p.historicalStats || []).reduce((acc, h) => ({
                passYds: acc.passYds + (h.passingYards || 0),
                rushYds: acc.rushYds + (h.rushingYards || 0),
                recYds: acc.recYds + (h.receivingYards || 0),
                games: acc.games + (h.gamesPlayed || 0)
            }), { passYds: 0, rushYds: 0, recYds: 0, games: 0 });

            return { ...p, totals };
        });
    }, [availablePlayers]);

    const filteredPlayers = useMemo(() => {
        let base = [...playersWithTotals];

        if (allowedPositions.length > 0) {
            base = base.filter(p => allowedPositions.includes(p.position));
        }

        if (teamFilter !== 'ALL') {
            base = base.filter(p => p.team === teamFilter);
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
                case 'NAME': return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
                default: return 0;
            }
        });
    }, [playersWithTotals, allowedPositions, teamFilter, sortBy]);

    // Reset visible count
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisibleCount(60);
    }, [teamFilter, posFilter, sortBy, isOpen]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.95)', zIndex: 1000,
            display: 'flex', flexDirection: 'column', padding: '20px'
        }}>
            {/* --- MODAL OVERLAYS --- */}
            {viewingPlayer && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                    zIndex: 1050, display: 'flex', justifyContent: 'center', alignItems: 'center'
                }} onClick={() => setViewingPlayer(null)}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <PlayerTradingCard
                            player={viewingPlayer}
                            onDraft={() => {
                                onSelect(viewingPlayer);
                                setViewingPlayer(null);
                            }}
                            onClose={() => setViewingPlayer(null)}
                        />
                    </div>
                </div>
            )}

            {showCreate && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', zIndex: 1010,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <CreatePlayerForm
                        onClose={() => setShowCreate(false)}
                        onCreate={(player) => {
                            onSelect(player);
                            setShowCreate(false);
                        }}
                        initialPosition={allowedPositions[0]}
                    />
                </div>
            )}

            {/* --- HEADER --- */}
            <div style={{
                color: 'white', marginBottom: '20px', borderBottom: '1px solid #444', paddingBottom: '20px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 900 }}>DRAFT PLAYER</h2>
                        {targetSlotId && (
                            <span style={{ color: '#eab308', background: 'rgba(234,179,8,0.1)', padding: '5px 15px', borderRadius: '20px', fontWeight: 700, fontSize: '0.9rem' }}>
                                TARGET: {targetSlotId.toUpperCase()}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                        <X size={32} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                        value={posFilter}
                        onChange={(e) => setPosFilter(e.target.value)}
                        style={{ padding: '10px', background: '#1f2937', color: 'white', border: '1px solid #4b5563', borderRadius: '8px', fontWeight: 600 }}
                    >
                        <option value="AUTO">Auto Filter</option>
                        <option value="ALL">All Positions</option>
                        {['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'LB', 'DL', 'DB', 'OL'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <select
                        value={teamFilter}
                        onChange={(e) => setTeamFilter(e.target.value)}
                        style={{ padding: '10px', background: '#1f2937', color: 'white', border: '1px solid #4b5563', borderRadius: '8px', fontWeight: 600 }}
                    >
                        <option value="ALL">ALL TEAMS</option>
                        {NFL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        style={{ padding: '10px', background: '#1f2937', color: 'white', border: '1px solid #4b5563', borderRadius: '8px', fontWeight: 600 }}
                    >
                        <option value="ADP">Sort by: ADP / Rank</option>
                        <option value="PROJ">Sort by: {ScoringEngine.getOrchestrationStatus().season} Projected Pts</option>
                        <option value="PASS_YDS">Sort by: Career Passing Yards</option>
                        <option value="RUSH_YDS">Sort by: Career Rushing Yards</option>
                        <option value="REC_YDS">Sort by: Career Receiving Yards</option>
                        <option value="GAMES">Sort by: Career Games Played</option>
                    </select>

                    <button
                        onClick={() => setShowCreate(true)}
                        style={{ marginLeft: 'auto', background: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    >
                        <Plus size={18} /> Create Custom
                    </button>
                </div>
            </div>

            {/* --- PLAYER GRID --- */}
            <div
                onScroll={(e) => {
                    const target = e.currentTarget;
                    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 400) {
                        if (visibleCount < filteredPlayers.length) setVisibleCount(v => v + 40);
                    }
                }}
                style={{
                    flex: 1, overflowY: 'auto',
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))',
                    gap: '20px', paddingBottom: '50px'
                }}>
                {filteredPlayers.length > 0 ? (
                    filteredPlayers.slice(0, visibleCount).map((p, index) => {
                        // Extract stat to highlight for Top 20
                        let highlight = undefined;
                        if (index < 20 && sortBy !== 'NAME' && sortBy !== 'ADP') {
                            const labels: Record<string, string> = {
                                'PROJ': 'PROJ PTS',
                                'PASS_YDS': 'PASS YDS',
                                'RUSH_YDS': 'RUSH YDS',
                                'REC_YDS': 'REC YDS',
                                'GAMES': 'GAMES'
                            };

                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const values: Record<string, any> = {
                                'PROJ': p.projectedPoints,
                                'PASS_YDS': p.totals.passYds,
                                'RUSH_YDS': p.totals.rushYds,
                                'REC_YDS': p.totals.recYds,
                                'GAMES': p.totals.games
                            };

                            if (values[sortBy]) {
                                highlight = { label: labels[sortBy], value: values[sortBy] };
                            }
                        }

                        return (
                            <div key={p.id} onClick={() => setViewingPlayer(p)} style={{ cursor: 'pointer' }}>
                                <PlayerCard
                                    player={p}
                                    actionLabel="View Card"
                                    onAction={() => setViewingPlayer(p)}
                                    highlightStat={highlight}
                                />
                            </div>
                        );
                    })
                ) : (
                    <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: '100px', gridColumn: '1 / -1' }}>
                        No players match these filters.
                    </div>
                )}
            </div>

            <div style={{ padding: '10px', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', borderTop: '1px solid #333' }}>
                Showing {Math.min(visibleCount, filteredPlayers.length)} of {filteredPlayers.length} Available Players
            </div>
        </div>
    );
};
