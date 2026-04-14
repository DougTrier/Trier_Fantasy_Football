import React, { useState, useEffect } from 'react';
import { Shield, Server, Activity, X, Trash2, Wifi, Check, Users, UserPlus, Copy, Download, Upload } from 'lucide-react';
import leatherTexture from '../assets/leather_texture.png';
import { DiscoveryService, type DiscoveredPeer } from '../services/DiscoveryService';
import { BackupService } from '../services/BackupService';
import { GlobalEventStore } from '../services/EventStore';
import { P2PService, type SignalPayload, type ConnectionState } from '../services/P2PService';
import { motion, AnimatePresence } from 'framer-motion';

export const NetworkPage: React.FC = () => {
    const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
    const [eventCount, setEventCount] = useState<number>(0);
    const [myId, setMyId] = useState('');
    const [incomingRequest, setIncomingRequest] = useState<string | null>(null);
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    // Force re-render trigger
    const [, setTick] = useState(0);

    // Invite UI State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');

    useEffect(() => {
        // Subscribe to peer updates
        const unsub = DiscoveryService.subscribe(setPeers);

        // Subscribe to Stats
        const updateStats = () => {
            setEventCount(GlobalEventStore.getAll().length);
            // setLastSyncTime(new Date().toLocaleTimeString()); // Optional, update on Sync event?
        };
        const unsubStore = GlobalEventStore.subscribe(updateStats);
        updateStats();

        setMyId(P2PService.myId || 'Initializing...');

        // Subscribe to P2P Signals
        P2PService.onSignal((payload: SignalPayload) => {
            if (payload.type_ === 'CONNECT_REQUEST') {
                setIncomingRequest(payload.sender_id);
            }
        });

        // Subscribe to Connection Status
        P2PService.onConnectionStatus(({ peerId, status }) => {
            setTick(t => t + 1); // Force Update UI
            if (status === 'DISCONNECTED' || status === 'TERMINATED') {
                // Clear any modal state if needed
                if (incomingRequest === peerId) setIncomingRequest(null);
            }
        });

        return () => {
            unsub();
            unsubStore();
        };
    }, []);

    // Helpers
    const getConnection = (id: string) => P2PService.connections.get(id);
    const getState = (id: string): ConnectionState => getConnection(id)?.state || 'IDLE';

    // Actions
    const handleConnect = (peer: DiscoveredPeer) => {
        // USE PEER PORT FROM DISCOVERY
        const targetPort = peer.port || 15432;
        console.log(`[Network] Connecting to ${peer.id} on ${peer.ip}:${targetPort}`);
        P2PService.requestConnection(peer.id, peer.ip, targetPort);
    };

    const handleAccept = () => {
        if (!incomingRequest) return;
        P2PService.acceptConnection(incomingRequest);
        setIncomingRequest(null);
    };

    const handleReject = () => {
        if (!incomingRequest) return;
        P2PService.rejectConnection(incomingRequest);
        setIncomingRequest(null);
    };

    const handleTerminate = (id: string) => {
        if (confirm(`Terminate connection with ${id}?`)) {
            P2PService.terminateConnection(id, 'User Terminated');
        }
    };

    const handleClearCache = async () => {
        await import('@tauri-apps/api/tauri').then(t => t.invoke('p2p_clear_discovery_cache'));
        window.location.reload();
    };

    const handleExport = async () => {
        try {
            const json = await BackupService.exportProfile();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trier_backup_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('Export Failed');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
            const result = await BackupService.importProfile(text);
            alert(`Imported ${result.count} events.`);
            window.location.reload();
        } catch (err) {
            alert('Import Failed');
        }
    };

    const handleGenerateInvite = async () => {
        try {
            const code = await DiscoveryService.generateInvite();
            setInviteCode(code);
            setShowInviteModal(true);
        } catch (e: any) {
            alert("Failed to generate invite: " + e.toString());
        }
    };

    const handleRedeemInvite = () => {
        try {
            DiscoveryService.redeemInvite(joinCode);
            setShowJoinModal(false);
            setJoinCode('');
            alert("Peer added to list! You can now connect to them.");
        } catch (e) {
            alert("Invalid Code");
        }
    };

    return (
        <div style={{ height: '100%', padding: '2rem', overflowY: 'auto', position: 'relative' }}>
            {/* HEADER */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '3rem', gap: '1rem' }}>
                <h1 style={{
                    fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                    fontWeight: 900,
                    margin: 0,
                    color: 'transparent',
                    backgroundImage: `url(${leatherTexture})`,
                    backgroundSize: '150px',
                    backgroundPosition: 'center',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    fontFamily: "'Graduate', 'Impact', sans-serif",
                    WebkitTextStroke: '1px rgba(255,255,255,0.95)',
                    textShadow: '0 5px 15px rgba(0,0,0,0.9)',
                    lineHeight: '1.2'
                }}>
                    FIND OR ADD FRIENDS
                </h1>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#fff', background: 'rgba(23, 37, 84, 0.9)', padding: '0.5rem 1.5rem', borderRadius: '20px', border: '1px solid rgba(96, 165, 250, 0.5)', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                    <Shield size={20} color="#60a5fa" />
                    <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>NODE ID: <span style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{myId}</span></span>
                    <span style={{ margin: '0 0.5rem', opacity: 0.3 }}>|</span>
                    <Activity size={20} color="#4ade80" />
                    <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>EVENTS: <span style={{ fontFamily: 'monospace', color: '#4ade80' }}>{eventCount}</span></span>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                        onClick={handleGenerateInvite}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: '#4ade80',
                            border: '1px solid #22c55e',
                            color: '#000',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                        }}
                        title="Generate a secure invite code to share with a friend on this network."
                    >
                        <UserPlus size={20} />
                        <span>INVITE</span>
                    </button>

                    <button
                        onClick={() => setShowJoinModal(true)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'rgba(255, 255, 255, 0.25)',
                            border: '1px solid rgba(255,255,255,0.4)',
                            color: '#fff',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            backdropFilter: 'blur(4px)',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                        }}
                        title="Enter an invite code from a friend to connect."
                    >
                        <Users size={20} />
                        <span>JOIN</span>
                    </button>

                    <button
                        onClick={() => setShowDiagnostics(true)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: showDiagnostics ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            color: '#fff',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            fontWeight: 'bold',
                            backdropFilter: 'blur(4px)',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                        }}
                        title="Run network diagnostics (Ping Gateway, DNS) to troubleshoot connectivity."
                    >
                        <Activity size={20} />
                        <span>DIAGNOSTICS</span>
                    </button>

                    <button
                        onClick={handleClearCache}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'rgba(220, 38, 38, 0.3)',
                            border: '1px solid #ef4444',
                            color: '#fca5a5',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            fontWeight: 'bold',
                            backdropFilter: 'blur(4px)',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                        }}
                        title="Clear discovered peers and reset local cache. Use if peers are stale."
                    >
                        <Trash2 size={20} />
                        <span>RESET</span>
                    </button>

                    <button
                        onClick={async () => {
                            try {
                                await DiscoveryService.openFirewall();
                                alert("Firewall rules updated! Restart app if issues persist.");
                            } catch (e) {
                                alert("Firewall Update Failed: " + e);
                            }
                        }}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'rgba(202, 138, 4, 0.3)',
                            border: '1px solid #eab308',
                            color: '#fde047',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            fontWeight: 'bold',
                            backdropFilter: 'blur(4px)',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                        }}
                        title="Attempt to automatically add Windows Firewall rules for Trier Fantasy."
                    >
                        <Shield size={20} />
                        <span>FIX FIREWALL</span>
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem' }}>
                    <button
                        onClick={handleExport}
                        style={{
                            background: '#0a192f', // Navyish
                            border: '2px solid #1e3a8a',
                            color: '#fff',
                            padding: '1rem 2rem',
                            borderRadius: '8px',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.8rem',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                        }}
                        title="Save your current profile and team data to a JSON file."
                    >
                        <Download size={24} /> EXPORT
                    </button>
                    {/* Re-using same style for Import - wait, Import usually implies button input */}
                    <label
                        style={{
                            background: '#0a192f',
                            border: '2px solid #1e3a8a',
                            color: '#fff',
                            padding: '1rem 2rem',
                            borderRadius: '8px',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.8rem',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                        }}
                        title="Restore profile and events from a JSON backup file."
                    >
                        <Upload size={24} /> IMPORT
                        <input type="file" onChange={handleImport} style={{ display: 'none' }} accept=".json" />
                    </label>
                </div>
            </div>

            {/* SCANNING GRID */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem'
            }}>
                {peers.map(peer => {
                    const state = getState(peer.id);
                    const isConnected = state === 'CONNECTED';
                    const isBusy = state === 'REQUESTING' || state === 'NEGOTIATING';
                    const isFailed = state === 'FAILED';

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
                                        {state}
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

            {/* TELEMETRY REMOVED */}

            {/* INVITE MODAL */}
            <AnimatePresence>
                {showInviteModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90
                        }}
                        onClick={() => setShowInviteModal(false)}
                    >
                        <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '12px', width: '500px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h2>Invite Friend</h2>
                                <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
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

            {/* JOIN MODAL */}
            <AnimatePresence>
                {showJoinModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90
                        }}
                        onClick={() => setShowJoinModal(false)}
                    >
                        <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '12px', width: '400px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h2>Join Friend</h2>
                                <button onClick={() => setShowJoinModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
                            </div>

                            <label style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>Paste Invite Code</label>
                            <textarea
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value)}
                                placeholder="Paste code here..."
                                style={{
                                    width: '100%', padding: '0.5rem',
                                    background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '4px',
                                    minHeight: '80px', marginBottom: '1rem', fontFamily: 'monospace'
                                }}
                            />

                            <button
                                onClick={handleRedeemInvite}
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

            {/* DIAGNOSTICS MODAL */}
            <AnimatePresence>
                {showDiagnostics && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90
                        }}
                        onClick={() => setShowDiagnostics(false)}
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
                                            <div>State: <span style={{ color: '#4ade80' }}>{conn.state}</span></div>
                                            {conn.startTime && <div>Duration: {((Date.now() - conn.startTime) / 1000).toFixed(1)}s</div>}
                                            {conn.lastError && <div style={{ color: '#ef4444' }}>Error: {conn.lastError}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                            <button onClick={() => setShowDiagnostics(false)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>Close</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SETTINGS REMOVED */}

            {/* INCOMING REQUEST MODAL */}
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
                                    onClick={handleReject}
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
                                    onClick={handleAccept}
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
        </div>
    );
};

const DiagnosticsRunner: React.FC = () => {
    const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'DONE' | 'ERROR'>('IDLE');
    const [result, setResult] = useState<any>(null);

    const run = async () => {
        setStatus('RUNNING');
        try {
            const { invoke } = await import('@tauri-apps/api/tauri');
            const res = await invoke<any>('run_network_diagnostics');
            setResult(res);
            setStatus('DONE');
        } catch (e) {
            console.error(e);
            setStatus('ERROR');
        }
    };

    useEffect(() => {
        run();
    }, []);

    return (
        <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: status === 'RUNNING' ? '#facc15' : status === 'DONE' ? '#4ade80' : '#fff' }}>
                    STATUS: {status}
                </span>
                <button onClick={run} style={{ cursor: 'pointer', background: '#333', color: '#fff', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>RERUN</button>
            </div>

            {status === 'RUNNING' && <div>Running Connectivity Checks (Gateway, DNS, Internet)...</div>}

            {result && (
                <div>
                    <div>Gateway Ping: {result.gatewayPing ? <span style={{ color: '#4ade80' }}>PASS ({result.gatewayLatency}ms)</span> : <span style={{ color: '#ef4444' }}>FAIL</span>}</div>
                    <div>DNS Ping (8.8.8.8): {result.dnsPing ? <span style={{ color: '#4ade80' }}>PASS</span> : <span style={{ color: '#ef4444' }}>FAIL</span>}</div>
                    <div>Internet Ping: {result.internetPing ? <span style={{ color: '#4ade80' }}>PASS</span> : <span style={{ color: '#ef4444' }}>FAIL</span>}</div>

                    {result.details && result.details.length > 0 && (
                        <div style={{ marginTop: '1rem', opacity: 0.7, fontSize: '0.9rem' }}>
                            {result.details.map((d: string, i: number) => <div key={i}>{d}</div>)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
