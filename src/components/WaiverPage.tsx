/**
 * WaiverPage — FAAB Waiver Wire
 * ==============================
 * Left panel: free agent pool with position filter, search, and projected points.
 * Right panel: your pending bids, FAAB balance, countdown to processing, and
 *              waiver history pulled from the team's transaction log.
 *
 * BID FLOW:
 *   Click "Bid" on any free agent → BidModal opens → set FAAB amount + optional
 *   drop player → Submit stores the bid locally. Blind until commissioner processes.
 *
 * PROCESSING:
 *   Countdown to next Tuesday 02:00. Commissioner sees a "Process Now" button
 *   that calls onProcessWaivers() immediately.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Gavel, Clock, DollarSign, X, ChevronDown, CheckCircle, XCircle, AlertCircle, Info, Brain, Link2, TrendingUp } from 'lucide-react';
import type { FantasyTeam, Player, WaiverBid } from '../types';
import {
    getFreeAgents, placeBid, cancelBid,
    getNextWaiverTime, formatCountdown,
} from '../services/WaiverService';
import leatherTexture from '../assets/leather_texture.png';

// ── Position colour palette (matches DraftSimulator) ─────────────────────────
const POS_COLOR: Record<string, string> = {
    QB: '#eab308', RB: '#10b981', WR: '#3b82f6',
    TE: '#a855f7', K: '#9ca3af', DST: '#ef4444',
};
const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'];

// ── Bid Modal ─────────────────────────────────────────────────────────────────

const BidModal: React.FC<{
    player: Player;
    myTeam: FantasyTeam;
    existingBid?: WaiverBid;
    onSubmit: (amount: number, dropPlayer?: Player) => void;
    onClose: () => void;
}> = ({ player, myTeam, existingBid, onSubmit, onClose }) => {
    const balance = myTeam.faabBalance ?? 100;
    const [amount, setAmount] = useState(existingBid?.bidAmount ?? 1);
    const [dropId, setDropId] = useState(existingBid?.dropPlayerId ?? '');

    // Bench players eligible to be dropped
    const dropOptions: Player[] = myTeam.bench || [];

    const dropPlayer = dropOptions.find(p => p.id === dropId);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: `url(${leatherTexture}), linear-gradient(135deg, rgba(17,24,39,0.98), rgba(31,41,55,0.98))`,
                backgroundBlendMode: 'overlay', backgroundSize: '150px, cover',
                border: '2px solid rgba(234,179,8,0.4)', borderRadius: '16px',
                padding: '28px', width: '400px', maxWidth: '90vw',
                boxShadow: '0 30px 60px rgba(0,0,0,0.7)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                        <div style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>
                            Place Waiver Claim
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>
                            {player.firstName} {player.lastName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <span style={{
                                fontSize: '0.65rem', fontWeight: 900, padding: '2px 7px',
                                borderRadius: '6px', background: `${POS_COLOR[player.position]}20`,
                                color: POS_COLOR[player.position], border: `1px solid ${POS_COLOR[player.position]}40`,
                            }}>{player.position}</span>
                            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{player.team}</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* FAAB balance */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
                    borderRadius: '8px', padding: '8px 14px', marginBottom: '20px',
                }}>
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Your FAAB</span>
                    <span style={{ fontSize: '1rem', fontWeight: 900, color: '#eab308' }}>${balance} remaining</span>
                </div>

                {/* Bid amount slider */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.62rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Bid Amount</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>${amount}</span>
                    </div>
                    <input
                        type="range" min={0} max={balance} value={amount}
                        onChange={e => setAmount(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#eab308' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#4b5563', marginTop: '2px' }}>
                        <span>$0 (priority bid)</span><span>${balance} (max)</span>
                    </div>
                </div>

                {/* Optional drop */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.62rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                        Drop Player (optional)
                    </div>
                    <div style={{ position: 'relative' }}>
                        <select
                            value={dropId}
                            onChange={e => setDropId(e.target.value)}
                            style={{
                                width: '100%', appearance: 'none', boxSizing: 'border-box',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '8px', color: dropId ? '#fff' : '#6b7280',
                                fontSize: '0.85rem', padding: '9px 32px 9px 12px',
                                outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                        >
                            <option value="" style={{ background: '#1f2937' }}>— No drop —</option>
                            {dropOptions.map(p => (
                                <option key={p.id} value={p.id} style={{ background: '#1f2937' }}>
                                    {p.position} — {p.firstName} {p.lastName}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: '11px', borderRadius: '8px', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#9ca3af', fontWeight: 700, fontSize: '0.85rem',
                    }}>Cancel</button>
                    <button
                        onClick={() => { onSubmit(amount, dropPlayer); onClose(); }}
                        style={{
                            flex: 2, padding: '11px', borderRadius: '8px', cursor: 'pointer',
                            background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                            border: 'none', color: '#000', fontWeight: 900,
                            fontSize: '0.9rem', fontFamily: "'Graduate', sans-serif",
                            letterSpacing: '0.5px',
                        }}
                    >
                        {existingBid ? 'Update Bid' : 'Submit Bid'} — ${amount} FAAB
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface WaiverPageProps {
    allPlayers: Player[];
    allTeams: FantasyTeam[];
    myTeam: FantasyTeam;
    isAdmin: boolean;
    onUpdateTeam: (team: FantasyTeam) => void;
    onProcessWaivers: () => void;
}

export const WaiverPage: React.FC<WaiverPageProps> = ({
    allPlayers, allTeams, myTeam, isAdmin, onUpdateTeam, onProcessWaivers,
}) => {
    const [posFilter, setPosFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [bidTarget, setBidTarget] = useState<Player | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    // 'list' = normal free agent pool, 'intel' = AI intelligence panel
    const [viewMode, setViewMode] = useState<'list' | 'intel'>('list');
    // Countdown to next Tuesday 02:00 processing window
    const [countdown, setCountdown] = useState(() => getNextWaiverTime() - Date.now());

    // Live countdown tick
    useEffect(() => {
        const t = setInterval(() => setCountdown(getNextWaiverTime() - Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const freeAgents = useMemo(() => getFreeAgents(allPlayers, allTeams), [allPlayers, allTeams]);

    const filtered = useMemo(() => {
        return freeAgents
            .filter(p => posFilter === 'ALL' || p.position === posFilter)
            .filter(p => !search || `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0));
    }, [freeAgents, posFilter, search]);

    // My pending bids
    const myPendingBids = (myTeam.waiverBids || []).filter(b => b.status === 'pending');

    // Waiver history from transaction log
    const waiverHistory = (myTeam.transactions || [])
        .filter(t => t.type === 'WAIVER_WIN' || t.type === 'WAIVER_LOSS')
        .slice(-10)
        .reverse();

    const handleBidSubmit = (player: Player, amount: number, dropPlayer?: Player) => {
        const updated = placeBid(myTeam, player, amount, dropPlayer);
        onUpdateTeam(updated);
    };

    const handleCancelBid = (bidId: string) => {
        onUpdateTeam(cancelBid(myTeam, bidId));
    };

    // Find existing pending bid for a given player
    const existingBidFor = (playerId: string) =>
        myPendingBids.find(b => b.playerId === playerId);

    // ── Intelligence Data ─────────────────────────────────────────────────────

    // AI composite score: projected pts weighted highest, boom bonus for over-performers,
    // platform ownership % as a tiebreaker for equal-projection players.
    const aiTopPicks = useMemo(() => {
        return freeAgents
            .filter(p => (p.projectedPoints ?? 0) > 0)
            .map(p => ({
                ...p,
                _score: (p.projectedPoints ?? 0) * 0.7
                    + Math.max(0, p.performance_differential ?? 0) * 0.4
                    + parseFloat((p.ownership ?? '0').replace('%', '')) * 0.3,
            }))
            .sort((a, b) => b._score - a._score)
            .slice(0, 20);
    }, [freeAgents]);

    // Handcuff targets: free agent RBs on the same NFL team as the user's rostered RBs.
    // If the starter goes down, the backup instantly becomes the starter.
    const handcuffTargets = useMemo(() => {
        const myRBs = [
            ...Object.values(myTeam.roster || {}).filter((p): p is Player => p?.position === 'RB'),
            ...(myTeam.bench || []).filter(p => p?.position === 'RB'),
        ];
        const results: Array<{ starter: Player; backup: Player }> = [];
        myRBs.forEach(starter => {
            freeAgents
                .filter(p => p.position === 'RB' && p.team === starter.team && p.id !== starter.id)
                .forEach(backup => results.push({ starter, backup }));
        });
        return results.slice(0, 12);
    }, [freeAgents, myTeam]);

    // Trending: highest platform ownership % among free agents — proxy for league-wide demand.
    const trendingPlayers = useMemo(() =>
        [...freeAgents]
            .filter(p => parseFloat((p.ownership ?? '0').replace('%', '')) > 0)
            .sort((a, b) =>
                parseFloat((b.ownership ?? '0').replace('%', '')) -
                parseFloat((a.ownership ?? '0').replace('%', ''))
            )
            .slice(0, 15),
        [freeAgents]
    );

    const sectionLabel: React.CSSProperties = {
        fontSize: '0.58rem', fontWeight: 900, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '1.5px',
    };

    return (
        <div style={{ display: 'flex', height: '100%', gap: '16px', minHeight: 0 }}>

            {/* ── Left: Free Agent Pool ─────────────────────────────────────── */}
            <div style={{
                flex: '1 1 0', display: 'flex', flexDirection: 'column', minHeight: 0,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden',
            }}>
                {/* Panel header */}
                <div style={{
                    padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)',
                    background: 'rgba(0,0,0,0.4)', flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Gavel size={16} color="#eab308" />
                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#eab308', textTransform: 'uppercase', letterSpacing: '2px' }}>
                            Free Agents
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#4b5563', fontWeight: 700 }}>
                            {freeAgents.length} available
                        </span>
                        {/* HOW TO USE info button */}
                        <button
                            onClick={() => setShowHelp(true)}
                            style={{
                                marginLeft: 'auto',
                                background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)',
                                borderRadius: '20px', padding: '5px 12px',
                                display: 'flex', alignItems: 'center', gap: '5px',
                                cursor: 'pointer', color: '#eab308', transition: 'all 0.15s',
                                fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.5px',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(234,179,8,0.25)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(234,179,8,0.12)'; }}
                        >
                            <Info size={12} /> HOW TO USE
                        </button>
                    </div>

                    {/* Position tabs + INTEL toggle */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
                        {/* Normal position filters — hidden when in intel mode */}
                        {viewMode === 'list' && POSITIONS.map(pos => (
                            <button key={pos} onClick={() => setPosFilter(pos)} style={{
                                padding: '4px 10px', borderRadius: '12px', cursor: 'pointer',
                                border: 'none', fontSize: '0.65rem', fontWeight: 800,
                                background: posFilter === pos ? (POS_COLOR[pos] || '#eab308') : 'rgba(255,255,255,0.07)',
                                color: posFilter === pos ? '#000' : '#9ca3af',
                                transition: 'all 0.12s',
                            }}>{pos}</button>
                        ))}
                        {/* INTEL tab — always visible, toggles mode */}
                        <button
                            onClick={() => setViewMode(v => v === 'intel' ? 'list' : 'intel')}
                            style={{
                                padding: '4px 10px', borderRadius: '12px', cursor: 'pointer',
                                border: viewMode === 'intel' ? '1px solid rgba(168,85,247,0.6)' : '1px solid rgba(168,85,247,0.25)',
                                fontSize: '0.65rem', fontWeight: 800,
                                background: viewMode === 'intel' ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.08)',
                                color: viewMode === 'intel' ? '#c084fc' : '#7c3aed',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                marginLeft: viewMode === 'list' ? '6px' : 0,
                                transition: 'all 0.12s',
                            }}
                        >
                            <Brain size={11} /> INTEL
                        </button>
                    </div>

                    {/* Search */}
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search free agents..."
                        style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', color: '#fff', fontSize: '0.8rem',
                            padding: '7px 12px', outline: 'none', fontFamily: 'inherit',
                        }}
                    />
                </div>

                {/* Column headers — hidden in intel mode */}
                {viewMode === 'list' && (
                    <div style={{
                        display: 'grid', gridTemplateColumns: '50px 1fr 60px 60px 80px', columnGap: '12px',
                        padding: '6px 18px', background: 'rgba(0,0,0,0.3)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
                    }}>
                        {['POS', 'PLAYER', 'PROJ', 'ADP', ''].map((h, i) => (
                            <span key={i} style={{ ...sectionLabel, textAlign: i >= 2 ? 'center' : 'left' }}>{h}</span>
                        ))}
                    </div>
                )}

                {/* ── List mode: normal free agent rows ────────────────────── */}
                {viewMode === 'list' && (
                    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#eab308 rgba(0,0,0,0.2)' }}>
                        {filtered.slice(0, 150).map(player => {
                            const bid = existingBidFor(player.id);
                            return (
                                <div key={player.id} style={{
                                    display: 'grid', gridTemplateColumns: '50px 1fr 60px 60px 80px', columnGap: '12px',
                                    alignItems: 'center', padding: '8px 18px',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    background: bid ? 'rgba(234,179,8,0.05)' : 'transparent',
                                    transition: 'background 0.1s',
                                }}
                                    onMouseEnter={e => (e.currentTarget.style.background = bid ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.03)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = bid ? 'rgba(234,179,8,0.05)' : 'transparent')}
                                >
                                    <span style={{
                                        fontSize: '0.62rem', fontWeight: 900, padding: '2px 6px',
                                        borderRadius: '5px', display: 'inline-block', textAlign: 'center',
                                        background: `${POS_COLOR[player.position] || '#9ca3af'}20`,
                                        color: POS_COLOR[player.position] || '#9ca3af',
                                        border: `1px solid ${POS_COLOR[player.position] || '#9ca3af'}40`,
                                    }}>{player.position}</span>
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e5e7eb' }}>
                                            {player.firstName} {player.lastName}
                                            {bid && <span style={{ marginLeft: '6px', fontSize: '0.58rem', color: '#eab308', fontWeight: 900 }}>BID ${bid.bidAmount}</span>}
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: '#4b5563', fontWeight: 600 }}>{player.team}</div>
                                    </div>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#10b981', textAlign: 'center' }}>
                                        {player.projectedPoints?.toFixed(0) ?? '—'}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, textAlign: 'center' }}>
                                        {player.adp ?? '—'}
                                    </span>
                                    <button
                                        onClick={() => setBidTarget(player)}
                                        style={{
                                            padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                                            fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.5px',
                                            border: bid ? '1px solid rgba(234,179,8,0.5)' : '1px solid rgba(255,255,255,0.15)',
                                            background: bid ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.07)',
                                            color: bid ? '#eab308' : '#9ca3af',
                                            transition: 'all 0.12s',
                                        }}
                                    >{bid ? '✏ Edit Bid' : '+ Bid'}</button>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && (
                            <div style={{ padding: '48px', textAlign: 'center', color: '#4b5563', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                No free agents match your filter
                            </div>
                        )}
                    </div>
                )}

                {/* ── Intel mode: AI picks, handcuffs, trending ────────────── */}
                {viewMode === 'intel' && (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', scrollbarWidth: 'thin', scrollbarColor: '#7c3aed rgba(0,0,0,0.2)' }}>

                        {/* Section 1: AI Top Picks */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                                <Brain size={13} color="#c084fc" />
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                                    AI Top Picks
                                </span>
                                <span style={{ fontSize: '0.58rem', color: '#4b5563' }}>projected × boom bonus × ownership</span>
                            </div>
                            {aiTopPicks.map((p, i) => {
                                const bid = existingBidFor(p.id);
                                const isBoom = (p.performance_differential ?? 0) >= 20;
                                return (
                                    <div key={p.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '8px 10px', borderRadius: '8px', marginBottom: '4px',
                                        background: i === 0 ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
                                        border: i === 0 ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                                    }}>
                                        <span style={{ fontSize: '0.65rem', color: '#4b5563', fontWeight: 700, width: '18px', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                                        <span style={{
                                            fontSize: '0.58rem', fontWeight: 900, padding: '2px 5px', borderRadius: '4px', flexShrink: 0,
                                            background: `${POS_COLOR[p.position] || '#9ca3af'}20`,
                                            color: POS_COLOR[p.position] || '#9ca3af',
                                        }}>{p.position}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {p.firstName} {p.lastName}
                                                {isBoom && <span style={{ marginLeft: '5px', fontSize: '0.55rem', color: '#10b981', fontWeight: 900 }}>BOOM</span>}
                                            </div>
                                            <div style={{ fontSize: '0.6rem', color: '#4b5563' }}>{p.team} · {p.projectedPoints?.toFixed(0)} proj</div>
                                        </div>
                                        <span style={{ fontSize: '0.65rem', color: '#c084fc', fontWeight: 800, flexShrink: 0 }}>{p._score.toFixed(0)}</span>
                                        <button onClick={() => setBidTarget(p)} style={{
                                            padding: '4px 9px', borderRadius: '6px', cursor: 'pointer', fontWeight: 800, fontSize: '0.62rem',
                                            border: bid ? '1px solid rgba(234,179,8,0.5)' : '1px solid rgba(168,85,247,0.4)',
                                            background: bid ? 'rgba(234,179,8,0.12)' : 'rgba(168,85,247,0.1)',
                                            color: bid ? '#eab308' : '#c084fc',
                                        }}>{bid ? `$${bid.bidAmount}` : '+ Bid'}</button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Section 2: Handcuff Targets */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                                <Link2 size={13} color="#10b981" />
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                                    Handcuff Targets
                                </span>
                                <span style={{ fontSize: '0.58rem', color: '#4b5563' }}>backup RBs for your starters</span>
                            </div>
                            {handcuffTargets.length === 0 ? (
                                <div style={{ fontSize: '0.72rem', color: '#4b5563', fontStyle: 'italic', padding: '12px 0' }}>
                                    {(myTeam.bench || []).some(p => p.position === 'RB') || Object.values(myTeam.roster || {}).some(p => p?.position === 'RB')
                                        ? 'No free agent RBs found on your starters\' teams.'
                                        : 'Add an RB to your roster to see handcuff suggestions.'}
                                </div>
                            ) : handcuffTargets.map(({ starter, backup }) => {
                                const bid = existingBidFor(backup.id);
                                return (
                                    <div key={`${starter.id}-${backup.id}`} style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '8px 10px', borderRadius: '8px', marginBottom: '4px',
                                        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.62rem', color: '#6b7280', marginBottom: '2px' }}>
                                                Backup for <span style={{ color: '#10b981', fontWeight: 800 }}>{starter.firstName} {starter.lastName}</span>
                                            </div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e5e7eb' }}>
                                                {backup.firstName} {backup.lastName}
                                            </div>
                                            <div style={{ fontSize: '0.6rem', color: '#4b5563' }}>{backup.team} · {backup.projectedPoints?.toFixed(0) ?? '—'} proj</div>
                                        </div>
                                        <button onClick={() => setBidTarget(backup)} style={{
                                            padding: '4px 9px', borderRadius: '6px', cursor: 'pointer', fontWeight: 800, fontSize: '0.62rem',
                                            border: bid ? '1px solid rgba(234,179,8,0.5)' : '1px solid rgba(16,185,129,0.4)',
                                            background: bid ? 'rgba(234,179,8,0.12)' : 'rgba(16,185,129,0.1)',
                                            color: bid ? '#eab308' : '#10b981',
                                        }}>{bid ? `$${bid.bidAmount}` : '+ Bid'}</button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Section 3: Trending Now (highest platform ownership among free agents) */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                                <TrendingUp size={13} color="#3b82f6" />
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                                    Trending Now
                                </span>
                                <span style={{ fontSize: '0.58rem', color: '#4b5563' }}>highest platform ownership %</span>
                            </div>
                            {trendingPlayers.map((p, i) => {
                                const bid = existingBidFor(p.id);
                                const pct = parseFloat((p.ownership ?? '0').replace('%', ''));
                                return (
                                    <div key={p.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '7px 10px', borderRadius: '8px', marginBottom: '4px',
                                        background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)',
                                    }}>
                                        <span style={{ fontSize: '0.65rem', color: '#4b5563', fontWeight: 700, width: '18px', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                                        <span style={{
                                            fontSize: '0.58rem', fontWeight: 900, padding: '2px 5px', borderRadius: '4px', flexShrink: 0,
                                            background: `${POS_COLOR[p.position] || '#9ca3af'}20`,
                                            color: POS_COLOR[p.position] || '#9ca3af',
                                        }}>{p.position}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {p.firstName} {p.lastName}
                                            </div>
                                            <div style={{ fontSize: '0.6rem', color: '#4b5563' }}>{p.team} · {p.projectedPoints?.toFixed(0)} proj</div>
                                        </div>
                                        {/* Ownership bar */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                            <div style={{ width: '50px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)' }}>
                                                <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: '#3b82f6' }} />
                                            </div>
                                            <span style={{ fontSize: '0.62rem', color: '#3b82f6', fontWeight: 800, width: '34px' }}>{pct.toFixed(0)}%</span>
                                        </div>
                                        <button onClick={() => setBidTarget(p)} style={{
                                            padding: '4px 9px', borderRadius: '6px', cursor: 'pointer', fontWeight: 800, fontSize: '0.62rem',
                                            border: bid ? '1px solid rgba(234,179,8,0.5)' : '1px solid rgba(59,130,246,0.4)',
                                            background: bid ? 'rgba(234,179,8,0.12)' : 'rgba(59,130,246,0.08)',
                                            color: bid ? '#eab308' : '#3b82f6',
                                        }}>{bid ? `$${bid.bidAmount}` : '+ Bid'}</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Right: Bids + Status ──────────────────────────────────────── */}
            <div style={{
                width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
                {/* FAAB + Countdown card */}
                <div style={{
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px',
                }}>
                    {/* FAAB balance */}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ ...sectionLabel, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <DollarSign size={11} /> FAAB Balance
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 900, color: '#eab308', fontFamily: "'Graduate', sans-serif" }}>
                                ${myTeam.faabBalance ?? 100}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>/ $100</span>
                        </div>
                        {/* FAAB bar */}
                        <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '6px' }}>
                            <div style={{
                                height: '100%', borderRadius: '2px',
                                width: `${(myTeam.faabBalance ?? 100)}%`,
                                background: (myTeam.faabBalance ?? 100) > 50 ? '#10b981' : (myTeam.faabBalance ?? 100) > 20 ? '#eab308' : '#ef4444',
                                transition: 'width 0.4s ease',
                            }} />
                        </div>
                    </div>

                    {/* Waiver priority */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ ...sectionLabel }}>Waiver Priority</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fff' }}>
                            #{myTeam.waiverPriority ?? '—'}
                        </span>
                    </div>

                    {/* Countdown */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <Clock size={12} color="#6b7280" />
                            <span style={{ ...sectionLabel }}>Next Processing</span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: countdown < 3600000 ? '#ef4444' : '#fff', fontFamily: "'Graduate', sans-serif" }}>
                            {formatCountdown(countdown)}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#4b5563', marginTop: '2px' }}>Tuesday 02:00 AM</div>
                    </div>

                    {/* Commissioner force-process */}
                    {isAdmin && (
                        <button
                            onClick={onProcessWaivers}
                            style={{
                                marginTop: '12px', width: '100%', padding: '10px',
                                background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(202,138,4,0.2))',
                                border: '1px solid rgba(234,179,8,0.4)', borderRadius: '10px',
                                color: '#eab308', fontWeight: 900, fontSize: '0.75rem',
                                cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            }}
                        >
                            <Gavel size={13} /> Process Waivers Now
                        </button>
                    )}
                </div>

                {/* Pending bids */}
                <div style={{
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
                    padding: '16px', flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column',
                }}>
                    <div style={{ ...sectionLabel, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertCircle size={11} />
                        Pending Bids ({myPendingBids.length})
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#eab308 rgba(0,0,0,0.2)' }}>
                        {myPendingBids.length === 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#4b5563', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                                No bids placed yet
                            </div>
                        )}
                        {myPendingBids.map(bid => (
                            <div key={bid.id} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 10px', borderRadius: '8px', marginBottom: '6px',
                                background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {bid.playerName}
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: '#6b7280', marginTop: '1px' }}>
                                        ${bid.bidAmount} FAAB{bid.dropPlayerName ? ` · drop ${bid.dropPlayerName}` : ''}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleCancelBid(bid.id)}
                                    title="Cancel bid"
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Waiver history */}
                {waiverHistory.length > 0 && (
                    <div style={{
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px',
                    }}>
                        <div style={{ ...sectionLabel, marginBottom: '10px' }}>Recent Results</div>
                        {waiverHistory.map(t => (
                            <div key={t.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '8px',
                                marginBottom: '8px', paddingBottom: '8px',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                            }}>
                                {t.type === 'WAIVER_WIN'
                                    ? <CheckCircle size={13} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    : <XCircle size={13} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                                }
                                <div style={{ fontSize: '0.65rem', color: '#9ca3af', lineHeight: 1.4 }}>{t.description}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Help overlay */}
            {showHelp && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{
                        background: `url(${leatherTexture}), linear-gradient(135deg, rgba(10,14,26,0.99) 0%, rgba(20,28,45,0.99) 100%)`,
                        backgroundBlendMode: 'overlay', backgroundSize: '150px, cover',
                        border: '2px solid rgba(234,179,8,0.4)', borderRadius: '20px',
                        padding: '28px 32px', width: '520px', maxWidth: '92vw',
                        maxHeight: '88vh', overflowY: 'auto',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.7)',
                        position: 'relative',
                    }}>
                        {/* Close */}
                        <button
                            onClick={() => setShowHelp(false)}
                            style={{
                                position: 'absolute', top: '14px', right: '14px',
                                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '50%', width: '28px', height: '28px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#9ca3af',
                            }}
                        ><X size={13} /></button>

                        <div style={{ fontFamily: "'Graduate', sans-serif", fontSize: '1rem', fontWeight: 900, color: '#eab308', marginBottom: '20px', letterSpacing: '2px' }}>
                            HOW THE WAIVER WIRE WORKS
                        </div>

                        {[
                            {
                                heading: '🏈 What is the Waiver Wire?',
                                body: 'The waiver wire is how you add free agents — players not currently on any team\'s roster. It replaces the open free-for-all with a structured, fair bidding system.',
                            },
                            {
                                heading: '💰 FAAB Bidding',
                                body: 'Every team starts the season with $100 Free Agent Acquisition Budget (FAAB). To claim a free agent, submit a blind bid between $0 and your remaining balance. You can\'t see what others bid until processing.',
                            },
                            {
                                heading: '🏆 How Winners Are Decided',
                                body: 'When waivers process, the highest bid wins each player. Ties are broken by waiver priority — the team with the lowest priority number wins. The winner pays their bid amount; losers keep their FAAB.',
                            },
                            {
                                heading: '📋 Waiver Priority',
                                body: 'Priority is assigned in reverse standings order — the worst record gets #1. After winning a claim, your priority drops to the bottom of the list. This gives struggling teams better access to free agents.',
                            },
                            {
                                heading: '🔄 Priority Bid ($0)',
                                body: 'Bidding $0 is a priority bid — you\'re willing to spend nothing but still want the player if nobody else bids. If multiple teams bid $0, the one with the best waiver priority wins.',
                            },
                            {
                                heading: '⏱ Processing Window',
                                body: 'Waivers process every Tuesday at 2:00 AM. The countdown timer on the right shows exactly how long until the next run. Your bids are locked in as soon as you submit them.',
                            },
                            {
                                heading: '✂️ Drop Player',
                                body: 'If your bench is full and you win a claim, you can designate a player to drop automatically when the claim succeeds. You set this when placing the bid.',
                            },
                            {
                                heading: '⚡ Commissioner Override',
                                body: 'The league commissioner can trigger waiver processing at any time using the "Process Waivers Now" button, regardless of the Tuesday schedule.',
                            },
                        ].map(({ heading, body }) => (
                            <div key={heading} style={{ marginBottom: '18px' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#e5e7eb', marginBottom: '5px' }}>{heading}</div>
                                <div style={{ fontSize: '0.7rem', color: '#9ca3af', lineHeight: 1.65 }}>{body}</div>
                            </div>
                        ))}

                        <button
                            onClick={() => setShowHelp(false)}
                            style={{
                                marginTop: '8px', width: '100%', padding: '11px',
                                background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                                border: 'none', borderRadius: '10px', color: '#000',
                                fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer',
                                fontFamily: "'Graduate', sans-serif", letterSpacing: '1px',
                            }}
                        >
                            GOT IT — START BIDDING
                        </button>
                    </div>
                </div>
            )}

            {/* Bid Modal */}
            {bidTarget && (
                <BidModal
                    player={bidTarget}
                    myTeam={myTeam}
                    existingBid={existingBidFor(bidTarget.id)}
                    onSubmit={(amount, drop) => handleBidSubmit(bidTarget, amount, drop)}
                    onClose={() => setBidTarget(null)}
                />
            )}
        </div>
    );
};
