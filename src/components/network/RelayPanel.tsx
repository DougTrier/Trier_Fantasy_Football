import React, { useState } from 'react';
import { Shield, Globe, Radio, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { type RelayStatus, type RelayLobby } from '../../services/RelayService';
import { type DiscoveredPeer } from '../../services/DiscoveryService';

interface Props {
    // TURN config
    turnUrl: string;
    turnUser: string;
    turnCred: string;
    onTurnUrlChange: (v: string) => void;
    onTurnUserChange: (v: string) => void;
    onTurnCredChange: (v: string) => void;
    onTurnSave: () => void;
    onTurnClear: () => void;
    turnSaved: boolean;
    // Relay
    relayStatus: RelayStatus;
    relayOnline: number;
    lobbies: RelayLobby[];
    peers: DiscoveredPeer[];
    onRelayToggle: () => void;
}

export const RelayPanel: React.FC<Props> = ({
    turnUrl,
    turnUser,
    turnCred,
    onTurnUrlChange,
    onTurnUserChange,
    onTurnCredChange,
    onTurnSave,
    onTurnClear,
    turnSaved,
    relayStatus,
    relayOnline,
    lobbies,
    peers,
    onRelayToggle,
}) => {
    const [showTurnConfig, setShowTurnConfig] = useState(false);

    const statusColor: Record<RelayStatus, string> = {
        DISCONNECTED: '#6b7280',
        CONNECTING:   '#facc15',
        CONNECTED:    '#60a5fa',
        REGISTERED:   '#4ade80',
        ERROR:        '#ef4444',
    };
    const isActive = relayStatus !== 'DISCONNECTED' && relayStatus !== 'ERROR';
    const relayPeers = peers.filter(p => p.transport === 'Relay');

    return (
        <>
            {/* TURN SERVER CONFIG */}
            <div style={{
                marginBottom: '2rem',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'rgba(10,14,26,0.82)',
                backdropFilter: 'blur(8px)',
            }}>
                {/* Collapsible header */}
                <button
                    onClick={() => setShowTurnConfig(v => !v)}
                    style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 1.5rem',
                        background: 'rgba(0,0,0,0.25)',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        letterSpacing: '0.08em',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Shield size={15} color={turnUrl ? '#4ade80' : '#6b7280'} />
                        <span style={{ textTransform: 'uppercase' }}>
                            TURN SERVER
                        </span>
                        {turnUrl ? (
                            <span style={{ color: '#4ade80', fontSize: '0.7rem', fontWeight: 'normal' }}>
                                ● configured
                            </span>
                        ) : (
                            <span style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 'normal' }}>
                                ○ STUN-only (optional)
                            </span>
                        )}
                    </div>
                    {showTurnConfig ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                {showTurnConfig && (
                    <div style={{ padding: '1.25rem 1.5rem' }}>
                        <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.82rem', lineHeight: '1.5' }}>
                            TURN relays WebRTC traffic for players behind strict corporate or symmetric NAT.
                            Without it, ~90% of home connections work fine via STUN.
                            Get free credentials at <span style={{ color: '#60a5fa' }}>metered.ca</span> or use a self-hosted coturn server.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#6b7280', fontWeight: 'bold', letterSpacing: '0.08em', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                                    TURN URL
                                </label>
                                <input
                                    value={turnUrl}
                                    onChange={e => onTurnUrlChange(e.target.value)}
                                    placeholder="turn:your-server.com:3478"
                                    style={{
                                        width: '100%', padding: '0.5rem 0.75rem',
                                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)',
                                        color: '#fff', borderRadius: '6px', fontSize: '0.85rem',
                                        fontFamily: 'monospace', boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#6b7280', fontWeight: 'bold', letterSpacing: '0.08em', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                                    Username
                                </label>
                                <input
                                    value={turnUser}
                                    onChange={e => onTurnUserChange(e.target.value)}
                                    placeholder="username"
                                    style={{
                                        width: '100%', padding: '0.5rem 0.75rem',
                                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)',
                                        color: '#fff', borderRadius: '6px', fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#6b7280', fontWeight: 'bold', letterSpacing: '0.08em', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                                    Credential
                                </label>
                                <input
                                    type="password"
                                    value={turnCred}
                                    onChange={e => onTurnCredChange(e.target.value)}
                                    placeholder="password"
                                    style={{
                                        width: '100%', padding: '0.5rem 0.75rem',
                                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)',
                                        color: '#fff', borderRadius: '6px', fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <button
                                onClick={onTurnSave}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    background: turnSaved ? '#16a34a' : '#1d4ed8',
                                    border: 'none', color: '#fff', borderRadius: '6px',
                                    fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem',
                                    transition: 'background 0.2s',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                }}
                            >
                                {turnSaved ? <><Check size={14} /> Saved!</> : 'Save'}
                            </button>
                            {turnUrl && (
                                <button
                                    onClick={onTurnClear}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        background: 'transparent', border: '1px solid #6b7280',
                                        color: '#9ca3af', borderRadius: '6px',
                                        cursor: 'pointer', fontSize: '0.8rem',
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                Stored locally — never sent to the relay server.
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* GLOBAL NETWORK RELAY PANEL */}
            <div style={{
                marginBottom: '2rem',
                border: `1px solid ${statusColor[relayStatus]}44`,
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'rgba(10,14,26,0.82)',
                backdropFilter: 'blur(8px)',
            }}>
                {/* Panel header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1rem 1.5rem',
                    background: 'rgba(0,0,0,0.3)',
                    borderBottom: `1px solid ${statusColor[relayStatus]}33`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Globe size={22} color={statusColor[relayStatus]} />
                        <span style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.08em', color: '#fff' }}>
                            OPTIONAL RELAY
                        </span>
                        {/* Status dot + label */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: statusColor[relayStatus],
                                boxShadow: relayStatus === 'REGISTERED' ? '0 0 6px #4ade80' : undefined,
                            }} />
                            <span style={{ fontSize: '0.8rem', color: statusColor[relayStatus], fontWeight: 'bold' }}>
                                {relayStatus}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {relayStatus === 'REGISTERED' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#4ade80', fontSize: '0.9rem' }}>
                                <Radio size={14} />
                                <span><strong>{relayOnline}</strong> online globally</span>
                            </div>
                        )}
                        <button
                            onClick={onRelayToggle}
                            disabled={relayStatus === 'CONNECTING' || relayStatus === 'CONNECTED'}
                            style={{
                                padding: '0.5rem 1.25rem',
                                background: isActive
                                    ? 'rgba(239,68,68,0.15)'
                                    : 'rgba(96,165,250,0.15)',
                                border: `1px solid ${isActive ? '#ef4444' : '#60a5fa'}`,
                                color: isActive ? '#fca5a5' : '#93c5fd',
                                borderRadius: '6px',
                                cursor: (relayStatus === 'CONNECTING' || relayStatus === 'CONNECTED') ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                opacity: (relayStatus === 'CONNECTING' || relayStatus === 'CONNECTED') ? 0.5 : 1,
                            }}
                        >
                            <Globe size={14} />
                            {isActive ? 'GO OFFLINE' : 'GO ONLINE'}
                        </button>
                    </div>
                </div>

                {/* Panel body */}
                <div style={{ padding: '1rem 1.5rem' }}>
                    {relayStatus === 'DISCONNECTED' || relayStatus === 'ERROR' ? (
                        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                            <strong style={{ color: '#d1d5db' }}>This app is local-first and fully peer-to-peer.</strong> Use <strong style={{ color: '#d1d5db' }}>INVITE / JOIN</strong> above to connect with friends anywhere — no server needed.
                            <br /><br />
                            This optional relay helps strangers discover each other globally, but requires a hosted signaling server. Off by default — only enable if you self-host one.
                            {relayStatus === 'ERROR' && <span style={{ color: '#ef4444' }}> (Connection failed — server may not be deployed.)</span>}
                        </p>
                    ) : relayStatus === 'CONNECTING' || relayStatus === 'CONNECTED' ? (
                        <p style={{ margin: 0, color: '#facc15', fontSize: '0.9rem' }}>Connecting to relay server...</p>
                    ) : (
                        <>
                            {/* Relay-discovered peers (shown inline since they also appear in main grid) */}
                            {relayPeers.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: lobbies.length > 0 ? '1rem' : 0 }}>
                                    {relayPeers.map(p => (
                                        <div key={p.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            background: 'rgba(96,165,250,0.1)',
                                            border: '1px solid rgba(96,165,250,0.3)',
                                            borderRadius: '20px',
                                            padding: '0.3rem 0.75rem',
                                            fontSize: '0.85rem',
                                        }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
                                            <span style={{ color: '#93c5fd' }}>{p.franchiseName || p.hostname}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ margin: 0, marginBottom: lobbies.length > 0 ? '1rem' : 0, color: '#6b7280', fontSize: '0.9rem' }}>
                                    No relay peers visible yet — waiting for others to join.
                                </p>
                            )}

                            {/* Lobby list */}
                            {lobbies.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'bold', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                                        ACTIVE LOBBIES
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                                        {lobbies.map(lobby => (
                                            <div key={lobby.leagueName} style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '8px',
                                                padding: '0.75rem',
                                            }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.9rem' }}>{lobby.leagueName}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>{lobby.region}</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                    {lobby.peers.map(lp => (
                                                        <span key={lp.nodeId} style={{
                                                            fontSize: '0.75rem',
                                                            background: 'rgba(96,165,250,0.12)',
                                                            color: '#93c5fd',
                                                            padding: '0.15rem 0.5rem',
                                                            borderRadius: '10px',
                                                        }}>
                                                            {lp.franchiseName}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};
