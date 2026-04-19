/**
 * SettingsPage — League Administration & Team Management
 * ========================================================
 * Central hub for all configuration that isn't part of normal gameplay:
 *
 *  1. Commissioner Center — toggle admin mode, create test franchises,
 *     manage Game Day locks per NFL team, configure YouTube API key.
 *
 *  2. Sideband Network — shows discovered and connected P2P peers.
 *
 *  3. Team Management — edit team name/owner/password, export/import .tff
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
    Trash2, RefreshCw, Globe, HardDrive, Plus, Edit2, Youtube, Radio, Bell, Sliders
} from 'lucide-react';
import { getNotifPrefs, setNotifPref, type NotifEvent } from '../services/NotificationService';
import type { FantasyTeam, ScoringRuleset } from '../types';
import { SCORING_PRESETS } from '../types';
// SecurityService wraps AES-GCM encryption/decryption for .tff backup files.
import { SecurityService } from '../utils/SecurityService';
// NetworkHealth renders real-time P2P diagnostics inside the Sideband panel.
import { NetworkHealth } from './diagnostics/NetworkHealth';
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
    peers: string[];         // Discovered but not yet connected peers
    connectedPeers: string[]; // VERIFIED WebRTC connections with full game-data access
    onImportTeam: (team: FantasyTeam) => void;
    lockedNFLTeams: string[];
    onToggleLock: (team: string) => void;
    onLockAll: () => void;
    onUnlockAll: () => void;
    onFetchSchedule: () => Promise<void>;
    scoringRuleset: ScoringRuleset;
    onUpdateRuleset: (ruleset: ScoringRuleset) => void;
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
    peers,
    connectedPeers,
    onImportTeam,
    lockedNFLTeams,
    onToggleLock,
    onLockAll,
    onUnlockAll,
    onFetchSchedule,
    scoringRuleset,
    onUpdateRuleset,
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

    // notifPrefs — loaded from localStorage once; updates written back via setNotifPref.
    const [notifPrefs, setNotifPrefs] = useState(getNotifPrefs);

    const toggleNotif = (event: NotifEvent) => {
        const next = !notifPrefs[event];
        setNotifPref(event, next);
        setNotifPrefs(prev => ({ ...prev, [event]: next }));
    };

    // YouTube API key — decrypted from localStorage on mount, displayed in plaintext UI field.
    // localStorage always holds the enc1: encrypted form; plaintext only lives in React state.
    const [ytApiKey, setYtApiKey] = useState('');
    useEffect(() => {
        const loadApiKey = async () => {
            const raw = localStorage.getItem('trier_yt_api_key');
            if (!raw) return;
            if (raw.startsWith('enc1:')) {
                // Decrypt stored key for display
                const { IdentityService } = await import('../services/IdentityService');
                const plain = await IdentityService.decryptSecret(raw);
                if (plain) setYtApiKey(plain);
            } else {
                // Legacy plaintext — display as-is and migrate to encrypted on next save
                setYtApiKey(raw);
            }
        };
        loadApiKey();
    }, []);
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
                            <>
                                <button
                                    onClick={() => onCreateTeam('Test Team #' + Math.floor(Math.random() * 100), 'Dummy Coach', '1234')}
                                    title="Generate a dummy team for testing and layout verification."
                                    style={{ ...btnStyle, background: 'rgba(255,255,255,0.05)', border: '1px dashed #eab308', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <Plus size={18} /> CREATE TEST FRANCHISE (ADMIN ONLY)
                                </button>

                                {/* Commissioner Dashboard link — only visible when admin */}
                                <div style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '10px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#eab308', fontFamily: "'Orbitron', sans-serif", letterSpacing: '1px', marginBottom: '4px' }}>
                                            COMMISSIONER DASHBOARD
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                                            Browser-based control panel. Open on any browser on this machine.
                                        </div>
                                        <code style={{ fontSize: '0.8rem', color: '#34d399', marginTop: '4px', display: 'block' }}>
                                            http://localhost:15434
                                        </code>
                                    </div>
                                    <button
                                        onClick={() => navigator.clipboard?.writeText('http://localhost:15434')}
                                        title="Copy URL to clipboard"
                                        style={{ ...btnStyle, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', fontSize: '0.75rem', padding: '6px 12px' }}
                                    >
                                        COPY URL
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ── NFL Game Day Locks ─────────────────────────────────── */}
                        {isAdmin && (
                            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                                    <Radio size={16} color="#ef4444" />
                                    <span style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#ef4444' }}>Game Day Locks</span>
                                    {lockedNFLTeams.length > 0 && (
                                        <span style={{ fontSize: '0.7rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                                            {lockedNFLTeams.length} LOCKED
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={async () => {
                                            setFetchingSchedule(true);
                                            await onFetchSchedule();
                                            setFetchingSchedule(false);
                                        }}
                                        disabled={fetchingSchedule}
                                        title="Fetch live game status from ESPN — auto-locks teams currently playing."
                                        style={{ ...btnStyle, fontSize: '0.75rem', padding: '6px 12px', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', opacity: fetchingSchedule ? 0.6 : 1 }}
                                    >
                                        <RefreshCw size={12} /> {fetchingSchedule ? 'FETCHING...' : 'LIVE SCHEDULE'}
                                    </button>
                                    <button onClick={onLockAll} title="Lock all 32 NFL teams (simulate full Sunday)." style={{ ...btnStyle, fontSize: '0.75rem', padding: '6px 12px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444' }}>
                                        LOCK ALL
                                    </button>
                                    <button onClick={onUnlockAll} title="Unlock all teams — open season mode." style={{ ...btnStyle, fontSize: '0.75rem', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#9ca3af' }}>
                                        UNLOCK ALL
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                    {NFL_TEAMS.map(team => (
                                        <button
                                            key={team}
                                            onClick={() => onToggleLock(team)}
                                            title={lockedNFLTeams.includes(team) ? `Unlock ${team}` : `Lock ${team}`}
                                            style={{
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900,
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
                        )}

                        {/* ── YouTube API Key ───────────────────────────────────── */}
                        {isAdmin && (
                            <div style={{ background: 'rgba(255,0,0,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '18px' }}>
                                {/* Header row with status badge */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                    <Youtube size={16} color="#ef4444" />
                                    <span style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>YouTube API Key</span>
                                    <span style={{ fontSize: '0.65rem', color: ytApiKey ? '#10b981' : '#6b7280', fontWeight: 700 }}>
                                        {ytApiKey ? '● CONFIGURED' : '○ MOCK MODE'}
                                    </span>
                                </div>

                                {/* Brief description */}
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '12px', lineHeight: 1.5 }}>
                                    A free YouTube Data API v3 key enables real player highlight search and game film.
                                    Without one, the video pipeline uses demo data only.
                                </div>

                                {/* Step-by-step setup instructions */}
                                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.7 }}>
                                    <div style={{ fontWeight: 700, color: '#d1d5db', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.68rem' }}>How to get a free key (2 minutes)</div>
                                    <div>1. Click <strong style={{ color: '#ef4444' }}>GET API KEY</strong> below — opens Google Cloud Console</div>
                                    <div>2. Sign in with any Google account and create a project (e.g. "TrierFantasy")</div>
                                    <div>3. In the left menu go to <strong style={{ color: '#d1d5db' }}>APIs &amp; Services → Library</strong></div>
                                    <div>4. Search for <strong style={{ color: '#d1d5db' }}>YouTube Data API v3</strong> and click <strong style={{ color: '#d1d5db' }}>Enable</strong></div>
                                    <div>5. Go to <strong style={{ color: '#d1d5db' }}>APIs &amp; Services → Credentials → Create Credentials → API Key</strong></div>
                                    <div>6. Copy the key (starts with <code style={{ color: '#fbbf24' }}>AIza</code>) and paste it below</div>
                                    <div style={{ marginTop: '6px', color: '#6b7280' }}>Free quota: 10,000 units/day — more than enough for a fantasy league.</div>
                                </div>

                                {/* Open Google Cloud Console button */}
                                <button
                                    onClick={() => {
                                        // shell.open is allowed in tauri.conf.json allowlist
                                        (window as any).__TAURI__?.shell?.open('https://console.cloud.google.com/apis/library/youtube.googleapis.com');
                                    }}
                                    style={{ ...btnStyle, padding: '6px 14px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.75rem', marginBottom: '10px' }}
                                >
                                    GET API KEY →
                                </button>

                                {/* Key input + save */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="password"
                                        placeholder="AIza..."
                                        value={ytApiKey}
                                        onChange={e => setYtApiKey(e.target.value)}
                                        style={{ ...inputStyle, flex: 1, fontSize: '0.85rem' }}
                                    />
                                    <button
                                        onClick={async () => {
                                            const trimmed = ytApiKey.trim();
                                            if (trimmed) {
                                                // Encrypt before storing — plaintext never touches localStorage
                                                const { IdentityService } = await import('../services/IdentityService');
                                                const encrypted = await IdentityService.encryptSecret(trimmed);
                                                localStorage.setItem('trier_yt_api_key', encrypted);
                                            } else {
                                                localStorage.removeItem('trier_yt_api_key');
                                            }
                                            showAlert(trimmed ? 'YouTube API key saved (encrypted). Real video search is now active.' : 'API key cleared. Pipeline will use demo data.', 'Saved');
                                        }}
                                        style={{ ...btnStyle, padding: '8px 14px', background: '#10b981', color: '#000', fontSize: '0.8rem' }}
                                    >
                                        SAVE
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </section>

                {/* 2. Scoring Format */}
                <section style={cardStyle}>
                    <div style={headerStyle}>
                        <Sliders size={22} color="#eab308" />
                        <h2 style={titleStyle}>Scoring Format</h2>
                    </div>

                    {/* Preset buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {(Object.keys(SCORING_PRESETS) as Array<keyof typeof SCORING_PRESETS>).map(key => {
                            const active = draftRuleset.presetKey === key;
                            return (
                                <button
                                    key={key}
                                    disabled={!isAdmin}
                                    onClick={() => setDraftRuleset({ ...SCORING_PRESETS[key] })}
                                    style={{
                                        padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem',
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
                        {/* Custom badge — shown when user has diverged from any preset */}
                        {draftRuleset.presetKey === 'Custom' && (
                            <span style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontFamily: "'Orbitron', sans-serif", border: '2px solid #a78bfa', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                                CUSTOM
                            </span>
                        )}
                    </div>

                    {/* Current format summary */}
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#9ca3af', marginBottom: '12px' }}>
                        <span>Reception: <b style={{ color: '#f3f4f6' }}>{draftRuleset.receptionPoints} pt</b></span>
                        <span>Pass TD: <b style={{ color: '#f3f4f6' }}>{draftRuleset.passingTDPoints} pts</b></span>
                        <span>Rush/Rec TD: <b style={{ color: '#f3f4f6' }}>{draftRuleset.rushingTDPoints} pts</b></span>
                        {draftRuleset.tepBonus > 0 && <span>TEP Bonus: <b style={{ color: '#a78bfa' }}>+{draftRuleset.tepBonus} pts/TE catch</b></span>}
                        {draftRuleset.passing300YardBonus > 0 && <span>300-yd Bonus: <b style={{ color: '#34d399' }}>+{draftRuleset.passing300YardBonus}</b></span>}
                    </div>

                    {/* Expand/collapse custom weight editor — admin-only */}
                    {isAdmin && (
                        <button
                            onClick={() => setScoringExpanded(v => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem', marginBottom: scoringExpanded ? '16px' : 0 }}
                        >
                            <Sliders size={14} /> {scoringExpanded ? '▲ Hide custom weights' : '▼ Edit custom weights'}
                        </button>
                    )}

                    {scoringExpanded && isAdmin && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Helper: a labeled number input row */}
                            {([
                                { label: 'PASSING', fields: [
                                    ['Pass yards per pt', 'passingYardsPerPoint'],
                                    ['Pass TD pts', 'passingTDPoints'],
                                    ['INT pts', 'passingINTPoints'],
                                    ['300-yd game bonus', 'passing300YardBonus'],
                                    ['400-yd game bonus', 'passing400YardBonus'],
                                ]},
                                { label: 'RUSHING', fields: [
                                    ['Rush yards per pt', 'rushingYardsPerPoint'],
                                    ['Rush TD pts', 'rushingTDPoints'],
                                    ['100-yd rush bonus', 'rushing100YardBonus'],
                                    ['200-yd rush bonus', 'rushing200YardBonus'],
                                ]},
                                { label: 'RECEIVING', fields: [
                                    ['Rec yards per pt', 'receivingYardsPerPoint'],
                                    ['Rec TD pts', 'receivingTDPoints'],
                                    ['Reception pts', 'receptionPoints'],
                                    ['TE bonus per catch', 'tepBonus'],
                                    ['100-yd rec bonus', 'receiving100YardBonus'],
                                    ['200-yd rec bonus', 'receiving200YardBonus'],
                                ]},
                                { label: 'MISC', fields: [
                                    ['Fumble lost pts', 'fumbleLostPoints'],
                                ]},
                                { label: 'KICKER', fields: [
                                    ['FG under 40 pts', 'fgUnder40Points'],
                                    ['FG 40–49 pts', 'fg40to49Points'],
                                    ['FG 50+ pts', 'fg50plusPoints'],
                                    ['XP pts', 'xpPoints'],
                                    ['Missed XP pts', 'missedXPPoints'],
                                ]},
                                { label: 'D/ST', fields: [
                                    ['Sack pts', 'dstSackPoints'],
                                    ['INT pts', 'dstINTPoints'],
                                    ['TD pts', 'dstTDPoints'],
                                    ['Safety pts', 'dstSafetyPoints'],
                                    ['Fumble rec pts', 'dstFumbleRecPoints'],
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
                                    <div style={{ fontSize: '0.7rem', fontFamily: "'Orbitron', sans-serif", color: '#eab308', letterSpacing: '1px', marginBottom: '8px' }}>{label}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                                        {fields.map(([fieldLabel, key]) => (
                                            <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{fieldLabel}</span>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={draftRuleset[key] as number}
                                                    onChange={e => setDraftRuleset(prev => ({
                                                        ...prev,
                                                        presetKey: 'Custom',
                                                        name: 'Custom',
                                                        [key]: parseFloat(e.target.value) || 0,
                                                    }))}
                                                    style={{
                                                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                                                        borderRadius: '4px', color: '#f3f4f6', padding: '4px 8px',
                                                        fontSize: '0.85rem', width: '100%',
                                                    }}
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Save / Export / Import row — commissioner-only */}
                    {isAdmin && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <button
                                onClick={() => { onUpdateRuleset(draftRuleset); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(234,179,8,0.15)', border: '1px solid #eab308', color: '#eab308', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Orbitron', sans-serif" }}
                            >
                                SAVE FORMAT
                            </button>
                            {/* Export active ruleset as .tffr file */}
                            <button
                                onClick={() => {
                                    const blob = new Blob([JSON.stringify(draftRuleset, null, 2)], { type: 'application/json' });
                                    const a = document.createElement('a');
                                    a.href = URL.createObjectURL(blob);
                                    a.download = `${draftRuleset.name.replace(/\s+/g, '_')}.tffr`;
                                    a.click();
                                    URL.revokeObjectURL(a.href);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#9ca3af', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                                <Download size={14} /> Export .tffr
                            </button>
                            {/* Import a .tffr ruleset file */}
                            <button
                                onClick={() => rulesetFileRef.current?.click()}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#9ca3af', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                                <Upload size={14} /> Import .tffr
                            </button>
                            <input
                                ref={rulesetFileRef}
                                type="file"
                                accept=".tffr,.json"
                                style={{ display: 'none' }}
                                onChange={async e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                        const text = await file.text();
                                        const parsed = JSON.parse(text) as ScoringRuleset;
                                        // Basic validation — must have the key fields
                                        if (typeof parsed.receptionPoints !== 'number') throw new Error('Invalid .tffr file');
                                        setDraftRuleset(parsed);
                                    } catch {
                                        alert('Could not import ruleset — invalid .tffr file.');
                                    }
                                    e.target.value = '';
                                }}
                            />
                        </div>
                    )}
                </section>

                {/* 3. Sideband Status */}
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

                {/* ── Franchise Management ─────────────────────────────────────────── */}
                {/* Spans full grid width so franchise cards don't wrap awkwardly      */}
                <section style={{ ...cardStyle, gridColumn: '1 / -1' }}>
                    <div style={headerStyle}>
                        <Users size={22} color="#eab308" />
                        <h2 style={titleStyle}>Manage Franchises</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                        {teams.map(t => {
                            const active = t.id === activeTeamId;
                            const editing = editingId === t.id;
                            // Only the active owner (or admin) can edit/backup their own franchise.
                            // Gold border on active team card for quick visual identification.
                            // editingId drives the inline form; null = display mode.
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
                                                <button onClick={async () => {
                                                    if (!editName || !editOwner || !editPass) {
                                                        await showAlert("Team Name, Coach Name, and Password are all required.", "Required Fields");
                                                        return;
                                                    }
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
                                                            onClick={async () => {
                                                                const p = await showPrompt(`Set new password for "${t.name}" (leave blank to remove password):`, "Reset Password", { placeholder: "New password..." });
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
                                                        <button onClick={async () => {
                                                            const p = t.password ? await showPrompt(`Enter the password for "${t.name}":`, t.name, { placeholder: "Password..." }) : undefined;
                                                            if (t.password && p === null) return; // cancelled
                                                            onSwitchTeam(t.id, p || undefined);
                                                        }} title="Log in as this coach to manage roster and trades." style={{ ...btnStyle, fontSize: '0.8rem', padding: '6px 12px' }}>SWITCH</button>
                                                    )}
                                                    {isAdmin && (
                                                        <button onClick={async () => {
                                                            if (await showConfirm(`Permanently delete "${t.name}"? This cannot be undone.`, "Delete Franchise", "DELETE")) {
                                                                onDeleteTeam(t.id);
                                                            }
                                                        }} title="Permanently remove this franchise from the league." style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}><Trash2 size={16} /></button>
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

                {/* ── Push Notifications ───────────────────────────────────────────── */}
                <section style={cardStyle}>
                    <div style={headerStyle}>
                        <Bell size={22} color="#eab308" />
                        <h2 style={titleStyle}>Push Notifications</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {(
                            [
                                { key: 'trade_offer',    label: 'Trade Offer Received',    desc: 'Another manager wants to buy one of your players' },
                                { key: 'trade_accepted', label: 'Trade Accepted',           desc: 'Your outgoing offer was accepted by the seller' },
                                { key: 'trade_declined', label: 'Trade Declined',           desc: 'Your outgoing offer was declined' },
                                { key: 'peer_connect',   label: 'Peer Connect / Disconnect',desc: 'A league peer comes online or goes offline' },
                                { key: 'gameday_lock',   label: 'Gameday Lock',             desc: 'NFL teams lock when their game kicks off' },
                            ] as { key: NotifEvent; label: string; desc: string }[]
                        ).map(({ key, label, desc }) => (
                            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px 16px', gap: '16px' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{desc}</div>
                                </div>
                                {/* Toggle pill */}
                                <button
                                    onClick={() => toggleNotif(key)}
                                    title={notifPrefs[key] ? `Disable ${label} notifications` : `Enable ${label} notifications`}
                                    style={{
                                        flexShrink: 0,
                                        width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                                        background: notifPrefs[key] ? '#10b981' : 'rgba(255,255,255,0.12)',
                                        position: 'relative', transition: 'background 0.2s',
                                    }}
                                >
                                    <span style={{
                                        position: 'absolute', top: '3px', width: '20px', height: '20px',
                                        borderRadius: '50%', background: 'white', transition: 'left 0.2s',
                                        left: notifPrefs[key] ? '25px' : '3px',
                                    }} />
                                </button>
                            </div>
                        ))}
                        <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '4px' }}>
                            Notifications use native OS alerts (Tauri) or browser notifications as a fallback.
                            Your OS may prompt for permission on first use.
                        </div>
                    </div>
                </section>

                {/* ── Data Operations ──────────────────────────────────────────────── */}
                {/* Import is always available; Factory Reset requires admin confirmation */}
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
                            <button onClick={async () => {
                                // Double-confirm to prevent accidental wipes — no undo possible
                                if (await showConfirm("WARNING: This will permanently erase all teams, rosters, and settings. This cannot be undone.", "Factory Reset", "ERASE EVERYTHING")) {
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
                                        onClick={async () => {
                                            if (!newName || !newOwner || !newPass) {
                                                await showAlert("Team Name, Coach Name, and Password are all required.", "Required Fields");
                                                return;
                                            }
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
