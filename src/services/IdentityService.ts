


const STORAGE_KEY_IDENTITY = 'trier_coach_identity';

export interface CoachIdentity {
    nodeId: string;
    publicKey: string;
    franchiseId?: string; // Phase 9/10
    name?: string;        // Phase 9/10
    createdAt: number;
}

export const IdentityService = {

    identity: null as CoachIdentity | null,

    /**
     * Initializes or recovers the Coach Identity.
     * Guaranteed to return the SAME ID across restarts.
     */
    async init(): Promise<CoachIdentity> {
        // 1. Try Load from Storage
        const stored = localStorage.getItem(STORAGE_KEY_IDENTITY);
        if (stored) {
            try {
                this.identity = JSON.parse(stored);
                console.log('[Identity] Loaded existing identity:', this.identity?.nodeId);
                return this.identity!;
            } catch (e) {
                console.warn('[Identity] Corrupt identity found. Regenerating.');
            }
        }

        // 2. Generate New
        // Fetch NTP Time from Rust Backend
        let ntpTimestamp = Date.now();
        try {
            const { invoke } = await import('@tauri-apps/api/tauri');
            const unixSecs = await invoke<number>('get_ntp_time');
            ntpTimestamp = unixSecs * 1000;
            console.log('[Identity] Syncing with NTP Time:', new Date(ntpTimestamp).toISOString());
        } catch (e) {
            console.warn('[Identity] NTP Sync failed, falling back to local clock', e);
        }

        const newId = await this.generateNodeId();
        this.identity = {
            nodeId: newId,
            publicKey: 'mock-pub-key-' + newId, // Placeholder for Phase 3
            createdAt: ntpTimestamp
        };

        // 3. Persist ONLY if primary
        // Note: During init(), port might not be known yet. 
        // We look at the existing P2PService.port (defaults to 15432).
        const currentPort = (await import('./P2PService')).P2PService.port;
        if (currentPort === 15432) {
            localStorage.setItem(STORAGE_KEY_IDENTITY, JSON.stringify(this.identity));
            console.log('[Identity] Generated NEW PRIMARY identity:', this.identity.nodeId);
        } else {
            console.log('[Identity] Generated NEW SECONDARY identity (Memory only):', this.identity.nodeId);
        }

        return this.identity;
    },

    /**
     * Updates the Node ID based on team name, serial tag, and current date.
     * @param teamName The current team name
     * @param port The current P2P signaling port (used to isolate local instances)
     */
    async updateNodeId(teamName: string, port?: number): Promise<string> {
        if (!this.identity) await this.init();

        // 1. Get Serial from Rust
        let serial = '0000';
        try {
            const { invoke } = await import('@tauri-apps/api/tauri');
            const fullSerial = await invoke<string>('get_system_serial');
            if (fullSerial && fullSerial !== '0000') {
                // Take last 4 of serial if it's long, or use as is
                serial = fullSerial.length >= 4 ? fullSerial.slice(-4) : fullSerial.padStart(4, '0');
            }
        } catch (e) {
            console.warn('[Identity] Failed to fetch system serial', e);
        }

        // 2. Format Date (YYYY-MM-DD from identity creation)
        const date = new Date(this.identity!.createdAt).toISOString().split('T')[0];

        // 3. Construct ID
        const cleanTeamName = teamName.replace(/[^a-zA-Z0-9]/g, '_');
        let newNodeId = `${cleanTeamName}_${serial}_${date}`;

        // 4. Isolation Logic: If custom port (dev mode), append port to ensure peer discovery works locally
        if (port && port !== 15432) {
            newNodeId = `${newNodeId}_${port}`;
        }

        if (this.identity!.nodeId !== newNodeId) {
            console.log('[Identity] Updating Node ID to:', newNodeId);
            this.identity!.nodeId = newNodeId;

            // CRITICAL FIX: Only persist to localStorage if this is the PRIMARY instance (port 15432).
            // This prevents Instance 2 from overwriting Instance 1's ID in the shared local storage.
            if (!port || port === 15432) {
                console.log('[Identity] Persisting primary identity to localStorage');
                localStorage.setItem(STORAGE_KEY_IDENTITY, JSON.stringify(this.identity));
            } else {
                console.log('[Identity] Secondary instance ID kept in-memory only:', newNodeId);
            }
        }

        return newNodeId;
    },

    /**
     * Generates a robust random Node ID (Legacy Fallback).
     */
    async generateNodeId(): Promise<string> {
        // In a real crypto implementation, this would be a public key hash.
        // For now, robust unique string is sufficient.
        const array = new Uint32Array(4);
        window.crypto.getRandomValues(array);
        const hex = Array.from(array).map(n => n.toString(16).padStart(8, '0')).join('');
        return `coach_${Date.now().toString(36)}_${hex}`;
    },

    get(): CoachIdentity {
        if (!this.identity) throw new Error("Identity not initialized. Call init() first.");
        return this.identity;
    }
};
