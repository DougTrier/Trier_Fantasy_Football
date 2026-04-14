import type { FantasyTeam } from '../types';

const SYNC_CHANNEL = 'trier_fantasy_sideband';

export interface SidebandMessage {
    type: 'PING' | 'PONG' | 'SYNC_TEAMS';
    senderId: string;
    payload?: any;
    timestamp: number;
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

    public getInstanceId() {
        return this.instanceId;
    }
}

export const SyncService = new SidebandSyncService();

