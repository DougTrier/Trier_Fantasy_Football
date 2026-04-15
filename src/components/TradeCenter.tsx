/**
 * TradeCenter — Trade Offer Hub
 * ==============================
 * Displays all TRADE_OFFER transactions from the user's perspective:
 *   - Outgoing: offers the user has sent (from their own transactions list)
 *   - Incoming: offers other teams sent that target a player the user owns
 *     (discovered by scanning all teams' transactions for matching targetPlayerId)
 *
 * Accepts trigger a two-step confirmation dialog to prevent accidental trades.
 * The escrow balance check in the confirmation dialog is a soft warning only —
 * the App layer enforces hard balance constraints when the offer was created.
 *
 * Admins see the "Commissioner Override" panel which shows all league-wide
 * pending offers and allows force-accept or force-cancel of any offer.
 */
// useState: tracks the two-step confirmation flow; null = no confirm shown.
import React, { useState } from 'react';
// useDialog: imperative async dialogs so we can await user confirmation.
import { useDialog } from './AppDialog';
import type { FantasyTeam, Transaction } from '../types';
import { ArrowRightLeft, History, Clock, CheckCircle, XCircle, Shield } from 'lucide-react';
import leatherTexture from '../assets/leather_texture.png';

interface TradeCenterProps {
    userTeam: FantasyTeam;
    allTeams: FantasyTeam[];
    isAdmin?: boolean;
    onAccept: (offer: Transaction, offeringTeam: FantasyTeam) => void;
    onDecline: (offer: Transaction, offeringTeam: FantasyTeam) => void;
    onCancel: (offerId: string) => void;
    onAdminForceAccept?: (offer: Transaction, buyerTeam: FantasyTeam, sellerTeam: FantasyTeam) => void;
    onAdminForceCancel?: (offerId: string, offeringTeamId: string) => void;
}

/**
 * TradeCenter — Trade Offer Hub component.
 * All trade mutation callbacks (accept/decline/cancel) are handled in App.tsx
 * to keep the event-signing logic (ECDSA + EventStore) centralized. This
 * component is purely display + user intent capture.
 */
export const TradeCenter: React.FC<TradeCenterProps> = ({
    userTeam, allTeams, isAdmin,
    onAccept, onDecline, onCancel,
    onAdminForceAccept, onAdminForceCancel
}) => {
    // pendingConfirm: the offer staged for second-step confirmation. null = idle.
    const [pendingConfirm, setPendingConfirm] = useState<{ offer: Transaction; team: FantasyTeam } | null>(null);
    const { showConfirm } = useDialog();

    // Derive offer lists from the transactions arrays — no separate offer store.
    const transactions = userTeam.transactions || [];
    // Outgoing: offers this team has placed on players they want to buy.
    // These live in the buyer's own transaction list.
    const outgoingOffers = transactions.filter(tx => tx.type === 'TRADE_OFFER');

    // Incoming: scan every other team's transactions for offers targeting a player I own.
    // This O(n*m) scan is acceptable because leagues have ≤20 teams and ≤50 offers each.
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

    // All pending offers across the whole league (admin view only)
    const allPendingOffers: { offer: Transaction; buyerTeam: FantasyTeam; sellerTeam: FantasyTeam | null }[] = [];
    if (isAdmin) {
        allTeams.forEach(buyerTeam => {
            (buyerTeam.transactions || []).filter(tx => tx.type === 'TRADE_OFFER').forEach(offer => {
                // Resolve the seller by finding which team currently owns the targeted player
                const sellerTeam = allTeams.find(t =>
                    [...Object.values(t.roster), ...t.bench].some(p => p && p.id === offer.targetPlayerId)
                ) || null;
                allPendingOffers.push({ offer, buyerTeam, sellerTeam });
            });
        });
    }

    return (
        <div style={{ padding: '30px', color: 'white', maxWidth: '1200px', margin: '0 auto' }}>

            {/* ── Confirmation Dialog ───────────────────────────────────────────────── */}
            {pendingConfirm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#0f172a', border: '1px solid #10b981', borderRadius: '20px', padding: '32px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>Confirm Trade</h2>
                        <div style={{ marginBottom: '20px', lineHeight: 1.8, color: '#d1d5db' }}>
                            <div>You are selling <strong style={{ color: '#fff', fontSize: '1.05rem' }}>{pendingConfirm.offer.playerName}</strong></div>
                            <div>to <strong style={{ color: '#eab308' }}>{pendingConfirm.team.name}</strong></div>
                            <div style={{ marginTop: '14px', padding: '14px 16px', background: 'rgba(16,185,129,0.1)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.3)' }}>
                                You will receive{' '}
                                <strong style={{ color: '#10b981', fontSize: '1.25rem' }}>
                                    {pendingConfirm.offer.amount?.toLocaleString()} PTS
                                </strong>
                            </div>
                            {/* Escrow balance check */}
                            {(() => {
                                const escrowed = pendingConfirm.team.points_escrowed || 0;
                                const offerAmt = pendingConfirm.offer.amount || 0;
                                const sufficient = escrowed >= offerAmt;
                                return (
                                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: sufficient ? '#6b7280' : '#ef4444', fontWeight: 600 }}>
                                        {sufficient
                                            ? `${pendingConfirm.team.name} has ${escrowed.toLocaleString()} PTS in escrow — trade is funded.`
                                            : `Warning: buyer escrow (${escrowed.toLocaleString()} PTS) may be insufficient.`}
                                    </div>
                                );
                            })()}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => { onAccept(pendingConfirm.offer, pendingConfirm.team); setPendingConfirm(null); }}
                                style={{ flex: 1, background: '#10b981', color: '#000', border: 'none', padding: '13px', borderRadius: '10px', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer' }}
                            >
                                CONFIRM TRADE
                            </button>
                            <button
                                onClick={() => setPendingConfirm(null)}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '13px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
                            >
                                CANCEL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ───────────────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px' }}>
                <div style={{ background: '#eab308', padding: '12px', borderRadius: '12px' }}>
                    <ArrowRightLeft size={32} color="#000" />
                </div>
                <div>
                    <h1 style={{
                        fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', margin: 0,
                        color: 'transparent', backgroundImage: `url(${leatherTexture})`, backgroundSize: '150px',
                        backgroundPosition: 'center', WebkitBackgroundClip: 'text', backgroundClip: 'text',
                        fontFamily: "'Graduate', 'Impact', sans-serif",
                        WebkitTextStroke: '1px rgba(255,255,255,0.95)', textShadow: '0 5px 15px rgba(0,0,0,0.9)'
                    }}>
                        Trade Center
                    </h1>
                    <p style={{ color: '#9ca3af', fontWeight: 600 }}>Manage your pending offers and transfer history</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px' }}>

                {/* ── Active Offers ─────────────────────────────────────────────────── */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '25px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Clock size={20} color="#eab308" />
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
                                    {incomingOffers.map(({ offer, team }) => (
                                        <div key={offer.id} style={{
                                            background: 'rgba(16,185,129,0.05)', padding: '20px', borderRadius: '16px',
                                            border: '1px solid rgba(16,185,129,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{offer.playerName}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                                                    From <strong style={{ color: '#fff' }}>{team.name}</strong> • <strong style={{ color: '#10b981' }}>{offer.amount?.toLocaleString()} PTS</strong>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => onDecline(offer, team)}
                                                    title="Reject this trade offer."
                                                    style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                                >
                                                    DECLINE
                                                </button>
                                                <button
                                                    onClick={() => setPendingConfirm({ offer, team })}
                                                    title="Review and confirm this trade offer."
                                                    style={{ background: '#10b981', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}
                                                >
                                                    ACCEPT
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {outgoingOffers.length > 0 && (
                                <>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#eab308', letterSpacing: '1px', marginBottom: '-10px' }}>OUTGOING OFFERS</div>
                                    {outgoingOffers.map(offer => (
                                        <div key={offer.id} style={{
                                            background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px',
                                            border: '1px solid rgba(234,179,8,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{offer.playerName}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}><strong style={{ color: '#eab308' }}>{offer.amount?.toLocaleString()} PTS</strong> Escrowed</div>
                                            </div>
                                            <button
                                                onClick={() => onCancel(offer.id)}
                                                title="Withdraw this offer and return escrowed points."
                                                style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                            >
                                                CANCEL
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Ledger History ────────────────────────────────────────────────── */}
                {/* Shows the 10 most recent transactions — ADD/DROP/SWAP/TRADE events   */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '25px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <History size={20} color="#3b82f6" />
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase' }}>Ledger History</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Cap at 10 entries to keep the panel compact — full history is in transactions array */}
                        {transactions.slice(0, 10).map(tx => (
                            <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '8px',
                                    background: tx.type === 'ADD' ? 'rgba(16,185,129,0.1)' : tx.type === 'DROP' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {tx.type === 'ADD' ? <CheckCircle size={16} color="#10b981" /> : tx.type === 'DROP' ? <XCircle size={16} color="#ef4444" /> : <ArrowRightLeft size={16} color="#eab308" />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{tx.description}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{new Date(tx.timestamp).toLocaleString()}</div>
                                </div>
                                {/* Prefix TRADE_OFFER amounts with "-" to show they reduced the balance */}
                                {tx.amount && (
                                    <div style={{ fontWeight: 800, color: tx.type === 'TRADE_OFFER' ? '#eab308' : '#fff' }}>
                                        {tx.type === 'TRADE_OFFER' ? '-' : ''}{tx.amount.toLocaleString()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Commissioner Override (Admin Only) ───────────────────────────────── */}
            {isAdmin && (
                <div style={{ marginTop: '30px', background: 'rgba(234,179,8,0.04)', borderRadius: '24px', border: '1px solid rgba(234,179,8,0.25)', padding: '25px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Shield size={20} color="#eab308" />
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', color: '#eab308' }}>Commissioner Override</h2>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(234,179,8,0.15)', color: '#eab308', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, letterSpacing: '1px' }}>ADMIN ONLY</span>
                    </div>

                    {allPendingOffers.length === 0 ? (
                        <div style={{ color: '#4b5563', textAlign: 'center', padding: '24px' }}>No pending offers across any team.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {allPendingOffers.map(({ offer, buyerTeam, sellerTeam }) => (
                                <div key={`admin-${offer.id}`} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '14px 18px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.07)'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 800 }}>{offer.playerName}</div>
                                        <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '2px' }}>
                                            <strong style={{ color: '#eab308' }}>{buyerTeam.name}</strong> offering{' '}
                                            <strong style={{ color: '#10b981' }}>{offer.amount?.toLocaleString()} PTS</strong>
                                            {sellerTeam && <> → <strong style={{ color: '#fff' }}>{sellerTeam.name}</strong></>}
                                            {!sellerTeam && <span style={{ color: '#ef4444' }}> (player not found)</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {sellerTeam && onAdminForceAccept && (
                                            <button
                                                onClick={async () => {
                                                    if (await showConfirm(`${buyerTeam.name} acquires ${offer.playerName} for ${offer.amount?.toLocaleString()} PTS. Proceed?`, "Commissioner Override", "FORCE ACCEPT")) {
                                                        onAdminForceAccept(offer, buyerTeam, sellerTeam);
                                                    }
                                                }}
                                                style={{ background: '#10b981', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}
                                            >
                                                FORCE ACCEPT
                                            </button>
                                        )}
                                        {onAdminForceCancel && (
                                            <button
                                                onClick={async () => {
                                                    if (await showConfirm(`Cancel this offer and return ${offer.amount?.toLocaleString()} PTS to ${buyerTeam.name}?`, "Cancel Offer", "FORCE CANCEL")) {
                                                        onAdminForceCancel(offer.id, buyerTeam.id);
                                                    }
                                                }}
                                                style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                            >
                                                FORCE CANCEL
                                            </button>
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
