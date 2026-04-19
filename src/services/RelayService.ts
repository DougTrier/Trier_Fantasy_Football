/**
 * Trier Fantasy Football
 * © 2026 Doug Trier
 *
 * Licensed under the MIT License.
 * See LICENSE file for details.
 *
 * "Trier OS" and "Trier Fantasy Football" are trademarks of Doug Trier.
 */

/**
 * RelayService — Global P2P Signaling Client
 * ============================================
 * Connects to the hosted Trier Fantasy Football relay server via WebSocket.
 * Handles peer discovery, lobby management, and WebRTC signal forwarding for
 * peers that are NOT on the same LAN.
 *
 * ARCHITECTURE:
 *   This service bridges the relay WebSocket and P2PService's existing WebRTC
 *   state machine. When the relay delivers a SIGNAL to us, we call
 *   P2PService.handleSignal() directly — the same path LAN signals use.
 *   When P2PService needs to send a signal to a relay peer, it calls the
 *   relaySender hook we register via P2PService.setRelaySender().
 *
 * TRUST MODEL:
 *   The relay only sees {type, from, to, payload} — never game data.
 *   Game data only flows after the ECDSA handshake completes (VERIFIED state).
 *   The relay is a matchmaker, not a participant.
 *
 * LIFECYCLE:
 *   connect(url) → register() → [list lobbies | receive PEER_JOINED]
 *   → user clicks Connect → P2PService takes over → VERIFIED → game data flows
 *   → disconnect() on app close
 *
 * @module RelayService
 */

import { P2PService } from './P2PService';
import { IdentityService } from './IdentityService';
import { DiscoveryService, type DiscoveredPeer } from './DiscoveryService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RelayPeerInfo {
    nodeId: string;
    franchiseName: string;
    leagueName: string;
    region: string;
    connectedAt?: number;
}

export interface RelayLobby {
    leagueName: string;
    region: string;
    peers: RelayPeerInfo[];
}

export type RelayStatus =
    | 'DISCONNECTED'
    | 'CONNECTING'
    | 'CONNECTED'       // WebSocket open, not yet registered
    | 'REGISTERED'      // Fully online on the relay
    | 'ERROR';

/** One entry in the federated relay registry — known relays with live health data. */
export interface RelayEndpoint {
    url: string;
    label: string;
    region: string;
    latencyMs: number | null;   // null = not yet measured or offline
    online: boolean;
    isBuiltIn: boolean;         // false = user-added via the Network page
}

// Default relay URL — can be overridden by the user in Network settings.
// Stored in localStorage as 'trier_relay_url'; must be a wss:// URL.
const DEFAULT_RELAY_URL = 'wss://trier-fantasy-relay.up.railway.app';

// Known public relays — updated as the federation grows.
const BUILT_IN_RELAYS: Array<Pick<RelayEndpoint, 'url' | 'label' | 'region'>> = [
    { url: 'wss://trier-fantasy-relay.up.railway.app', label: 'Default (Railway)', region: 'US-East' },
];

/**
 * Reads the user-configured relay URL from localStorage, falling back to the
 * default. Rejects ws:// (unencrypted) URLs to prevent downgrade attacks.
 */
function getConfiguredRelayUrl(): string {
    const stored = localStorage.getItem('trier_relay_url');
    if (!stored) return DEFAULT_RELAY_URL;
    // Block cleartext WebSocket connections — only wss:// is accepted
    if (!stored.startsWith('wss://')) {
        console.warn('[Relay] Custom relay URL must use wss:// — ignoring and using default.');
        return DEFAULT_RELAY_URL;
    }
    return stored;
}

// ─────────────────────────────────────────────────────────────────────────────
// RelayService
// ─────────────────────────────────────────────────────────────────────────────

export const RelayService = {
    ws: null as WebSocket | null,
    status: 'DISCONNECTED' as RelayStatus,
    relayUrl: DEFAULT_RELAY_URL,
    totalOnline: 0,

    // Listeners
    statusListeners: [] as ((status: RelayStatus, totalOnline: number) => void)[],
    lobbyListeners: [] as ((lobbies: RelayLobby[]) => void)[],
    peerListeners: [] as ((peer: RelayPeerInfo, event: 'joined' | 'left') => void)[],
    _endpointListeners: [] as ((endpoints: RelayEndpoint[]) => void)[],

    // Federation — live health data for all known relays
    _relayEndpoints: [] as RelayEndpoint[],

    // Heartbeat + reconnect timers
    _pingTimer: null as ReturnType<typeof setInterval> | null,
    _reconnectTimer: null as ReturnType<typeof setTimeout> | null,
    _reconnectDelay: 5_000,      // start at 5s, backs off to 60s max
    _connecting: false,           // guard against React StrictMode double-invoke
    _intentionalDisconnect: false, // true when user explicitly goes offline

    // ── Connection Lifecycle ──────────────────────────────────────────────────

    async connect(url?: string): Promise<void> {
        // Guard: prevent concurrent connection attempts (React StrictMode safe)
        if (this._connecting) return;
        if (this.ws && this.status !== 'DISCONNECTED' && this.status !== 'ERROR') {
            return;
        }

        this._connecting = true;
        this._intentionalDisconnect = false;
        this._clearReconnectTimer();
        // Fallback chain: explicit arg → pinned custom URL → best-health relay → built-in default
        this.relayUrl = url
            || (localStorage.getItem('trier_relay_url') ? getConfiguredRelayUrl() : null)
            || (this._relayEndpoints.length > 0 ? this.getBestRelay() : null)
            || DEFAULT_RELAY_URL;
        this._setStatus('CONNECTING');
        console.debug(`[Relay] Connecting to ${this.relayUrl}...`);

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.relayUrl);
            } catch (e) {
                this._connecting = false;
                this._setStatus('ERROR');
                reject(e);
                return;
            }

            // Shared cleanup — called exactly once regardless of which path fires first.
            // Clears the timeout so onclose and the timer can never BOTH call _scheduleReconnect.
            let settled = false;
            const settle = (clearTimer: () => void) => {
                if (settled) return false;
                settled = true;
                clearTimer();
                this._connecting = false;
                return true;
            };

            const timeoutId = setTimeout(() => {
                if (!settle(() => {})) return;
                this._setStatus('ERROR');
                this._scheduleReconnect();
                reject(new Error('[Relay] Connection timed out after 10s'));
            }, 10_000);

            this.ws!.onopen = async () => {
                if (!settle(() => clearTimeout(timeoutId))) return;
                this._reconnectDelay = 5_000; // reset backoff on success
                this._setStatus('CONNECTED');
                console.log('[Relay] WebSocket open. Registering...');
                try {
                    await this._register();
                    this._startHeartbeat();
                    resolve();
                } catch (e) {
                    this._setStatus('ERROR');
                    reject(e);
                }
            };

            this.ws!.onmessage = (event) => {
                this._handleMessage(event.data);
            };

            this.ws!.onclose = () => {
                const first = settle(() => clearTimeout(timeoutId));
                this._cleanup();
                this._setStatus('DISCONNECTED');
                // Auto-reconnect unless the user explicitly went offline.
                // Only schedule if this handler ran first (prevents double-schedule with timeout).
                if (first && !this._intentionalDisconnect) {
                    this._scheduleReconnect();
                }
            };

            this.ws!.onerror = () => {
                // onerror always fires before onclose — mark ERROR here.
                // onclose will handle scheduling the reconnect.
                this._setStatus('ERROR');
            };
        });
    },

    disconnect() {
        this._intentionalDisconnect = true;
        this._clearReconnectTimer();
        this._cleanup();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._setStatus('DISCONNECTED');
        // Unhook from P2PService signal routing
        P2PService.setRelaySender(null);
    },

    // ── Registration ─────────────────────────────────────────────────────────

    async _register(): Promise<void> {
        const identity = IdentityService.get();

        // Resolve team name from DiscoveryService peers or fall back to identity
        const teamName = (DiscoveryService as unknown as { _franchiseName?: string })._franchiseName
            || identity.name
            || identity.nodeId;

        this._send({
            type: 'REGISTER',
            nodeId: identity.nodeId,
            franchiseName: teamName,
            leagueName: 'Trier Fantasy League',
            region: 'Global',
        });

        // Hook into P2PService so signals for relay peers go through us
        P2PService.setRelaySender((payload) => {
            this._sendSignal(payload.to!, payload);
        });

        console.log(`[Relay] Registered as ${identity.nodeId}`);
    },

    // ── Lobby Management ──────────────────────────────────────────────────────

    listLobbies() {
        this._send({ type: 'LIST' });
    },

    // ── Inbound Message Handler ───────────────────────────────────────────────

    _handleMessage(raw: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let msg: any;
        try {
            msg = JSON.parse(raw);
        } catch {
            console.warn('[Relay] Non-JSON message received');
            return;
        }

        switch (msg.type) {

            case 'WELCOME':
                this.totalOnline = msg.totalOnline;
                this._setStatus('REGISTERED');
                console.log(`[Relay] ✅ Online. ${msg.totalOnline} peers connected globally.`);
                // Immediately request the lobby list
                this.listLobbies();
                break;

            case 'LOBBIES':
                this.lobbyListeners.forEach(l => l(msg.lobbies));
                break;

            case 'PEER_JOINED': {
                const peer: RelayPeerInfo = {
                    nodeId: msg.nodeId,
                    franchiseName: msg.franchiseName,
                    leagueName: msg.leagueName,
                    region: msg.region,
                };
                console.log(`[Relay] + Peer joined: ${peer.franchiseName} (${peer.nodeId})`);
                this._addToDiscovery(peer);
                this.peerListeners.forEach(l => l(peer, 'joined'));
                break;
            }

            case 'PEER_LEFT':
                console.log(`[Relay] - Peer left: ${msg.nodeId}`);
                this.peerListeners.forEach(l => l(
                    { nodeId: msg.nodeId, franchiseName: '', leagueName: '', region: '' },
                    'left'
                ));
                break;

            case 'SIGNAL': {
                // Forward the relayed signal into P2PService's existing state machine
                const payload = msg.payload;
                payload.sender_id = msg.from;

                // Mark this peer as a relay peer so P2PService routes signals back via us
                P2PService.addRelayPeer(msg.from);

                console.log(`[Relay] ⇄ Signal from ${msg.from}: ${payload.type_}`);
                P2PService.handleSignal(payload);
                break;
            }

            case 'PONG':
                // heartbeat ack — nothing to do
                break;

            case 'ERROR':
                console.error(`[Relay] Server error: ${msg.message}`);
                break;

            default:
                console.warn(`[Relay] Unknown message type: ${msg.type}`);
        }
    },

    // ── Signal Forwarding ─────────────────────────────────────────────────────

    /**
     * Send a WebRTC signal to a specific peer via the relay.
     * Called by P2PService's relaySender hook for relay peers.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _sendSignal(targetNodeId: string, payload: any) {
        this._send({ type: 'SIGNAL', to: targetNodeId, payload });
    },

    // ── Discovery Integration ─────────────────────────────────────────────────

    /**
     * Add a relay-discovered peer to DiscoveryService so it appears in the
     * Network page alongside LAN peers.
     */
    _addToDiscovery(peer: RelayPeerInfo) {
        const discovered: DiscoveredPeer = {
            id: peer.nodeId,
            ip: 'relay',          // sentinel — signals go via relay WS, not direct HTTP
            port: 0,
            hostname: peer.franchiseName,
            franchiseName: peer.franchiseName,
            transport: 'Relay',
            lastSeen: Date.now(),
        };
        DiscoveryService.addPeer(discovered);
    },

    // ── Heartbeat ─────────────────────────────────────────────────────────────

    _startHeartbeat() {
        this._pingTimer = setInterval(() => {
            if (this.status === 'REGISTERED') {
                this._send({ type: 'PING' });
            }
        }, 30_000); // ping every 30s — server times out after 90s
    },

    _scheduleReconnect() {
        if (this._intentionalDisconnect || this._reconnectTimer) return;
        const delay = this._reconnectDelay;
        console.debug(`[Relay] Reconnecting in ${delay / 1000}s...`);
        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            // Double the delay for next attempt, cap at 60s
            this._reconnectDelay = Math.min(this._reconnectDelay * 2, 60_000);
            this.connect().catch(() => {}); // errors handled inside connect()
        }, delay);
    },

    _clearReconnectTimer() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    },

    // ── Subscription API ──────────────────────────────────────────────────────

    onStatus(fn: (status: RelayStatus, totalOnline: number) => void) {
        this.statusListeners.push(fn);
        fn(this.status, this.totalOnline); // fire immediately with current state
        return () => {
            this.statusListeners = this.statusListeners.filter(l => l !== fn);
        };
    },

    onLobbies(fn: (lobbies: RelayLobby[]) => void) {
        this.lobbyListeners.push(fn);
        return () => {
            this.lobbyListeners = this.lobbyListeners.filter(l => l !== fn);
        };
    },

    onPeer(fn: (peer: RelayPeerInfo, event: 'joined' | 'left') => void) {
        this.peerListeners.push(fn);
        return () => {
            this.peerListeners = this.peerListeners.filter(l => l !== fn);
        };
    },

    // ── Internal Helpers ──────────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _send(msg: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        } else {
            console.warn('[Relay] Cannot send — not connected.');
        }
    },

    _setStatus(status: RelayStatus) {
        this.status = status;
        this.statusListeners.forEach(l => l(status, this.totalOnline));
    },

    _cleanup() {
        if (this._pingTimer) {
            clearInterval(this._pingTimer);
            this._pingTimer = null;
        }
    },

    // ── Federation — relay health monitoring ──────────────────────────────────

    /** Read user-added relay URLs from localStorage. */
    _getCustomRelays(): Array<{ url: string; label: string }> {
        try {
            const raw = localStorage.getItem('trier_extra_relays');
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    /** Add a self-hosted relay to the persistent list and re-measure health. */
    addCustomRelay(url: string, label: string) {
        const list = this._getCustomRelays();
        if (!list.some(r => r.url === url)) {
            list.push({ url, label });
            localStorage.setItem('trier_extra_relays', JSON.stringify(list));
        }
        this.refreshRelayHealth();
    },

    /** Remove a user-added relay by URL and update the health list. */
    removeCustomRelay(url: string) {
        const list = this._getCustomRelays().filter(r => r.url !== url);
        localStorage.setItem('trier_extra_relays', JSON.stringify(list));
        this._relayEndpoints = this._relayEndpoints.filter(e => e.url !== url);
        this._endpointListeners.forEach(l => l([...this._relayEndpoints]));
    },

    /** Open a temporary WebSocket and measure time-to-open (proxy for RTT). */
    measureRelayLatency(url: string): Promise<number | null> {
        return new Promise(resolve => {
            const start = Date.now();
            try {
                const ws = new WebSocket(url);
                const timer = setTimeout(() => { try { ws.close(); } catch { /* ignore */ } resolve(null); }, 5_000);
                ws.onopen = () => {
                    clearTimeout(timer);
                    const ms = Date.now() - start;
                    try { ws.close(); } catch { /* ignore */ }
                    resolve(ms);
                };
                ws.onerror = () => { clearTimeout(timer); resolve(null); };
            } catch { resolve(null); }
        });
    },

    /** Ping all known relays in parallel and notify endpoint listeners with results. */
    async refreshRelayHealth() {
        const custom = this._getCustomRelays().map(r => ({
            url: r.url, label: r.label, region: 'Custom',
            latencyMs: null as number | null, online: false, isBuiltIn: false,
        }));
        const all: RelayEndpoint[] = [
            ...BUILT_IN_RELAYS.map(r => ({ ...r, latencyMs: null as number | null, online: false, isBuiltIn: true })),
            ...custom,
        ];

        // Notify immediately with pending state so UI shows "measuring..."
        this._relayEndpoints = all;
        this._endpointListeners.forEach(l => l([...this._relayEndpoints]));

        await Promise.all(all.map(async (ep, i) => {
            const ms = await this.measureRelayLatency(ep.url);
            all[i].latencyMs = ms;
            all[i].online = ms !== null;
        }));

        this._relayEndpoints = all;
        this._endpointListeners.forEach(l => l([...this._relayEndpoints]));
    },

    /** Return the URL of the lowest-latency online relay, or the default as fallback. */
    getBestRelay(): string {
        const online = this._relayEndpoints.filter(e => e.online && e.latencyMs !== null);
        if (online.length === 0) return DEFAULT_RELAY_URL;
        return online.reduce((a, b) => a.latencyMs! <= b.latencyMs! ? a : b).url;
    },

    /** Subscribe to relay endpoint health updates. Fires immediately with current state. */
    onEndpoints(fn: (endpoints: RelayEndpoint[]) => void) {
        this._endpointListeners.push(fn);
        fn([...this._relayEndpoints]);
        return () => { this._endpointListeners = this._endpointListeners.filter(l => l !== fn); };
    },

};
