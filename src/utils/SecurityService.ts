
// SecurityService.ts - Native Web Crypto Wrapper

export class SecurityService {
    private static SALT = new TextEncoder().encode("TRIER_FANTASY_V1_SALT"); // Static salt for simplicity in this context

    // Derive a key from a password
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

    // Encrypt data object to Base64 String
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

    // Decrypt Base64 String to data object
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
