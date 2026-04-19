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
import React, { useState, useEffect, useRef } from 'react';
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
        } catch {
            showAlert("Failed to generate invite. Check your network connection.", "Invite Error");
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

    return (
        <div style={{ height: '100%', padding: '2rem', overflowY: 'auto', position: 'relative' }}>
            {/* HEADER + IDENTITY + FRIENDS + ACTION BUTTONS + EXPORT/IMPORT */}
            <NodeIdentityPanel
                myPeerUuid={myPeerUuid}
                myId={myId}
                eventCount={eventCount}
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

            {/* CUSTOM RELAY URL — optional self-hosted relay, must be wss:// */}
            <div style={{
                marginBottom: '1.5rem',
                background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                padding: '0.85rem 1.25rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
                <label style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'bold', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                    RELAY URL
                </label>
                <input
                    value={customRelayUrl}
                    onChange={e => setCustomRelayUrl(e.target.value)}
                    placeholder="wss://your-relay.example.com (leave blank for default)"
                    style={{
                        flex: 1, padding: '0.4rem 0.75rem',
                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fff', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace',
                    }}
                />
                <button
                    onClick={handleSaveRelayUrl}
                    style={{ padding: '0.4rem 1rem', background: '#1d4ed8', border: 'none', color: '#fff', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                    Save
                </button>
            </div>

            {/* TURN SERVER CONFIG + GLOBAL NETWORK RELAY PANEL */}
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

            {/* SCANNING GRID */}
            <DiscoveredPeersGrid
                peers={peers}
                getState={getState}
                handleConnect={handleConnect}
                handleTerminate={handleTerminate}
            />

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
