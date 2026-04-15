/**
 * SecurityService — AES-GCM Encryption Wrapper
 * ==============================================
 * Uses the native Web Crypto API (SubtleCrypto) so no external crypto
 * library is required and private keys never leave the browser.
 *
 * Algorithm: PBKDF2(SHA-256, 100k iterations) → AES-GCM-256.
 * The 12-byte IV is generated fresh per encrypt call and prepended to the
 * ciphertext so the combined Base64 blob is self-contained.
 *
 * SECURITY NOTE: The static SALT is intentional — this protects against
 * casual clipboard edits ("security through friction"), not adversarial
 * brute-force. User-supplied passwords add the real entropy.
 */

// SecurityService.ts - Native Web Crypto Wrapper

export class SecurityService {
    // Static salt — acceptable here because the goal is tamper-resistance,
    // not cryptographic hardening against offline dictionary attacks.
    private static SALT = new TextEncoder().encode("TRIER_FANTASY_V1_SALT");

    /** Derives a 256-bit AES-GCM key from a plaintext password via PBKDF2. */
    private static async getKey(password: string): Promise<CryptoKey> {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: this.SALT,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    /**
     * Serialises `data` to JSON and encrypts it to a Base64 string.
     * Falls back to a well-known default key when no password is given —
     * this at least prevents casual plaintext editing of exported files.
     */
    static async encrypt(data: any, password?: string): Promise<string> {
        try {
            // Use a default system password if none provided, to at least prevent Notepad edits
            const pass = password || "TRIER_DEFAULT_SYSTEM_KEY_99";
            const key = await this.getKey(pass);
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encodedData = new TextEncoder().encode(JSON.stringify(data));

            const encrypted = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encodedData
            );

            // Combine IV + Encrypted Data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            // Convert to Base64
            return btoa(String.fromCharCode(...combined));
        } catch (e) {
            console.error("Encryption failed", e);
            throw new Error("Failed to encrypt team data.");
        }
    }

    /**
     * Decrypts a Base64 string produced by encrypt() back to the original object.
     * Throws "Invalid password or corrupted file integrity." on auth tag failure,
     * which the caller (SettingsPage) uses to prompt for a retry.
     */
    static async decrypt(base64Str: string, password?: string): Promise<any> {
        try {
            const pass = password || "TRIER_DEFAULT_SYSTEM_KEY_99";
            const key = await this.getKey(pass);

            const str = atob(base64Str);
            const combined = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) combined[i] = str.charCodeAt(i);

            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encryptedData
            );

            const decodedStr = new TextDecoder().decode(decrypted);
            return JSON.parse(decodedStr);
        } catch (e) {
            console.error("Decryption failed", e);
            throw new Error("Invalid password or corrupted file integrity.");
        }
    }
}
