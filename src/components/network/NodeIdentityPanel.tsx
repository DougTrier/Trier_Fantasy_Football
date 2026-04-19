import React, { useRef, useState } from 'react';
import { Shield, Activity, X, Wifi, Users, UserPlus, Download, Upload, Star, Trash2 } from 'lucide-react';
import { useDialog } from '../AppDialog';
import { DiscoveryService, type DiscoveredPeer } from '../../services/DiscoveryService';
import { BackupService } from '../../services/BackupService';
import { type ConnectionState } from '../../services/P2PService';

export interface FriendEntry {
    uuid: string;
    nickname: string;
    nodeId?: string;
    addedAt: number;
}

interface Props {
    myPeerUuid: string;
    friends: FriendEntry[];
    peers: DiscoveredPeer[];
    onFriendsChange: (updated: FriendEntry[]) => void;
    showDiagnostics: boolean;
    onShowDiagnostics: () => void;
    onShowInviteModal: () => void;
    onShowJoinModal: () => void;
    getStateByNodeId: (nodeId: string) => ConnectionState;
    handleConnect: (peer: DiscoveredPeer) => void;
}

export const NodeIdentityPanel: React.FC<Props> = ({
    myPeerUuid,
    friends,
    peers,
    onFriendsChange,
    showDiagnostics,
    onShowDiagnostics,
    onShowInviteModal,
    onShowJoinModal,
    getStateByNodeId,
    handleConnect,
}) => {
    const { showAlert, showConfirm } = useDialog();
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [friendUuidInput, setFriendUuidInput] = useState('');
    const [friendNicknameInput, setFriendNicknameInput] = useState('');

    const saveFriends = (updated: FriendEntry[]) => {
        onFriendsChange(updated);
        localStorage.setItem('trier_friends', JSON.stringify(updated));
    };

    const handleAddFriend = () => {
        const uuid = friendUuidInput.trim().toLowerCase();
        if (!uuid) return;
        if (uuid === myPeerUuid.toLowerCase()) { showAlert("That's your own Peer ID!", "Can't Add Yourself"); return; }
        if (friends.some(f => f.uuid === uuid)) { showAlert("This coach is already in your friends list.", "Already Added"); return; }
        saveFriends([...friends, {
            uuid,
            nickname: friendNicknameInput.trim() || 'Unknown Coach',
            addedAt: Date.now(),
        }]);
        // Init DHT lazily on first friend add if it wasn't started at mount
        import('../../services/DHTService').then(m => {
            if (!m.DHTService._ready) m.DHTService.init(myPeerUuid);
            m.DHTService.watchFriend(uuid);
        });
        setFriendUuidInput('');
        setFriendNicknameInput('');
        setShowAddFriend(false);
    };

    const handleRemoveFriend = (uuid: string) => {
        import('../../services/DHTService').then(m => m.DHTService.stopWatchingFriend(uuid));
        saveFriends(friends.filter(f => f.uuid !== uuid));
    };

    const handleClearCache = async () => {
        await import('@tauri-apps/api/tauri').then(t => t.invoke('p2p_clear_discovery_cache'));
        window.location.reload();
    };

    const handleExport = async () => {
        try {
            const json = await BackupService.exportProfile();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trier_backup_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            showAlert('Export failed. Please try again.', 'Export Error');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
            const result = await BackupService.importProfile(text);
            showAlert(`Imported ${result.count} events. The app will now reload.`, 'Import Complete');
            window.location.reload();
        } catch {
            showAlert('Import failed. The file may be corrupted or invalid.', 'Import Error');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>

            {/* Section label */}
            <div style={{
                background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
                padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                <span style={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#d1d5db' }}>P2P Network Node</span>
            </div>

            {/* ── FRIENDS PANEL ── */}
            <div style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(10,14,26,0.82)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                overflow: 'hidden',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.85rem 1.25rem',
                    borderBottom: friends.length > 0 || showAddFriend ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#d1d5db', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.08em' }}>
                        <Star size={15} color="#eab308" />
                        FRIENDS ({friends.length})
                    </div>
                    <button
                        onClick={() => setShowAddFriend(v => !v)}
                        style={{
                            background: showAddFriend ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: '#d1d5db', borderRadius: '6px',
                            padding: '0.35rem 0.85rem', cursor: 'pointer',
                            fontSize: '0.78rem', fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                        }}
                    >
                        <UserPlus size={13} /> Add Friend
                    </button>
                </div>

                {/* Add friend form */}
                {showAddFriend && (
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(96,165,250,0.05)' }}>
                        <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            Paste your friend's Peer ID. Ask them to find it on their Network page.
                        </div>
                        <input
                            value={friendUuidInput}
                            onChange={e => setFriendUuidInput(e.target.value)}
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            style={{
                                width: '100%', padding: '0.5rem 0.75rem',
                                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                                color: '#fff', borderRadius: '6px', fontFamily: 'monospace',
                                fontSize: '0.82rem', marginBottom: '0.5rem', boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                value={friendNicknameInput}
                                onChange={e => setFriendNicknameInput(e.target.value)}
                                placeholder="Nickname (e.g. Mike's Team)"
                                style={{
                                    flex: 1, padding: '0.5rem 0.75rem',
                                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#fff', borderRadius: '6px', fontSize: '0.82rem', boxSizing: 'border-box',
                                }}
                            />
                            <button
                                onClick={handleAddFriend}
                                style={{
                                    padding: '0.5rem 1rem', background: '#1d4ed8',
                                    border: 'none', color: '#fff', borderRadius: '6px',
                                    fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                )}

                {/* Friends list */}
                {friends.map(f => {
                    const nodeState = f.nodeId ? getStateByNodeId(f.nodeId) : 'IDLE';
                    const isVerified = nodeState === 'VERIFIED';
                    const isConnecting = nodeState === 'REQUESTING' || nodeState === 'VERIFYING' || nodeState === 'NEGOTIATING' || nodeState === 'CONNECTED';
                    const discovered = f.nodeId ? peers.find(p => p.id === f.nodeId) : undefined;
                    const statusColor = isVerified ? '#4ade80' : isConnecting ? '#facc15' : discovered ? '#60a5fa' : '#374151';
                    const statusLabel = isVerified ? '● Connected'
                        : isConnecting ? '◌ Connecting…'
                        : discovered ? '● On LAN'
                        : '○ Offline';
                    return (
                        <div key={f.uuid} style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.75rem 1.25rem',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}>
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: statusColor,
                                boxShadow: isVerified ? '0 0 6px #4ade80' : undefined,
                                flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f3f4f6' }}>{f.nickname}</div>
                                <div style={{ fontSize: '0.68rem', color: '#6b7280', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {f.uuid}
                                </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: statusColor, whiteSpace: 'nowrap' }}>
                                {statusLabel}
                            </div>
                            {discovered && !isVerified && !isConnecting && (
                                <button
                                    onClick={() => handleConnect(discovered)}
                                    style={{
                                        padding: '0.3rem 0.7rem', background: 'rgba(255,255,255,0.1)',
                                        border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                                        borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem',
                                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                                    }}
                                >
                                    <Wifi size={11} /> Connect
                                </button>
                            )}
                            <button
                                onClick={() => handleRemoveFriend(f.uuid)}
                                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '0.2rem' }}
                                title="Remove friend"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
                {friends.length === 0 && !showAddFriend && (
                    <div style={{ padding: '1rem 1.25rem', color: '#6b7280', fontSize: '0.82rem' }}>
                        No friends added yet. Click "Add Friend" and paste their Peer ID.
                    </div>
                )}
            </div>

            {/* Action buttons — compact 3-column grid */}
            <div style={{
                background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                padding: '0.75rem',
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
                width: '100%', boxSizing: 'border-box',
            }}>
                <button onClick={onShowInviteModal} title="Generate a secure invite code"
                    style={{ padding: '0.5rem 0.4rem', background: 'rgba(74,222,128,0.15)', border: '1px solid #22c55e', color: '#4ade80', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.72rem' }}>
                    <UserPlus size={14} /> INVITE
                </button>
                <button onClick={onShowJoinModal} title="Enter an invite code from a friend"
                    style={{ padding: '0.5rem 0.4rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#d1d5db', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.72rem' }}>
                    <Users size={14} /> JOIN
                </button>
                <button onClick={onShowDiagnostics} title="Run network diagnostics"
                    style={{ padding: '0.5rem 0.4rem', background: showDiagnostics ? 'rgba(96,165,250,0.2)' : 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.3)', color: '#93c5fd', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.72rem' }}>
                    <Activity size={14} /> DIAG
                </button>
                <button onClick={handleClearCache} title="Clear discovered peers cache"
                    style={{ padding: '0.5rem 0.4rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.72rem' }}>
                    <Trash2 size={14} /> RESET
                </button>
                <button onClick={async () => {
                        try { await DiscoveryService.openFirewall(); showAlert("Firewall rules updated.", "Updated"); }
                        catch { showAlert("Firewall update failed — try running as administrator.", "Failed"); }
                    }} title="Add Windows Firewall rules"
                    style={{ padding: '0.5rem 0.4rem', background: 'rgba(202,138,4,0.1)', border: '1px solid rgba(234,179,8,0.4)', color: '#fde047', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.72rem' }}>
                    <Shield size={14} /> FIREWALL
                </button>
            </div>

            {/* Export / Import — compact row */}
            <div style={{
                display: 'flex', gap: '0.5rem',
                background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                padding: '0.6rem 0.75rem',
                width: '100%', boxSizing: 'border-box',
            }}>
                <button onClick={handleExport} title="Save profile and events to a JSON file."
                    style={{ flex: 1, padding: '0.45rem 0.5rem', background: 'rgba(30,58,138,0.4)', border: '1px solid #1e3a8a', color: '#93c5fd', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.75rem' }}>
                    <Download size={14} /> EXPORT
                </button>
                <label title="Restore from a JSON backup file."
                    style={{ flex: 1, padding: '0.45rem 0.5rem', background: 'rgba(30,58,138,0.4)', border: '1px solid #1e3a8a', color: '#93c5fd', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.75rem' }}>
                    <Upload size={14} /> IMPORT
                    <input type="file" onChange={handleImport} style={{ display: 'none' }} accept=".json" />
                </label>
            </div>
        </div>
    );
};
