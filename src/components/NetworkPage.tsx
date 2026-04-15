import React, { useState, useEffect, useRef } from 'react';
import { useDialog } from './AppDialog';
import { Shield, Server, Activity, X, Trash2, Wifi, Check, Users, UserPlus, Copy, Download, Upload, Globe, Radio, ChevronDown, ChevronUp, Star, RotateCcw } from 'lucide-react';
import { IdentityService } from '../services/IdentityService';
import leatherTexture from '../assets/leather_texture.png';
import { DiscoveryService, type DiscoveredPeer } from '../services/DiscoveryService';
import { BackupService } from '../services/BackupService';
import { GlobalEventStore } from '../services/EventStore';
import { P2PService, type SignalPayload, type ConnectionState } from '../services/P2PService';
import { DHTService } from '../services/DHTService';
import { RelayService, type RelayStatus, type RelayLobby } from '../services/RelayService';
import { motion, AnimatePresence } from 'framer-motion';

export const NetworkPage: React.FC = () => {
    const { showAlert, showConfirm } = useDialog();
    const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
    const [eventCount, setEventCount] = useState<number>(0);
    const [myId, setMyId] = useState('');
    const [incomingRequest, setIncomingRequest] = useState<string | null>(null);
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    // Force re-render trigger
    const [, setTick] = useState(0);

    // Relay state
    const [relayStatus, setRelayStatus] = useState<RelayStatus>('DISCONNECTED');
    const [lobbies, setLobbies] = useState<RelayLobby[]>([]);
    const [relayOnline, setRelayOnline] = useState(0);

    // TURN config state
    const [showTurnConfig, setShowTurnConfig] = useState(false);
    const [turnUrl, setTurnUrl] = useState('');
    const [turnUser, setTurnUser] = useState('');
    const [turnCred, setTurnCred] = useState('');
    const [turnSaved, setTurnSaved] = useState(false);
    const turnSavedTimer = useRef<any>(null);

    // Friends system
    interface FriendEntry { uuid: string; nickname: string; nodeId?: string; addedAt: number; }
    const [myPeerUuid, setMyPeerUuid] = useState('');
    const [friends, setFriends] = useState<FriendEntry[]>([]);
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [friendUuidInput, setFriendUuidInput] = useState('');
    const [friendNicknameInput, setFriendNicknameInput] = useState('');
    const [uuidCopied, setUuidCopied] = useState(false);
    const uuidCopyTimer = useRef<any>(null);

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
        P2PService.onConnectionStatus(({ peerId, status, details }) => {
            setTick(t => t + 1);
            if (status === 'VERIFIED' && details?.peerUuid) {
                updateFriendNodeId(details.peerUuid, peerId);
            }
            if (status === 'DISCONNECTED' || status === 'TERMINATED') {
                if (incomingRequest === peerId) setIncomingRequest(null);
            }
        });

        return () => {
            unsub();
            unsubStore();
        };
    }, []);

    // Load peer UUID and friends list; start DHT presence
    useEffect(() => {
        const myUuid = IdentityService.getPeerUuid();
        setMyPeerUuid(myUuid);
        DHTService.init(myUuid);

        let loaded: typeof friends = [];
        try {
            const raw = localStorage.getItem('trier_friends');
            if (raw) { loaded = JSON.parse(raw); setFriends(loaded); }
        } catch {}

        // Start watching each known friend's room for internet discovery
        loaded.forEach(f => DHTService.watchFriend(f.uuid));

        return () => { if (uuidCopyTimer.current) clearTimeout(uuidCopyTimer.current); };
    }, []);

    // Load TURN config from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem('trier_turn_config');
            if (raw) {
                const cfg = JSON.parse(raw);
                setTurnUrl(cfg.url || '');
                setTurnUser(cfg.username || '');
                setTurnCred(cfg.credential || '');
            }
        } catch {}
        return () => { if (turnSavedTimer.current) clearTimeout(turnSavedTimer.current); };
    }, []);

    // Relay subscriptions
    useEffect(() => {
        const unsubStatus = RelayService.onStatus((status, totalOnline) => {
            setRelayStatus(status);
            setRelayOnline(totalOnline);
        });
        const unsubLobbies = RelayService.onLobbies(setLobbies);
        return () => {
            unsubStatus();
            unsubLobbies();
        };
    }, []);

    // Helpers
    const getConnection = (id: string) => P2PService.connections.get(id);
    const getState = (id: string): ConnectionState => getConnection(id)?.state || 'IDLE';

    /** Find a connection by the peer's real nodeId (works for both LAN and DHT peers). */
    const getConnectionByNodeId = (nodeId: string) => {
        const direct = P2PService.connections.get(nodeId);
        if (direct) return direct;
        for (const c of P2PService.connections.values()) {
            if (c.nodeId === nodeId) return c;
        }
        return undefined;
    };
    const getStateByNodeId = (nodeId: string): ConnectionState =>
        getConnectionByNodeId(nodeId)?.state ?? 'IDLE';

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

    const handleTerminate = async (id: string) => {
        if (await showConfirm(`Terminate connection with peer ${id.slice(0, 16)}...?`, "Terminate Connection", "DISCONNECT")) {
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
            showAlert('Export failed. Please try again.', 'Export Error');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
            const result = await BackupService.importProfile(text);
            showAlert(`Imported ${result.count} events. The app will now reload.`, 'Import Complete');
            window.location.reload();
        } catch (err) {
            showAlert('Import failed. The file may be corrupted or invalid.', 'Import Error');
        }
    };

    const saveFriends = (updated: typeof friends) => {
        setFriends(updated);
        localStorage.setItem('trier_friends', JSON.stringify(updated));
    };

    const handleAddFriend = () => {
        const uuid = friendUuidInput.trim().toLowerCase();
        if (!uuid) return;
        if (uuid === myPeerUuid.toLowerCase()) { showAlert("That's your own Peer ID!", "Can't Add Yourself"); return; }
        if (friends.some(f => f.uuid === uuid)) { showAlert("This coach is already in your friends list.", "Already Added"); return; }
        saveFriends([...friends, {
            uuid,
            nickname: friendNicknameInput.trim() || 'Unknown Coach',
            addedAt: Date.now(),
        }]);
        DHTService.watchFriend(uuid); // start internet discovery for this friend
        setFriendUuidInput('');
        setFriendNicknameInput('');
        setShowAddFriend(false);
    };

    const handleRemoveFriend = (uuid: string) => {
        DHTService.stopWatchingFriend(uuid);
        saveFriends(friends.filter(f => f.uuid !== uuid));
    };

    const handleCopyUuid = () => {
        navigator.clipboard.writeText(myPeerUuid);
        setUuidCopied(true);
        if (uuidCopyTimer.current) clearTimeout(uuidCopyTimer.current);
        uuidCopyTimer.current = setTimeout(() => setUuidCopied(false), 2000);
    };

    // When a peer finishes the ECDSA handshake (VERIFIED), save their UUID→nodeId mapping
    const updateFriendNodeId = (peerUuid: string, nodeId: string) => {
        setFriends(prev => {
            const updated = prev.map(f =>
                f.uuid === peerUuid ? { ...f, nodeId } : f
            );
            localStorage.setItem('trier_friends', JSON.stringify(updated));
            return updated;
        });
    };

    const handleSaveTurn = () => {
        if (turnUrl.trim()) {
            localStorage.setItem('trier_turn_config', JSON.stringify({
                url: turnUrl.trim(),
                username: turnUser.trim(),
                credential: turnCred.trim(),
            }));
        } else {
            localStorage.removeItem('trier_turn_config');
        }
        setTurnSaved(true);
        if (turnSavedTimer.current) clearTimeout(turnSavedTimer.current);
        turnSavedTimer.current = setTimeout(() => setTurnSaved(false), 2500);
    };

    const handleRelayToggle = async () => {
        if (relayStatus === 'DISCONNECTED' || relayStatus === 'ERROR') {
            RelayService.connect().catch(() => {}); // status dot reflects failure
        } else {
            RelayService.disconnect();
        }
    };

    const handleGenerateInvite = async () => {
        try {
            const code = await DiscoveryService.generateInvite();
            setInviteCode(code);
            setShowInviteModal(true);
        } catch (e: any) {
            showAlert("Failed to generate invite. Check your network connection.", "Invite Error");
        }
    };

    const handleRedeemInvite = () => {
        try {
            DiscoveryService.redeemInvite(joinCode);
            setShowJoinModal(false);
            setJoinCode('');
            showAlert("Peer added! They will appear as connectable once they come online.", "Peer Added");
        } catch (e) {
            showAlert("Invalid or expired invite code. Ask your opponent to generate a new one.", "Invalid Code");
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

                {/* ── YOUR PEER ID CARD ── */}
                <div style={{
                    background: 'rgba(23, 37, 84, 0.85)',
                    border: '1px solid rgba(96, 165, 250, 0.4)',
                    borderRadius: '16px',
                    padding: '1.25rem 1.75rem',
                    maxWidth: '600px',
                    width: '100%',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}>
                    <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 900, letterSpacing: '0.15em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                        Your Peer ID — share this to let friends find you
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <code style={{
                            flex: 1, fontFamily: 'monospace', fontSize: '0.95rem',
                            color: '#93c5fd', letterSpacing: '0.05em',
                            wordBreak: 'break-all',
                        }}>
                            {myPeerUuid || '...'}
                        </code>
                        <button
                            onClick={handleCopyUuid}
                            title="Copy Peer ID to clipboard"
                            style={{
                                background: uuidCopied ? 'rgba(74,222,128,0.2)' : 'rgba(96,165,250,0.15)',
                                border: `1px solid ${uuidCopied ? '#4ade80' : 'rgba(96,165,250,0.4)'}`,
                                color: uuidCopied ? '#4ade80' : '#93c5fd',
                                borderRadius: '8px', padding: '0.5rem 0.9rem',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                                fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap',
                                transition: 'background 0.2s, border-color 0.2s, color 0.2s',
                            }}
                        >
                            {uuidCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                        </button>
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#6b7280' }}>
                        <span><Activity size={12} style={{ display: 'inline', marginRight: 4 }} />{eventCount} events</span>
                        <span style={{ opacity: 0.5 }}>|</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{myId}</span>
                        <span style={{ opacity: 0.5 }}>|</span>
                        <button
                            onClick={async () => {
                                if (!await showConfirm('Rotate your cryptographic keypair? This generates a new identity key — all peers will need to re-verify. This cannot be undone.', 'Rotate Keypair', 'ROTATE')) return;
                                const { IdentityService } = await import('../services/IdentityService');
                                await IdentityService.rotateKeys();
                                showAlert('Keypair rotated. Reconnect to peers to re-establish trust.', 'Keys Rotated');
                            }}
                            title="Generate a new ECDSA keypair (lost device / key compromise recovery)"
                            style={{
                                background: 'none', border: 'none', color: '#6b7280',
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                gap: '0.3rem', fontSize: '0.7rem', padding: 0,
                            }}
                        >
                            <RotateCcw size={11} /> Rotate Keys
                        </button>
                    </div>
                </div>

                {/* ── FRIENDS PANEL ── */}
                <div style={{
                    maxWidth: '600px', width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 1.25rem',
                        borderBottom: friends.length > 0 || showAddFriend ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#d1d5db', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.08em' }}>
                            <Star size={15} color="#eab308" />
                            FRIENDS ({friends.length})
                        </div>
                        <button
                            onClick={() => setShowAddFriend(v => !v)}
                            style={{
                                background: showAddFriend ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: '#d1d5db', borderRadius: '6px',
                                padding: '0.35rem 0.85rem', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 'bold',
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                            }}
                        >
                            <UserPlus size={13} /> Add Friend
                        </button>
                    </div>

                    {/* Add friend form */}
                    {showAddFriend && (
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(96,165,250,0.05)' }}>
                            <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                Paste your friend's Peer ID. Ask them to find it on their Network page.
                            </div>
                            <input
                                value={friendUuidInput}
                                onChange={e => setFriendUuidInput(e.target.value)}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                style={{
                                    width: '100%', padding: '0.5rem 0.75rem',
                                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#fff', borderRadius: '6px', fontFamily: 'monospace',
                                    fontSize: '0.82rem', marginBottom: '0.5rem', boxSizing: 'border-box',
                                }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    value={friendNicknameInput}
                                    onChange={e => setFriendNicknameInput(e.target.value)}
                                    placeholder="Nickname (e.g. Mike's Team)"
                                    style={{
                                        flex: 1, padding: '0.5rem 0.75rem',
                                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                                        color: '#fff', borderRadius: '6px', fontSize: '0.82rem', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    onClick={handleAddFriend}
                                    style={{
                                        padding: '0.5rem 1rem', background: '#1d4ed8',
                                        border: 'none', color: '#fff', borderRadius: '6px',
                                        fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap',
                                    }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Friends list */}
                    {friends.map(f => {
                        const nodeState = f.nodeId ? getStateByNodeId(f.nodeId) : 'IDLE';
                        const isVerified = nodeState === 'VERIFIED';
                        const isConnecting = nodeState === 'REQUESTING' || nodeState === 'VERIFYING' || nodeState === 'NEGOTIATING' || nodeState === 'CONNECTED';
                        const discovered = f.nodeId ? peers.find(p => p.id === f.nodeId) : undefined;
                        const statusColor = isVerified ? '#4ade80' : isConnecting ? '#facc15' : discovered ? '#60a5fa' : '#374151';
                        const statusLabel = isVerified ? '● Connected'
                            : isConnecting ? '◌ Connecting…'
                            : discovered ? '● On LAN'
                            : '○ Offline';
                        return (
                            <div key={f.uuid} style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.75rem 1.25rem',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                            }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: statusColor,
                                    boxShadow: isVerified ? '0 0 6px #4ade80' : undefined,
                                    flexShrink: 0,
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f3f4f6' }}>{f.nickname}</div>
                                    <div style={{ fontSize: '0.68rem', color: '#6b7280', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {f.uuid}
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: statusColor, whiteSpace: 'nowrap' }}>
                                    {statusLabel}
                                </div>
                                {discovered && !isVerified && !isConnecting && (
                                    <button
                                        onClick={() => handleConnect(discovered)}
                                        style={{
                                            padding: '0.3rem 0.7rem', background: 'rgba(255,255,255,0.1)',
                                            border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                                            borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem',
                                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                                        }}
                                    >
                                        <Wifi size={11} /> Connect
                                    </button>
                                )}
                                <button
                                    onClick={() => handleRemoveFriend(f.uuid)}
                                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.2rem' }}
                                    title="Remove friend"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        );
                    })}
                    {friends.length === 0 && !showAddFriend && (
                        <div style={{ padding: '1rem 1.25rem', color: '#6b7280', fontSize: '0.82rem' }}>
                            No friends added yet. Click "Add Friend" and paste their Peer ID.
                        </div>
                    )}
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
                                showAlert("Firewall rules updated. Restart the app if connectivity issues persist.", "Firewall Updated");
                            } catch (e) {
                                showAlert("Firewall update failed. You may need to run as administrator.", "Update Failed");
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

            {/* TURN SERVER CONFIG */}
            <div style={{
                marginBottom: '2rem',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.02)',
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
                                    onChange={e => setTurnUrl(e.target.value)}
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
                                    onChange={e => setTurnUser(e.target.value)}
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
                                    onChange={e => setTurnCred(e.target.value)}
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
                                onClick={handleSaveTurn}
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
                                    onClick={() => { setTurnUrl(''); setTurnUser(''); setTurnCred(''); localStorage.removeItem('trier_turn_config'); }}
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

            {/* SCANNING GRID */}
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

            {/* GLOBAL NETWORK RELAY PANEL */}
            {(() => {
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
                    <div style={{
                        marginBottom: '2rem',
                        border: `1px solid ${statusColor[relayStatus]}44`,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: 'rgba(255,255,255,0.02)',
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
                                    onClick={handleRelayToggle}
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
                );
            })()}

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
                                            <div>State: <span style={{ color: conn.state === 'VERIFIED' ? '#4ade80' : conn.state === 'VERIFYING' ? '#facc15' : '#aaa' }}>{conn.state}</span></div>
                                            {conn.startTime && <div>Duration: {((Date.now() - conn.startTime) / 1000).toFixed(1)}s</div>}
                                            {conn.iceStats && <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>ICE — host: {conn.iceStats.host} srflx: {conn.iceStats.srflx} relay: {conn.iceStats.relay}</div>}
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
        const { isTauri } = await import('../utils/tauriEnv');
        if (!isTauri()) {
            setStatus('ERROR');
            setResult({ _browserMode: true });
            return;
        }
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

            {result?._browserMode && <div style={{ color: '#facc15' }}>Diagnostics unavailable in browser mode — run the Tauri app.</div>}
            {status === 'RUNNING' && <div>Running Connectivity Checks (Gateway, DNS, Internet)...</div>}

            {result && !result._browserMode && (
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
