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
 * SyncService — Sideband State Synchronization
 * ==============================================
 * Keeps league state consistent across two surfaces simultaneously:
 *   1. Local browser tabs (via BroadcastChannel — same machine, different windows)
 *   2. LAN peers (via P2PService WebRTC data channel)
 *
 * WHY SIDEBAND (not EventStore) FOR FULL SYNC:
 *   SYNC_TEAMS is a full-state snapshot, not a granular event. It handles the
 *   initial state handshake when a new peer connects (VERIFIED). Granular mutations
 *   (e.g. ROSTER_MOVE) are routed through EventStore instead.
 *   These two channels are complementary — sideband for bulk init, EventStore for deltas.
 *
 * NOTE: The P2PService.onData hook in this constructor only processes SYNC_TEAMS
 * and PING messages. All EVENT messages bypass this service entirely and go
 * directly to App.tsx → applyRosterMoveEvent().
 *
 * @module SyncService
 */
import type { FantasyTeam } from '../types';

const SYNC_CHANNEL = 'trier_fantasy_sideband';

export interface SidebandMessage {
    type: 'PING' | 'PONG' | 'SYNC_TEAMS' | 'CHAT';
    senderId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any;
    timestamp: number;
}

export interface ChatPayload {
    sender: string; // team/owner display name
    text: string;
}

import { P2PService } from '../services/P2PService';

class SidebandSyncService {
    private channel: BroadcastChannel;
    private instanceId: string;
    private onMessageListeners: ((msg: SidebandMessage) => void)[] = [];

    constructor() {
        this.instanceId = `inst-${Math.random().toString(36).substring(2, 9)}`;
        this.channel = new BroadcastChannel(SYNC_CHANNEL);

        // Local Tab Sync
        this.channel.onmessage = (event) => {
            const msg = event.data as SidebandMessage;
            if (msg.senderId !== this.instanceId) {
                this.onMessageListeners.forEach(l => l(msg));
            }
        };

        // P2P Network Sync (Incoming)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        P2PService.onData((msg: any) => {
            // Treat P2P messages same as local tab messages
            const sMsg = msg as SidebandMessage;
            if (sMsg.senderId !== this.instanceId && (sMsg.type === 'SYNC_TEAMS' || sMsg.type === 'PING')) {
                console.log('[Sync] Received P2P update from', sMsg.senderId);
                this.onMessageListeners.forEach(l => l(sMsg));
            }
        });
    }

    public ping() {
        this.sendMessage({ type: 'PING', senderId: this.instanceId, timestamp: Date.now() });
    }

    public pong() {
        this.sendMessage({ type: 'PONG', senderId: this.instanceId, timestamp: Date.now() });
    }

    public syncTeams(teams: FantasyTeam[]) {
        this.sendMessage({
            type: 'SYNC_TEAMS',
            senderId: this.instanceId,
            payload: teams,
            timestamp: Date.now()
        });
    }

    public addListener(listener: (msg: SidebandMessage) => void) {
        this.onMessageListeners.push(listener);
    }

    public removeListener(listener: (msg: SidebandMessage) => void) {
        this.onMessageListeners = this.onMessageListeners.filter(l => l !== listener);
    }

    private sendMessage(msg: SidebandMessage) {
        // 1. Broadcast to Local Tabs
        this.channel.postMessage(msg);
        // 2. Broadcast to P2P Network
        P2PService.broadcast(msg);
    }

    public sendChat(sender: string, text: string) {
        this.sendMessage({
            type: 'CHAT',
            senderId: this.instanceId,
            payload: { sender, text } as ChatPayload,
            timestamp: Date.now()
        });
    }

    public getInstanceId() {
        return this.instanceId;
    }
}

export const SyncService = new SidebandSyncService();

