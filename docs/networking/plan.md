# Implementation Plan: P2P Sync & Invite System

**Status:** DRAFT (Phase 2)
**Date:** 2026-02-01
**Architecture:** [ADR-001](./adr-001-p2p-sync.md)

This plan breaks down the P2P Sync implementation into 7 independent, testable Pull Requests.

---

## PR 1: Protocol & Diagnostics Skeleton
**Goal:** Establish data structures and strict Types. No network changes yet.
- **Scope:**
    - `src/types/P2P.ts`: `HandshakeMsg`, `EventLogEntry`, `SyncRequest`, `PeerState`.
    - `src/services/declarations/EventStore.ts`: In-memory log + validation.
    - `src/components/diagnostics/NetworkHealth.tsx`: UI for internal state.
- **Files Touched:**
    - `src/types/P2P.ts`
    - `src/services/declarations/EventStore.ts`
    - `src/components/diagnostics/NetworkHealth.tsx`

## PR 2: LAN Discovery & Firewall Diagnostics
**Goal:** Reliable peer detection on LAN with Admin-friendly repairs.
- **Scope:**
    - Rust: Add `fix_firewall_rules` command (executes `netsh` via runas).
    - `DiscoveryService.ts`: Strict `mdns` events.
    - UI: "Fix Firewall" button.
- **Files Touched:**
    - `src-tauri/src/main.rs`.
    - `src/services/DiscoveryService.ts`.

## PR 3: Invite Code Flow (Identity V2)
**Goal:** Generate and Accept robust Invite Codes.
- **Scope:**
    - `IdentityService.ts`: Move Identity Logic to Rust (ed25519).
    - `InviteModal.tsx`: Code UI.
- **Files Touched:**
    - `src-tauri/src/identity.rs`.
    - `src/components/InviteModal.tsx`.

## PR 4: WebRTC Transport & Security
**Goal:** Secure DataChannel with NAT Traversal.
- **Scope:**
    - `P2PService.ts`: `simple-peer` integration.
    - **NAT Traversal:**
        - 1. UPnP (IGD).
        - 2. STUN (`stun.l.google.com`).
        - 3. Manual TURN configuration.
    - **Security:**
        - Key Storage: Windows Credential Manager (`keyring`).
        - CSP: Strict update in `tauri.conf.json`.
- **Files Touched:**
    - `src/services/P2PService.ts`.
    - `src-tauri/tauri.conf.json`.

## PR 5: Sync Engine
**Goal:** Exchange Events & Resolve Conflicts.
- **Scope:**
    - `SyncLogic.ts`: Vector Clocks, LWW Conflict Resolution.
    - **Offline:** Queue mutations to `IndexedDB`, replay on connect.
- **Files Touched:**
    - `src/services/SyncLogic.ts`.

## PR 6: Export/Import (Follower Profile)
**Goal:** Allow "offline" onboarding via File.
- **Scope:**
    - `BackupService.ts`: Include `SyncProfile`.
- **Files Touched:**
    - `src/services/BackupService.ts`.

## PR 7: Hardening & Stress Testing
**Goal:** Final Security & UX verification.
- **Scope:**
    - **Network Condition Tests:**
        - Simulate High Latency (Network Link Conditioner).
        - Packet Loss Simulation (DevTools).
    - **Security Tests:**
        - Key Extraction attempt.
        - CSP Violation check.
    - **Stress:** 10-peer 1000-event simulation.
- **Files Touched:**
    - `tests/security/`
    - `docs/user-guide.md`
