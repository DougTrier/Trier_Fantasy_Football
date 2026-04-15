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
    const turnSavedTimer = useRef<any>(null);

    // Friends system
    const [myPeerUuid, setMyPeerUuid] = useState('');
    const [friends, setFriends] = useState<FriendEntry[]>([]);

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

        let loaded: FriendEntry[] = [];
        try {
            const raw = localStorage.getItem('trier_friends');
            if (raw) { loaded = JSON.parse(raw); setFriends(loaded); }
        } catch {}

        // Start watching each known friend's room for internet discovery
        loaded.forEach(f => DHTService.watchFriend(f.uuid));
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

    const handleTurnClear = () => {
        setTurnUrl('');
        setTurnUser('');
        setTurnCred('');
        localStorage.removeItem('trier_turn_config');
    };

    const handleRelayToggle = async () => {
        if (relayStatus === 'DISCONNECTED' || relayStatus === 'ERROR') {
            RelayService.connect().catch(() => {});
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
                onClose={() => setShowInviteModal(false)}
            />

            <JoinModal
                show={showJoinModal}
                joinCode={joinCode}
                onJoinCodeChange={setJoinCode}
                onClose={() => setShowJoinModal(false)}
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
