/**
 * TradeCenter — Trade Offer Hub
 * ==============================
 * Three panels:
 *   Active Offers  — incoming (with fairness score + counter offer) and outgoing
 *   Trade History  — all TRADE_ACCEPT entries across every team in the league
 *   Commissioner   — force-accept / force-cancel any pending offer (admin only)
 *
 * FAIRNESS SCORE:
 *   Player's projected PPG is used as the baseline value.
 *   Offered PTS compared to (PPG × 4) — a "4-week value" benchmark.
 *   GREAT ≥ 90% · FAIR 70–90% · LOW < 70%
 *
 * COUNTER OFFER:
 *   Seller clicks Counter → enters desired amount → App updates the buyer's
 *   existing offer amount in-place so the buyer sees the new price.
 */
import React, { useState, useMemo } from 'react';
import { useDialog } from './AppDialog';
import type { FantasyTeam, Transaction, Player } from '../types';
import { ArrowRightLeft, History, Clock, CheckCircle, XCircle, Shield, TrendingUp, RefreshCw } from 'lucide-react';
import leatherTexture from '../assets/leather_texture.png';

// ── Shared style ──────────────────────────────────────────────────────────────

const GOLD   = '#eab308';
// Standard dark overlay — prevents chalkboard bleed-through on all panels.
const PANEL  = {
    background: 'rgba(10,14,26,0.82)',
    backdropFilter: 'blur(8px)',
    borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '25px',
};

// ── Fairness helpers ──────────────────────────────────────────────────────────

function getPlayerPPG(playerId: string | undefined, allTeams: FantasyTeam[], allPlayers: Player[]): number | null {
    if (!playerId) return null;
    // Check player pool first
    const poolPlayer = allPlayers.find(p => p.id === playerId);
    if (poolPlayer?.projectedPoints) return poolPlayer.projectedPoints;
    // Fall back to scanning rosters
    for (const team of allTeams) {
        const found = [...Object.values(team.roster), ...team.bench].find(p => p?.id === playerId);
        if (found?.projectedPoints) return found.projectedPoints;
    }
    return null;
}

function fairnessLabel(offered: number, ppg: number): { label: string; color: string } {
    const fairValue = ppg * 4; // 4-week benchmark
    const pct = offered / fairValue;
    if (pct >= 0.9) return { label: 'GREAT OFFER', color: '#10b981' };
    if (pct >= 0.7) return { label: 'FAIR', color: GOLD };
    return { label: 'LOW OFFER', color: '#ef4444' };
}

// ── Counter Offer Modal ───────────────────────────────────────────────────────

const CounterModal: React.FC<{
    offer: Transaction;
    buyerTeam: FantasyTeam;
    ppg: number | null;
    onSubmit: (amount: number) => void;
    onClose: () => void;
}> = ({ offer, buyerTeam, ppg, onSubmit, onClose }) => {
    const suggested = ppg ? Math.round(ppg * 4) : (offer.amount ?? 0) + 10;
    const [amount, setAmount] = useState(suggested);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{
                background: `url(${leatherTexture}), linear-gradient(135deg, rgba(17,24,39,0.98), rgba(31,41,55,0.98))`,
                backgroundBlendMode: 'overlay', backgroundSize: '150px, cover',
                border: '2px solid rgba(234,179,8,0.4)', borderRadius: '16px',
                padding: '28px', width: '380px', maxWidth: '90vw',
                boxShadow: '0 30px 60px rgba(0,0,0,0.7)',
            }}>
                <div style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>Counter Offer</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>{offer.playerName}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '20px' }}>
                    {buyerTeam.name} offered <strong style={{ color: GOLD }}>{offer.amount?.toLocaleString()} PTS</strong>
                    {ppg && <span> · Player PPG: <strong style={{ color: '#fff' }}>{ppg.toFixed(1)}</strong></span>}
                </div>

                <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Counter Amount (PTS)</label>
                <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '8px', marginBottom: '20px', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff', fontSize: '1.1rem', fontWeight: 900, outline: 'none', boxSizing: 'border-box' }}
                />

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => onSubmit(amount)} style={{ flex: 1, background: `linear-gradient(90deg,${GOLD},#ca8a04)`, border: 'none', borderRadius: '8px', padding: '11px', color: '#000', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer' }}>
                        SEND COUNTER
                    </button>
                    <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '11px', color: '#e5e7eb', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                        CANCEL
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface TradeCenterProps {
    userTeam: FantasyTeam;
    allTeams: FantasyTeam[];
    allPlayers: Player[];
    isAdmin?: boolean;
    onAccept: (offer: Transaction, offeringTeam: FantasyTeam) => void;
    onDecline: (offer: Transaction, offeringTeam: FantasyTeam) => void;
    onCancel: (offerId: string) => void;
    onCounterOffer: (offer: Transaction, counterAmount: number, buyerTeam: FantasyTeam) => void;
    onAdminForceAccept?: (offer: Transaction, buyerTeam: FantasyTeam, sellerTeam: FantasyTeam) => void;
    onAdminForceCancel?: (offerId: string, offeringTeamId: string) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export const TradeCenter: React.FC<TradeCenterProps> = ({
    userTeam, allTeams, allPlayers, isAdmin,
    onAccept, onDecline, onCancel, onCounterOffer,
    onAdminForceAccept, onAdminForceCancel,
}) => {
    const [pendingConfirm, setPendingConfirm] = useState<{ offer: Transaction; team: FantasyTeam } | null>(null);
    const [counterTarget, setCounterTarget]   = useState<{ offer: Transaction; team: FantasyTeam } | null>(null);
    const { showConfirm } = useDialog();

    const transactions   = userTeam.transactions || [];
    const outgoingOffers = transactions.filter(tx => tx.type === 'TRADE_OFFER');

    // Incoming: other teams offering PTS for a player I own
    const incomingOffers: { offer: Transaction; team: FantasyTeam }[] = [];
    allTeams.forEach(team => {
        if (team.id === userTeam.id) return;
        (team.transactions || []).forEach(tx => {
            if (tx.type === 'TRADE_OFFER' && tx.targetPlayerId) {
                const isMine = [...Object.values(userTeam.roster), ...userTeam.bench].some(p => p && p.id === tx.targetPlayerId);
                if (isMine) incomingOffers.push({ offer: tx, team });
            }
        });
    });

    // League-wide completed trades (all TRADE_ACCEPT across all teams)
    const tradeHistory = useMemo(() => {
        const entries: { tx: Transaction; team: FantasyTeam }[] = [];
        allTeams.forEach(team => {
            (team.transactions || [])
                .filter(tx => tx.type === 'TRADE_ACCEPT')
                .forEach(tx => entries.push({ tx, team }));
        });
        return entries.sort((a, b) => b.tx.timestamp - a.tx.timestamp).slice(0, 30);
    }, [allTeams]);

    // Admin view: all pending offers league-wide
    const allPendingOffers: { offer: Transaction; buyerTeam: FantasyTeam; sellerTeam: FantasyTeam | null }[] = [];
    if (isAdmin) {
        allTeams.forEach(buyerTeam => {
            (buyerTeam.transactions || []).filter(tx => tx.type === 'TRADE_OFFER').forEach(offer => {
                const sellerTeam = allTeams.find(t =>
                    [...Object.values(t.roster), ...t.bench].some(p => p && p.id === offer.targetPlayerId)
                ) || null;
                allPendingOffers.push({ offer, buyerTeam, sellerTeam });
            });
        });
    }

    return (
        <div style={{ padding: '30px', color: 'white', maxWidth: '1200px', margin: '0 auto' }}>

            {/* ── Confirm accept dialog ─────────────────────────────────────── */}
            {pendingConfirm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#0f172a', border: '1px solid #10b981', borderRadius: '20px', padding: '32px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>Confirm Trade</h2>
                        <div style={{ marginBottom: '20px', lineHeight: 1.8, color: '#d1d5db' }}>
                            <div>You are selling <strong style={{ color: '#fff', fontSize: '1.05rem' }}>{pendingConfirm.offer.playerName}</strong></div>
                            <div>to <strong style={{ color: GOLD }}>{pendingConfirm.team.name}</strong></div>
                            <div style={{ marginTop: '14px', padding: '14px 16px', background: 'rgba(16,185,129,0.1)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.3)' }}>
                                You will receive <strong style={{ color: '#10b981', fontSize: '1.25rem' }}>{pendingConfirm.offer.amount?.toLocaleString()} PTS</strong>
                            </div>
                            {(() => {
                                const escrowed = pendingConfirm.team.points_escrowed || 0;
                                const offerAmt = pendingConfirm.offer.amount || 0;
                                const ok = escrowed >= offerAmt;
                                return <div style={{ marginTop: '8px', fontSize: '0.78rem', color: ok ? '#6b7280' : '#ef4444', fontWeight: 600 }}>{ok ? `${pendingConfirm.team.name} has ${escrowed.toLocaleString()} PTS in escrow — trade is funded.` : `Warning: buyer escrow (${escrowed.toLocaleString()} PTS) may be insufficient.`}</div>;
                            })()}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => { onAccept(pendingConfirm.offer, pendingConfirm.team); setPendingConfirm(null); }} style={{ flex: 1, background: '#10b981', color: '#000', border: 'none', padding: '13px', borderRadius: '10px', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer' }}>CONFIRM TRADE</button>
                            <button onClick={() => setPendingConfirm(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '13px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Counter offer modal ───────────────────────────────────────── */}
            {counterTarget && (
                <CounterModal
                    offer={counterTarget.offer}
                    buyerTeam={counterTarget.team}
                    ppg={getPlayerPPG(counterTarget.offer.targetPlayerId, allTeams, allPlayers)}
                    onSubmit={(amount) => {
                        onCounterOffer(counterTarget.offer, amount, counterTarget.team);
                        setCounterTarget(null);
                    }}
                    onClose={() => setCounterTarget(null)}
                />
            )}

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)', borderRadius: '16px', padding: '18px 24px' }}>
                <div style={{ background: GOLD, padding: '12px', borderRadius: '12px' }}>
                    <ArrowRightLeft size={32} color="#000" />
                </div>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: 'transparent', backgroundImage: `url(${leatherTexture})`, backgroundSize: '150px', backgroundPosition: 'center', WebkitBackgroundClip: 'text', backgroundClip: 'text', fontFamily: "'Graduate','Impact',sans-serif", WebkitTextStroke: '1px rgba(255,255,255,0.95)', textShadow: '0 5px 15px rgba(0,0,0,0.9)' }}>
                        Trade Center
                    </h1>
                    <p style={{ color: '#9ca3af', fontWeight: 600 }}>Manage pending offers, analyze fairness, and browse league trade history</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(350px,1fr))', gap: '30px' }}>

                {/* ── Active Offers ─────────────────────────────────────────── */}
                <div style={PANEL}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Clock size={20} color={GOLD} />
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase' }}>Active Offers</h2>
                    </div>

                    {incomingOffers.length === 0 && outgoingOffers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#4b5563' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚖️</div>
                            <p>No active trade offers found.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {incomingOffers.length > 0 && (
                                <>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#10b981', letterSpacing: '1px', marginBottom: '-10px' }}>INCOMING OFFERS</div>
                                    {incomingOffers.map(({ offer, team }) => {
                                        const ppg = getPlayerPPG(offer.targetPlayerId, allTeams, allPlayers);
                                        const fair = ppg && offer.amount ? fairnessLabel(offer.amount, ppg) : null;
                                        return (
                                            <div key={offer.id} style={{ background: 'rgba(16,185,129,0.05)', padding: '18px', borderRadius: '16px', border: '1px solid rgba(16,185,129,0.3)' }}>
                                                {/* Player + offer amount */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{offer.playerName}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                                                            From <strong style={{ color: '#fff' }}>{team.name}</strong> · <strong style={{ color: '#10b981' }}>{offer.amount?.toLocaleString()} PTS</strong>
                                                        </div>
                                                    </div>
                                                    {/* Fairness badge */}
                                                    {fair && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: `${fair.color}18`, border: `1px solid ${fair.color}40` }}>
                                                            <TrendingUp size={11} color={fair.color} />
                                                            <span style={{ fontSize: '0.6rem', fontWeight: 900, color: fair.color, letterSpacing: '1px' }}>{fair.label}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Fairness details */}
                                                {ppg && offer.amount && (
                                                    <div style={{ fontSize: '0.68rem', color: '#6b7280', marginBottom: '12px', padding: '7px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
                                                        Player PPG: <strong style={{ color: '#e5e7eb' }}>{ppg.toFixed(1)}</strong>
                                                        <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
                                                        4-wk value: <strong style={{ color: '#e5e7eb' }}>{(ppg * 4).toFixed(0)} PTS</strong>
                                                        <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
                                                        Offered: <strong style={{ color: '#e5e7eb' }}>{Math.round((offer.amount / (ppg * 4)) * 100)}% of value</strong>
                                                    </div>
                                                )}

                                                {/* Action buttons */}
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => onDecline(offer, team)} style={{ flex: 1, background: '#333', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>DECLINE</button>
                                                    <button onClick={() => setCounterTarget({ offer, team })} style={{ flex: 1, background: 'rgba(234,179,8,0.15)', color: GOLD, border: `1px solid rgba(234,179,8,0.4)`, padding: '8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                        <RefreshCw size={11} /> COUNTER
                                                    </button>
                                                    <button onClick={() => setPendingConfirm({ offer, team })} style={{ flex: 1, background: '#10b981', color: '#000', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 900, cursor: 'pointer' }}>ACCEPT</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            {outgoingOffers.length > 0 && (
                                <>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: GOLD, letterSpacing: '1px', marginBottom: '-10px' }}>OUTGOING OFFERS</div>
                                    {outgoingOffers.map(offer => (
                                        <div key={offer.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '18px', borderRadius: '16px', border: '1px solid rgba(234,179,8,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{offer.playerName}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}><strong style={{ color: GOLD }}>{offer.amount?.toLocaleString()} PTS</strong> Escrowed</div>
                                            </div>
                                            <button onClick={() => onCancel(offer.id)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>CANCEL</button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Ledger History ────────────────────────────────────────── */}
                <div style={PANEL}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <History size={20} color="#3b82f6" />
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase' }}>My Ledger</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {transactions.slice(0, 10).map(tx => (
                            <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: tx.type === 'ADD' ? 'rgba(16,185,129,0.1)' : tx.type === 'DROP' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {tx.type === 'ADD' ? <CheckCircle size={15} color="#10b981" /> : tx.type === 'DROP' ? <XCircle size={15} color="#ef4444" /> : <ArrowRightLeft size={15} color={GOLD} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>{new Date(tx.timestamp).toLocaleString()}</div>
                                </div>
                                {tx.amount && <div style={{ fontWeight: 800, fontSize: '0.82rem', color: tx.type === 'TRADE_OFFER' ? GOLD : '#fff', flexShrink: 0 }}>{tx.type === 'TRADE_OFFER' ? '-' : ''}{tx.amount.toLocaleString()}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── League Trade History ──────────────────────────────────────── */}
            <div style={{ ...PANEL, marginTop: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <TrendingUp size={20} color="#a855f7" />
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase' }}>League Trade History</h2>
                    <span style={{ fontSize: '0.65rem', background: 'rgba(168,85,247,0.15)', color: '#a855f7', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, letterSpacing: '1px' }}>ALL TEAMS</span>
                </div>

                {tradeHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#4b5563' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📋</div>
                        <p style={{ fontSize: '0.85rem' }}>No completed trades in the league yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: '12px' }}>
                        {tradeHistory.map(({ tx, team }) => (
                            <div key={`${team.id}-${tx.id}`} style={{ padding: '12px 16px', background: 'rgba(168,85,247,0.04)', borderRadius: '12px', border: '1px solid rgba(168,85,247,0.15)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#e5e7eb' }}>{tx.playerName ?? tx.description}</div>
                                    {tx.amount && <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#10b981' }}>{tx.amount.toLocaleString()} PTS</div>}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>
                                    <strong style={{ color: '#9ca3af' }}>{team.name}</strong> · {new Date(tx.timestamp).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Commissioner Override ─────────────────────────────────────── */}
            {isAdmin && (
                <div style={{ marginTop: '30px', background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)', borderRadius: '24px', border: '1px solid rgba(234,179,8,0.25)', padding: '25px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Shield size={20} color={GOLD} />
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', color: GOLD }}>Commissioner Override</h2>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(234,179,8,0.15)', color: GOLD, padding: '2px 8px', borderRadius: '4px', fontWeight: 800, letterSpacing: '1px' }}>ADMIN ONLY</span>
                    </div>

                    {allPendingOffers.length === 0 ? (
                        <div style={{ color: '#4b5563', textAlign: 'center', padding: '24px' }}>No pending offers across any team.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {allPendingOffers.map(({ offer, buyerTeam, sellerTeam }) => (
                                <div key={`admin-${offer.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                                    <div>
                                        <div style={{ fontWeight: 800 }}>{offer.playerName}</div>
                                        <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '2px' }}>
                                            <strong style={{ color: GOLD }}>{buyerTeam.name}</strong> offering <strong style={{ color: '#10b981' }}>{offer.amount?.toLocaleString()} PTS</strong>
                                            {sellerTeam && <> → <strong style={{ color: '#fff' }}>{sellerTeam.name}</strong></>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {sellerTeam && onAdminForceAccept && (
                                            <button onClick={async () => { if (await showConfirm(`${buyerTeam.name} acquires ${offer.playerName} for ${offer.amount?.toLocaleString()} PTS. Proceed?`, "Commissioner Override", "FORCE ACCEPT")) onAdminForceAccept(offer, buyerTeam, sellerTeam); }} style={{ background: '#10b981', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}>FORCE ACCEPT</button>
                                        )}
                                        {onAdminForceCancel && (
                                            <button onClick={async () => { if (await showConfirm(`Cancel this offer and return ${offer.amount?.toLocaleString()} PTS to ${buyerTeam.name}?`, "Cancel Offer", "FORCE CANCEL")) onAdminForceCancel(offer.id, buyerTeam.id); }} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>FORCE CANCEL</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
