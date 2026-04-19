/**
 * SeasonProjectionsDashboard — Phase 3.1
 * ========================================
 * Surfaces the projectedPoints / total_actual_fantasy_points /
 * performance_differential data already present in all_players_pool.json
 * in a visual, interactive format.
 *
 * Three sections:
 *   1. Position filter tabs + sort controls
 *   2. Ranked player table with inline diff bar and boom/bust badge
 *   3. Two Recharts panels: projected-vs-actual scatter + position bar comparison
 *
 * Data note: weekly splits are not in the pipeline yet. All charts show
 * full-season totals. The scatter's diagonal line = "met projection exactly".
 */
import React, { useState, useMemo } from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
    ResponsiveContainer, ReferenceLine, BarChart, Bar, Legend, Cell
} from 'recharts';
import allPlayersRaw from '../data/all_players_pool.json';
import type { Player } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'projected' | 'actual' | 'diff' | 'name';
type PosFilter = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';

interface ProjectionRow {
    id: string;
    name: string;
    team: string;
    position: string;
    projected: number;
    actual: number;
    diff: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Boom/bust thresholds — ±20 pts is roughly one missed game or a bad outing.
const BOOM_THRESHOLD = 20;
const BUST_THRESHOLD = -20;

const POSITION_COLORS: Record<string, string> = {
    QB: '#f59e0b', RB: '#10b981', WR: '#3b82f6', TE: '#a855f7',
    K: '#6b7280', DST: '#ef4444',
};

// Position group averages for the bar chart
const POSITIONS: PosFilter[] = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'];

// ─── Helper: boom/bust badge ──────────────────────────────────────────────────

function BoomBustBadge({ diff }: { diff: number }) {
    if (diff >= BOOM_THRESHOLD) return (
        <span style={{
            fontSize: '0.55rem', fontWeight: 900, padding: '2px 6px',
            borderRadius: '4px', background: 'rgba(16,185,129,0.2)',
            color: '#10b981', border: '1px solid rgba(16,185,129,0.4)',
            letterSpacing: '0.5px', whiteSpace: 'nowrap'
        }}>BOOM</span>
    );
    if (diff <= BUST_THRESHOLD) return (
        <span style={{
            fontSize: '0.55rem', fontWeight: 900, padding: '2px 6px',
            borderRadius: '4px', background: 'rgba(239,68,68,0.2)',
            color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)',
            letterSpacing: '0.5px', whiteSpace: 'nowrap'
        }}>BUST</span>
    );
    return (
        <span style={{
            fontSize: '0.55rem', fontWeight: 700, padding: '2px 6px',
            borderRadius: '4px', background: 'rgba(107,114,128,0.2)',
            color: '#9ca3af', border: '1px solid rgba(107,114,128,0.3)',
            letterSpacing: '0.5px', whiteSpace: 'nowrap'
        }}>—</span>
    );
}

// ─── Custom scatter tooltip ───────────────────────────────────────────────────

const ScatterTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as ProjectionRow;
    const diff = d.actual - d.projected;
    return (
        <div style={{
            background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px', padding: '10px 14px', fontSize: '0.72rem', color: '#e5e7eb'
        }}>
            <div style={{ fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{d.name}</div>
            <div style={{ color: POSITION_COLORS[d.position] || '#9ca3af' }}>{d.position} · {d.team}</div>
            <div style={{ marginTop: '6px' }}>Proj: <b style={{ color: '#eab308' }}>{d.projected.toFixed(1)}</b></div>
            <div>Actual: <b style={{ color: '#10b981' }}>{d.actual.toFixed(1)}</b></div>
            <div style={{ color: diff >= 0 ? '#10b981' : '#ef4444' }}>
                Diff: {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const SeasonProjectionsDashboard: React.FC = () => {
    const [posFilter, setPosFilter] = useState<PosFilter>('ALL');
    const [sortKey, setSortKey] = useState<SortKey>('actual');
    const [sortDesc, setSortDesc] = useState(true);

    // Build ranked rows from raw player pool JSON
    const allRows = useMemo<ProjectionRow[]>(() => {
        const players = (Array.isArray(allPlayersRaw) ? allPlayersRaw : Object.values(allPlayersRaw)) as Player[];
        return players
            .filter(p => (p.projectedPoints ?? 0) > 0 || (p.total_actual_fantasy_points ?? 0) > 0)
            .map(p => ({
                id: p.id,
                name: `${p.firstName} ${p.lastName}`,
                team: p.team || '—',
                position: p.position || '?',
                projected: p.projectedPoints ?? p.total_projected_fantasy_points ?? 0,
                actual: p.total_actual_fantasy_points ?? 0,
                diff: p.performance_differential ?? ((p.total_actual_fantasy_points ?? 0) - (p.projectedPoints ?? 0)),
            }));
    }, []);

    // Filtered + sorted rows for the table
    const rows = useMemo(() => {
        const filtered = posFilter === 'ALL' ? allRows : allRows.filter(r => r.position === posFilter);
        return [...filtered].sort((a, b) => {
            const val = (r: ProjectionRow) => sortKey === 'projected' ? r.projected
                : sortKey === 'actual' ? r.actual
                : sortKey === 'diff' ? r.diff
                : r.name.charCodeAt(0);
            return sortDesc ? val(b) - val(a) : val(a) - val(b);
        });
    }, [allRows, posFilter, sortKey, sortDesc]);

    // Scatter data: only players with both projected AND actual > 0
    const scatterData = useMemo(() =>
        (posFilter === 'ALL' ? allRows : allRows.filter(r => r.position === posFilter))
            .filter(r => r.projected > 0 && r.actual > 0),
        [allRows, posFilter]
    );

    // Position bar chart: avg projected vs avg actual per position
    const posBarData = useMemo(() => {
        return (['QB', 'RB', 'WR', 'TE', 'K', 'DST'] as PosFilter[]).map(pos => {
            const group = allRows.filter(r => r.position === pos && r.projected > 0);
            const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
            return {
                pos,
                projected: parseFloat(avg(group.map(r => r.projected)).toFixed(1)),
                actual: parseFloat(avg(group.filter(r => r.actual > 0).map(r => r.actual)).toFixed(1)),
            };
        });
    }, [allRows]);

    // Toggle sort: same key flips direction, new key defaults to descending
    const handleSort = (key: SortKey) => {
        if (key === sortKey) setSortDesc(d => !d);
        else { setSortKey(key); setSortDesc(true); }
    };

    const headerStyle = (key: SortKey): React.CSSProperties => ({
        cursor: 'pointer', padding: '8px 12px', fontSize: '0.62rem',
        fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px',
        color: sortKey === key ? '#eab308' : '#9ca3af',
        userSelect: 'none', whiteSpace: 'nowrap',
    });

    // Summary stats shown in the four KPI cards at the top
    const boomCount = rows.filter(r => r.diff >= BOOM_THRESHOLD).length;
    const bustCount = rows.filter(r => r.diff <= BUST_THRESHOLD).length;
    const avgDiff = rows.length ? rows.reduce((s, r) => s + r.diff, 0) / rows.length : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>

            {/* ── Page header ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#fff', fontFamily: "'Graduate', sans-serif", letterSpacing: '1px' }}>
                        SEASON PROJECTIONS
                    </h2>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                        {new Date().getFullYear()} · Projected vs Actual · {allRows.length} players
                    </div>
                </div>

                {/* KPI summary pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                        { label: 'Showing', value: rows.length, color: '#e5e7eb' },
                        { label: 'Boom', value: boomCount, color: '#10b981' },
                        { label: 'Bust', value: bustCount, color: '#ef4444' },
                        { label: 'Avg Diff', value: (avgDiff >= 0 ? '+' : '') + avgDiff.toFixed(1), color: avgDiff >= 0 ? '#10b981' : '#ef4444' },
                    ].map(k => (
                        <div key={k.label} style={{
                            background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                            padding: '6px 12px', textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.55rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{k.label}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 900, color: k.color }}>{k.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Position filter tabs ──────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {POSITIONS.map(pos => (
                    <button key={pos} onClick={() => setPosFilter(pos)} style={{
                        padding: '5px 14px', borderRadius: '20px', border: 'none',
                        cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.5px',
                        background: posFilter === pos
                            ? (POSITION_COLORS[pos] || '#eab308')
                            : 'rgba(10,14,26,0.82)',
                        color: posFilter === pos ? '#fff' : '#9ca3af',
                        border: `1px solid ${posFilter === pos ? (POSITION_COLORS[pos] || '#eab308') : 'rgba(255,255,255,0.08)'}`,
                        backdropFilter: 'blur(8px)',
                        transition: 'all 0.15s',
                    }}>
                        {pos}
                    </button>
                ))}
            </div>

            {/* ── Main content: table + charts ─────────────────────────────── */}
            <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0, flexWrap: 'wrap' }}>

                {/* Rankings table (left, scrollable) */}
                <div style={{
                    flex: '1 1 400px', minWidth: 0,
                    background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}>
                    {/* Table header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '36px 1fr 52px 72px 72px 72px 80px 52px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ ...headerStyle('name'), color: '#6b7280' }}>#</div>
                        <div style={headerStyle('name')} onClick={() => handleSort('name')}>Player</div>
                        <div style={{ ...headerStyle('name'), color: '#6b7280' }}>Pos</div>
                        <div style={headerStyle('projected')} onClick={() => handleSort('projected')}>
                            Proj {sortKey === 'projected' ? (sortDesc ? '↓' : '↑') : ''}
                        </div>
                        <div style={headerStyle('actual')} onClick={() => handleSort('actual')}>
                            Actual {sortKey === 'actual' ? (sortDesc ? '↓' : '↑') : ''}
                        </div>
                        <div style={headerStyle('diff')} onClick={() => handleSort('diff')}>
                            Diff {sortKey === 'diff' ? (sortDesc ? '↓' : '↑') : ''}
                        </div>
                        <div style={{ ...headerStyle('diff'), color: '#6b7280' }}>Bar</div>
                        <div style={{ ...headerStyle('diff'), color: '#6b7280' }}>Tag</div>
                    </div>

                    {/* Table body — virtualized via overflow-y scroll */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {rows.map((row, i) => {
                            const posColor = POSITION_COLORS[row.position] || '#6b7280';
                            const diffColor = row.diff > 0 ? '#10b981' : row.diff < 0 ? '#ef4444' : '#6b7280';
                            // Bar width relative to max absolute diff in visible set (max 100px)
                            const maxDiff = Math.max(...rows.map(r => Math.abs(r.diff)), 1);
                            const barW = Math.round((Math.abs(row.diff) / maxDiff) * 64);

                            return (
                                <div key={row.id} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '36px 1fr 52px 72px 72px 72px 80px 52px',
                                    alignItems: 'center',
                                    padding: '5px 0',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                }}>
                                    {/* Rank */}
                                    <div style={{ padding: '0 8px', fontSize: '0.62rem', color: '#4b5563', fontWeight: 700 }}>{i + 1}</div>

                                    {/* Player name + team */}
                                    <div style={{ padding: '0 8px', minWidth: 0 }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>
                                        <div style={{ fontSize: '0.58rem', color: '#6b7280' }}>{row.team}</div>
                                    </div>

                                    {/* Position badge */}
                                    <div style={{ padding: '0 4px' }}>
                                        <span style={{
                                            fontSize: '0.58rem', fontWeight: 800, padding: '2px 5px',
                                            borderRadius: '4px', background: `${posColor}22`,
                                            color: posColor, border: `1px solid ${posColor}44`,
                                        }}>{row.position}</span>
                                    </div>

                                    {/* Projected */}
                                    <div style={{ padding: '0 8px', fontSize: '0.72rem', color: '#eab308', fontWeight: 700, textAlign: 'right' }}>
                                        {row.projected > 0 ? row.projected.toFixed(1) : '—'}
                                    </div>

                                    {/* Actual */}
                                    <div style={{ padding: '0 8px', fontSize: '0.72rem', color: '#10b981', fontWeight: 700, textAlign: 'right' }}>
                                        {row.actual > 0 ? row.actual.toFixed(1) : '—'}
                                    </div>

                                    {/* Diff number */}
                                    <div style={{ padding: '0 8px', fontSize: '0.72rem', color: diffColor, fontWeight: 700, textAlign: 'right' }}>
                                        {row.diff !== 0 ? (row.diff > 0 ? '+' : '') + row.diff.toFixed(1) : '—'}
                                    </div>

                                    {/* Inline diff bar */}
                                    <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{
                                            width: `${barW}px`, height: '6px', borderRadius: '3px',
                                            background: diffColor, opacity: 0.8, minWidth: '2px',
                                        }} />
                                    </div>

                                    {/* Boom/Bust badge */}
                                    <div style={{ padding: '0 4px' }}>
                                        <BoomBustBadge diff={row.diff} />
                                    </div>
                                </div>
                            );
                        })}
                        {rows.length === 0 && (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>
                                No projection data for this position
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: charts stacked */}
                <div style={{ flex: '0 1 380px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

                    {/* Projected vs Actual scatter */}
                    <div style={{
                        background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                        padding: '16px', flex: '1 1 200px'
                    }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                            Projected vs Actual — each dot = 1 player
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: -10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="projected" type="number" name="Projected" tick={{ fontSize: 9, fill: '#6b7280' }} label={{ value: 'Projected', position: 'insideBottom', offset: -4, fontSize: 9, fill: '#6b7280' }} />
                                <YAxis dataKey="actual" type="number" name="Actual" tick={{ fontSize: 9, fill: '#6b7280' }} />
                                {/* Diagonal "met projection" reference line */}
                                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 450, y: 450 }]} stroke="rgba(234,179,8,0.3)" strokeDasharray="4 4" label={{ value: 'On Track', position: 'insideTopLeft', fontSize: 8, fill: '#eab308' }} />
                                <RechartsTip content={<ScatterTooltip />} />
                                <Scatter data={scatterData} isAnimationActive={false}>
                                    {scatterData.map((entry, idx) => (
                                        <Cell key={idx} fill={POSITION_COLORS[entry.position] || '#6b7280'} fillOpacity={0.75} />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                        {/* Position color legend */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                            {Object.entries(POSITION_COLORS).map(([pos, color]) => (
                                <span key={pos} style={{ fontSize: '0.58rem', color, fontWeight: 700 }}>● {pos}</span>
                            ))}
                        </div>
                    </div>

                    {/* Position average bar chart */}
                    <div style={{
                        background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                        padding: '16px', flex: '1 1 180px'
                    }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                            Avg Points by Position
                        </div>
                        <ResponsiveContainer width="100%" height={170}>
                            <BarChart data={posBarData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }} barGap={2}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="pos" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                                <RechartsTip contentStyle={{ background: 'rgba(10,14,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.72rem' }} />
                                <Legend wrapperStyle={{ fontSize: '0.62rem', color: '#9ca3af' }} />
                                <Bar dataKey="projected" name="Projected" fill="#eab308" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                                <Bar dataKey="actual" name="Actual" fill="#10b981" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                </div>
            </div>
        </div>
    );
};
