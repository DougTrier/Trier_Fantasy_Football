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
 * IdentityService — Cryptographic Node Identity
 * ===============================================
 * Generates, persists, and exposes the local node's cryptographic identity.
 * Every running instance of this app has a unique keypair and a human-readable
 * node ID tied to the coach's franchise name and machine serial number.
 *
 * KEYPAIR:
 *   - Algorithm: ECDSA with P-256 curve (Web Crypto API standard)
 *   - WHY P-256 (not Ed25519): The browser's crypto.subtle does not support Ed25519.
 *     P-256 ECDSA is the only curve natively available for signing in all modern browsers.
 *   - Public key: exported as Base64 SPKI — safe to share over the wire in handshakes.
 *   - Private key: exported as Base64 PKCS8 — stored in localStorage, never leaves the device.
 *   - Keys are generated once and persist across sessions. Regenerated only if storage is corrupted.
 *
 * NODE ID FORMAT:
 *   {teamName}_{serialLast4}_{creationDate}
 *   Example: "Triers_Titans_A3F2_2026-04-15"
 *   Secondary instances (dev mode) append the port: "Triers_Titans_A3F2_2026-04-15_15433"
 *
 * SIGNING:
 *   sign(data) — signs an arbitrary string (e.g. a handshake nonce) with the private key.
 *   verifySignature(pubKey, data, sig) — verifies a peer's signature against their advertised public key.
 *
 * ⚠️  CORE ARCHITECTURE — Do not modify without opening an issue first.
 *     See CONTRIBUTING.md for the protected architecture list.
 *
 * @module IdentityService
 */

const STORAGE_KEY_IDENTITY = 'trier_coach_identity';
const STORAGE_KEY_KEYS = 'trier_coach_keys';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StoredKeys {
    publicKeyBase64: string;  // SPKI format, Base64
    privateKeyBase64: string; // PKCS8 format, Base64
}

export interface CoachIdentity {
    nodeId: string;
    publicKey: string;       // Base64-encoded SPKI — real ECDSA P-256 public key
    franchiseId?: string;
    name?: string;
    createdAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// IdentityService
// ─────────────────────────────────────────────────────────────────────────────

export const IdentityService = {

    identity: null as CoachIdentity | null,
    privateKey: null as CryptoKey | null,
    _publicKey: null as CryptoKey | null, // internal CryptoKey object
    _subtleUnavailableLogged: false,      // suppress duplicate "insecure context" warnings
    _peerUuid: null as string | null,     // stable install UUID — never changes, safe to share

    /**
     * Returns (or generates) this install's stable Peer UUID.
     * Stored in localStorage as 'trier_peer_uuid'. Unlike nodeId, this never
     * changes when the team name changes — it is purely a device identity.
     * Safe to share publicly: it carries no IP, port, or machine info.
     */
    getPeerUuid(): string {
        if (this._peerUuid) return this._peerUuid;
        const stored = localStorage.getItem('trier_peer_uuid');
        if (stored) {
            this._peerUuid = stored;
            return stored;
        }
        // crypto.randomUUID() requires a secure context in some WebView2 versions.
        // Fall back to getRandomValues() (available since Chrome 11) when randomUUID is absent.
        let uuid: string;
        if (typeof crypto?.randomUUID === 'function') {
            uuid = crypto.randomUUID();
        } else {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
            bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
            const h = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
            uuid = `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
        }
        localStorage.setItem('trier_peer_uuid', uuid);
        this._peerUuid = uuid;
        return uuid;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Key Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Loads or generates a persistent ECDSA P-256 keypair.
     * Keys are stored as Base64-encoded SPKI (public) and PKCS8 (private) in localStorage.
     * After this call, `this.privateKey` and `this._publicKey` are populated CryptoKey objects.
     */
    async initKeys(): Promise<void> {
        // crypto.subtle is only available in secure contexts (HTTPS, localhost, or Tauri).
        // When the dev server is accessed over a plain-HTTP LAN address (e.g. http://10.x.x.x),
        // crypto.subtle is undefined and key generation must be skipped gracefully.
        // P2P and Discovery are already no-ops in browser mode, so this is safe.
        if (!crypto?.subtle) {
            if (!this._subtleUnavailableLogged) {
                console.log('[Identity] crypto.subtle unavailable (HTTP dev mode — expected). Key operations disabled.');
                this._subtleUnavailableLogged = true;
            }
            return;
        }

        const stored = localStorage.getItem(STORAGE_KEY_KEYS);
        if (stored) {
            try {
                const { publicKeyBase64, privateKeyBase64 } = JSON.parse(stored) as StoredKeys;

                const pubKeyBytes = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
                const privKeyBytes = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));

                this._publicKey = await crypto.subtle.importKey(
                    'spki', pubKeyBytes,
                    { name: 'ECDSA', namedCurve: 'P-256' },
                    true, ['verify']
                );
                this.privateKey = await crypto.subtle.importKey(
                    'pkcs8', privKeyBytes,
                    { name: 'ECDSA', namedCurve: 'P-256' },
                    true, ['sign']
                );

                console.log('[Identity] Loaded existing ECDSA P-256 keypair.');
                return;
            } catch (e) {
                console.warn('[Identity] Corrupt keys found — regenerating.', e);
            }
        }

        // Generate a fresh keypair
        const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true, // extractable so we can export for storage
            ['sign', 'verify']
        );

        this._publicKey = keyPair.publicKey;
        this.privateKey = keyPair.privateKey;

        // Export and persist
        const pubBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
        const privBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

        const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubBuffer)));
        const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privBuffer)));

        localStorage.setItem(STORAGE_KEY_KEYS, JSON.stringify({ publicKeyBase64, privateKeyBase64 }));
        console.log('[Identity] Generated and stored new ECDSA P-256 keypair.');
    },

    /**
     * Returns the local public key as a Base64-encoded SPKI string.
     * This is safe to share over the wire.
     */
    async getPublicKeyBase64(): Promise<string> {
        if (!this._publicKey || !crypto?.subtle) return 'no-key';
        const buffer = await crypto.subtle.exportKey('spki', this._publicKey);
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    },

    /**
     * Signs an arbitrary string (e.g., a nonce) with the local ECDSA P-256 private key.
     * Returns a Base64-encoded DER signature.
     */
    async sign(data: string): Promise<string> {
        if (!this.privateKey || !crypto?.subtle) return 'unsigned';
        const encoded = new TextEncoder().encode(data);
        const signature = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            this.privateKey,
            encoded
        );
        return btoa(String.fromCharCode(...new Uint8Array(signature)));
    },

    /**
     * Verifies a Base64-encoded ECDSA P-256 signature against a known public key (Base64 SPKI).
     * Used to validate that a peer owns the private key they advertised.
     */
    async verifySignature(publicKeyBase64: string, data: string, signatureBase64: string): Promise<boolean> {
        if (!crypto?.subtle) return false;
        try {
            const pubKeyBytes = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
            const pubKey = await crypto.subtle.importKey(
                'spki', pubKeyBytes,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false, ['verify']
            );
            const encoded = new TextEncoder().encode(data);
            const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
            return await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                pubKey,
                signature,
                encoded
            );
        } catch (e) {
            console.error('[Identity] Signature verification error:', e);
            return false;
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Identity Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Initializes or recovers the Coach Identity.
     * Guaranteed to return the SAME ID across restarts.
     * Always initializes the ECDSA keypair before returning.
     */
    async init(): Promise<CoachIdentity> {
        // 1. Initialize (or load) the ECDSA keypair first
        await this.initKeys();
        const realPublicKey = await this.getPublicKeyBase64();

        // 2. Try to load existing identity from storage
        const stored = localStorage.getItem(STORAGE_KEY_IDENTITY);
        if (stored) {
            try {
                this.identity = JSON.parse(stored);
                // Migrate: update stored public key if it was a mock placeholder
                if (this.identity!.publicKey?.startsWith('mock-pub-key-') || !this.identity!.publicKey) {
                    console.log('[Identity] Migrating mock public key to real ECDSA key.');
                    this.identity!.publicKey = realPublicKey;
                    localStorage.setItem(STORAGE_KEY_IDENTITY, JSON.stringify(this.identity));
                }
                console.log('[Identity] Loaded existing identity:', this.identity?.nodeId);
                return this.identity!;
            } catch (e) {
                console.warn('[Identity] Corrupt identity found. Regenerating.');
            }
        }

        // 3. Generate a new identity
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
            publicKey: realPublicKey, // Real ECDSA P-256 key, not a placeholder
            createdAt: ntpTimestamp
        };

        // 4. Persist ONLY if primary instance (port 15432)
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
     * Keeps the public key synchronized.
     */
    async updateNodeId(teamName: string, port?: number): Promise<string> {
        if (!this.identity) await this.init();

        // 1. Get Serial from Rust
        let serial = '0000';
        try {
            const { invoke } = await import('@tauri-apps/api/tauri');
            const fullSerial = await invoke<string>('get_system_serial');
            if (fullSerial && fullSerial !== '0000') {
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

        // 4. Dev mode isolation: append port for secondary instances
        if (port && port !== 15432) {
            newNodeId = `${newNodeId}_${port}`;
        }

        if (this.identity!.nodeId !== newNodeId) {
            console.log('[Identity] Updating Node ID to:', newNodeId);
            this.identity!.nodeId = newNodeId;

            // Keep public key in sync
            this.identity!.publicKey = await this.getPublicKeyBase64();

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
     * Generates a robust random Node ID (used before team name is available).
     */
    async generateNodeId(): Promise<string> {
        const array = new Uint32Array(4);
        window.crypto.getRandomValues(array);
        const hex = Array.from(array).map(n => n.toString(16).padStart(8, '0')).join('');
        return `coach_${Date.now().toString(36)}_${hex}`;
    },

    get(): CoachIdentity {
        if (!this.identity) throw new Error('[Identity] Not initialized. Call init() first.');
        return this.identity;
    }
};
