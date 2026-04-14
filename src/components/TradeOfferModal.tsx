import React, { useState } from 'react';
import type { Player, FantasyTeam } from '../types';
import { Wallet, Info, AlertTriangle, Zap } from 'lucide-react';

interface TradeOfferModalProps {
    player: Player;
    userTeam: FantasyTeam;
    onClose: () => void;
    onSubmit: (amount: number) => void;
}

export const TradeOfferModal: React.FC<TradeOfferModalProps> = ({ player, userTeam, onClose, onSubmit }) => {
    const [amount, setAmount] = useState<number>(100);
    const balance = (userTeam.total_production_pts || 0) - (userTeam.points_spent || 0);

    const isInvalid = amount > balance || amount <= 0;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div style={{
                background: '#1a1a1a',
                border: '4px solid #eab308',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '450px',
                overflow: 'hidden',
                boxShadow: '0 25px 50px rgba(0,0,0,0.8)'
            }}>
                {/* Header */}
                <div style={{ background: '#eab308', padding: '20px', color: '#000', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px' }}>New Trade Offer</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: "'Graduate', sans-serif" }}>{player.lastName}</div>
                </div>

                <div style={{ padding: '30px' }}>
                    {/* Balance Info */}
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        padding: '15px',
                        borderRadius: '12px',
                        marginBottom: '25px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.8rem', fontWeight: 700 }}>
                            <span>AVAILABLE BALANCE</span>
                            <span style={{ color: '#10b981' }}>{balance.toLocaleString()} PTS</span>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 900, color: '#eab308', letterSpacing: '1px', marginBottom: '8px' }}>OFFER AMOUNT (PTS)</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    background: '#000',
                                    border: isInvalid ? '2px solid #ef4444' : '2px solid #333',
                                    borderRadius: '12px',
                                    padding: '15px 15px 15px 45px',
                                    color: '#fff',
                                    fontSize: '1.5rem',
                                    fontWeight: 900,
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                            />
                            <Wallet style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#eab308' }} size={24} />
                        </div>
                        {amount > balance && (
                            <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}>
                                <AlertTriangle size={14} /> Insufficient Balance
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '15px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '30px', display: 'flex', gap: '12px' }}>
                        <Info size={20} color="#3b82f6" style={{ flexShrink: 0 }} />
                        <div style={{ fontSize: '0.75rem', color: '#93c5fd', lineHeight: 1.4 }}>
                            Points will be held <strong>In Escrow</strong> once the offer is sent. If the offer is declined or expires, points will return to your balance.
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                flex: 1,
                                padding: '15px',
                                background: 'transparent',
                                border: '2px solid #333',
                                color: '#9ca3af',
                                borderRadius: '12px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                textTransform: 'uppercase'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => !isInvalid && onSubmit(amount)}
                            disabled={isInvalid}
                            style={{
                                flex: 2,
                                padding: '15px',
                                background: isInvalid ? '#4b5563' : 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                                color: '#000',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 900,
                                cursor: isInvalid ? 'not-allowed' : 'pointer',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: isInvalid ? 'none' : '0 10px 20px rgba(234, 179, 8, 0.3)'
                            }}
                        >
                            Send Offer <Zap size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
