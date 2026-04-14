import React, { useRef, useState } from 'react';
import {
    Settings, Shield, Users, Lock, Download, Upload,
    Trash2, RefreshCw, Globe, HardDrive, Plus, Edit2
} from 'lucide-react';
import type { FantasyTeam } from '../types';
import { SecurityService } from '../utils/SecurityService';
import { NetworkHealth } from './diagnostics/NetworkHealth';
import leatherTexture from '../assets/leather_texture.png';

interface SettingsPageProps {
    teams: FantasyTeam[];
    activeTeamId: string;
    isAdmin: boolean;
    onResetOwnerPassword: (teamId: string, newPassword?: string) => void;
    onToggleAdmin: () => void;
    onSwitchTeam: (teamId: string, password?: string) => void;
    onDeleteTeam: (teamId: string) => void;
    onUpdateDetails: (teamId: string, name: string, owner: string, password?: string) => void;
    onCreateTeam: (name: string, owner: string, password?: string) => void;
    peers: string[]; // Discovered Peers
    connectedPeers: string[]; // ACTIVE WebRTC Connections
    onImportTeam: (team: FantasyTeam) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
    teams,
    activeTeamId,
    isAdmin,
    onResetOwnerPassword,
    onToggleAdmin,
    onSwitchTeam,
    onDeleteTeam,
    onUpdateDetails,
    onCreateTeam,
    peers,
    connectedPeers,
    onImportTeam
}) => {
    // ... (refs and state validation logic remains same, skipping for brevity in replacement)
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Edit Form States
    const [editName, setEditName] = useState('');
    const [editOwner, setEditOwner] = useState('');
    const [editPass, setEditPass] = useState('');

    // New Team Form States
    const [newName, setNewName] = useState('');
    const [newOwner, setNewOwner] = useState('');
    const [newPass, setNewPass] = useState('');

    const handleExport = async (team: FantasyTeam) => {
        try {
            const encryptionPass = team.password || prompt("Set a backup password (Optional):") || undefined;
            const securePayload = { version: 'v2', timestamp: Date.now(), teamData: team };
            const encryptedData = await SecurityService.encrypt(securePayload, encryptionPass);
            const finalPayload = { trier_secure_v2: true, payload: encryptedData };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalPayload));
            const dl = document.createElement('a');
            dl.setAttribute("href", dataStr);
            dl.setAttribute("download", `${team.name.replace(/\s+/g, '_')}_SECURE.tff`);
            dl.click();
        } catch (e) { alert("Export failed"); }
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const json = JSON.parse(ev.target?.result as string);
                const tryDecrypt = async (data: string): Promise<any> => {
                    try { return await SecurityService.decrypt(data, undefined); }
                    catch {
                        const pass = prompt("Enter file password:");
                        if (!pass) throw new Error("Cancelled");
                        return await SecurityService.decrypt(data, pass);
                    }
                };

                if (json.trier_secure_v2) {
                    const decrypted = await tryDecrypt(json.payload);
                    onImportTeam(decrypted.teamData);
                    alert(`Imported ${decrypted.teamData.name}`);
                }
            } catch (err) { alert("Failed to import"); }
        };
        reader.readAsText(file);
    };

    return (
        <div style={{ color: 'white', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', sans-serif", paddingBottom: '5vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'clamp(20px, 4vh, 40px)' }}>
                <Settings size={40} color="#eab308" />
                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: 900,
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    color: 'transparent',
                    backgroundImage: `url(${leatherTexture})`,
                    backgroundSize: '150px',
                    backgroundPosition: 'center',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    fontFamily: "'Graduate', 'Impact', sans-serif",
                    WebkitTextStroke: '1px rgba(255,255,255,0.95)',
                    textShadow: '0 5px 15px rgba(0,0,0,0.9)'
                }}>
                    League Settings
                </h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '30px' }}>

                {/* 1. Commissioner Control Center */}
                <section style={cardStyle}>
                    <div style={headerStyle}>
                        <Shield size={22} color="#eab308" />
                        <h2 style={titleStyle}>Commissioner Center</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px' }}>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Admin Mode</div>
                                <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{isAdmin ? 'Full access to league data enabled.' : 'Enable to manage all franchises.'}</div>
                            </div>
                            <button
                                onClick={onToggleAdmin}
                                title="Enable commissioner tools to force trades, edit active teams, or modify league settings."
                                style={{ ...btnStyle, background: isAdmin ? '#ef4444' : '#eab308', color: isAdmin ? 'white' : 'black' }}
                            >
                                {isAdmin ? 'EXIT ADMIN' : 'LOG IN'}
                            </button>
                        </div>

                        {isAdmin && (
                            <button
                                onClick={() => onCreateTeam('Test Team #' + Math.floor(Math.random() * 100), 'Dummy Coach', '1234')}
                                title="Generate a dummy team for testing and layout verification."
                                style={{ ...btnStyle, background: 'rgba(255,255,255,0.05)', border: '1px dashed #eab308', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                <Plus size={18} /> CREATE TEST FRANCHISE (ADMIN ONLY)
                            </button>
                        )}


                    </div>
                </section>

                {/* 2. Sideband Status */}
                <section style={cardStyle}>
                    <div style={headerStyle}>
                        <Globe size={22} color="#eab308" />
                        <h2 style={titleStyle}>Sideband Network</h2>
                    </div>
                    {/* ... existing code ... */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: connectedPeers.length > 0 ? '#10b981' : '#6b7280', boxShadow: connectedPeers.length > 0 ? '0 0 10px #10b981' : 'none' }} />
                            <span style={{ fontWeight: 800, fontSize: '1rem' }}>{connectedPeers.length > 0 ? 'CONNECTION ACTIVE' : 'OFFLINE / STANDALONE'}</span>
                        </div>
                        {/* ... */}
                        <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '20px' }}>
                            {connectedPeers.length > 0
                                ? `You are connected to ${connectedPeers.length} active peers.`
                                : `Scanning subnet... Found ${peers.length} potential peers.`}
                        </div>

                        {/* Connected Peers List */}
                        {connectedPeers.length > 0 && (
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', marginBottom: '5px' }}>CONNECTED</div>
                                <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {connectedPeers.map(p => (
                                        <div key={p} style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                            ✓ {p}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Discovered Peers List */}
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', marginBottom: '5px' }}>DISCOVERED (Click Network Tab to Connect)</div>
                        <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {peers.filter(p => !connectedPeers.includes(p)).map(p => (
                                <div key={p} style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280', background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '4px' }}>
                                    • {p}
                                </div>
                            ))}
                            {peers.filter(p => !connectedPeers.includes(p)).length === 0 && (
                                <div style={{ fontSize: '0.75rem', fontStyle: 'italic', opacity: 0.5 }}>No other peers discovered.</div>
                            )}
                        </div>

                        <div style={{ marginTop: 20 }}>
                            <NetworkHealth />
                        </div>
                    </div>
                </section>

                {/* 3. Franchise Management */}
                <section style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                    <div style={headerStyle}>
                        <Users size={22} color="#eab308" />
                        <h2 style={titleStyle}>Manage Franchises</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                        {teams.map(t => {
                            const active = t.id === activeTeamId;
                            const editing = editingId === t.id;
                            return (
                                <div key={t.id} style={{
                                    background: active ? 'rgba(234, 179, 8, 0.1)' : 'rgba(255,255,255,0.03)',
                                    border: active ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px', padding: '24px', transition: 'all 0.2s'
                                }}>
                                    {editing ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Team Name" style={inputStyle} />
                                            <input value={editOwner} onChange={e => setEditOwner(e.target.value)} placeholder="Owner Name" style={inputStyle} />
                                            <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="Franchise Password" style={inputStyle} />
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => {
                                                    if (!editName || !editOwner || !editPass) return alert("All fields including Password are required for league integrity.");
                                                    onUpdateDetails(t.id, editName, editOwner, editPass);
                                                    setEditingId(null);
                                                }} style={{ ...btnStyle, flex: 1, background: '#10b981' }}>SAVE</button>
                                                <button onClick={() => setEditingId(null)} style={{ ...btnStyle, flex: 1, background: '#64748b' }}>CANCEL</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                                <div>
                                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: active ? '#eab308' : 'white' }}>{t.name}</div>
                                                    <div style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Coach: {t.ownerName}</div>
                                                </div>
                                                {t.password && <Lock size={18} color={active || isAdmin ? '#10b981' : '#ef4444'} />}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                                                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                                    {(active || isAdmin) && (
                                                        <>
                                                            <button onClick={() => handleExport(t)} title="Export this franchise's data to a secure file." style={actionBtnStyle}><Download size={14} /> BACKUP</button>
                                                            <button onClick={() => {
                                                                const input = document.createElement('input');
                                                                input.type = 'file';
                                                                input.accept = '.tff,.json';
                                                                input.onchange = (e: any) => {
                                                                    const file = e.target.files[0];
                                                                    const reader = new FileReader();
                                                                    reader.onload = async (ev) => {
                                                                        try {
                                                                            const json = JSON.parse(ev.target?.result as string);
                                                                            if (confirm(`Overwrite ${t.name} with data from backup file?`)) {
                                                                                const tryDecrypt = async (data: string): Promise<any> => {
                                                                                    try { return await SecurityService.decrypt(data, undefined); }
                                                                                    catch {
                                                                                        const pass = prompt("Enter file password:");
                                                                                        return await SecurityService.decrypt(data, pass || '');
                                                                                    }
                                                                                };
                                                                                const decrypted = json.trier_secure_v2 ? await tryDecrypt(json.payload) : json;
                                                                                const teamData = decrypted.teamData || decrypted;
                                                                                onImportTeam({ ...teamData, id: t.id });
                                                                            }
                                                                        } catch (err) { alert("Import failed"); }
                                                                    };
                                                                    reader.readAsText(file);
                                                                };
                                                                input.click();
                                                            }} title="Overwrite this franchise with external data." style={actionBtnStyle}><Upload size={14} /> IMPORT</button>
                                                            <button onClick={() => {
                                                                setEditingId(t.id);
                                                                setEditName(t.name);
                                                                setEditOwner(t.ownerName);
                                                            }} title="Rename team or change owner." style={actionBtnStyle}><Edit2 size={14} /> EDIT</button>
                                                        </>
                                                    )}

                                                    {isAdmin && t.password && (
                                                        <button
                                                            onClick={() => {
                                                                const p = prompt(`Set new password for ${t.name} (leave empty to remove):`);
                                                                if (p !== null) onResetOwnerPassword(t.id, p);
                                                            }}
                                                            style={{ ...actionBtnStyle, color: '#eab308' }}
                                                            title="Emergency override for lost owner passwords."
                                                        >
                                                            <RefreshCw size={14} /> RESET PASS
                                                        </button>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {!active && (
                                                        <button onClick={() => {
                                                            const p = t.password ? prompt("Enter password:") : undefined;
                                                            onSwitchTeam(t.id, p || undefined);
                                                        }} title="Log in as this coach to manage roster and trades." style={{ ...btnStyle, fontSize: '0.8rem', padding: '6px 12px' }}>SWITCH</button>
                                                    )}
                                                    {isAdmin && (
                                                        <button onClick={() => confirm(`Delete ${t.name}?`) && onDeleteTeam(t.id)} title="Permanently remove this franchise from the league." style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}><Trash2 size={16} /></button>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                        <div onClick={() => setIsCreating(true)} style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '140px', color: '#6b7280', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#eab308'; e.currentTarget.style.color = '#eab308'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#6b7280'; }}
                        >
                            <Plus size={32} />
                            <div style={{ fontWeight: 800, marginTop: '10px' }}>ADD FRANCHISE</div>
                        </div>
                    </div>
                </section>

                {/* 4. Data Ops */}
                <section style={cardStyle}>
                    <div style={headerStyle}>
                        <HardDrive size={22} color="#eab308" />
                        <h2 style={titleStyle}>Data Operations</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <button onClick={() => fileInputRef.current?.click()} title="Restore league data from a previously exported .tff file." style={{ ...btnStyle, background: '#3b82f6', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Upload size={18} /> IMPORT DATA FROM FILE (.TFF)
                        </button>
                        {isAdmin && (
                            <button onClick={() => {
                                if (confirm("WARNING: This will clear all data and reset the app. Continue?")) {
                                    localStorage.clear();
                                    window.location.reload();
                                }
                            }} title="Wipe all local data, clear cache, and start fresh (Irreversible)." style={{ ...btnStyle, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={18} /> FACTORY RESET APP
                            </button>
                        )}
                    </div>
                </section>

                {/* CREATE FRANCHISE MODAL */}
                {isCreating && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                        zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                        <div style={{ ...cardStyle, width: '450px', maxWidth: '90%' }}>
                            <div style={headerStyle}>
                                <Plus size={24} color="#eab308" />
                                <h2 style={titleStyle}>Establish New Franchise</h2>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', color: '#9ca3af', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>TEAM NAME</label>
                                    <input type="text" placeholder="e.g. Gotham Knights" value={newName} onChange={e => setNewName(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: '#9ca3af', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>COACH NAME</label>
                                    <input type="text" placeholder="e.g. Bruce Wayne" value={newOwner} onChange={e => setNewOwner(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: '#9ca3af', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>SECURITY PASSWORD</label>
                                    <input type="password" placeholder="Set a strong password..." value={newPass} onChange={e => setNewPass(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                                </div>

                                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                    <button
                                        onClick={() => {
                                            if (!newName || !newOwner || !newPass) return alert("Team Name, Coach Name, and Password are all REQUIRED!");
                                            onCreateTeam(newName, newOwner, newPass);
                                            setIsCreating(false);
                                            setNewName(''); setNewOwner(''); setNewPass('');
                                        }}
                                        style={{ ...btnStyle, flex: 1, background: '#eab308', color: 'black' }}
                                    >
                                        ESTABLISH FRANCHISE
                                    </button>
                                    <button onClick={() => setIsCreating(false)} style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#9ca3af' }}>
                                        CANCEL
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".tff,.json" onChange={handleImportFile} />
        </div>
    );
};

const cardStyle: React.CSSProperties = {
    background: 'rgba(15, 23, 42, 0.9)',
    backdropFilter: 'blur(12px)',
    borderRadius: '24px',
    padding: 'clamp(15px, 3vh, 30px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: 'clamp(12px, 2.5vh, 24px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: 'clamp(8px, 1.5vh, 15px)'
};

const titleStyle: React.CSSProperties = {
    fontSize: '1.2rem',
    fontWeight: 900,
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '1px'
};

const btnStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '0.9rem'
};

const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '10px 15px',
    color: 'white',
    fontSize: '0.95rem'
};

const actionBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer'
};
