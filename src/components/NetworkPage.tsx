/**
 * NetworkPage — P2P Connection Hub
 * ==================================
 * Central UI for managing all peer connectivity:
 *
 *   LAN discovery  — mDNS scan via DiscoveryService (Tauri Rust backend)
 *   Internet peers — WebSocket relay (RelayService) + DHT fallback (DHTService)
 *   Friends list   — stable UUID-based bookmarks persisted in localStorage
 *
 * Security note: connections displayed here may be CONNECTED (transport up)
 * but not yet VERIFIED (handshake incomplete). Only VERIFIED peers exchange
 * game data. See P2PService.ts for the full state machine.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Check, Activity, RotateCcw } from 'lucide-react';
import { useDialog } from './AppDialog';
import { IdentityService } from '../services/IdentityService';
import { DiscoveryService, type DiscoveredPeer } from '../services/DiscoveryService';
import { GlobalEventStore } from '../services/EventStore';
import { P2PService, type SignalPayload, type ConnectionState } from '../services/P2PService';
import { DHTService } from '../services/DHTService';
import { RelayService, type RelayStatus, type RelayLobby } from '../services/RelayService';

import { NodeIdentityPanel, type FriendEntry } from './network/NodeIdentityPanel';
import { DiscoveredPeersGrid } from './network/DiscoveredPeersGrid';
import { RelayPanel } from './network/RelayPanel';
import {
    InviteModal,
    JoinModal,
    DiagnosticsModal,
    IncomingRequestModal,
} from './network/NetworkModals';

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

    // Right-column active tab
    const [activeTab, setActiveTab] = useState<'peers' | 'advanced'>('peers');

    // TURN config state
    const [turnUrl, setTurnUrl] = useState('');
    const [turnUser, setTurnUser] = useState('');
    const [turnCred, setTurnCred] = useState('');
    const [turnSaved, setTurnSaved] = useState(false);

    // Custom relay URL — must be wss:// (enforced by RelayService.getConfiguredRelayUrl)
    const [customRelayUrl, setCustomRelayUrl] = useState(
        () => localStorage.getItem('trier_relay_url') || ''
    );
    const turnSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Friends system
    const [myPeerUuid, setMyPeerUuid] = useState('');
    const [friends, setFriends] = useState<FriendEntry[]>([]);

    // Peer ID copy feedback — declared after myPeerUuid to avoid temporal dead zone
    const [uuidCopied, setUuidCopied] = useState(false);
    const uuidCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleCopyUuid = useCallback(() => {
        navigator.clipboard.writeText(myPeerUuid);
        setUuidCopied(true);
        if (uuidCopyTimer.current) clearTimeout(uuidCopyTimer.current);
        uuidCopyTimer.current = setTimeout(() => setUuidCopied(false), 2000);
    }, [myPeerUuid]);

    // Invite UI State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [inviteExpiresAt, setInviteExpiresAt] = useState(0);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joinError, setJoinError] = useState('');

    useEffect(() => {
        // Subscribe to peer updates
        const unsub = DiscoveryService.subscribe(setPeers);

        // Subscribe to Stats
        const updateStats = () => {
            setEventCount(GlobalEventStore.getAll().length);
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
                // eslint-disable-next-line react-hooks/immutability
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

    // Load peer UUID and friends list; start DHT presence only if friends exist.
    // DHT init triggers Trystero WebSocket relay connections — skip when there are
    // no friends so we don't flood the console with relay-failure noise for no reason.
    useEffect(() => {
        const myUuid = IdentityService.getPeerUuid();
        setMyPeerUuid(myUuid);

        let loaded: FriendEntry[] = [];
        try {
            const raw = localStorage.getItem('trier_friends');
            if (raw) { loaded = JSON.parse(raw); setFriends(loaded); }
        } catch { /* intentionally empty — corrupted storage is silently ignored */ }

        // Only connect to Nostr/DHT relays when there are friends to discover
        if (loaded.length > 0) {
            DHTService.init(myUuid);
            loaded.forEach(f => DHTService.watchFriend(f.uuid));
        }
    }, []);

    // Load and decrypt TURN config from localStorage on mount.
    // Supports both the new enc1: encrypted format and the legacy plaintext JSON format.
    useEffect(() => {
        const loadTurnConfig = async () => {
            try {
                const raw = localStorage.getItem('trier_turn_config');
                if (!raw) return;

                let cfg: { url?: string; username?: string; credential?: string } | null = null;

                if (raw.startsWith('enc1:')) {
                    // New encrypted format — decrypt via IdentityService
                    const { IdentityService } = await import('../services/IdentityService');
                    const plaintext = await IdentityService.decryptSecret(raw);
                    if (plaintext) cfg = JSON.parse(plaintext);
                } else {
                    // Legacy plaintext — parse directly and re-encrypt immediately
                    cfg = JSON.parse(raw);
                    if (cfg?.url) {
                        const { IdentityService } = await import('../services/IdentityService');
                        const encrypted = await IdentityService.encryptSecret(JSON.stringify(cfg));
                        localStorage.setItem('trier_turn_config', encrypted);
                        console.log('[Network] TURN config migrated to encrypted storage.');
                    }
                }

                if (cfg) {
                    setTurnUrl(cfg.url || '');
                    setTurnUser(cfg.username || '');
                    setTurnCred(cfg.credential || '');
                    // Populate P2PService cache so it can be used synchronously during ICE
                    const { P2PService } = await import('../services/P2PService');
                    if (cfg.url) {
                        P2PService.setTurnConfigCache([{
                            urls: cfg.url,
                            username: cfg.username || '',
                            credential: cfg.credential || '',
                        }]);
                    }
                }
            } catch { /* non-fatal — STUN-only fallback is acceptable */ }
        };
        loadTurnConfig();
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

    // ── Connection actions ────────────────────────────────────────────────────
    const handleConnect = (peer: DiscoveredPeer) => {
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

    // Encrypt TURN credentials before persisting to localStorage.
    const handleSaveTurn = async () => {
        const { IdentityService } = await import('../services/IdentityService');
        const { P2PService } = await import('../services/P2PService');
        if (turnUrl.trim()) {
            const cfg = {
                url: turnUrl.trim(),
                username: turnUser.trim(),
                credential: turnCred.trim(),
            };
            // Store encrypted; update in-memory cache for synchronous ICE use
            const encrypted = await IdentityService.encryptSecret(JSON.stringify(cfg));
            localStorage.setItem('trier_turn_config', encrypted);
            P2PService.setTurnConfigCache([{
                urls: cfg.url,
                username: cfg.username,
                credential: cfg.credential,
            }]);
        } else {
            localStorage.removeItem('trier_turn_config');
            P2PService.setTurnConfigCache(null);
        }
        setTurnSaved(true);
        if (turnSavedTimer.current) clearTimeout(turnSavedTimer.current);
        turnSavedTimer.current = setTimeout(() => setTurnSaved(false), 2500);
    };

    const handleTurnClear = async () => {
        const { P2PService } = await import('../services/P2PService');
        setTurnUrl('');
        setTurnUser('');
        setTurnCred('');
        localStorage.removeItem('trier_turn_config');
        P2PService.setTurnConfigCache(null);
    };

    const handleRelayToggle = async () => {
        if (relayStatus === 'DISCONNECTED' || relayStatus === 'ERROR') {
            // Pass custom URL if set; RelayService enforces wss:// or falls back to default
            RelayService.connect(customRelayUrl || undefined).catch(() => {});
        } else {
            RelayService.disconnect();
        }
    };

    // Persist custom relay URL (or clear it) — RelayService reads this on next connect
    const handleSaveRelayUrl = () => {
        const trimmed = customRelayUrl.trim();
        if (trimmed && !trimmed.startsWith('wss://')) {
            // Show inline warning without blocking the save — RelayService will reject it
            alert('Relay URL must start with wss:// — plaintext ws:// is not allowed.');
            return;
        }
        if (trimmed) {
            localStorage.setItem('trier_relay_url', trimmed);
        } else {
            localStorage.removeItem('trier_relay_url');
        }
    };

    // Generates a short-lived invite code via DiscoveryService and shows the share modal.
    // The code encodes this node's IP + port so the recipient can add them as a peer directly.
    const handleGenerateInvite = async () => {
        try {
            const code = await DiscoveryService.generateInvite();
            setInviteCode(code);
            setInviteExpiresAt(Date.now() + DiscoveryService.INVITE_TTL_MS);
            setShowInviteModal(true);
        } catch (e) {
            showAlert(e instanceof Error ? e.message : "Failed to generate invite. Check your network connection.", "Invite Error");
        }
    };

    // Redeems a code from another peer — adds them to the known-peer list so DiscoveryService
    // will show them as connectable when both are on the same LAN or relay.
    const handleRedeemInvite = () => {
        try {
            DiscoveryService.redeemInvite(joinCode);
            setShowJoinModal(false);
            setJoinCode('');
            setJoinError('');
            showAlert("Peer added! They will appear as connectable once they come online.", "Peer Added");
        } catch (e) {
            // Show error inline in the modal rather than an alert — keeps context visible
            setJoinError(e instanceof Error ? e.message : 'Invalid invite code.');
        }
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

    // Tab pill styles
    const tabBtn = (active: boolean): React.CSSProperties => ({
        flex: 1, padding: '7px 14px', borderRadius: '7px', border: 'none',
        fontWeight: 800, fontSize: '0.78rem', letterSpacing: '1px', cursor: 'pointer',
        textTransform: 'uppercase', transition: 'all 0.15s',
        background: active ? 'rgba(234,179,8,0.2)' : 'transparent',
        color: active ? '#eab308' : '#6b7280',
    });

    return (
        // Two-column layout that fills the viewport — no outer scroll
        <div style={{ height: '100%', display: 'flex', gap: '1.25rem', padding: '1.5rem 2rem', overflow: 'hidden', boxSizing: 'border-box' }}>

            {/* ── LEFT SIDEBAR — Identity, Friends, Actions ─────────────────────── */}
            <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
                <NodeIdentityPanel
                    myPeerUuid={myPeerUuid}
                    friends={friends}
                    peers={peers}
                    onFriendsChange={setFriends}
                    showDiagnostics={showDiagnostics}
                    onShowDiagnostics={() => setShowDiagnostics(true)}
                    onShowInviteModal={handleGenerateInvite}
                    onShowJoinModal={() => setShowJoinModal(true)}
                    getStateByNodeId={getStateByNodeId}
                    handleConnect={handleConnect}
                />
            </div>

            {/* ── RIGHT COLUMN — Tabbed content ─────────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Tab bar */}
                <div style={{ flexShrink: 0, background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '5px', display: 'flex', gap: '4px', marginBottom: '0.75rem' }}>
                    <button style={tabBtn(activeTab === 'peers')} onClick={() => setActiveTab('peers')}>Discovered Peers</button>
                    <button style={tabBtn(activeTab === 'advanced')} onClick={() => setActiveTab('advanced')}>Relay &amp; TURN</button>
                </div>

                {/* Tab content — inner scroll only */}
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    {activeTab === 'peers' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <DiscoveredPeersGrid
                                peers={peers}
                                getState={getState}
                                handleConnect={handleConnect}
                                handleTerminate={handleTerminate}
                            />
                            {/* YOUR PEER ID — below the scanning grid so it's contextually grouped with discovery */}
                            <div style={{ background: 'rgba(23,37,84,0.85)', border: '1px solid rgba(96,165,250,0.4)', borderRadius: '12px', padding: '0.85rem 1.1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                                <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 900, letterSpacing: '0.15em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                    Your Peer ID — share this to let friends find you
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <code style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.9rem', color: '#93c5fd', letterSpacing: '0.05em', wordBreak: 'break-all' }}>
                                        {myPeerUuid || '...'}
                                    </code>
                                    <button onClick={handleCopyUuid} title="Copy Peer ID to clipboard"
                                        style={{ background: uuidCopied ? 'rgba(74,222,128,0.2)' : 'rgba(96,165,250,0.15)', border: `1px solid ${uuidCopied ? '#4ade80' : 'rgba(96,165,250,0.4)'}`, color: uuidCopied ? '#4ade80' : '#93c5fd', borderRadius: '8px', padding: '0.45rem 0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.78rem', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
                                        {uuidCopied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                                    </button>
                                </div>
                                <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.72rem', color: '#6b7280', flexWrap: 'wrap' }}>
                                    <span><Activity size={11} style={{ display: 'inline', marginRight: 3 }} />{eventCount} events</span>
                                    <span style={{ opacity: 0.4 }}>|</span>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>{myId}</span>
                                    <span style={{ opacity: 0.4 }}>|</span>
                                    <button
                                        title="Generate a new ECDSA keypair (lost device / key compromise recovery)"
                                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', padding: 0 }}
                                        onClick={async () => {
                                            if (!await showConfirm('Rotate your cryptographic keypair? All peers will need to re-verify. This cannot be undone.', 'Rotate Keypair', 'ROTATE')) return;
                                            const { IdentityService } = await import('../services/IdentityService');
                                            await IdentityService.rotateKeys();
                                            showAlert('Keypair rotated. Reconnect to peers to re-establish trust.', 'Keys Rotated');
                                        }}
                                    >
                                        <RotateCcw size={11} /> Rotate Keys
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Custom relay URL */}
                            <div style={{ background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'bold', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                                    RELAY URL
                                </label>
                                <input
                                    value={customRelayUrl}
                                    onChange={e => setCustomRelayUrl(e.target.value)}
                                    placeholder="wss://your-relay.example.com (leave blank for default)"
                                    style={{ flex: 1, padding: '0.4rem 0.75rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                                />
                                <button onClick={handleSaveRelayUrl} style={{ padding: '0.4rem 1rem', background: '#1d4ed8', border: 'none', color: '#fff', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
                                    Save
                                </button>
                            </div>
                            <RelayPanel
                                turnUrl={turnUrl}
                                turnUser={turnUser}
                                turnCred={turnCred}
                                onTurnUrlChange={setTurnUrl}
                                onTurnUserChange={setTurnUser}
                                onTurnCredChange={setTurnCred}
                                onTurnSave={handleSaveTurn}
                                onTurnClear={handleTurnClear}
                                turnSaved={turnSaved}
                                relayStatus={relayStatus}
                                relayOnline={relayOnline}
                                lobbies={lobbies}
                                peers={peers}
                                onRelayToggle={handleRelayToggle}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* MODALS */}
            <InviteModal
                show={showInviteModal}
                inviteCode={inviteCode}
                expiresAt={inviteExpiresAt}
                onClose={() => setShowInviteModal(false)}
            />
            <JoinModal
                show={showJoinModal}
                joinCode={joinCode}
                error={joinError}
                onJoinCodeChange={code => { setJoinCode(code); setJoinError(''); }}
                onClose={() => { setShowJoinModal(false); setJoinError(''); }}
                onRedeem={handleRedeemInvite}
            />
            <DiagnosticsModal
                show={showDiagnostics}
                peers={peers}
                getConnection={getConnection}
                onClose={() => setShowDiagnostics(false)}
            />
            <IncomingRequestModal
                incomingRequest={incomingRequest}
                onAccept={handleAccept}
                onReject={handleReject}
            />
        </div>
    );
};
