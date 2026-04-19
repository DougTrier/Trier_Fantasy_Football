/**
 * SettingsPage — League Administration & Team Management
 * ========================================================
 * Central hub for all configuration that isn't part of normal gameplay:
 *
 *  1. Commissioner Center — toggle admin mode, create test franchises,
 *     manage Game Day locks per NFL team, configure YouTube API key.
 *
 *  2. Team Management — edit team name/owner/password, export/import .tff
 *     backup files (AES-encrypted via SecurityService), delete teams.
 *
 * GAME DAY LOCKS:
 *   The commissioner can lock individual NFL teams (or fetch live schedule
 *   to auto-lock active games). While locked, players on that team cannot
 *   be swapped in or out of starting lineups — enforced in isPlayerLocked().
 *
 * BACKUP FORMAT:
 *   Exports use a .tff extension (Trier Fantasy Football). The file is
 *   encrypted with AES-GCM. Password is optional; a default key prevents
 *   casual plaintext edits without providing real security guarantees.
 */
// useRef: the hidden file input element for the .tff import trigger.
// useState: inline form state + create-franchise modal visibility.
import React, { useRef, useState, useEffect } from 'react';
import { useDialog } from './AppDialog';
import {
    Settings, Shield, Users, Lock, Download, Upload,
    Trash2, RefreshCw, HardDrive, Plus, Edit2, Radio, Bell, Sliders, Star
} from 'lucide-react';
import { getNotifPrefs, setNotifPref, type NotifEvent } from '../services/NotificationService';
import type { FantasyTeam, ScoringRuleset, DynastySettings, League } from '../types';
import { SCORING_PRESETS } from '../types';
// SecurityService wraps AES-GCM encryption/decryption for .tff backup files.
import { SecurityService } from '../utils/SecurityService';
// NFL_TEAMS is a complete list of 32 abbreviations used for the lock grid.
import { NFL_TEAMS } from '../utils/gamedayLogic';
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
    onImportTeam: (team: FantasyTeam) => void;
    lockedNFLTeams: string[];
    onToggleLock: (team: string) => void;
    onLockAll: () => void;
    onUnlockAll: () => void;
    onFetchSchedule: () => Promise<void>;
    scoringRuleset: ScoringRuleset;
    onUpdateRuleset: (ruleset: ScoringRuleset) => void;
    league: League;
    onUpdateDynastySettings: (settings: DynastySettings) => void;
    onChangeCommPassword: () => Promise<void>;
}

/**
 * SettingsPage — main component.
 * All mutation callbacks originate in App.tsx so this component stays free
 * of direct localStorage access except for the YouTube API key (admin-only).
 * The file import flow uses a hidden <input type="file"> triggered via ref
 * rather than a visible input for layout control.
 */
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
    onImportTeam,
    lockedNFLTeams,
    onToggleLock,
    onLockAll,
    onUnlockAll,
    onFetchSchedule,
    scoringRuleset,
    onUpdateRuleset,
    league,
    onUpdateDynastySettings,
    onChangeCommPassword,
}) => {
    // fileInputRef: the hidden <input type="file"> used for .tff import clicks.
    const fileInputRef = useRef<HTMLInputElement>(null);
    const rulesetFileRef = useRef<HTMLInputElement>(null);
    const [editingId, setEditingId] = useState<string | null>(null); // Which team is being edited inline
    const [isCreating, setIsCreating] = useState(false);
    // fetchingSchedule: prevents double-clicks on the Live Schedule button.
    const [fetchingSchedule, setFetchingSchedule] = useState(false);

    // Scoring editor state — a local copy of the ruleset so edits are staged before saving
    const [draftRuleset, setDraftRuleset] = useState<ScoringRuleset>(scoringRuleset);
    const [scoringExpanded, setScoringExpanded] = useState(false);
    // Sync whenever parent changes (e.g. import from file)
    useEffect(() => { setDraftRuleset(scoringRuleset); }, [scoringRuleset]);

    // Edit Form States — populated when editingId is set
    const [editName, setEditName] = useState('');
    const [editOwner, setEditOwner] = useState('');
    const [editPass, setEditPass] = useState('');

    // New Team Form States — cleared after successful creation
    const [newName, setNewName] = useState('');
    const [newOwner, setNewOwner] = useState('');
    const [newPass, setNewPass] = useState('');

    // commToken — per-session dashboard token fetched from Rust on admin login.
    // Empty string until admin mode is active in a Tauri context.
    const [commToken, setCommToken] = useState('');
    useEffect(() => {
        if (!isAdmin) { setCommToken(''); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(window as any).__TAURI__) return;
        import('@tauri-apps/api/tauri').then(({ invoke }) => {
            invoke<string>('get_comm_token').then(setCommToken).catch(() => {});
        });
    }, [isAdmin]);

    // notifPrefs — loaded from localStorage once; updates written back via setNotifPref.
    const [notifPrefs, setNotifPrefs] = useState(getNotifPrefs);

    const toggleNotif = (event: NotifEvent) => {
        const next = !notifPrefs[event];
        setNotifPref(event, next);
        setNotifPrefs(prev => ({ ...prev, [event]: next }));
    };

    const { showAlert, showConfirm, showPrompt } = useDialog();

    /**
     * Encrypts and downloads the team as a .tff file.
     * Always prompts for a separate backup password — team.password is now a PBKDF2 hash
     * and must not be reused as an AES encryption key.
     */
    const handleExport = async (team: FantasyTeam) => {
        try {
            // Backup password is separate from the team access password (which is now a hash)
            const encryptionPass =
                await showPrompt("Set a backup password (leave blank to skip):", "Backup Encryption", { placeholder: "Optional password..." }) ||
                undefined;
            // eslint-disable-next-line react-hooks/purity
            const securePayload = { version: 'v2', timestamp: Date.now(), teamData: team };
            const encryptedData = await SecurityService.encrypt(securePayload, encryptionPass);
            const finalPayload = { trier_secure_v2: true, payload: encryptedData };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalPayload));
            const dl = document.createElement('a');
            dl.setAttribute("href", dataStr);
            dl.setAttribute("download", `${team.name.replace(/\s+/g, '_')}_SECURE.tff`);
            dl.click();
        } catch { showAlert("Export failed. Please try again.", "Export Error"); }
    };

    // handleImportFile — decrypts and imports a .tff backup into the league.
    // Supports both legacy (raw JSON) and v2 (AES-GCM encrypted) formats.
    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const json = JSON.parse(ev.target?.result as string);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tryDecrypt = async (data: string): Promise<any> => {
                    try { return await SecurityService.decrypt(data, undefined); }
                    catch {
                        const pass = await showPrompt("This file is password-protected. Enter the password:", "Protected File");
                        if (!pass) throw new Error("Cancelled");
                        return await SecurityService.decrypt(data, pass);
                    }
                };

                if (json.trier_secure_v2) {
                    const decrypted = await tryDecrypt(json.payload);
                    onImportTeam(decrypted.teamData);
                    showAlert(`Successfully imported "${decrypted.teamData.name}".`, "Import Complete");
                }
            } catch { showAlert("Failed to import. The file may be corrupted or the password was wrong.", "Import Failed"); }
        };
        reader.readAsText(file);
    };

    return (
        <div style={{ color: 'white', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px', flexShrink: 0 }}>
                <Settings size={34} color="#eab308" />
                <h1 style={{
                    fontSize: '1.9rem', fontWeight: 900, margin: 0, textTransform: 'uppercase',
                    letterSpacing: '2px', color: 'transparent',
                    backgroundImage: `url(${leatherTexture})`, backgroundSize: '150px', backgroundPosition: 'center',
                    WebkitBackgroundClip: 'text', backgroundClip: 'text',
                    fontFamily: "'Graduate', 'Impact', sans-serif",
                    WebkitTextStroke: '1px rgba(255,255,255,0.95)', textShadow: '0 5px 15px rgba(0,0,0,0.9)'
                }}>
                    League Settings
                </h1>
            </div>

            {/* Two-column body — each column scrolls independently */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* ── LEFT COLUMN: Commissioner · Scoring · Dynasty ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', paddingBottom: '12px' }}>

                    {/* 1. Commissioner Center */}
                    <section style={cardStyle}>
                        <div style={headerStyle}>
                            <Shield size={20} color="#eab308" />
                            <h2 style={titleStyle}>Commissioner Center</h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '14px 16px', borderRadius: '10px' }}>
                                <div>
                                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>Admin Mode</div>
                                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{isAdmin ? 'Full access to league data enabled.' : 'Enable to manage all franchises.'}</div>
                                </div>
                                <button
                                    onClick={onToggleAdmin}
                                    title="Enable commissioner tools to force trades, edit active teams, or modify league settings."
                                    style={{ ...btnStyle, background: isAdmin ? '#ef4444' : '#eab308', color: isAdmin ? 'white' : 'black', padding: '8px 16px' }}
                                >
                                    {isAdmin ? 'EXIT ADMIN' : 'LOG IN'}
                                </button>
                            </div>

                            {isAdmin && (
                                <>
                                    {/* Change Commissioner password — only accessible while already logged in */}
                                    <button
                                        onClick={onChangeCommPassword}
                                        title="Change the Commissioner password for this league."
                                        style={{ ...btnStyle, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 16px' }}
                                    >
                                        <RefreshCw size={14} /> CHANGE COMMISSIONER PASSWORD
                                    </button>

                                    <button
                                        onClick={() => onCreateTeam('Test Team #' + Math.floor(Math.random() * 100), 'Dummy Coach', '1234')}
                                        title="Generate a dummy team for testing and layout verification."
                                        style={{ ...btnStyle, background: 'rgba(255,255,255,0.05)', border: '1px dashed #eab308', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 16px' }}
                                    >
                                        <Plus size={16} /> CREATE TEST FRANCHISE (ADMIN ONLY)
                                    </button>

                                    {/* Commissioner Dashboard link — token URL only visible to admin */}
                                    <div style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#eab308', fontFamily: "'Orbitron', sans-serif", letterSpacing: '1px', marginBottom: '3px' }}>COMMISSIONER DASHBOARD</div>
                                            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: '3px' }}>Browser control panel — localhost only. Token refreshes on each app launch.</div>
                                            {commToken
                                                ? <code style={{ fontSize: '0.68rem', color: '#34d399', display: 'block', wordBreak: 'break-all' }}>http://localhost:15434/?token={commToken}</code>
                                                : <code style={{ fontSize: '0.68rem', color: '#6b7280', display: 'block' }}>http://localhost:15434 (Tauri only)</code>
                                            }
                                        </div>
                                        <button
                                            onClick={() => navigator.clipboard?.writeText(commToken ? `http://localhost:15434/?token=${commToken}` : 'http://localhost:15434')}
                                            title="Copy dashboard URL to clipboard"
                                            style={{ ...btnStyle, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', fontSize: '0.72rem', padding: '5px 10px', flexShrink: 0, marginLeft: '10px' }}
                                        >
                                            COPY URL
                                        </button>
                                    </div>

                                    {/* ── NFL Game Day Locks ── */}
                                    <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                            <Radio size={14} color="#ef4444" />
                                            <span style={{ fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#ef4444' }}>Game Day Locks</span>
                                            {lockedNFLTeams.length > 0 && (
                                                <span style={{ fontSize: '0.68rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                                                    {lockedNFLTeams.length} LOCKED
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={async () => { setFetchingSchedule(true); await onFetchSchedule(); setFetchingSchedule(false); }}
                                                disabled={fetchingSchedule}
                                                title="Fetch live game status from ESPN — auto-locks teams currently playing."
                                                style={{ ...btnStyle, fontSize: '0.7rem', padding: '5px 10px', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px', opacity: fetchingSchedule ? 0.6 : 1 }}
                                            >
                                                <RefreshCw size={11} /> {fetchingSchedule ? 'FETCHING...' : 'LIVE SCHEDULE'}
                                            </button>
                                            <button onClick={onLockAll} title="Lock all 32 NFL teams (simulate full Sunday)." style={{ ...btnStyle, fontSize: '0.7rem', padding: '5px 10px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444' }}>LOCK ALL</button>
                                            <button onClick={onUnlockAll} title="Unlock all teams — open season mode." style={{ ...btnStyle, fontSize: '0.7rem', padding: '5px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#9ca3af' }}>UNLOCK ALL</button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {NFL_TEAMS.map(team => (
                                                <button
                                                    key={team}
                                                    onClick={() => onToggleLock(team)}
                                                    title={lockedNFLTeams.includes(team) ? `Unlock ${team}` : `Lock ${team}`}
                                                    style={{
                                                        padding: '3px 6px', borderRadius: '3px', fontSize: '0.6rem', fontWeight: 900,
                                                        cursor: 'pointer', border: '1px solid', transition: 'all 0.1s',
                                                        background: lockedNFLTeams.includes(team) ? '#ef4444' : 'transparent',
                                                        color: lockedNFLTeams.includes(team) ? '#fff' : '#6b7280',
                                                        borderColor: lockedNFLTeams.includes(team) ? '#ef4444' : 'rgba(255,255,255,0.15)'
                                                    }}
                                                >
                                                    {team}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                </>
                            )}
                        </div>
                    </section>

                    {/* 2. Data Operations */}
                    <section style={cardStyle}>
                        <div style={headerStyle}>
                            <HardDrive size={20} color="#eab308" />
                            <h2 style={titleStyle}>Data Operations</h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button onClick={() => fileInputRef.current?.click()} title="Restore league data from a previously exported .tff file." style={{ ...btnStyle, background: '#3b82f6', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Upload size={16} /> IMPORT DATA FROM FILE (.TFF)
                            </button>
                            {isAdmin && (
                                <button onClick={async () => {
                                    // Double-confirm to prevent accidental wipes — no undo possible
                                    if (await showConfirm("WARNING: This will permanently erase all teams, rosters, and settings. This cannot be undone.", "Factory Reset", "ERASE EVERYTHING")) {
                                        localStorage.clear();
                                        window.location.reload();
                                    }
                                }} title="Wipe all local data, clear cache, and start fresh (Irreversible)." style={{ ...btnStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <RefreshCw size={16} /> FACTORY RESET APP
                                </button>
                            )}
                        </div>
                    </section>

                    {/* 3. Manage Franchises — compact rows */}
                    <section style={cardStyle}>
                        <div style={headerStyle}>
                            <Users size={20} color="#eab308" />
                            <h2 style={titleStyle}>Manage Franchises</h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {teams.map(t => {
                                const active = t.id === activeTeamId;
                                const editing = editingId === t.id;
                                return (
                                    <div key={t.id} style={{
                                        background: active ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.03)',
                                        border: active ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '10px', padding: editing ? '14px' : '10px 14px', transition: 'all 0.2s'
                                    }}>
                                        {editing ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Team Name" style={inputStyle} />
                                                <input value={editOwner} onChange={e => setEditOwner(e.target.value)} placeholder="Owner Name" style={inputStyle} />
                                                <input type="password" value={editPass} onChange={e => setEditPass(e.target.value)} placeholder="Franchise Password" style={inputStyle} />
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={async () => {
                                                        if (!editName || !editOwner || !editPass) { await showAlert("Team Name, Coach Name, and Password are all required.", "Required Fields"); return; }
                                                        onUpdateDetails(t.id, editName, editOwner, editPass);
                                                        setEditingId(null);
                                                    }} style={{ ...btnStyle, flex: 1, background: '#10b981', padding: '8px 12px', fontSize: '0.82rem' }}>SAVE</button>
                                                    <button onClick={() => setEditingId(null)} style={{ ...btnStyle, flex: 1, background: '#64748b', padding: '8px 12px', fontSize: '0.82rem' }}>CANCEL</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {/* Name + owner */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: active ? '#eab308' : 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                                                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Coach: {t.ownerName}</div>
                                                </div>
                                                {t.password && <Lock size={13} color={active || isAdmin ? '#10b981' : '#ef4444'} style={{ flexShrink: 0 }} />}
                                                {/* Action buttons */}
                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                                                    {(active || isAdmin) && (
                                                        <>
                                                            <button onClick={() => handleExport(t)} title="Export backup (.tff)" style={compactIconBtn}><Download size={13} /></button>
                                                            <button onClick={() => {
                                                                const input = document.createElement('input');
                                                                input.type = 'file';
                                                                input.accept = '.tff,.json';
                                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                                input.onchange = (e: any) => {
                                                                    const file = e.target.files[0];
                                                                    const reader = new FileReader();
                                                                    reader.onload = async (ev) => {
                                                                        try {
                                                                            const json = JSON.parse(ev.target?.result as string);
                                                                            if (await showConfirm(`Overwrite "${t.name}" with data from this backup file?`, "Overwrite Franchise", "OVERWRITE")) {
                                                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                                                const tryDecrypt = async (data: string): Promise<any> => {
                                                                                    try { return await SecurityService.decrypt(data, undefined); }
                                                                                    catch {
                                                                                        const pass = await showPrompt("This file is password-protected:", "Enter Password");
                                                                                        return await SecurityService.decrypt(data, pass || '');
                                                                                    }
                                                                                };
                                                                                const decrypted = json.trier_secure_v2 ? await tryDecrypt(json.payload) : json;
                                                                                const teamData = decrypted.teamData || decrypted;
                                                                                onImportTeam({ ...teamData, id: t.id });
                                                                            }
                                                                        } catch { showAlert("Import failed. Check that the file is valid.", "Import Error"); }
                                                                    };
                                                                    reader.readAsText(file);
                                                                };
                                                                input.click();
                                                            }} title="Import/overwrite from backup" style={compactIconBtn}><Upload size={13} /></button>
                                                            <button onClick={() => { setEditingId(t.id); setEditName(t.name); setEditOwner(t.ownerName); }} title="Edit team details" style={compactIconBtn}><Edit2 size={13} /></button>
                                                        </>
                                                    )}
                                                    {isAdmin && t.password && (
                                                        <button
                                                            onClick={async () => {
                                                                const p = await showPrompt(`Set new password for "${t.name}" (leave blank to remove):`, "Reset Password", { placeholder: "New password..." });
                                                                if (p !== null) onResetOwnerPassword(t.id, p);
                                                            }}
                                                            title="Reset owner password"
                                                            style={{ ...compactIconBtn, color: '#eab308' }}
                                                        ><RefreshCw size={13} /></button>
                                                    )}
                                                    {!active && (
                                                        <button onClick={async () => {
                                                            const p = t.password ? await showPrompt(`Enter the password for "${t.name}":`, t.name, { placeholder: "Password..." }) : undefined;
                                                            if (t.password && p === null) return;
                                                            onSwitchTeam(t.id, p || undefined);
                                                        }} title="Log in as this team" style={{ ...btnStyle, fontSize: '0.68rem', padding: '4px 10px', background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308' }}>LOG IN</button>
                                                    )}
                                                    {isAdmin && (
                                                        <button onClick={async () => {
                                                            if (await showConfirm(`Permanently delete "${t.name}"? This cannot be undone.`, "Delete Franchise", "DELETE")) {
                                                                onDeleteTeam(t.id);
                                                            }
                                                        }} title="Delete franchise" style={{ ...compactIconBtn, color: '#ef4444' }}><Trash2 size={13} /></button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {/* Add franchise row */}
                            <div
                                onClick={() => setIsCreating(true)}
                                style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '46px', color: '#6b7280', gap: '8px', transition: 'all 0.2s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#eab308'; e.currentTarget.style.color = '#eab308'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#6b7280'; }}
                            >
                                <Plus size={18} />
                                <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>ADD FRANCHISE</div>
                            </div>
                        </div>
                    </section>

                    {/* 3. Dynasty Mode — admin only */}
                    {isAdmin && (
                        <section style={cardStyle}>
                            <div style={headerStyle}>
                                <Star size={20} color="#eab308" />
                                <h2 style={titleStyle}>Dynasty Mode</h2>
                            </div>
                            <p style={{ margin: '0 0 12px', color: '#9ca3af', fontSize: '0.8rem', lineHeight: 1.6 }}>
                                Season-to-season roster continuity. Managers designate keepers before each new season; all others return to the free agent pool.
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: '#f3f4f6', fontSize: '0.85rem' }}>Dynasty Mode</div>
                                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 1 }}>Enables Dynasty page and keeper selection</div>
                                </div>
                                <button
                                    onClick={() => onUpdateDynastySettings({
                                        ...(league.settings?.dynastySettings ?? { enabled: false, maxKeepers: 3, contractYearsEnabled: false }),
                                        enabled: !(league.settings?.dynastySettings?.enabled ?? false),
                                    })}
                                    style={{
                                        padding: '5px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem',
                                        background: league.settings?.dynastySettings?.enabled ? '#16a34a' : 'rgba(255,255,255,0.1)',
                                        color: league.settings?.dynastySettings?.enabled ? '#fff' : '#9ca3af', transition: 'all 0.2s',
                                    }}
                                >
                                    {league.settings?.dynastySettings?.enabled ? 'ENABLED' : 'DISABLED'}
                                </button>
                            </div>
                            {league.settings?.dynastySettings?.enabled && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, color: '#f3f4f6', fontSize: '0.82rem' }}>Max Keepers Per Team</div>
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 1 }}>Players each team can retain per off-season</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button onClick={() => onUpdateDynastySettings({ ...league.settings!.dynastySettings!, maxKeepers: Math.max(1, (league.settings?.dynastySettings?.maxKeepers ?? 3) - 1) })} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.4)', color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                                            <span style={{ minWidth: '2rem', textAlign: 'center', fontWeight: 800, color: '#eab308', fontSize: '1rem' }}>{league.settings?.dynastySettings?.maxKeepers ?? 3}</span>
                                            <button onClick={() => onUpdateDynastySettings({ ...league.settings!.dynastySettings!, maxKeepers: Math.min(10, (league.settings?.dynastySettings?.maxKeepers ?? 3) + 1) })} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.4)', color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#f3f4f6', fontSize: '0.82rem' }}>3-Year Contract Limit</div>
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 1 }}>Players expire after 3 seasons and return to free agency</div>
                                        </div>
                                        <button
                                            onClick={() => onUpdateDynastySettings({ ...league.settings!.dynastySettings!, contractYearsEnabled: !league.settings?.dynastySettings?.contractYearsEnabled })}
                                            style={{
                                                padding: '5px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem',
                                                background: league.settings?.dynastySettings?.contractYearsEnabled ? '#1d4ed8' : 'rgba(255,255,255,0.1)',
                                                color: league.settings?.dynastySettings?.contractYearsEnabled ? '#fff' : '#9ca3af', transition: 'all 0.2s',
                                            }}
                                        >
                                            {league.settings?.dynastySettings?.contractYearsEnabled ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </section>
                    )}
                </div>

                {/* ── RIGHT COLUMN: Franchises · Notifications · Data ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', paddingBottom: '12px' }}>

                    {/* 4. Scoring Format */}
                    <section style={cardStyle}>
                        <div style={headerStyle}>
                            <Sliders size={20} color="#eab308" />
                            <h2 style={titleStyle}>Scoring Format</h2>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {(Object.keys(SCORING_PRESETS) as Array<keyof typeof SCORING_PRESETS>).map(key => {
                                const active = draftRuleset.presetKey === key;
                                return (
                                    <button
                                        key={key}
                                        disabled={!isAdmin}
                                        onClick={() => setDraftRuleset({ ...SCORING_PRESETS[key] })}
                                        style={{
                                            padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem',
                                            fontFamily: "'Orbitron', sans-serif", cursor: isAdmin ? 'pointer' : 'default',
                                            border: active ? '2px solid #eab308' : '1px solid rgba(255,255,255,0.15)',
                                            background: active ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)',
                                            color: active ? '#eab308' : '#9ca3af',
                                        }}
                                    >
                                        {SCORING_PRESETS[key].name}
                                    </button>
                                );
                            })}
                            {draftRuleset.presetKey === 'Custom' && (
                                <span style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem', fontFamily: "'Orbitron', sans-serif", border: '2px solid #a78bfa', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>CUSTOM</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '10px' }}>
                            <span>Reception: <b style={{ color: '#f3f4f6' }}>{draftRuleset.receptionPoints} pt</b></span>
                            <span>Pass TD: <b style={{ color: '#f3f4f6' }}>{draftRuleset.passingTDPoints} pts</b></span>
                            <span>Rush/Rec TD: <b style={{ color: '#f3f4f6' }}>{draftRuleset.rushingTDPoints} pts</b></span>
                            {draftRuleset.tepBonus > 0 && <span>TEP Bonus: <b style={{ color: '#a78bfa' }}>+{draftRuleset.tepBonus} pts/TE catch</b></span>}
                            {draftRuleset.passing300YardBonus > 0 && <span>300-yd Bonus: <b style={{ color: '#34d399' }}>+{draftRuleset.passing300YardBonus}</b></span>}
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => setScoringExpanded(v => !v)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.78rem', marginBottom: scoringExpanded ? '14px' : 0 }}
                            >
                                <Sliders size={13} /> {scoringExpanded ? '▲ Hide custom weights' : '▼ Edit custom weights'}
                            </button>
                        )}
                        {scoringExpanded && isAdmin && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {([
                                    { label: 'PASSING', fields: [
                                        ['Pass yards per pt', 'passingYardsPerPoint'],
                                        ['Pass TD pts', 'passingTDPoints'],
                                        ['INT pts', 'passingINTPoints'],
                                        ['300-yd bonus', 'passing300YardBonus'],
                                        ['400-yd bonus', 'passing400YardBonus'],
                                    ]},
                                    { label: 'RUSHING', fields: [
                                        ['Rush yards per pt', 'rushingYardsPerPoint'],
                                        ['Rush TD pts', 'rushingTDPoints'],
                                        ['100-yd bonus', 'rushing100YardBonus'],
                                        ['200-yd bonus', 'rushing200YardBonus'],
                                    ]},
                                    { label: 'RECEIVING', fields: [
                                        ['Rec yards per pt', 'receivingYardsPerPoint'],
                                        ['Rec TD pts', 'receivingTDPoints'],
                                        ['Reception pts', 'receptionPoints'],
                                        ['TE bonus/catch', 'tepBonus'],
                                        ['100-yd bonus', 'receiving100YardBonus'],
                                        ['200-yd bonus', 'receiving200YardBonus'],
                                    ]},
                                    { label: 'MISC', fields: [['Fumble lost pts', 'fumbleLostPoints']]},
                                    { label: 'KICKER', fields: [
                                        ['FG under 40', 'fgUnder40Points'],
                                        ['FG 40–49', 'fg40to49Points'],
                                        ['FG 50+', 'fg50plusPoints'],
                                        ['XP', 'xpPoints'],
                                        ['Missed XP', 'missedXPPoints'],
                                    ]},
                                    { label: 'D/ST', fields: [
                                        ['Sack', 'dstSackPoints'],
                                        ['INT', 'dstINTPoints'],
                                        ['TD', 'dstTDPoints'],
                                        ['Safety', 'dstSafetyPoints'],
                                        ['Fumble rec', 'dstFumbleRecPoints'],
                                    ]},
                                    { label: 'IDP', fields: [
                                        ['Solo tackle', 'soloTacklePoints'],
                                        ['Assisted tackle', 'assistedTacklePoints'],
                                        ['Sack', 'idpSackPoints'],
                                        ['TFL', 'tflPoints'],
                                        ['Pass deflection', 'passDefPoints'],
                                        ['QB hit', 'qbHitPoints'],
                                        ['Forced fumble', 'ffPoints'],
                                        ['Blocked kick', 'blockedKickPoints'],
                                    ]},
                                ] as { label: string; fields: [string, keyof ScoringRuleset][] }[]).map(({ label, fields }) => (
                                    <div key={label}>
                                        <div style={{ fontSize: '0.68rem', fontFamily: "'Orbitron', sans-serif", color: '#eab308', letterSpacing: '1px', marginBottom: '6px' }}>{label}</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px' }}>
                                            {fields.map(([fieldLabel, key]) => (
                                                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ fontSize: '0.66rem', color: '#6b7280' }}>{fieldLabel}</span>
                                                    <input
                                                        type="number" step="0.5"
                                                        value={draftRuleset[key] as number}
                                                        onChange={e => setDraftRuleset(prev => ({ ...prev, presetKey: 'Custom', name: 'Custom', [key]: parseFloat(e.target.value) || 0 }))}
                                                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: '#f3f4f6', padding: '3px 6px', fontSize: '0.8rem', width: '100%' }}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {isAdmin && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <button
                                    onClick={() => onUpdateRuleset(draftRuleset)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(234,179,8,0.15)', border: '1px solid #eab308', color: '#eab308', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Orbitron', sans-serif" }}
                                >
                                    SAVE FORMAT
                                </button>
                                <button
                                    onClick={() => {
                                        const blob = new Blob([JSON.stringify(draftRuleset, null, 2)], { type: 'application/json' });
                                        const a = document.createElement('a');
                                        a.href = URL.createObjectURL(blob);
                                        a.download = `${draftRuleset.name.replace(/\s+/g, '_')}.tffr`;
                                        a.click();
                                        URL.revokeObjectURL(a.href);
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#9ca3af', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                    <Download size={13} /> Export .tffr
                                </button>
                                <button
                                    onClick={() => rulesetFileRef.current?.click()}
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#9ca3af', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                    <Upload size={13} /> Import .tffr
                                </button>
                                <input
                                    ref={rulesetFileRef}
                                    type="file" accept=".tffr,.json" style={{ display: 'none' }}
                                    onChange={async e => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            const text = await file.text();
                                            const parsed = JSON.parse(text) as ScoringRuleset;
                                            // Basic validation — must have the key fields
                                            if (typeof parsed.receptionPoints !== 'number') throw new Error('Invalid .tffr file');
                                            setDraftRuleset(parsed);
                                        } catch { alert('Could not import ruleset — invalid .tffr file.'); }
                                        e.target.value = '';
                                    }}
                                />
                            </div>
                        )}
                    </section>

                    {/* 5. Push Notifications */}
                    <section style={cardStyle}>
                        <div style={headerStyle}>
                            <Bell size={20} color="#eab308" />
                            <h2 style={titleStyle}>Push Notifications</h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(
                                [
                                    { key: 'trade_offer',    label: 'Trade Offer Received',     desc: 'Another manager wants to buy one of your players' },
                                    { key: 'trade_accepted', label: 'Trade Accepted',            desc: 'Your outgoing offer was accepted' },
                                    { key: 'trade_declined', label: 'Trade Declined',            desc: 'Your outgoing offer was declined' },
                                    { key: 'peer_connect',   label: 'Peer Connect / Disconnect', desc: 'A league peer comes online or goes offline' },
                                    { key: 'gameday_lock',   label: 'Gameday Lock',              desc: 'NFL teams lock when their game kicks off' },
                                ] as { key: NotifEvent; label: string; desc: string }[]
                            ).map(({ key, label, desc }) => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '10px 14px', gap: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{label}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '1px' }}>{desc}</div>
                                    </div>
                                    {/* Toggle pill */}
                                    <button
                                        onClick={() => toggleNotif(key)}
                                        title={notifPrefs[key] ? `Disable ${label} notifications` : `Enable ${label} notifications`}
                                        style={{
                                            flexShrink: 0, width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                            background: notifPrefs[key] ? '#10b981' : 'rgba(255,255,255,0.12)',
                                            position: 'relative', transition: 'background 0.2s',
                                        }}
                                    >
                                        <span style={{
                                            position: 'absolute', top: '2px', width: '20px', height: '20px',
                                            borderRadius: '50%', background: 'white', transition: 'left 0.2s',
                                            left: notifPrefs[key] ? '22px' : '2px',
                                        }} />
                                    </button>
                                </div>
                            ))}
                            <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '2px' }}>
                                Native OS alerts (Tauri) or browser notifications as fallback. OS may prompt for permission on first use.
                            </div>
                        </div>
                    </section>

                </div>
            </div>

            {/* CREATE FRANCHISE MODAL */}
            {isCreating && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ ...cardStyle, width: '420px', maxWidth: '90%' }}>
                        <div style={headerStyle}>
                            <Plus size={22} color="#eab308" />
                            <h2 style={titleStyle}>Establish New Franchise</h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', color: '#9ca3af', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700 }}>TEAM NAME</label>
                                <input type="text" placeholder="e.g. Gotham Knights" value={newName} onChange={e => setNewName(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#9ca3af', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700 }}>COACH NAME</label>
                                <input type="text" placeholder="e.g. Bruce Wayne" value={newOwner} onChange={e => setNewOwner(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#9ca3af', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700 }}>SECURITY PASSWORD</label>
                                <input type="password" placeholder="Set a strong password..." value={newPass} onChange={e => setNewPass(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                                <button
                                    onClick={async () => {
                                        if (!newName || !newOwner || !newPass) { await showAlert("Team Name, Coach Name, and Password are all required.", "Required Fields"); return; }
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

            {/* Hidden file input — triggered programmatically by the Import button */}
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".tff,.json" onChange={handleImportFile} />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared style objects — defined at module level so they don't recreate on
// every render. All use CSSProperties for IDE autocomplete.
// Keeping styles outside the component prevents a new object allocation on
// every render cycle, which is measurable when the franchise list is large.
// ─────────────────────────────────────────────────────────────────────────────

// cardStyle — base panel container; heavy blur + dark tint for legibility.
const cardStyle: React.CSSProperties = {
    background: 'rgba(15, 23, 42, 0.9)',
    backdropFilter: 'blur(12px)',
    borderRadius: '24px',
    padding: 'clamp(15px, 3vh, 30px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
};

// headerStyle — section heading row with icon + title + bottom divider.
const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: 'clamp(12px, 2.5vh, 24px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: 'clamp(8px, 1.5vh, 15px)'
};

// titleStyle — uppercase section label; matches the stadium placard aesthetic.
const titleStyle: React.CSSProperties = {
    fontSize: '1.2rem',
    fontWeight: 900,
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '1px'
};

// btnStyle — primary action button; background/color overridden per usage site.
const btnStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '0.9rem'
};

// inputStyle — text fields in the edit/create forms; dark background for contrast.
const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '10px 15px',
    color: 'white',
    fontSize: '0.95rem'
};

// actionBtnStyle — ghost button for per-franchise actions (Backup / Import / Edit).
// Uses no background so it doesn't visually compete with the franchise card.
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

// compactIconBtn — small icon-only ghost button used in compact franchise rows.
const compactIconBtn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
};
