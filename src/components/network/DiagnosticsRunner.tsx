import React, { useState, useEffect } from 'react';

export const DiagnosticsRunner: React.FC = () => {
    const [status, setStatus] = useState<'IDLE' | 'RUNNING' | 'DONE' | 'ERROR'>('IDLE');
    const [result, setResult] = useState<any>(null);

    const run = async () => {
        const { isTauri } = await import('../../utils/tauriEnv');
        if (!isTauri()) {
            setStatus('ERROR');
            setResult({ _browserMode: true });
            return;
        }
        setStatus('RUNNING');
        try {
            const { invoke } = await import('@tauri-apps/api/tauri');
            const res = await invoke<any>('run_network_diagnostics');
            setResult(res);
            setStatus('DONE');
        } catch (e) {
            console.error(e);
            setStatus('ERROR');
        }
    };

    useEffect(() => {
        run();
    }, []);

    return (
        <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: status === 'RUNNING' ? '#facc15' : status === 'DONE' ? '#4ade80' : '#fff' }}>
                    STATUS: {status}
                </span>
                <button onClick={run} style={{ cursor: 'pointer', background: '#333', color: '#fff', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>RERUN</button>
            </div>

            {result?._browserMode && <div style={{ color: '#facc15' }}>Diagnostics unavailable in browser mode — run the Tauri app.</div>}
            {status === 'RUNNING' && <div>Running Connectivity Checks (Gateway, DNS, Internet)...</div>}

            {result && !result._browserMode && (
                <div>
                    <div>Gateway Ping: {result.gatewayPing ? <span style={{ color: '#4ade80' }}>PASS ({result.gatewayLatency}ms)</span> : <span style={{ color: '#ef4444' }}>FAIL</span>}</div>
                    <div>DNS Ping (8.8.8.8): {result.dnsPing ? <span style={{ color: '#4ade80' }}>PASS</span> : <span style={{ color: '#ef4444' }}>FAIL</span>}</div>
                    <div>Internet Ping: {result.internetPing ? <span style={{ color: '#4ade80' }}>PASS</span> : <span style={{ color: '#ef4444' }}>FAIL</span>}</div>

                    {result.details && result.details.length > 0 && (
                        <div style={{ marginTop: '1rem', opacity: 0.7, fontSize: '0.9rem' }}>
                            {result.details.map((d: string, i: number) => <div key={i}>{d}</div>)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
