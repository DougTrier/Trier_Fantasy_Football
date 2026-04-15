import React from 'react';
import { Server, Wifi, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { type DiscoveredPeer } from '../../services/DiscoveryService';
import { type ConnectionState } from '../../services/P2PService';

interface Props {
    peers: DiscoveredPeer[];
    getState: (id: string) => ConnectionState;
    handleConnect: (peer: DiscoveredPeer) => void;
    handleTerminate: (id: string) => void;
}

export const DiscoveredPeersGrid: React.FC<Props> = ({
    peers,
    getState,
    handleConnect,
    handleTerminate,
}) => {
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem'
        }}>
            {peers.map(peer => {
                const state = getState(peer.id);
                const isVerified = state === 'VERIFIED';
                // CONNECTED = transport only (not trusted). VERIFYING = handshake in progress.
                const isBusy = state === 'REQUESTING' || state === 'NEGOTIATING' || state === 'VERIFYING' || state === 'CONNECTED';
                const isFailed = state === 'FAILED';
                // Legacy alias for border/color logic below
                const isConnected = isVerified;

                return (
                    <motion.div
                        key={peer.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: isConnected ? '1px solid #4ade80' : isFailed ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '1.5rem',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{
                                width: 40, height: 40,
                                background: isConnected ? '#4ade80' : isFailed ? '#ef4444' : '#3b82f6',
                                borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 'bold', color: '#000'
                            }}>
                                {peer.hostname.substring(0, 2).toUpperCase()}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>STATUS</div>
                                <div style={{
                                    color: isConnected ? '#4ade80' : isFailed ? '#ef4444' : isBusy ? '#facc15' : '#fff',
                                    fontWeight: 'bold'
                                }}>
                                    {state === 'VERIFIED' ? '✅ VERIFIED'
                                        : state === 'VERIFYING' ? '🔐 VERIFYING'
                                        : state === 'CONNECTED' ? '🔗 HANDSHAKING'
                                        : state}
                                </div>
                            </div>
                        </div>

                        <h3 style={{ marginBottom: '0.25rem', fontSize: '1.1rem' }}>
                            {peer.franchiseName || peer.hostname}
                        </h3>
                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '1rem', fontFamily: 'monospace' }}>
                            {peer.franchiseName ? peer.hostname : ''} {peer.transport ? `[${peer.transport}]` : ''}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {state === 'IDLE' || state === 'FAILED' || state === 'DISCONNECTED' || state === 'TERMINATED' ? (
                                <button
                                    onClick={() => handleConnect(peer)}
                                    title={`Initiate a secure connection with ${peer.franchiseName || peer.hostname}`}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        background: '#fff',
                                        color: '#000',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                    }}
                                >
                                    <Wifi size={16} /> {state === 'FAILED' ? 'RETRY' : 'CONNECT'}
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => handleTerminate(peer.id)}
                                        title={isConnected ? "Safely close the connection" : "Cancel the pending request"}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            color: '#ef4444',
                                            border: '1px solid #ef4444',
                                            borderRadius: '4px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                        }}
                                    >
                                        <X size={16} /> {isConnected ? 'DISCONNECT' : 'CANCEL'}
                                    </button>
                                    {isConnected && (
                                        <div />
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                );
            })}

            {/* EMPTY STATE */}
            {peers.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem' }}>
                    <div style={{ marginBottom: '1rem', color: '#000080' }}><Server size={48} /></div>
                    <h3 style={{ color: '#000080', fontWeight: 'bold' }}>SCANNING SUBNET...</h3>
                    <p style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '1rem' }}>
                        No other Trier Fantasy nodes detected.
                    </p>
                </div>
            )}
        </div>
    );
};
