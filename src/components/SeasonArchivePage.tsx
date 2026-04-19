/**
 * SeasonArchivePage — Historical Season Browser
 * ===============================================
 * Displays past league seasons: champion banner, final standings, and top scorer.
 * Admin can archive the current active season (captures standings snapshot into
 * league.history and persists via onLeagueChange).
 *
 * Data tiers:
 *   Sparse  — only year/champion/points (legacy history entries)
 *   Full    — includes standings[], topScorer, championRecord (archived via this page)
 *
 * Export — uses html-to-image toPng to capture the summary card as a PNG.
 */
import React, { useState, useRef } from 'react';
import { Trophy, Star, Download, Archive, Users, Loader } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { League, FantasyTeam, Player } from '../types';
import { ScoringEngine } from '../utils/ScoringEngine';

interface SeasonArchivePageProps {
    league: League;
    allTeams: FantasyTeam[];
    players: Player[];
    isAdmin: boolean;
    onLeagueChange: (updated: League) => void;
}

// Medal colors for top-3 finishes
const RANK_STYLES: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: '#fef3c7', color: '#92400e', label: '🥇' },
    2: { bg: '#f1f5f9', color: '#475569', label: '🥈' },
    3: { bg: '#fdf4ee', color: '#9a3412', label: '🥉' },
};

export const SeasonArchivePage: React.FC<SeasonArchivePageProps> = ({
    league, allTeams, players, isAdmin, onLeagueChange
}) => {
    const history = league.history ?? [];
    // Descending year order so the most recent season is the default tab
    const archivedYears = [...new Set(history.map(h => h.year))].sort((a, b) => b - a);
    const [selectedYear, setSelectedYear] = useState<number | null>(archivedYears[0] ?? null);
    const [isExporting, setIsExporting] = useState(false);
    const [archiveConfirm, setArchiveConfirm] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    const season = history.find(h => h.year === selectedYear);

    // Derive live standings from allTeams (used for the "Season in Progress" panel
    // and as the source when the admin archives the current season).
    const liveStandings = [...allTeams]
        .sort((a, b) => {
            const wA = a.wins ?? 0, wB = b.wins ?? 0;
            const pA = a.weeklyScores?.reduce((s, v) => s + v, 0) ?? 0;
            const pB = b.weeklyScores?.reduce((s, v) => s + v, 0) ?? 0;
            return wB !== wA ? wB - wA : pB - pA;
        })
        .map((t, i) => ({
            rank: i + 1,
            teamName: t.name,
            ownerName: t.ownerName,
            wins: t.wins ?? 0,
            losses: t.losses ?? 0,
            ties: t.ties ?? 0,
            totalPoints: +(t.weeklyScores?.reduce((s, v) => s + v, 0) ?? 0).toFixed(1),
        }));

    // Top fantasy scorer across all players (by pipeline total_actual_fantasy_points)
    const topPlayerBySeason = players
        .filter(p => p.total_actual_fantasy_points)
        .sort((a, b) => (b.total_actual_fantasy_points ?? 0) - (a.total_actual_fantasy_points ?? 0))[0];

    // Archive the current active season into league.history
    const handleArchiveSeason = () => {
        const currentYear = ScoringEngine.getOrchestrationStatus().season ?? new Date().getFullYear();
        const champion = liveStandings[0];
        if (!champion) return;

        const topScorer = topPlayerBySeason ? {
            playerName: `${topPlayerBySeason.firstName} ${topPlayerBySeason.lastName}`,
            position: topPlayerBySeason.position,
            points: +(topPlayerBySeason.total_actual_fantasy_points ?? 0).toFixed(1),
            teamAbbr: topPlayerBySeason.team,
        } : undefined;

        const newEntry = {
            year: currentYear,
            champion: champion.teamName,
            points: champion.totalPoints,
            championOwner: champion.ownerName,
            championRecord: `${champion.wins}-${champion.losses}-${champion.ties}`,
            championPoints: champion.totalPoints,
            topScorer,
            standings: liveStandings,
        };

        // Replace existing entry for this year or prepend
        const filtered = history.filter(h => h.year !== currentYear);
        onLeagueChange({ ...league, history: [newEntry, ...filtered] });
        setSelectedYear(currentYear);
        setArchiveConfirm(false);
    };

    // Export the visible summary panel as a PNG
    const handleExport = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        try {
            const dataUrl = await toPng(exportRef.current, { pixelRatio: 2, skipFonts: true, backgroundColor: '#0f1117' });
            const link = document.createElement('a');
            link.download = `TFF_Season_${selectedYear ?? 'Archive'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.error('[Archive] Export failed', e);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'rgba(10,14,26,0.82)',
            backdropFilter: 'blur(8px)',
            padding: '24px',
            color: '#fff',
            fontFamily: 'system-ui, sans-serif'
        }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <Archive size={22} color="#eab308" />
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontFamily: "'Graduate', sans-serif", fontWeight: 900 }}>
                            SEASON ARCHIVE
                        </h1>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {archivedYears.length} season{archivedYears.length !== 1 ? 's' : ''} on record
                    </div>
                </div>

                {/* Admin: Archive Current Season */}
                {isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {archiveConfirm ? (
                            <>
                                <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>Archive current season?</span>
                                <button
                                    onClick={handleArchiveSeason}
                                    style={{ background: '#eab308', color: '#000', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 800, cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                    Confirm
                                </button>
                                <button
                                    onClick={() => setArchiveConfirm(false)}
                                    style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setArchiveConfirm(true)}
                                style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.4)', borderRadius: '8px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <Archive size={14} /> Archive Current Season
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Season Tabs */}
            {archivedYears.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {archivedYears.map(yr => (
                        <button
                            key={yr}
                            onClick={() => setSelectedYear(yr)}
                            style={{
                                background: selectedYear === yr ? '#eab308' : 'rgba(255,255,255,0.08)',
                                color: selectedYear === yr ? '#000' : '#94a3b8',
                                border: 'none',
                                borderRadius: '20px',
                                padding: '6px 18px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                transition: 'all 0.15s',
                                fontFamily: "'Graduate', sans-serif",
                            }}
                        >
                            {yr}
                        </button>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {archivedYears.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                    <Trophy size={56} color="#374151" style={{ marginBottom: '16px' }} />
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#4b5563', marginBottom: '8px', fontFamily: "'Graduate', sans-serif" }}>
                        NO SEASONS ARCHIVED YET
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', maxWidth: '380px', margin: '0 auto', lineHeight: 1.5 }}>
                        When the commissioner closes a season, click <strong style={{ color: '#eab308' }}>Archive Current Season</strong> above to capture the final standings and crown the champion.
                    </div>
                    {/* Season In Progress teaser */}
                    {allTeams.length > 0 && (
                        <div style={{ marginTop: '40px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#eab308', letterSpacing: '2px', marginBottom: '12px' }}>
                                — SEASON IN PROGRESS —
                            </div>
                            <LiveStandingsTable standings={liveStandings} />
                        </div>
                    )}
                </div>
            )}

            {/* Selected Season */}
            {season && (
                <div ref={exportRef}>
                    {/* Champion Banner */}
                    <div style={{
                        background: 'linear-gradient(135deg, #92400e 0%, #eab308 50%, #ca8a04 100%)',
                        borderRadius: '16px',
                        padding: '24px',
                        marginBottom: '20px',
                        boxShadow: '0 8px 32px rgba(234,179,8,0.3)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Subtle pattern */}
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '18px 18px', pointerEvents: 'none' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', position: 'relative' }}>
                            <Trophy size={48} color="#fff" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} />
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '3px', marginBottom: '4px' }}>
                                    {season.year} LEAGUE CHAMPION
                                </div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', fontFamily: "'Graduate', sans-serif", lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                                    {season.champion}
                                </div>
                                {season.championOwner && (
                                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>
                                        Coach {season.championOwner}
                                    </div>
                                )}
                            </div>
                            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                {season.championRecord && (
                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', fontFamily: "'Graduate', sans-serif" }}>
                                        {season.championRecord}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                                    {(season.championPoints ?? season.points).toFixed(1)} PTS
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Scorer Badge */}
                    {season.topScorer && (
                        <div style={{
                            background: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: '12px',
                            padding: '14px 20px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <Star size={20} color="#10b981" fill="#10b981" />
                            <div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#10b981', letterSpacing: '2px' }}>TOP SCORER</div>
                                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>
                                    {season.topScorer.playerName}
                                    <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                                        {season.topScorer.position} · {season.topScorer.teamAbbr}
                                    </span>
                                </div>
                            </div>
                            <div style={{ marginLeft: 'auto', fontSize: '1.4rem', fontWeight: 900, color: '#10b981', fontFamily: "'Graduate', sans-serif" }}>
                                {season.topScorer.points.toFixed(1)}
                                <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, marginLeft: '4px' }}>PTS</span>
                            </div>
                        </div>
                    )}

                    {/* Final Standings */}
                    {season.standings && season.standings.length > 0 && (
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
                                <Users size={16} color="#94a3b8" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' }}>
                                    FINAL STANDINGS — {season.year}
                                </span>
                            </div>
                            <StandingsTable standings={season.standings} />
                        </div>
                    )}

                    {/* Season label for export */}
                    <div style={{ textAlign: 'center', fontSize: '0.6rem', color: '#374151', letterSpacing: '2px', fontWeight: 800, paddingTop: '8px' }}>
                        TRIER FANTASY FOOTBALL · {season.year} SEASON
                    </div>
                </div>
            )}

            {/* Export Button */}
            {season && (
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            color: '#94a3b8',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '8px',
                            padding: '10px 24px',
                            fontWeight: 700,
                            cursor: isExporting ? 'default' : 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: isExporting ? 0.6 : 1,
                            transition: 'all 0.2s',
                        }}
                    >
                        {isExporting
                            ? <><Loader size={14} style={{ animation: 'tff-spin 0.8s linear infinite' }} /> Exporting...</>
                            : <><Download size={14} /> Export Season Summary</>
                        }
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

interface StandingRow {
    rank: number;
    teamName: string;
    ownerName: string;
    wins: number;
    losses: number;
    ties: number;
    totalPoints: number;
}

const StandingsTable: React.FC<{ standings: StandingRow[] }> = ({ standings }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
            <tr style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '10px 18px', textAlign: 'left' }}>#</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Team</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Owner</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>W</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>L</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>T</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>PTS</th>
            </tr>
        </thead>
        <tbody>
            {standings.map(row => {
                const medal = RANK_STYLES[row.rank];
                return (
                    <tr key={row.rank} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: medal ? `${medal.bg}18` : 'transparent', transition: 'background 0.15s' }}>
                        <td style={{ padding: '12px 18px', fontWeight: 900, fontSize: '1rem' }}>
                            {medal ? medal.label : <span style={{ color: '#475569', fontSize: '0.8rem' }}>{row.rank}</span>}
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 800, color: '#f1f5f9', fontSize: '0.85rem' }}>{row.teamName}</td>
                        <td style={{ padding: '12px 8px', color: '#94a3b8', fontSize: '0.8rem' }}>{row.ownerName}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>{row.wins}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', color: '#ef4444', fontWeight: 700, fontSize: '0.85rem' }}>{row.losses}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>{row.ties}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 900, color: '#eab308', fontSize: '0.9rem' }}>{row.totalPoints}</td>
                    </tr>
                );
            })}
        </tbody>
    </table>
);

// Live standings variant — same layout but muted header, used in the empty state
const LiveStandingsTable: React.FC<{ standings: StandingRow[] }> = ({ standings }) => (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '0.65rem', fontWeight: 800, color: '#4b5563', letterSpacing: '1px' }}>
            CURRENT STANDINGS (NOT YET ARCHIVED)
        </div>
        <StandingsTable standings={standings} />
    </div>
);
