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
const STORAGE_KEY_KEYS     = 'trier_coach_keys';

// ─── Crypto constants ────────────────────────────────────────────────────────

// Iterations used for all PBKDF2 derivations — NIST recommends ≥ 600,000 for
// interactive logins, but 100,000 is the practical floor for in-browser PBKDF2.
const PBKDF2_ITERATIONS = 100_000;

// Application-level wrapping secret baked into the binary.
// Combined with a per-install random salt via PBKDF2 → AES-GCM wrapping key.
// Protects the ECDSA private key from casual localStorage dumps / XSS reads.
// NOT a substitute for OS keychain, but raises the extraction cost significantly.
const APP_KEY_WRAP_SECRET = 'TrierFantasy-2026-KeyProtection-v1';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────


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

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Crypto Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Derives an AES-GCM 256-bit wrapping key from APP_KEY_WRAP_SECRET + a
     * per-install random salt. The resulting key is used to wrap/unwrap the
     * ECDSA private key so it is never stored as raw bytes in localStorage.
     */
    async _deriveWrappingKey(salt: Uint8Array): Promise<CryptoKey> {
        // Import the app secret as raw PBKDF2 key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(APP_KEY_WRAP_SECRET),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        // Derive AES-GCM key — wrapKey/unwrapKey usage so it can wrap CryptoKeys directly
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt as Uint8Array<ArrayBuffer>, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['wrapKey', 'unwrapKey']
        );
    },

    /**
     * Encrypts an arbitrary plaintext string with AES-GCM using a key derived
     * from APP_KEY_WRAP_SECRET + a fresh random salt. Returns a self-contained
     * encoded string: "enc1:<saltB64>:<ivB64>:<ciphertextB64>".
     *
     * Used for YouTube API key, TURN credentials, and any other secrets stored
     * in localStorage that are not CryptoKeys.
     */
    async encryptSecret(plaintext: string): Promise<string> {
        if (!crypto?.subtle) throw new Error('[Identity] crypto.subtle required for secret encryption');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv   = crypto.getRandomValues(new Uint8Array(12));
        // Derive an encrypt/decrypt key (different usage than wrapKey)
        const keyMaterial = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(APP_KEY_WRAP_SECRET), 'PBKDF2', false, ['deriveKey']
        );
        const aesKey = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            new TextEncoder().encode(plaintext)
        );
        // Pack salt + iv + ciphertext into a single versioned string
        const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
        return `enc1:${b64(salt.buffer)}:${b64(iv.buffer)}:${b64(ciphertext)}`;
    },

    /**
     * Decrypts a string produced by encryptSecret(). Returns null if the input
     * is not in the expected "enc1:" format (treats it as already-plaintext for
     * migration compatibility — callers should re-encrypt on read).
     */
    async decryptSecret(encoded: string): Promise<string | null> {
        if (!crypto?.subtle) return null;
        // Not our format — caller should treat as plaintext and re-encrypt
        if (!encoded.startsWith('enc1:')) return null;
        try {
            const parts = encoded.split(':');
            if (parts.length !== 4) return null;
            const [, saltB64, ivB64, ciphertextB64] = parts;
            const b64dec = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
            const salt       = b64dec(saltB64);
            const iv         = b64dec(ivB64);
            const ciphertext = b64dec(ciphertextB64);
            const keyMaterial = await crypto.subtle.importKey(
                'raw', new TextEncoder().encode(APP_KEY_WRAP_SECRET), 'PBKDF2', false, ['deriveKey']
            );
            const aesKey = await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt']
            );
            const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
            return new TextDecoder().decode(plain);
        } catch (e) {
            console.error('[Identity] decryptSecret failed:', e);
            return null;
        }
    },

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
                const parsed = JSON.parse(stored);
                const pubKeyBytes = Uint8Array.from(atob(parsed.publicKeyBase64), c => c.charCodeAt(0));
                this._publicKey = await crypto.subtle.importKey(
                    'spki', pubKeyBytes,
                    { name: 'ECDSA', namedCurve: 'P-256' },
                    true, ['verify']
                );

                if (parsed.wrappedPrivateKey) {
                    // New encrypted format: unwrap via AES-GCM wrapping key
                    const salt    = Uint8Array.from(atob(parsed.wrapSalt), c => c.charCodeAt(0));
                    const iv      = Uint8Array.from(atob(parsed.wrapIv),   c => c.charCodeAt(0));
                    const wrapped = Uint8Array.from(atob(parsed.wrappedPrivateKey), c => c.charCodeAt(0));
                    const wrappingKey = await this._deriveWrappingKey(salt);
                    this.privateKey = await crypto.subtle.unwrapKey(
                        'pkcs8', wrapped, wrappingKey,
                        { name: 'AES-GCM', iv },
                        { name: 'ECDSA', namedCurve: 'P-256' },
                        true, ['sign']
                    );
                    console.log('[Identity] Loaded encrypted ECDSA P-256 keypair.');
                } else if (parsed.privateKeyBase64) {
                    // Legacy plaintext format — import then immediately re-save encrypted
                    console.warn('[Identity] Upgrading plaintext private key to encrypted storage.');
                    const privKeyBytes = Uint8Array.from(atob(parsed.privateKeyBase64), c => c.charCodeAt(0));
                    this.privateKey = await crypto.subtle.importKey(
                        'pkcs8', privKeyBytes,
                        { name: 'ECDSA', namedCurve: 'P-256' },
                        true, ['sign']
                    );
                    // Re-save with encryption so plaintext is removed from storage
                    await this._saveKeysEncrypted(this._publicKey!, this.privateKey);
                } else {
                    throw new Error('Unrecognized key storage format');
                }
                return;
            } catch (e) {
                console.warn('[Identity] Corrupt keys found — regenerating.', e);
            }
        }

        // Generate a fresh keypair
        const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true, // extractable so we can wrap and persist
            ['sign', 'verify']
        );

        this._publicKey  = keyPair.publicKey;
        this.privateKey  = keyPair.privateKey;

        // Persist with private key AES-GCM wrapped — never stored as raw bytes
        await this._saveKeysEncrypted(this._publicKey, this.privateKey);
        console.log('[Identity] Generated and stored new encrypted ECDSA P-256 keypair.');
    },

    /**
     * Wraps the ECDSA private key with AES-GCM and persists both keys to localStorage.
     * The public key is stored as plain SPKI (safe to expose); the private key is
     * AES-GCM wrapped so it cannot be extracted as raw bytes from localStorage.
     */
    async _saveKeysEncrypted(publicKey: CryptoKey, privateKey: CryptoKey): Promise<void> {
        // Fresh random salt and IV for each save (rotation-safe)
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv   = crypto.getRandomValues(new Uint8Array(12));
        const wrappingKey = await this._deriveWrappingKey(salt);

        // wrapKey exports PKCS8 then encrypts in one atomic operation
        const wrapped = await crypto.subtle.wrapKey('pkcs8', privateKey, wrappingKey, { name: 'AES-GCM', iv });

        const b64 = (buf: ArrayBuffer | Uint8Array) =>
            btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)));

        const pubBuffer = await crypto.subtle.exportKey('spki', publicKey);

        localStorage.setItem(STORAGE_KEY_KEYS, JSON.stringify({
            publicKeyBase64:   b64(pubBuffer),
            wrappedPrivateKey: b64(wrapped),
            wrapSalt:          b64(salt),
            wrapIv:            b64(iv),
        }));
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
            } catch {
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
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Password Hashing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Hashes a plaintext password with PBKDF2-SHA256 (100k iterations, random 16-byte salt).
     * Returns a self-contained string: "pbkdf2:<saltBase64>:<hashBase64>".
     *
     * Requires crypto.subtle — throws if unavailable (no insecure plaintext fallback).
     * Existing sha256: and plain: hashes are still accepted by verifyPassword() for migration.
     */
    async hashPassword(plaintext: string): Promise<string> {
        if (!crypto?.subtle) throw new Error('[Identity] crypto.subtle required — cannot hash password in an insecure context');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const keyMaterial = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(plaintext), 'PBKDF2', false, ['deriveBits']
        );
        const hashBits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
            keyMaterial,
            256 // 32 bytes
        );
        const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
        return `pbkdf2:${b64(salt.buffer)}:${b64(hashBits)}`;
    },

    /**
     * Verifies a plaintext password against a stored hash.
     * Supports three formats (newest first):
     *   pbkdf2:<salt>:<hash>  — PBKDF2-SHA256, current format
     *   sha256:<hex>          — legacy SHA-256, auto-migrates on next save
     *   plain:<text>          — legacy HTTP dev sessions, auto-migrates on next save
     *
     * Returns false (not an error) when crypto.subtle is unavailable.
     */
    async verifyPassword(plaintext: string, stored: string): Promise<boolean> {
        if (!stored) return false;

        if (stored.startsWith('pbkdf2:')) {
            // Current format — extract salt and re-derive to compare
            if (!crypto?.subtle) return false;
            const parts = stored.split(':');
            if (parts.length !== 3) return false;
            const salt    = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
            const expected = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
            const keyMaterial = await crypto.subtle.importKey(
                'raw', new TextEncoder().encode(plaintext), 'PBKDF2', false, ['deriveBits']
            );
            const hashBits = await crypto.subtle.deriveBits(
                { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
                keyMaterial, 256
            );
            // Constant-time comparison using XOR reduction to prevent timing attacks
            const actual = new Uint8Array(hashBits);
            if (actual.length !== expected.length) return false;
            let diff = 0;
            for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
            return diff === 0;
        }

        if (stored.startsWith('sha256:')) {
            // Legacy SHA-256 — verify then caller should re-hash with PBKDF2 on next save
            if (!crypto?.subtle) return false;
            const encoded = new TextEncoder().encode(plaintext);
            const buffer  = await crypto.subtle.digest('SHA-256', encoded);
            const hex = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            return `sha256:${hex}` === stored;
        }

        if (stored.startsWith('plain:')) {
            // Legacy plaintext — only used in old HTTP dev sessions, migration path only
            return plaintext === stored.slice(6);
        }

        return false;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Key Rotation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generates a fresh ECDSA P-256 keypair, overwrites the stored one, and
     * updates the identity's public key. Use this for "lost device" recovery
     * or when a keypair may have been compromised.
     *
     * After rotation all peers must re-handshake — existing VERIFIED sessions
     * will be invalid because they hold the old public key.
     */
    async rotateKeys(): Promise<void> {
        if (!crypto?.subtle) {
            console.warn('[Identity] rotateKeys: crypto.subtle unavailable.');
            return;
        }
        console.log('[Identity] Rotating keypair...');
        // Clear stored keys so initKeys() regenerates fresh ones
        localStorage.removeItem(STORAGE_KEY_KEYS);
        this.privateKey = null;
        this._publicKey = null;

        await this.initKeys(); // re-generates and re-encrypts a fresh keypair

        // Sync the new public key into the persisted identity
        if (this.identity) {
            this.identity.publicKey = await this.getPublicKeyBase64();
            const { P2PService } = await import('./P2PService');
            if (P2PService.port === 15432) {
                localStorage.setItem(STORAGE_KEY_IDENTITY, JSON.stringify(this.identity));
            }
        }
        console.log('[Identity] Keypair rotation complete. All peers must re-handshake.');
    },
};
