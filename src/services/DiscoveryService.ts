
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
        const identity = await IdentityService.init();

        console.log('[Discovery] Initializing with ID:', identity.nodeId);

        // Check environment
        const { isTauri } = await import('../utils/tauriEnv');
        if (!isTauri()) {
            console.log('[Discovery] Browser mode detected. P2P discovery disabled.');
            return;
        }

        // 1. Listen for Peers from Rust
        try {
            await listen('PEER_DISCOVERED', (event) => {
                const peerRaw = event.payload as any;
                // Validate
                if (!peerRaw.id || !peerRaw.ip) return;

                const peer: DiscoveredPeer = {
                    id: peerRaw.id,
                    ip: peerRaw.ip,
                    port: peerRaw.port,
                    hostname: peerRaw.hostname,
                    franchiseId: peerRaw.franchise_id,
                    franchiseName: peerRaw.franchise_name,
                    transport: peerRaw.transport,
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
            // @ts-ignore - accessing internal property for simpler implementation matching P2PService structure
            P2PService.portAssignmentListeners.forEach((l: any) => l(allocatedPort));

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

    notifyTimer: null as any,
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

    async generateInvite(): Promise<string> {
        const ip = await invoke<string>('get_local_ip');
        const port = P2PService.port;
        const id = P2PService.myId;
        const payload = JSON.stringify({ id, ip, port });
        return btoa(payload);
    },

    redeemInvite(code: string) {
        try {
            const json = atob(code);
            const { id, ip, port } = JSON.parse(json);
            if (!id || !ip || !port) throw new Error("Invalid Invite Code");

            console.log('[Discovery] Redeeming Invite:', id, ip, port);

            // Add to peers manually
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

            // Auto Connect? Let's just add it to list and let user click Connect.
            // Or maybe auto-connect? The prompt says "Generate/Paste". Usually implies connection.
            // But strict manual connection is safer.
            // I'll leave it as "Add to List".
        } catch (e) {
            console.error("Invalid Invite Code", e);
            throw e;
        }
    }
};
