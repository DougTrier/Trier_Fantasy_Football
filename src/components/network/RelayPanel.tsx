import React, { useState } from 'react';
import { Shield, Globe, Radio, Check, ChevronDown, ChevronUp, RefreshCw, Plus, Trash2, Server } from 'lucide-react';
import { type RelayStatus, type RelayLobby, type RelayEndpoint } from '../../services/RelayService';
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
    // Federation
    relayEndpoints: RelayEndpoint[];
    onRefreshHealth: () => void;
    onAddRelay: (url: string, label: string) => void;
    onRemoveRelay: (url: string) => void;
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
    relayEndpoints,
    onRefreshHealth,
    onAddRelay,
    onRemoveRelay,
}) => {
    const [showTurnConfig, setShowTurnConfig] = useState(false);
    const [showSelfHost, setShowSelfHost] = useState(false);
    const [newRelayUrl, setNewRelayUrl] = useState('');
    const [newRelayLabel, setNewRelayLabel] = useState('');
    const [addCopied, setAddCopied] = useState(false);

    const statusColor: Record<RelayStatus, string> = {
        DISCONNECTED: '#6b7280',
        CONNECTING:   '#facc15',
        CONNECTED:    '#60a5fa',
        REGISTERED:   '#4ade80',
        ERROR:        '#ef4444',
    };
    const isActive = relayStatus !== 'DISCONNECTED' && relayStatus !== 'ERROR';
    const relayPeers = peers.filter(p => p.transport === 'Relay');

    // Latency badge colour: green <80ms, yellow <250ms, red otherwise
    const latencyColor = (ms: number | null, online: boolean) => {
        if (!online || ms === null) return '#6b7280';
        if (ms < 80) return '#4ade80';
        if (ms < 250) return '#facc15';
        return '#f87171';
    };

    const handleAddRelay = () => {
        const url = newRelayUrl.trim();
        const label = newRelayLabel.trim() || url;
        if (!url.startsWith('wss://')) return;
        onAddRelay(url, label);
        setNewRelayUrl('');
        setNewRelayLabel('');
    };

    const dockerCmd = `docker run -d -p 3001:3001 \\
  -e RELAY_REGION=US-East \\
  --name trier-relay \\
  $(docker build -q .)`;

    return (
        <>
            {/* ── RELAY NETWORK — federation health grid ───────────────────────── */}
            <div style={{
                marginBottom: '2rem',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'rgba(10,14,26,0.82)',
                backdropFilter: 'blur(8px)',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.85rem 1.5rem',
                    background: 'rgba(0,0,0,0.25)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Server size={15} color="#60a5fa" />
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase' }}>
                            Relay Network
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                            — auto-selects best on GO ONLINE
                        </span>
                    </div>
                    <button
                        onClick={onRefreshHealth}
                        title="Re-measure relay latency"
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    >
                        <RefreshCw size={13} /> Refresh
                    </button>
                </div>

                <div style={{ padding: '0.75rem 1.5rem' }}>
                    {/* Health grid */}
                    {relayEndpoints.length === 0 ? (
                        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>Click Refresh to measure relay latency.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {relayEndpoints.map(ep => (
                                <div key={ep.url} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                                    {/* Status dot */}
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                        background: latencyColor(ep.latencyMs, ep.online),
                                        boxShadow: ep.online ? `0 0 5px ${latencyColor(ep.latencyMs, ep.online)}` : undefined,
                                    }} />
                                    {/* Label + region */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: '0.85rem', color: '#d1d5db', fontWeight: 600 }}>{ep.label}</span>
                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#6b7280' }}>{ep.region}</span>
                                    </div>
                                    {/* Latency badge */}
                                    <span style={{ fontSize: '0.78rem', color: latencyColor(ep.latencyMs, ep.online), fontFamily: 'monospace', minWidth: '3.5rem', textAlign: 'right' }}>
                                        {ep.latencyMs === null ? (ep.online === false && relayEndpoints.some(e => e.latencyMs !== null) ? 'offline' : '…') : `${ep.latencyMs} ms`}
                                    </span>
                                    {/* Remove button (custom relays only) */}
                                    {!ep.isBuiltIn && (
                                        <button onClick={() => onRemoveRelay(ep.url)} title="Remove relay" style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0 0.25rem', display: 'flex', alignItems: 'center' }}>
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add custom relay */}
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                            value={newRelayUrl}
                            onChange={e => setNewRelayUrl(e.target.value)}
                            placeholder="wss://your-relay.example.com"
                            style={{ flex: 2, padding: '0.35rem 0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '5px', fontSize: '0.78rem', fontFamily: 'monospace' }}
                        />
                        <input
                            value={newRelayLabel}
                            onChange={e => setNewRelayLabel(e.target.value)}
                            placeholder="Label (optional)"
                            style={{ flex: 1, padding: '0.35rem 0.6rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '5px', fontSize: '0.78rem' }}
                        />
                        <button
                            onClick={handleAddRelay}
                            disabled={!newRelayUrl.startsWith('wss://')}
                            style={{ padding: '0.35rem 0.75rem', background: newRelayUrl.startsWith('wss://') ? '#1d4ed8' : 'rgba(255,255,255,0.05)', border: 'none', color: newRelayUrl.startsWith('wss://') ? '#fff' : '#4b5563', borderRadius: '5px', cursor: newRelayUrl.startsWith('wss://') ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                            <Plus size={12} /> Add
                        </button>
                    </div>
                </div>

                {/* Self-hosting instructions — collapsible */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                        onClick={() => setShowSelfHost(v => !v)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1.5rem', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '0.06em' }}
                    >
                        <span>SELF-HOST YOUR OWN RELAY</span>
                        {showSelfHost ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {showSelfHost && (
                        <div style={{ padding: '0.5rem 1.5rem 1rem' }}>
                            <p style={{ margin: '0 0 0.5rem', color: '#9ca3af', fontSize: '0.82rem', lineHeight: 1.6 }}>
                                Run the relay server from the <code style={{ color: '#60a5fa' }}>relay-server/</code> directory in the repo.
                                Anyone can host their own — build the Docker image and deploy anywhere.
                            </p>
                            <div style={{ position: 'relative', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', padding: '0.75rem 3rem 0.75rem 1rem' }}>
                                <pre style={{ margin: 0, color: '#4ade80', fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>{dockerCmd}</pre>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(dockerCmd);
                                        setAddCopied(true);
                                        setTimeout(() => setAddCopied(false), 2000);
                                    }}
                                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: addCopied ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.08)', border: 'none', color: addCopied ? '#4ade80' : '#9ca3af', borderRadius: '4px', padding: '0.2rem 0.4rem', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                    {addCopied ? <><Check size={11} /> Copied</> : 'Copy'}
                                </button>
                            </div>
                            <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.75rem' }}>
                                Set <code style={{ color: '#fbbf24' }}>RELAY_REGION</code> to your region (e.g. <code style={{ color: '#fbbf24' }}>EU-West</code>, <code style={{ color: '#fbbf24' }}>US-West</code>) and add the <code>wss://</code> URL above to share it with your league.
                            </p>
                        </div>
                    )}
                </div>
            </div>

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
