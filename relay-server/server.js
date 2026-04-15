/**
 * Trier Fantasy Football — Global P2P Relay Server
 * =================================================
 * A lightweight WebSocket signaling relay. Its ONLY job is to help two peers
 * find each other and exchange WebRTC offer/answer/candidate messages.
 *
 * Once the WebRTC connection opens, this server is completely out of the picture.
 * It never sees game data — only signaling payloads (a few hundred bytes each).
 *
 * PROTOCOL (all messages are JSON):
 *
 *   Client → Server:
 *     REGISTER   { nodeId, franchiseName, leagueName, region }
 *     SIGNAL     { to: nodeId, payload: SignalPayload }
 *     LIST       {}                          — request lobby list
 *     PING       {}
 *     LEAVE      {}
 *
 *   Server → Client:
 *     WELCOME    { totalOnline }
 *     LOBBIES    { lobbies: LobbyInfo[] }
 *     SIGNAL     { from: nodeId, payload: SignalPayload }
 *     PEER_JOINED { nodeId, franchiseName, leagueName, region }
 *     PEER_LEFT  { nodeId }
 *     PONG       {}
 *     ERROR      { message }
 *
 * DEPLOY:
 *   Railway: connect repo, set root to /relay-server, start command: node server.js
 *   Render:  same — add env var PORT if needed (defaults to 3001)
 *   Local:   node server.js
 */

const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3001;

// ─── In-memory peer registry ──────────────────────────────────────────────────
// Map<nodeId, PeerRecord>
const peers = new Map();

function makePeerRecord(ws, data) {
    return {
        ws,
        nodeId: data.nodeId,
        franchiseName: data.franchiseName || 'Unknown Coach',
        leagueName: data.leagueName || 'Open League',
        region: data.region || 'Global',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(ws, msg) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

function broadcast(msg, excludeNodeId = null) {
    for (const [nodeId, peer] of peers) {
        if (nodeId !== excludeNodeId) {
            send(peer.ws, msg);
        }
    }
}

function getLobbyList() {
    const byLeague = new Map();
    for (const peer of peers.values()) {
        const key = peer.leagueName;
        if (!byLeague.has(key)) {
            byLeague.set(key, {
                leagueName: peer.leagueName,
                region: peer.region,
                peers: []
            });
        }
        byLeague.get(key).peers.push({
            nodeId: peer.nodeId,
            franchiseName: peer.franchiseName,
            connectedAt: peer.connectedAt,
        });
    }
    return Array.from(byLeague.values());
}

// ─── HTTP health check (so Railway/Render know the server is alive) ───────────
const httpServer = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', peers: peers.size, uptime: process.uptime() }));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Trier Fantasy Football Relay Server');
    }
});

// ─── WebSocket server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
    const remoteIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[Relay] New connection from ${remoteIp}`);

    let nodeId = null; // set on REGISTER

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            send(ws, { type: 'ERROR', message: 'Invalid JSON' });
            return;
        }

        switch (msg.type) {

            // ── REGISTER ────────────────────────────────────────────────────
            case 'REGISTER': {
                if (!msg.nodeId) {
                    send(ws, { type: 'ERROR', message: 'nodeId required' });
                    return;
                }

                // If this nodeId is already registered (reconnect), evict old entry
                if (peers.has(msg.nodeId)) {
                    const old = peers.get(msg.nodeId);
                    try { old.ws.terminate(); } catch {}
                }

                nodeId = msg.nodeId;
                const peer = makePeerRecord(ws, msg);
                peers.set(nodeId, peer);

                console.log(`[Relay] + REGISTERED: ${nodeId} (${peer.franchiseName}) league="${peer.leagueName}"`);

                send(ws, { type: 'WELCOME', totalOnline: peers.size });

                // Notify all other peers
                broadcast({
                    type: 'PEER_JOINED',
                    nodeId: peer.nodeId,
                    franchiseName: peer.franchiseName,
                    leagueName: peer.leagueName,
                    region: peer.region,
                }, nodeId);

                break;
            }

            // ── LIST ─────────────────────────────────────────────────────────
            case 'LIST': {
                send(ws, { type: 'LOBBIES', lobbies: getLobbyList() });
                break;
            }

            // ── SIGNAL ───────────────────────────────────────────────────────
            case 'SIGNAL': {
                if (!nodeId) {
                    send(ws, { type: 'ERROR', message: 'Must REGISTER before sending signals' });
                    return;
                }
                if (!msg.to || !msg.payload) {
                    send(ws, { type: 'ERROR', message: 'SIGNAL requires "to" and "payload"' });
                    return;
                }

                const target = peers.get(msg.to);
                if (!target) {
                    send(ws, { type: 'ERROR', message: `Peer "${msg.to}" not found on relay` });
                    return;
                }

                console.log(`[Relay] ⇄ SIGNAL ${nodeId} → ${msg.to} (${msg.payload?.type_})`);
                send(target.ws, {
                    type: 'SIGNAL',
                    from: nodeId,
                    payload: msg.payload,
                });
                break;
            }

            // ── PING ──────────────────────────────────────────────────────────
            case 'PING': {
                if (nodeId && peers.has(nodeId)) {
                    peers.get(nodeId).lastSeen = Date.now();
                }
                send(ws, { type: 'PONG' });
                break;
            }

            // ── LEAVE ─────────────────────────────────────────────────────────
            case 'LEAVE': {
                ws.close();
                break;
            }

            default:
                send(ws, { type: 'ERROR', message: `Unknown message type: ${msg.type}` });
        }
    });

    ws.on('close', () => {
        if (nodeId && peers.has(nodeId)) {
            peers.delete(nodeId);
            console.log(`[Relay] - DISCONNECTED: ${nodeId}. Online: ${peers.size}`);
            broadcast({ type: 'PEER_LEFT', nodeId });
        }
    });

    ws.on('error', (err) => {
        console.error(`[Relay] WebSocket error (${nodeId || 'unregistered'}):`, err.message);
    });
});

// ─── Stale peer cleanup (every 60s) ──────────────────────────────────────────
setInterval(() => {
    const cutoff = Date.now() - 90_000; // 90 seconds without a ping = stale
    for (const [id, peer] of peers) {
        if (peer.lastSeen < cutoff) {
            console.log(`[Relay] Evicting stale peer: ${id}`);
            try { peer.ws.terminate(); } catch {}
            peers.delete(id);
            broadcast({ type: 'PEER_LEFT', nodeId: id });
        }
    }
}, 60_000);

httpServer.listen(PORT, () => {
    console.log(`[Relay] Trier Fantasy Football relay running on port ${PORT}`);
    console.log(`[Relay] Health check: http://localhost:${PORT}/health`);
});
