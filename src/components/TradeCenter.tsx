import React from 'react';
import type { FantasyTeam, Transaction } from '../types';
import { ArrowRightLeft, History, Clock, CheckCircle, XCircle } from 'lucide-react';
import leatherTexture from '../assets/leather_texture.png';

interface TradeCenterProps {
    userTeam: FantasyTeam;
    allTeams: FantasyTeam[];
    onAccept: (offer: Transaction, offeringTeam: FantasyTeam) => void;
    onDecline: (offer: Transaction, offeringTeam: FantasyTeam) => void;
    onCancel: (offerId: string) => void;
}

export const TradeCenter: React.FC<TradeCenterProps> = ({ userTeam, allTeams, onAccept, onDecline, onCancel }) => {
    const transactions = userTeam.transactions || [];
    const outgoingOffers = transactions.filter(tx => tx.type === 'TRADE_OFFER');

    // Find incoming offers by checking other teams' transactions for my players
    const incomingOffers: { offer: Transaction; team: FantasyTeam }[] = [];
    allTeams.forEach(team => {
        if (team.id === userTeam.id) return;
        (team.transactions || []).forEach(tx => {
            if (tx.type === 'TRADE_OFFER' && tx.targetPlayerId) {
                // Check if I own this player
                const isMine = [...Object.values(userTeam.roster), ...userTeam.bench].some(p => p && p.id === tx.targetPlayerId);
                if (isMine) {
                    incomingOffers.push({ offer: tx, team: team });
                }
            }
        });
    });

    return (
        <div style={{ padding: '30px', color: 'white', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px' }}>
                <div style={{ background: '#eab308', padding: '12px', borderRadius: '12px' }}>
                    <ArrowRightLeft size={32} color="#000" />
                </div>
                <div>
                    <h1 style={{
                        fontSize: '2.5rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        margin: 0,
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
                        Trade Center
                    </h1>
                    <p style={{ color: '#9ca3af', fontWeight: 600 }}>Manage your pending offers and transfer history</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px' }}>
                {/* Active Offers Section */}
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
                            {/* INCOMING SECTION */}
                            {incomingOffers.length > 0 && (
                                <>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#10b981', letterSpacing: '1px', marginBottom: '-10px' }}>INCOMING OFFERS</div>
                                    {incomingOffers.map(({ offer, team }) => (
                                        <div key={offer.id} style={{
                                            background: 'rgba(16, 185, 129, 0.05)',
                                            padding: '20px',
                                            borderRadius: '16px',
                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{offer.playerName}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>From <strong style={{ color: '#fff' }}>{team.name}</strong> • <strong style={{ color: '#10b981' }}>{offer.amount?.toLocaleString()} PTS</strong></div>
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
                                                    onClick={() => onAccept(offer, team)}
                                                    title="Confirm this trade and swap players/points immediately."
                                                    style={{ background: '#10b981', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}
                                                >
                                                    ACCEPT
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* OUTGOING SECTION */}
                            {outgoingOffers.length > 0 && (
                                <>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#eab308', letterSpacing: '1px', marginBottom: '-10px' }}>OUTGOING OFFERS</div>
                                    {outgoingOffers.map(offer => (
                                        <div key={offer.id} style={{
                                            background: 'rgba(0,0,0,0.3)',
                                            padding: '20px',
                                            borderRadius: '16px',
                                            border: '1px solid rgba(234, 179, 8, 0.2)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{offer.playerName}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}><strong style={{ color: '#eab308' }}>{offer.amount?.toLocaleString()} PTS</strong> Escrowed</div>
                                            </div>
                                            <button
                                                onClick={() => onCancel(offer.id)}
                                                title="Withdraw this offer."
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

                {/* Transfer History Section */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', padding: '25px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <History size={20} color="#3b82f6" />
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase' }}>Ledger History</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {transactions.slice(0, 10).map(tx => (
                            <div key={tx.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '12px'
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: tx.type === 'ADD' ? 'rgba(16, 185, 129, 0.1)' : tx.type === 'DROP' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {tx.type === 'ADD' ? <CheckCircle size={16} color="#10b981" /> : tx.type === 'DROP' ? <XCircle size={16} color="#ef4444" /> : <ArrowRightLeft size={16} color="#eab308" />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{tx.description}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{new Date(tx.timestamp).toLocaleString()}</div>
                                </div>
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
        </div>
    );
};
