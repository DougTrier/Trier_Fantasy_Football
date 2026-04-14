# ADR 001: P2P Sync & Invite System

**Status:** DRAFT (Revision 7)
**Date:** 2026-02-01
**Author:** Builder Agent

## 1. Goal
P2P Sync for < 10 peers.

## 2. Architecture
- **Identity:** `Ed25519` (Rust Keyring).
- **Transport:** Full Mesh WebRTC (Max 10).
- **Sync:** Event Sourced (LWW).

## 3. Implementation Plan Reference
Full rollout details are strictly defined in `docs/networking/plan.md`.

### 3.1 Security (PR4, PR7)
- **CSP:** Strict.
- **Keys:** Protected by OS or App Password.

### 3.2 Scalability (PR4)
- Limited to 10 peers. V2 uses SFU.

### 3.3 Conflict & Offline (PR5)
- **Offline:** Queue -> Replay.
- **Conflict:** Last-Write-Wins.

## 4. Testing Strategy (PR7)
- **Security:** CSP & Key Extraction tests.
- **Stress:** 10-peer simulation.
