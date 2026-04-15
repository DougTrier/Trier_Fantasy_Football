/**
 * NetworkHealth — Developer Diagnostics Panel
 * =============================================
 * A low-level debug view used within SettingsPage to inspect the live state
 * of the P2P mesh and EventStore. Not surfaced in the main navigation.
 *
 * EVENT LOG: Subscribes reactively to GlobalEventStore so any new event
 * (local or inbound from a peer) appears immediately. Shows the last 10
 * events to keep the panel compact.
 *
 * PEERS: Polled every 1s because P2PService does not yet expose a reactive
 * store for connection state — a future improvement would replace the
 * interval with an onConnectionStatus subscriber.
 *
 * TODO: Type the peers array properly once P2PService exports a typed
 * connection summary interface.
 */
import React, { useEffect, useState } from 'react';
import { GlobalEventStore } from '../../services/EventStore';
import type { EventLogEntry } from '../../types/P2P';
import { P2PService } from '../../services/P2PService';

export const NetworkHealth: React.FC = () => {
    const [events, setEvents] = useState<EventLogEntry[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [peers, setPeers] = useState<any[]>([]); // TODO: type with P2PConnection summary

    useEffect(() => {
        // Subscribe to Store — updates state on every new event for live diagnostics
        const unsub = GlobalEventStore.subscribe((all) => {
            setEvents([...all]);
        });

        // Poll Peers — temporary until P2PService gains a reactive connection store
        const interval = setInterval(() => {
            const list = Array.from(P2PService.connections.values()).map(c => ({
                id: c.nodeId,
                state: c.state,
                latency: c.iceStats?.srflx || 0 // srflx = server-reflexive ICE candidate RTT
            }));
            setPeers(list);
        }, 1000);

        return () => {
            unsub();
            clearInterval(interval);
        };
    }, []);

    return (
        <div style={{ padding: 20, background: '#111', color: '#0f0', fontFamily: 'monospace' }}>
            <h2>NETWORK DIAGNOSTICS</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Event Log Stats */}
                <div style={{ border: '1px solid #333', padding: 10 }}>
                    <h3>EVENT LOG ({events.length})</h3>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {events.slice(-10).map(e => (
                            <div key={e.id} style={{ fontSize: 12, borderBottom: '1px solid #222' }}>
                                <span style={{ color: '#aaa' }}>{e.seq}</span> {e.type}
                                <span style={{ marginLeft: 10, color: 'cyan' }}>{new Date(e.ts).toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Peer Stats */}
                <div style={{ border: '1px solid #333', padding: 10 }}>
                    <h3>PEERS ({peers.length})</h3>
                    {peers.map(p => (
                        <div key={p.id}>
                            [{p.state}] {p.id.substring(0, 10)}... (Lat: {p.latency}ms)
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
