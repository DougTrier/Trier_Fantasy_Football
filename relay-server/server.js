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
const RELAY_REGION = process.env.RELAY_REGION || 'Global';
// Comma-separated wss:// URLs of other relays this one knows about (for federation)
const SIBLING_RELAYS = process.env.RELAY_PEERS
    ? process.env.RELAY_PEERS.split(',').map(s => s.trim()).filter(Boolean)
    : [];

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Per-IP sliding-window counter. Allows burst up to RATE_LIMIT_MAX messages
// within RATE_WINDOW_MS, then drops excess with an ERROR response.
const RATE_WINDOW_MS  = 60_000; // 1 minute window
const RATE_LIMIT_MAX  = 120;    // max messages per IP per window
const MAX_MSG_BYTES   = 16_384; // 16 KB hard cap per message

// Map<ip, { count: number, windowStart: number }>
const rateLimitMap = new Map();

/**
 * Returns true if the IP is within rate limits and increments its counter.
 * Resets the window automatically when it expires.
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
        // Start a fresh window
        rateLimitMap.set(ip, { count: 1, windowStart: now });
        return true;
    }
    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX) {
        console.warn(`[Relay] Rate limit exceeded for ${ip} (${entry.count} msgs/min)`);
        return false;
    }
    return true;
}

// Periodically purge stale rate-limit entries to prevent memory growth
setInterval(() => {
    const cutoff = Date.now() - RATE_WINDOW_MS * 2;
    for (const [ip, entry] of rateLimitMap) {
        if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
    }
}, RATE_WINDOW_MS);

// ─── In-memory peer registry ──────────────────────────────────────────────────
// Map<nodeId, PeerRecord>
const peers = new Map();

// Tracks which socket owns each registered nodeId (prevents hijacking).
// Map<nodeId, WebSocket>
const nodeOwners = new Map();

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

// ─── HTTP server (health + federation discovery endpoints) ────────────────────
const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', peers: peers.size, region: RELAY_REGION, uptime: process.uptime() }));
    } else if (req.url === '/relays') {
        // Federation: return known sibling relays so clients can discover the network
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ region: RELAY_REGION, siblings: SIBLING_RELAYS }));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Trier Fantasy Football Relay Server');
    }
});

// ─── WebSocket server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
    // Prefer X-Forwarded-For when running behind Railway/Render reverse proxy
    const remoteIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
        .toString().split(',')[0].trim();
    console.log(`[Relay] New connection from ${remoteIp}`);

    let nodeId = null; // set on REGISTER

    ws.on('message', (rawBuf) => {
        // Enforce hard message size cap to prevent memory exhaustion
        if (rawBuf.length > MAX_MSG_BYTES) {
            send(ws, { type: 'ERROR', message: 'Message too large' });
            return;
        }

        // Per-IP rate limiting — drop excess messages silently after warning
        if (!checkRateLimit(remoteIp)) {
            send(ws, { type: 'ERROR', message: 'Rate limit exceeded — slow down' });
            return;
        }

        let msg;
        try {
            msg = JSON.parse(rawBuf.toString());
        } catch {
            send(ws, { type: 'ERROR', message: 'Invalid JSON' });
            return;
        }

        switch (msg.type) {

            // ── REGISTER ────────────────────────────────────────────────────
            case 'REGISTER': {
                if (!msg.nodeId || typeof msg.nodeId !== 'string') {
                    send(ws, { type: 'ERROR', message: 'nodeId required' });
                    return;
                }

                // Enforce nodeId format: printable ASCII, max 128 chars, no whitespace
                if (!/^[\x21-\x7E]{1,128}$/.test(msg.nodeId)) {
                    send(ws, { type: 'ERROR', message: 'nodeId format invalid' });
                    return;
                }

                // If this nodeId is already claimed by a DIFFERENT socket, reject the hijack.
                // Same socket re-registering (reconnect race) is allowed and evicts the old record.
                if (nodeOwners.has(msg.nodeId) && nodeOwners.get(msg.nodeId) !== ws) {
                    const old = peers.get(msg.nodeId);
                    if (old) {
                        try { old.ws.terminate(); } catch {}
                    }
                }

                // Clamp display-name fields to prevent oversized lobby broadcasts
                if (msg.franchiseName && msg.franchiseName.length > 64) msg.franchiseName = msg.franchiseName.slice(0, 64);
                if (msg.leagueName   && msg.leagueName.length   > 64) msg.leagueName   = msg.leagueName.slice(0, 64);
                if (msg.region       && msg.region.length       > 32) msg.region       = msg.region.slice(0, 32);

                // Track ownership so future SIGNALs can be validated against sender
                nodeOwners.set(msg.nodeId, ws);
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

                // Verify the sender owns the nodeId they registered — prevents spoofing
                if (nodeOwners.get(nodeId) !== ws) {
                    send(ws, { type: 'ERROR', message: 'Unauthorized: nodeId ownership mismatch' });
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
            // Clean up ownership record only if this socket still owns the nodeId
            if (nodeOwners.get(nodeId) === ws) nodeOwners.delete(nodeId);
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
            // Remove ownership record so a new connection can re-register this nodeId
            if (nodeOwners.get(id) === peer.ws) nodeOwners.delete(id);
            broadcast({ type: 'PEER_LEFT', nodeId: id });
        }
    }
}, 60_000);

httpServer.listen(PORT, () => {
    console.log(`[Relay] Trier Fantasy Football relay running on port ${PORT}`);
    console.log(`[Relay] Health check: http://localhost:${PORT}/health`);
});
