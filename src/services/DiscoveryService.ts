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
 * DiscoveryService — Peer Discovery (Phase A: LAN mDNS / Phase B: WAN Invite Codes)
 * ====================================================================================
 * Finds other running instances of this app on the network and maintains
 * a live peer registry. Operates in two modes:
 *
 *   Phase A — LAN mDNS:
 *     Uses Rust (Tauri) to broadcast and listen on the local network via mDNS.
 *     When a peer announces itself, it appears in this service's peer map within seconds.
 *     This is the primary path for home/LAN play.
 *
 *   Phase B — Invite Code (WAN):
 *     Generates a short alphanumeric code that can be shared out-of-band (text, chat).
 *     The remote peer enters the code, resolving to a relay signaling endpoint.
 *     Used for cross-network play where mDNS is blocked by the router.
 *
 * ARCHITECTURE:
 *   - peers Map<nodeId, DiscoveredPeer> — the live registry, updated on every mDNS event.
 *   - subscribe(fn) — UI components receive push updates when the peer list changes.
 *   - setIpResolver() is called by P2PService so it can look up IPs by nodeId.
 *
 * This service does NOT handle trust or authentication — that is P2PService's job.
 * A discovered peer is just a network address until the handshake completes.
 *
 * @module DiscoveryService
 */

import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { IdentityService } from './IdentityService';
import { P2PService } from './P2PService';

export interface DiscoveredPeer {
    id: string;      // "CoachNodeID"
    ip: string;      // LAN IP (Private)
    port: number;
    hostname: string;
    franchiseId?: string;
    franchiseName?: string;
    transport?: string;
    lastSeen: number;
}

export const DiscoveryService = {
    peers: new Map<string, DiscoveredPeer>(),
    listeners: [] as ((peers: DiscoveredPeer[]) => void)[],

    async init() {
        // Guard first — no need to init identity/keys if we're not in Tauri.
        const { isTauri } = await import('../utils/tauriEnv');
        if (!isTauri()) {
            console.log('[Discovery] Browser mode — P2P discovery disabled.');
            return;
        }

        const identity = await IdentityService.init();
        console.log('[Discovery] Initializing with ID:', identity.nodeId);

        // 1. Listen for Peers from Rust
        try {
            await listen('PEER_DISCOVERED', (event) => {
                const peerRaw = event.payload as Record<string, unknown>;
                // Validate
                if (!peerRaw.id || !peerRaw.ip) return;

                const peer: DiscoveredPeer = {
                    id: peerRaw.id as string,
                    ip: peerRaw.ip as string,
                    port: peerRaw.port as number,
                    hostname: peerRaw.hostname as string,
                    franchiseId: peerRaw.franchise_id as string | undefined,
                    franchiseName: peerRaw.franchise_name as string | undefined,
                    transport: peerRaw.transport as string | undefined,
                    lastSeen: Date.now()
                };

                this.addPeer(peer);
            });
        } catch (e) {
            console.warn('[Discovery] Failed to attach listener:', e);
        }

        // 2. Start Rust mDNS Listener & Signal Server
        try {
            // New P2P Service Start with Identity
            const allocatedPort = await invoke<number>('start_p2p_services', {
                nodeId: identity.nodeId,
                franchiseId: identity.franchiseId || null,
                franchise_name: identity.name || 'Unknown Team'
            });
            P2PService.port = allocatedPort;
            P2PService.isPortAssigned = true;
            console.log('[Discovery] P2P Services Started on port:', allocatedPort);

            // Notify listeners that port is ready
            P2PService.portAssignmentListeners.forEach((l) => l(allocatedPort));

            // Set IP Resolver for P2P Service
            P2PService.setIpResolver((id) => {
                const peer = this.peers.get(id); // map lookup is faster than find
                return peer ? { ip: peer.ip, port: peer.port || 15432 } : undefined;
            });
        } catch (e) {
            console.error('[Discovery] Failed to start P2P Services:', e);
        }

        // Init Sync Logic
        // We import it dynamically to avoid circular dependency issues if any
        import('./SyncService').then(m => m.SyncService.init());
    },

    addPeer(peer: DiscoveredPeer) {
        // Filter out my own ID (Self-Discovery Loop)
        if (peer.id === P2PService.myId) return;

        let changed = false;
        if (this.peers.has(peer.id)) {
            // Update timestamp
            const existing = this.peers.get(peer.id)!;
            existing.lastSeen = Date.now();
            if (existing.ip !== peer.ip) {
                existing.ip = peer.ip; // Update IP if changed
                changed = true;
            }
        } else {
            console.log('[Discovery] New Peer Found:', peer.id);
            this.peers.set(peer.id, peer);
            changed = true;
        }

        // Debounced Notify (only if changed or new)
        if (changed) {
            this.notifyListenersDebounced();
        }
    },

    notifyTimer: null as ReturnType<typeof setTimeout> | null,
    notifyListenersDebounced() {
        if (this.notifyTimer) clearTimeout(this.notifyTimer);
        this.notifyTimer = setTimeout(() => {
            this.notifyListeners();
            this.notifyTimer = null;
        }, 500); // 500ms debounce
    },

    getPeers(): DiscoveredPeer[] {
        return Array.from(this.peers.values());
    },

    subscribe(callback: (peers: DiscoveredPeer[]) => void) {
        this.listeners.push(callback);
        // Initial callback
        callback(this.getPeers());
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    },

    notifyListeners() {
        const list = this.getPeers();
        this.listeners.forEach(l => l(list));
    },

    async refresh() {
        console.log('[Discovery] Manual refresh requested');
        this.peers.clear();
        this.notifyListeners();

        try {
            await invoke('p2p_refresh_discovery');
        } catch (e) {
            console.warn('[Discovery] Backend refresh failed', e);
        }

        // Also re-init browser loop if possible, 
        // though Rust side clears internal cache already.
    },

    async updateIdentity(franchiseId: string, franchiseName: string) {
        const identity = await IdentityService.init();
        console.log('[Discovery] Updating Identity:', franchiseName);
        try {
            await invoke('p2p_update_identity', {
                nodeId: identity.nodeId,
                franchiseId: franchiseId,
                franchiseName: franchiseName
            });
        } catch (e) {
            console.error('[Discovery] Failed to update identity:', e);
        }
    },

    async openFirewall(): Promise<string> {
        // Guard Check
        const { isTauri } = await import('../utils/tauriEnv');
        if (!isTauri()) {
            throw new Error("Firewall settings only available in Desktop App");
        }
        return invoke('fix_firewall_rules');
    },

    // Invite TTL — codes expire after 10 minutes to limit replay window
    INVITE_TTL_MS: 10 * 60 * 1000,

    async generateInvite(): Promise<string> {
        const { isTauri } = await import('../utils/tauriEnv');
        if (!isTauri()) {
            throw new Error('Invite codes require the Trier desktop app — P2P features are unavailable in browser mode.');
        }
        if (!P2PService.isPortAssigned) {
            throw new Error('P2P services are still starting up. Wait a moment and try again.');
        }
        const ip = await invoke<string>('get_local_ip');
        const port = P2PService.port;
        const id = P2PService.myId;
        // Embed creation timestamp so the recipient can detect stale codes
        const payload = JSON.stringify({ id, ip, port, ts: Date.now(), ttl: this.INVITE_TTL_MS });
        return btoa(payload);
    },

    redeemInvite(code: string) {
        let parsed: { id: string; ip: string; port: number; ts?: number; ttl?: number };
        try {
            parsed = JSON.parse(atob(code.trim()));
        } catch {
            throw new Error('Invalid invite code — could not decode. Make sure you copied the full code.');
        }

        const { id, ip, port, ts, ttl } = parsed;
        if (!id || !ip || !port) throw new Error('Invite code is missing required fields.');

        // Reject codes that have passed their TTL
        if (ts && ttl && Date.now() - ts > ttl) {
            throw new Error('This invite code has expired. Ask your opponent to generate a new one.');
        }

        console.log('[Discovery] Redeeming Invite:', id, ip, port);

        // Add peer to known list — user clicks Connect to initiate the handshake
        const peer: DiscoveredPeer = {
            id,
            ip,
            port,
            hostname: 'Invited Peer',
            franchiseName: 'Invited Friend',
            lastSeen: Date.now(),
            transport: 'Invite'
        };
        this.addPeer(peer);
    }
};
