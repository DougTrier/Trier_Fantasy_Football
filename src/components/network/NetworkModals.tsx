import React from 'react';
import { X, Copy, Check, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type DiscoveredPeer } from '../../services/DiscoveryService';
import { DiagnosticsRunner } from './DiagnosticsRunner';

// ─── Invite Modal ────────────────────────────────────────────────────────────

interface InviteModalProps {
    show: boolean;
    inviteCode: string;
    onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ show, inviteCode, onClose }) => (
    <AnimatePresence>
        {show && (
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90
                }}
                onClick={onClose}
            >
                <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '12px', width: '500px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2>Invite Friend</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
                    </div>

                    <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
                        Share this code with a friend on the same network to let them connect to you manually.
                    </p>

                    <div style={{
                        background: '#000', padding: '1rem', borderRadius: '6px',
                        border: '1px solid #333',
                        fontFamily: 'monospace', wordBreak: 'break-all',
                        marginBottom: '1rem',
                        display: 'flex', gap: '1rem', alignItems: 'center'
                    }}>
                        <span style={{ flex: 1 }}>{inviteCode}</span>
                        <button
                            onClick={() => navigator.clipboard.writeText(inviteCode)}
                            style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer' }}
                            title="Copy"
                        >
                            <Copy size={16} />
                        </button>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#eab308' }}>
                        Note: Invites require both devices to be on this LAN.
                    </div>
                </div>
            </motion.div>
        )}
    </AnimatePresence>
);

// ─── Join Modal ──────────────────────────────────────────────────────────────

interface JoinModalProps {
    show: boolean;
    joinCode: string;
    onJoinCodeChange: (v: string) => void;
    onClose: () => void;
    onRedeem: () => void;
}

export const JoinModal: React.FC<JoinModalProps> = ({ show, joinCode, onJoinCodeChange, onClose, onRedeem }) => (
    <AnimatePresence>
        {show && (
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90
                }}
                onClick={onClose}
            >
                <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '12px', width: '400px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2>Join Friend</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
                    </div>

                    <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Paste Invite Code</label>
                    <textarea
                        value={joinCode}
                        onChange={e => onJoinCodeChange(e.target.value)}
                        placeholder="Paste code here..."
                        style={{
                            width: '100%', padding: '0.5rem',
                            background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '4px',
                            minHeight: '80px', marginBottom: '1rem', fontFamily: 'monospace'
                        }}
                    />

                    <button
                        onClick={onRedeem}
                        style={{
                            width: '100%', padding: '0.75rem',
                            background: '#3b82f6', color: '#fff',
                            border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer'
                        }}
                    >
                        FIND PEER
                    </button>
                </div>
            </motion.div>
        )}
    </AnimatePresence>
);

// ─── Diagnostics Modal ───────────────────────────────────────────────────────

interface DiagnosticsModalProps {
    show: boolean;
    peers: DiscoveredPeer[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getConnection: (id: string) => any;
    onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ show, peers, getConnection, onClose }) => (
    <AnimatePresence>
        {show && (
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90
                }}
                onClick={onClose}
            >
                <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '12px', width: '600px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                    <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Network Diagnostics</h2>

                    <DiagnosticsRunner />

                    <h3 style={{ marginTop: '2rem', fontSize: '1.2rem' }}>Known Peers</h3>
                    <div style={{ marginTop: '1rem' }}>
                        {peers.map(p => {
                            const conn = getConnection(p.id);
                            if (!conn) return null;
                            return (
                                <div key={p.id} style={{ borderBottom: '1px solid #333', padding: '1rem 0' }}>
                                    <div style={{ fontWeight: 'bold' }}>{p.franchiseName || p.hostname} ({p.id})</div>
                                    <div>State: <span style={{ color: conn.state === 'VERIFIED' ? '#4ade80' : conn.state === 'VERIFYING' ? '#facc15' : '#aaa' }}>{conn.state}</span></div>
                                    {/* eslint-disable-next-line react-hooks/purity */}
                                    {conn.startTime && <div>Duration: {((Date.now() - conn.startTime) / 1000).toFixed(1)}s</div>}
                                    {conn.iceStats && <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>ICE — host: {conn.iceStats.host} srflx: {conn.iceStats.srflx} relay: {conn.iceStats.relay}</div>}
                                    {conn.lastError && <div style={{ color: '#ef4444' }}>Error: {conn.lastError}</div>}
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={onClose} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>Close</button>
                </div>
            </motion.div>
        )}
    </AnimatePresence>
);

// ─── Incoming Request Modal ──────────────────────────────────────────────────

interface IncomingRequestModalProps {
    incomingRequest: string | null;
    onAccept: () => void;
    onReject: () => void;
}

export const IncomingRequestModal: React.FC<IncomingRequestModalProps> = ({ incomingRequest, onAccept, onReject }) => (
    <AnimatePresence>
        {incomingRequest && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 100
                }}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    style={{
                        background: '#1a1a1a',
                        border: '1px solid #4ade80',
                        padding: '2rem',
                        borderRadius: '12px',
                        width: '400px',
                        textAlign: 'center',
                        boxShadow: '0 0 40px rgba(74, 222, 128, 0.2)'
                    }}
                >
                    <div style={{
                        width: 60, height: 60, background: 'rgba(74, 222, 128, 0.2)',
                        borderRadius: '50%', margin: '0 auto 1.5rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Wifi size={32} color="#4ade80" />
                    </div>

                    <h2 style={{ marginBottom: '0.5rem', fontFamily: "'Orbitron', sans-serif" }}>CONNECTION REQUEST</h2>
                    <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
                        Peer <strong style={{ color: '#fff' }}>{incomingRequest}</strong> wants to establish a secure link.
                    </p>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={onReject}
                            style={{
                                flex: 1, padding: '1rem',
                                background: 'transparent',
                                border: '1px solid #ef4444',
                                color: '#ef4444',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                            }}
                        >
                            <X size={18} /> REJECT
                        </button>
                        <button
                            onClick={onAccept}
                            style={{
                                flex: 1, padding: '1rem',
                                background: '#4ade80',
                                border: 'none',
                                color: '#000',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                            }}
        >
                            <Check size={18} /> ACCEPT
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);
