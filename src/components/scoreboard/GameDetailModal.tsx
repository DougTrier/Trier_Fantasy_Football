/**
 * GameDetailModal — full-game box score + scoring play timeline
 * =============================================================
 * Opens as a fixed overlay when a game card is clicked in LiveScoreboardStrip.
 * Fetches the ESPN summary endpoint via ScoreboardService.getGameDetail() and
 * shows per-team statistics and a chronological scoring play list.
 *
 * "View on ESPN" opens the game page via Tauri shell.open (same pattern as
 * TeamSnapshotPanel's NFL.com button — already permitted in the allowlist).
 */
import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Loader } from 'lucide-react';
import {
    ScoreboardService,
    type GameDetail,
} from '../../services/ScoreboardService';
import { getTeamTheme } from '../../utils/teamThemes';

interface GameDetailModalProps {
    eventId: string;
    onClose: () => void;
}

// ─── Stat row helper ──────────────────────────────────────────────────────────

const StatRow: React.FC<{
    label: string;
    home: number | string;
    away: number | string;
}> = ({ label, home, away }) => (
    <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', gap: '6px',
        padding: '4px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', textAlign: 'right' }}>
            {away}
        </span>
        <span style={{
            fontSize: '0.52rem', fontWeight: 700, color: '#6b7280',
            textTransform: 'uppercase', letterSpacing: '0.8px',
            textAlign: 'center', whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', textAlign: 'left' }}>
            {home}
        </span>
    </div>
);

// ─── Main modal ───────────────────────────────────────────────────────────────

export const GameDetailModal: React.FC<GameDetailModalProps> = ({ eventId, onClose }) => {
    const [detail, setDetail]   = useState<GameDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        ScoreboardService.getGameDetail(eventId).then(d => {
            if (!cancelled) { setDetail(d); setLoading(false); }
        });
        return () => { cancelled = true; };
    }, [eventId]);

    const homeTheme = getTeamTheme(detail?.homeTeam ?? '');
    const awayTheme = getTeamTheme(detail?.awayTeam ?? '');

    const openESPN = () => {
        const url = `https://www.espn.com/nfl/game/_/gameId/${eventId}`;
        const tauri = (window as any).__TAURI__;
        if (tauri?.shell?.open) tauri.shell.open(url);
        else window.open(url, '_blank', 'noopener');
    };

    // Quarter label helper
    const qLabel = (q: number) => q > 4 ? 'OT' : `Q${q}`;

    return (
        // Full-screen backdrop — click outside closes
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.78)',
                backdropFilter: 'blur(4px)',
                zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            {/* Modal panel — stop propagation so clicks inside don't close */}
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: 'min(680px, 95vw)',
                    maxHeight: '85vh',
                    background: 'linear-gradient(135deg, rgba(17,24,39,0.98) 0%, rgba(31,41,55,0.98) 100%)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '16px',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideIn 0.15s ease-out',
                }}
            >
                {/* ── Header: team logos + scores ── */}
                <div style={{
                    padding: '16px 20px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    position: 'relative',
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: 10, right: 10,
                            background: 'none', border: 'none',
                            color: '#6b7280', cursor: 'pointer', padding: '4px',
                        }}
                    >
                        <X size={16} />
                    </button>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                            <Loader size={20} color="#6b7280" className="spin" />
                        </div>
                    ) : detail ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                            {/* Away team */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '120px', justifyContent: 'flex-end' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>
                                        {detail.awayTeam}
                                    </div>
                                    <div style={{ fontSize: '0.55rem', color: '#6b7280', textTransform: 'uppercase' }}>Away</div>
                                </div>
                                <img src={awayTheme.logoUrl} alt={detail.awayTeam}
                                    style={{ width: 44, height: 44, objectFit: 'contain' }} />
                            </div>

                            {/* Score + status */}
                            <div style={{ textAlign: 'center', minWidth: '100px' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                                    {detail.awayScore} – {detail.homeScore}
                                </div>
                                <div style={{
                                    fontSize: '0.6rem', fontWeight: 700,
                                    color: detail.status === 'in' ? '#ef4444' : '#6b7280',
                                    textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px',
                                }}>
                                    {detail.statusDetail}
                                </div>
                            </div>

                            {/* Home team */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '120px' }}>
                                <img src={homeTheme.logoUrl} alt={detail.homeTeam}
                                    style={{ width: 44, height: 44, objectFit: 'contain' }} />
                                <div>
                                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>
                                        {detail.homeTeam}
                                    </div>
                                    <div style={{ fontSize: '0.55rem', color: '#6b7280', textTransform: 'uppercase' }}>Home</div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* ── Body: stats + scoring plays ── */}
                {!loading && detail && (
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1px 1fr',
                        flex: 1, minHeight: 0, overflow: 'hidden',
                    }}>
                        {/* Left: team stats */}
                        <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
                            <div style={{
                                fontSize: '0.52rem', fontWeight: 900, color: '#6b7280',
                                textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px',
                                display: 'flex', justifyContent: 'space-between',
                            }}>
                                <span>{detail.awayTeam}</span>
                                <span>TEAM STATS</span>
                                <span>{detail.homeTeam}</span>
                            </div>
                            {/* Away logos bracket under header */}
                            <StatRow label="Pass Yds" away={detail.awayBox?.passingYards ?? '—'} home={detail.homeBox?.passingYards ?? '—'} />
                            <StatRow label="Rush Yds" away={detail.awayBox?.rushingYards ?? '—'} home={detail.homeBox?.rushingYards ?? '—'} />
                            <StatRow label="Total Yds" away={detail.awayBox?.totalYards ?? '—'} home={detail.homeBox?.totalYards ?? '—'} />
                            <StatRow label="Turnovers" away={detail.awayBox?.turnovers ?? '—'} home={detail.homeBox?.turnovers ?? '—'} />
                        </div>

                        {/* Divider */}
                        <div style={{ background: 'rgba(255,255,255,0.07)' }} />

                        {/* Right: scoring plays */}
                        <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
                            <div style={{
                                fontSize: '0.52rem', fontWeight: 900, color: '#6b7280',
                                textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px',
                            }}>
                                Scoring Plays
                            </div>
                            {detail.scoringPlays.length === 0 ? (
                                <div style={{ fontSize: '0.65rem', color: '#4b5563', fontStyle: 'italic' }}>
                                    {detail.status === 'pre' ? 'Game not started' : 'No scoring plays yet'}
                                </div>
                            ) : (
                                detail.scoringPlays.map((play, i) => {
                                    const playTheme = getTeamTheme(play.teamAbbr);
                                    return (
                                        <div key={i} style={{
                                            display: 'flex', gap: '8px', alignItems: 'flex-start',
                                            padding: '5px 0',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        }}>
                                            {/* Team logo */}
                                            <img src={playTheme.logoUrl} alt={play.teamAbbr}
                                                style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0, marginTop: '1px' }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {/* Quarter + clock + running score */}
                                                <div style={{
                                                    fontSize: '0.55rem', fontWeight: 700, color: '#6b7280',
                                                    marginBottom: '2px',
                                                }}>
                                                    {qLabel(play.quarter)} {play.clockDisplay}
                                                    <span style={{ marginLeft: '6px', color: '#9ca3af' }}>
                                                        {detail.awayTeam} {play.awayScore} – {play.homeScore} {detail.homeTeam}
                                                    </span>
                                                </div>
                                                {/* Play description */}
                                                <div style={{ fontSize: '0.68rem', color: '#d1d5db', lineHeight: 1.3 }}>
                                                    {play.text}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* ── Footer: ESPN link ── */}
                <div style={{
                    padding: '10px 16px',
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    background: 'rgba(0,0,0,0.2)',
                }}>
                    <button
                        onClick={openESPN}
                        style={{
                            width: '100%', padding: '7px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '8px', color: '#9ca3af',
                            fontSize: '0.62rem', fontWeight: 700,
                            cursor: 'pointer', letterSpacing: '0.5px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        }}
                    >
                        <ExternalLink size={11} />
                        VIEW FULL GAME ON ESPN
                    </button>
                </div>
            </div>
        </div>
    );
};
