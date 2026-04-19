/**
 * NotificationService — Tauri Native Push Notifications
 * =======================================================
 * Central hub for all in-app system notifications. Each event type can be
 * toggled independently via user prefs stored in localStorage.
 *
 * EVENTS:
 *   trade_offer    — another manager makes an offer on your player
 *   trade_accepted — your outgoing offer was accepted
 *   trade_declined — your outgoing offer was declined
 *   peer_connect   — a peer completes the VERIFIED handshake
 *   gameday_lock   — NFL teams are locked (game in progress)
 *
 * BROWSER FALLBACK:
 *   When running outside Tauri (browser dev mode), falls back to the
 *   Web Notifications API if permission has been granted.
 */

// ── Pref keys ─────────────────────────────────────────────────────────────────

export type NotifEvent = 'trade_offer' | 'trade_accepted' | 'trade_declined' | 'peer_connect' | 'gameday_lock';

const PREFS_KEY = 'trier_notif_prefs_v1';

const DEFAULT_PREFS: Record<NotifEvent, boolean> = {
    trade_offer:    true,
    trade_accepted: true,
    trade_declined: true,
    peer_connect:   true,
    gameday_lock:   true,
};

// ── Prefs persistence ─────────────────────────────────────────────────────────

export function getNotifPrefs(): Record<NotifEvent, boolean> {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch { /* fall through */ }
    return { ...DEFAULT_PREFS };
}

export function setNotifPref(event: NotifEvent, enabled: boolean): void {
    const prefs = getNotifPrefs();
    prefs[event] = enabled;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ── Core send ─────────────────────────────────────────────────────────────────

async function send(title: string, body: string): Promise<void> {
    // Tauri path — uses native OS notification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.__TAURI__) {
        try {
            const { isPermissionGranted, requestPermission, sendNotification } =
                await import('@tauri-apps/api/notification');
            let granted = await isPermissionGranted();
            if (!granted) {
                const result = await requestPermission();
                granted = result === 'granted';
            }
            if (granted) sendNotification({ title, body });
        } catch (e) {
            console.warn('[NotificationService] Tauri notification failed:', e);
        }
        return;
    }

    // Browser fallback — Web Notifications API
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification(title, { body });
        } else if (Notification.permission !== 'denied') {
            const perm = await Notification.requestPermission();
            if (perm === 'granted') new Notification(title, { body });
        }
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const NotificationService = {
    /** A team has made an offer on one of your players. */
    tradeOfferReceived(playerName: string, fromTeam: string): void {
        if (!getNotifPrefs().trade_offer) return;
        send('💰 Trade Offer Received', `${fromTeam} wants to buy ${playerName}`);
    },

    /** Your outgoing offer was accepted by the seller. */
    tradeAccepted(playerName: string, byTeam: string): void {
        if (!getNotifPrefs().trade_accepted) return;
        send('✅ Trade Accepted', `${byTeam} accepted your offer for ${playerName}`);
    },

    /** Your outgoing offer was declined by the seller. */
    tradeDeclined(playerName: string, byTeam: string): void {
        if (!getNotifPrefs().trade_declined) return;
        send('❌ Trade Declined', `${byTeam} declined your offer for ${playerName}`);
    },

    /** A peer has completed the VERIFIED handshake. */
    peerConnected(peerId: string): void {
        if (!getNotifPrefs().peer_connect) return;
        send('🔗 Peer Connected', `${peerId} is now online and verified`);
    },

    /** A peer has disconnected. */
    peerDisconnected(peerId: string): void {
        if (!getNotifPrefs().peer_connect) return;
        send('📴 Peer Disconnected', `${peerId} has gone offline`);
    },

    /** NFL teams have been locked for an active game. */
    gamedayLock(teamCount: number): void {
        if (!getNotifPrefs().gameday_lock) return;
        send('🔒 Gameday Lock', `${teamCount} NFL team${teamCount !== 1 ? 's' : ''} locked — games are in progress`);
    },
};
