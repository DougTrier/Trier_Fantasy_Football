
import React, { useEffect, useState } from 'react';
import { GlobalEventStore } from '../../services/EventStore';
import type { EventLogEntry } from '../../types/P2P';
import { P2PService } from '../../services/P2PService';

export const NetworkHealth: React.FC = () => {
    const [events, setEvents] = useState<EventLogEntry[]>([]);
    const [peers, setPeers] = useState<any[]>([]); // To be typed properly later

    useEffect(() => {
        // Subscribe to Store
        const unsub = GlobalEventStore.subscribe((all) => {
            setEvents([...all]);
        });

        // Poll Peers (Temporary until P2PService has reactive store)
        const interval = setInterval(() => {
            // @ts-ignore - Accessing internal map for debug
            const list = Array.from(P2PService.connections.values()).map(c => ({
                id: c.nodeId,
                state: c.state,
                latency: c.iceStats?.srflx || 0 // Mock use of stat
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
