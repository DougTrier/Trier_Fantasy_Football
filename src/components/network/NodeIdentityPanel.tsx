import React, { useRef, useState } from 'react';
import { Shield, Activity, X, Wifi, Users, UserPlus, Copy, Download, Upload, Check, Star, RotateCcw, Trash2 } from 'lucide-react';
import { useDialog } from '../AppDialog';
import { DiscoveryService, type DiscoveredPeer } from '../../services/DiscoveryService';
import { BackupService } from '../../services/BackupService';
import { type ConnectionState } from '../../services/P2PService';
import leatherTexture from '../../assets/leather_texture.png';

export interface FriendEntry {
    uuid: string;
    nickname: string;
    nodeId?: string;
    addedAt: number;
}

interface Props {
    myPeerUuid: string;
    myId: string;
    eventCount: number;
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
    myId,
    eventCount,
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
    const [uuidCopied, setUuidCopied] = useState(false);
    const uuidCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const handleCopyUuid = () => {
        navigator.clipboard.writeText(myPeerUuid);
        setUuidCopied(true);
        if (uuidCopyTimer.current) clearTimeout(uuidCopyTimer.current);
        uuidCopyTimer.current = setTimeout(() => setUuidCopied(false), 2000);
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '3rem', gap: '1rem' }}>
            <h1 style={{
                fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                fontWeight: 900,
                margin: 0,
                color: 'transparent',
                backgroundImage: `url(${leatherTexture})`,
                backgroundSize: '150px',
                backgroundPosition: 'center',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                fontFamily: "'Graduate', 'Impact', sans-serif",
                WebkitTextStroke: '1px rgba(255,255,255,0.95)',
                textShadow: '0 5px 15px rgba(0,0,0,0.9)',
                lineHeight: '1.2'
            }}>
                FIND OR ADD FRIENDS
            </h1>

            {/* ── YOUR PEER ID CARD ── */}
            <div style={{
                background: 'rgba(23, 37, 84, 0.85)',
                border: '1px solid rgba(96, 165, 250, 0.4)',
                borderRadius: '16px',
                padding: '1.25rem 1.75rem',
                maxWidth: '600px',
                width: '100%',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
                <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 900, letterSpacing: '0.15em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    Your Peer ID — share this to let friends find you
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <code style={{
                        flex: 1, fontFamily: 'monospace', fontSize: '0.95rem',
                        color: '#93c5fd', letterSpacing: '0.05em',
                        wordBreak: 'break-all',
                    }}>
                        {myPeerUuid || '...'}
                    </code>
                    <button
                        onClick={handleCopyUuid}
                        title="Copy Peer ID to clipboard"
                        style={{
                            background: uuidCopied ? 'rgba(74,222,128,0.2)' : 'rgba(96,165,250,0.15)',
                            border: `1px solid ${uuidCopied ? '#4ade80' : 'rgba(96,165,250,0.4)'}`,
                            color: uuidCopied ? '#4ade80' : '#93c5fd',
                            borderRadius: '8px', padding: '0.5rem 0.9rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                            fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap',
                            transition: 'background 0.2s, border-color 0.2s, color 0.2s',
                        }}
                    >
                        {uuidCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                    </button>
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#6b7280' }}>
                    <span><Activity size={12} style={{ display: 'inline', marginRight: 4 }} />{eventCount} events</span>
                    <span style={{ opacity: 0.5 }}>|</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{myId}</span>
                    <span style={{ opacity: 0.5 }}>|</span>
                    <button
                        onClick={async () => {
                            if (!await showConfirm('Rotate your cryptographic keypair? This generates a new identity key — all peers will need to re-verify. This cannot be undone.', 'Rotate Keypair', 'ROTATE')) return;
                            const { IdentityService } = await import('../../services/IdentityService');
                            await IdentityService.rotateKeys();
                            showAlert('Keypair rotated. Reconnect to peers to re-establish trust.', 'Keys Rotated');
                        }}
                        title="Generate a new ECDSA keypair (lost device / key compromise recovery)"
                        style={{
                            background: 'none', border: 'none', color: '#6b7280',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            gap: '0.3rem', fontSize: '0.7rem', padding: 0,
                        }}
                    >
                        <RotateCcw size={11} /> Rotate Keys
                    </button>
                </div>
            </div>

            {/* ── FRIENDS PANEL ── */}
            <div style={{
                maxWidth: '600px', width: '100%',
                background: 'rgba(10,14,26,0.82)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
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

            <div style={{
                display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center',
                background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
                padding: '1rem 1.5rem',
                maxWidth: '700px', width: '100%',
            }}>
                <button
                    onClick={onShowInviteModal}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: '#4ade80',
                        border: '1px solid #22c55e',
                        color: '#000',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                    title="Generate a secure invite code to share with a friend on this network."
                >
                    <UserPlus size={20} />
                    <span>INVITE</span>
                </button>

                <button
                    onClick={onShowJoinModal}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: 'rgba(255, 255, 255, 0.25)',
                        border: '1px solid rgba(255,255,255,0.4)',
                        color: '#fff',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        backdropFilter: 'blur(4px)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                    }}
                    title="Enter an invite code from a friend to connect."
                >
                    <Users size={20} />
                    <span>JOIN</span>
                </button>

                <button
                    onClick={onShowDiagnostics}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: showDiagnostics ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        color: '#fff',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        fontWeight: 'bold',
                        backdropFilter: 'blur(4px)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                    }}
                    title="Run network diagnostics (Ping Gateway, DNS) to troubleshoot connectivity."
                >
                    <Activity size={20} />
                    <span>DIAGNOSTICS</span>
                </button>

                <button
                    onClick={handleClearCache}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: 'rgba(220, 38, 38, 0.3)',
                        border: '1px solid #ef4444',
                        color: '#fca5a5',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        fontWeight: 'bold',
                        backdropFilter: 'blur(4px)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                    }}
                    title="Clear discovered peers and reset local cache. Use if peers are stale."
                >
                    <Trash2 size={20} />
                    <span>RESET</span>
                </button>

                <button
                    onClick={async () => {
                        try {
                            await DiscoveryService.openFirewall();
                            showAlert("Firewall rules updated. Restart the app if connectivity issues persist.", "Firewall Updated");
                        } catch {
                            showAlert("Firewall update failed. You may need to run as administrator.", "Update Failed");
                        }
                    }}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: 'rgba(202, 138, 4, 0.3)',
                        border: '1px solid #eab308',
                        color: '#fde047',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        fontWeight: 'bold',
                        backdropFilter: 'blur(4px)',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                    }}
                    title="Attempt to automatically add Windows Firewall rules for Trier Fantasy."
                >
                    <Shield size={20} />
                    <span>FIX FIREWALL</span>
                </button>
            </div>

            <div style={{
                display: 'flex', gap: '1.5rem', marginTop: '1rem',
                background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
                padding: '1rem 1.5rem',
            }}>
                <button
                    onClick={handleExport}
                    style={{
                        background: '#0a192f',
                        border: '2px solid #1e3a8a',
                        color: '#fff',
                        padding: '1rem 2rem',
                        borderRadius: '8px',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.8rem',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                    }}
                    title="Save your current profile and team data to a JSON file."
                >
                    <Download size={24} /> EXPORT
                </button>
                <label
                    style={{
                        background: '#0a192f',
                        border: '2px solid #1e3a8a',
                        color: '#fff',
                        padding: '1rem 2rem',
                        borderRadius: '8px',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.8rem',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                    }}
                    title="Restore profile and events from a JSON backup file."
                >
                    <Upload size={24} /> IMPORT
                    <input type="file" onChange={handleImport} style={{ display: 'none' }} accept=".json" />
                </label>
            </div>
        </div>
    );
};
