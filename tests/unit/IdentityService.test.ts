/**
 * IdentityService Unit Tests
 * ==========================
 * Tests the ECDSA P-256 cryptographic operations using Node's built-in
 * WebCrypto API (available since Node 15+). These tests verify the core
 * security contract: sign → verify round-trip, and tamper detection.
 *
 * Note: Tests operate on the raw crypto operations directly (not the full
 * IdentityService which depends on localStorage and Tauri), ensuring the
 * security-critical math is correct regardless of environment.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;

// ─── Helpers (mirrors IdentityService internals) ─────────────────────────────

async function generateKeyPair(): Promise<CryptoKeyPair> {
    return subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
    ) as Promise<CryptoKeyPair>;
}

async function exportPublicKey(key: CryptoKey): Promise<string> {
    const buffer = await subtle.exportKey('spki', key);
    return Buffer.from(buffer as ArrayBuffer).toString('base64');
}

async function exportPrivateKey(key: CryptoKey): Promise<string> {
    const buffer = await subtle.exportKey('pkcs8', key);
    return Buffer.from(buffer as ArrayBuffer).toString('base64');
}

async function importPublicKey(base64: string): Promise<CryptoKey> {
    const bytes = Buffer.from(base64, 'base64');
    return subtle.importKey(
        'spki', bytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['verify']
    );
}

async function importPrivateKey(base64: string): Promise<CryptoKey> {
    const bytes = Buffer.from(base64, 'base64');
    return subtle.importKey(
        'pkcs8', bytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['sign']
    );
}

async function sign(privateKey: CryptoKey, data: string): Promise<string> {
    const encoded = new TextEncoder().encode(data);
    const sig = await subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey,
        encoded
    );
    return Buffer.from(sig as ArrayBuffer).toString('base64');
}

async function verify(publicKey: CryptoKey, data: string, sigBase64: string): Promise<boolean> {
    const encoded = new TextEncoder().encode(data);
    const sig = Buffer.from(sigBase64, 'base64');
    return subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        sig,
        encoded
    );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('IdentityService — Key Generation', () => {
    it('generates a P-256 keypair with sign and verify usages', async () => {
        const kp = await generateKeyPair();
        assert.ok(kp.publicKey, 'should have a public key');
        assert.ok(kp.privateKey, 'should have a private key');
        assert.equal(kp.publicKey.algorithm.name, 'ECDSA');
        assert.equal((kp.publicKey.algorithm as EcKeyAlgorithm).namedCurve, 'P-256');
    });

    it('exports public key as non-empty base64 SPKI string', async () => {
        const kp = await generateKeyPair();
        const pub = await exportPublicKey(kp.publicKey);
        assert.ok(pub.length > 50, 'base64 public key should be at least 50 chars');
        assert.ok(!pub.includes(' '), 'base64 should not contain spaces');
    });

    it('exports private key as non-empty base64 PKCS8 string', async () => {
        const kp = await generateKeyPair();
        const priv = await exportPrivateKey(kp.privateKey);
        assert.ok(priv.length > 50, 'base64 private key should be at least 50 chars');
    });

    it('two generated keypairs produce different public keys', async () => {
        const kp1 = await generateKeyPair();
        const kp2 = await generateKeyPair();
        const pub1 = await exportPublicKey(kp1.publicKey);
        const pub2 = await exportPublicKey(kp2.publicKey);
        assert.notEqual(pub1, pub2, 'keypairs should be unique');
    });
});

describe('IdentityService — Key Import Round-trip', () => {
    it('exports and re-imports a public key faithfully', async () => {
        const kp = await generateKeyPair();
        const pub64 = await exportPublicKey(kp.publicKey);
        const reimported = await importPublicKey(pub64);
        assert.equal(reimported.type, 'public');
        assert.equal(reimported.algorithm.name, 'ECDSA');
    });

    it('exports and re-imports a private key faithfully', async () => {
        const kp = await generateKeyPair();
        const priv64 = await exportPrivateKey(kp.privateKey);
        const reimported = await importPrivateKey(priv64);
        assert.equal(reimported.type, 'private');
        assert.equal(reimported.algorithm.name, 'ECDSA');
    });
});

describe('IdentityService — Sign / Verify', () => {
    it('valid signature verifies correctly', async () => {
        const kp = await generateKeyPair();
        const message = 'hello-nonce-12345';
        const sig = await sign(kp.privateKey, message);
        const valid = await verify(kp.publicKey, message, sig);
        assert.ok(valid, 'valid signature should verify as true');
    });

    it('signature differs on every sign call (non-deterministic ECDSA)', async () => {
        const kp = await generateKeyPair();
        const message = 'same-message';
        const sig1 = await sign(kp.privateKey, message);
        const sig2 = await sign(kp.privateKey, message);
        // ECDSA with random k produces different signatures for same input
        assert.notEqual(sig1, sig2, 'ECDSA signatures should be non-deterministic');
    });

    it('tampered payload fails verification', async () => {
        const kp = await generateKeyPair();
        const original = 'nonce:abc123';
        const sig = await sign(kp.privateKey, original);
        const valid = await verify(kp.publicKey, 'nonce:TAMPERED', sig);
        assert.ok(!valid, 'tampered payload should fail verification');
    });

    it('wrong public key fails verification', async () => {
        const kp1 = await generateKeyPair();
        const kp2 = await generateKeyPair();
        const message = 'test-handshake';
        const sig = await sign(kp1.privateKey, message);
        // Verify kp1's signature with kp2's public key — should fail
        const valid = await verify(kp2.publicKey, message, sig);
        assert.ok(!valid, 'wrong public key should fail verification');
    });

    it('truncated signature fails verification', async () => {
        const kp = await generateKeyPair();
        const message = 'test-handshake';
        const sig = await sign(kp.privateKey, message);
        const truncated = sig.slice(0, sig.length - 10);
        let failed = false;
        try {
            const valid = await verify(kp.publicKey, message, truncated);
            if (!valid) failed = true;
        } catch {
            failed = true; // crypto.subtle throws on malformed signature bytes
        }
        assert.ok(failed, 'truncated signature should fail');
    });

    it('verifies correctly after export/import round-trip', async () => {
        const kp = await generateKeyPair();
        const message = 'round-trip-test';

        // Sign with original private key
        const sig = await sign(kp.privateKey, message);

        // Export and re-import the public key (simulates receiving it over the wire)
        const pub64 = await exportPublicKey(kp.publicKey);
        const reimportedPub = await importPublicKey(pub64);

        const valid = await verify(reimportedPub, message, sig);
        assert.ok(valid, 'should verify after public key export/import round-trip');
    });
});

describe('IdentityService — Password Hashing', () => {
    // Test the SHA-256 password hash logic used in hashPassword()

    async function hashPassword(plaintext: string): Promise<string> {
        const encoded = new TextEncoder().encode(plaintext);
        const buffer = await subtle.digest('SHA-256', encoded);
        const hex = Array.from(new Uint8Array(buffer as ArrayBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        return `sha256:${hex}`;
    }

    it('produces a sha256: prefixed hash', async () => {
        const h = await hashPassword('mypassword');
        assert.ok(h.startsWith('sha256:'), 'hash should start with sha256:');
    });

    it('same password produces same hash', async () => {
        const h1 = await hashPassword('password123');
        const h2 = await hashPassword('password123');
        assert.equal(h1, h2);
    });

    it('different passwords produce different hashes', async () => {
        const h1 = await hashPassword('correct-horse');
        const h2 = await hashPassword('battery-staple');
        assert.notEqual(h1, h2);
    });

    it('hash is 64 hex chars (256 bits) after the prefix', async () => {
        const h = await hashPassword('test');
        const hex = h.replace('sha256:', '');
        assert.equal(hex.length, 64);
    });
});
