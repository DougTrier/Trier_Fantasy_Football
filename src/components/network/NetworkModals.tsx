import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { type DiscoveredPeer } from '../../services/DiscoveryService';
import { DiagnosticsRunner } from './DiagnosticsRunner';

// ─── Invite Modal ────────────────────────────────────────────────────────────

interface InviteModalProps {
    show: boolean;
    inviteCode: string;
    expiresAt: number; // Unix ms — countdown target
    onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ show, inviteCode, expiresAt, onClose }) => {
    // Countdown state — recalculated every second while modal is open
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!show) return;
        // Tick every second; clear on close
        const tick = () => setSecondsLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [show, expiresAt]);

    // Format seconds as MM:SS for display
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const ss = String(secondsLeft % 60).padStart(2, '0');
    const isExpiringSoon = secondsLeft < 120; // Turn red under 2 minutes
    const isExpired = secondsLeft === 0;

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
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
                    <div
                        style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '12px', width: '520px' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2>Invite Friend</h2>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        <p style={{ opacity: 0.7, marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                            Share this code or have your friend scan the QR code to connect — works over LAN or internet relay.
                        </p>

                        {/* QR code — encodes the invite string directly */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                            <div style={{ background: '#fff', padding: '12px', borderRadius: '8px' }}>
                                <QRCodeSVG value={inviteCode} size={180} />
                            </div>
                        </div>

                        {/* Text code + copy button */}
                        <div style={{
                            background: '#000', padding: '1rem', borderRadius: '6px',
                            border: '1px solid #333', fontFamily: 'monospace', wordBreak: 'break-all',
                            marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center'
                        }}>
                            <span style={{ flex: 1, fontSize: '0.75rem', opacity: isExpired ? 0.4 : 1 }}>{inviteCode}</span>
                            <button
                                onClick={handleCopy}
                                disabled={isExpired}
                                style={{ background: 'none', border: 'none', color: copied ? '#4ade80' : '#4ade80', cursor: isExpired ? 'not-allowed' : 'pointer' }}
                                title="Copy"
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>

                        {/* Expiry countdown */}
                        <div style={{
                            fontSize: '0.8rem',
                            color: isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : '#6b7280',
                            textAlign: 'center'
                        }}>
                            {isExpired
                                ? 'Code expired — close and generate a new one.'
                                : `Expires in ${mm}:${ss}`}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ─── Join Modal ──────────────────────────────────────────────────────────────

interface JoinModalProps {
    show: boolean;
    joinCode: string;
    error?: string; // Error message from last failed redeem attempt
    onJoinCodeChange: (v: string) => void;
    onClose: () => void;
    onRedeem: () => void;
}

export const JoinModal: React.FC<JoinModalProps> = ({ show, joinCode, error, onJoinCodeChange, onClose, onRedeem }) => (
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
                <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '12px', width: '420px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2>Join Friend</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
                    </div>

                    <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7, fontSize: '0.85rem' }}>
                        Paste invite code or scan QR with your camera app
                    </label>
                    <textarea
                        value={joinCode}
                        onChange={e => onJoinCodeChange(e.target.value)}
                        placeholder="Paste code here..."
                        style={{
                            width: '100%', padding: '0.5rem',
                            background: '#333', border: `1px solid ${error ? '#ef4444' : '#555'}`,
                            color: '#fff', borderRadius: '4px',
                            minHeight: '80px', marginBottom: '0.5rem', fontFamily: 'monospace',
                            resize: 'vertical'
                        }}
                    />

                    {/* Inline error message — shown instead of alert for better UX */}
                    {error && (
                        <div style={{ fontSize: '0.78rem', color: '#ef4444', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                            {error}
                        </div>
                    )}

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
