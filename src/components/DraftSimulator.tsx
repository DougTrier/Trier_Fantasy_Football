/**
 * DraftSimulator — Snake draft with AI opponents
 * ================================================
 * Three phases: Config → Draft Room → Results.
 * AI opponents pick using ADP + positional need logic.
 * Mock mode: practice only. Real mode: saves drafted roster as a new team.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Info, X } from 'lucide-react';
import type { Player, FantasyTeam } from '../types';
import leatherTexture from '../assets/leather_texture.png';

// ── Constants ─────────────────────────────────────────────────────────────────

const POS_COLOR: Record<string, string> = {
    QB: '#eab308', RB: '#10b981', WR: '#3b82f6',
    TE: '#a855f7', K: '#9ca3af', DST: '#ef4444',
};

// Minimum starter counts per position the AI tries to fill
const STARTER_NEEDS: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 };

const AI_NAMES = [
    'Iron Pigskin', 'Gridiron Ghosts', 'Blitz Kings', 'Red Zone Raiders',
    'Fourth & Long', 'Hail Mary FC', 'Sack Masters', 'The End Zones',
    'Turf Burners', 'Two-Minute Drill', 'Coffin Corner', 'Blitz Brothers',
    'Goalpost Gang', 'False Start FC', 'Encroachment United',
];

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'];

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftConfig {
    numTeams: number;
    userSlot: number;      // 1-indexed
    timerSeconds: number;  // 0 = off
    numRounds: number;
    mockMode: boolean;
    teamName: string;
    ownerName: string;
}

interface DraftPick {
    overall: number;
    round: number;
    pickInRound: number;
    teamSlot: number;
    player: Player;
}

export interface DraftSimulatorProps {
    allPlayers: Player[];
    myTeam?: FantasyTeam | null;
    onSaveTeam: (team: FantasyTeam) => void;
    onExit: () => void;
}

// ── Snake draft helpers ───────────────────────────────────────────────────────

// Returns the 1-indexed team slot whose turn it is for a given overall pick number
function getTeamForPick(overall: number, n: number): number {
    const round = Math.ceil(overall / n);
    const pos = overall - (round - 1) * n;
    return round % 2 === 1 ? pos : n - pos + 1;
}

// ── AI pick logic ─────────────────────────────────────────────────────────────

function aiPickPlayer(slot: number, byTeam: Record<number, Player[]>, pool: Player[]): Player {
    const mine = byTeam[slot] || [];
    const counts: Record<string, number> = {};
    mine.forEach(p => { counts[p.position] = (counts[p.position] || 0) + 1; });
    const sorted = [...pool].sort((a, b) => (a.adp ?? 999) - (b.adp ?? 999));
    const round = mine.length + 1;

    // Late rounds: fill positional needs first
    if (round > 8) {
        for (const [pos, need] of Object.entries(STARTER_NEEDS)) {
            if ((counts[pos] || 0) < need) {
                const c = sorted.find(p => p.position === pos);
                if (c) return c;
            }
        }
    }

    // Early rounds: best available, avoid triple-stacking one position
    for (let i = 0; i < Math.min(5, sorted.length); i++) {
        const p = sorted[i];
        const need = STARTER_NEEDS[p.position] ?? 2;
        if ((counts[p.position] || 0) < need * 2) return p;
    }

    return sorted[0];
}

// ── Build FantasyTeam from draft picks ────────────────────────────────────────

function buildTeamFromPicks(picks: Player[], name: string, owner: string): FantasyTeam {
    const slotOrder: Array<keyof FantasyTeam['roster']> = [
        'qb', 'rb1', 'rb2', 'wr1', 'wr2', 'te', 'flex', 'k', 'dst',
    ];
    const allowed: Record<string, string[]> = {
        qb: ['QB'], rb1: ['RB'], rb2: ['RB'],
        wr1: ['WR'], wr2: ['WR'], te: ['TE'],
        flex: ['RB', 'WR', 'TE'], k: ['K'], dst: ['DST'],
    };
    const roster: FantasyTeam['roster'] = {
        qb: null, rb1: null, rb2: null, wr1: null, wr2: null,
        te: null, flex: null, k: null, dst: null,
    };
    const rem = [...picks];
    for (const slot of slotOrder) {
        const idx = rem.findIndex(p => allowed[slot].includes(p.position));
        if (idx !== -1) roster[slot] = rem.splice(idx, 1)[0];
    }
    return {
        id: `drafted-${Date.now()}`,
        name, ownerName: owner,
        roster, bench: rem, transactions: [],
        total_production_pts: 0, points_escrowed: 0, points_spent: 0,
    };
}

// ── Config Screen ─────────────────────────────────────────────────────────────

const ConfigScreen: React.FC<{
    onStart: (cfg: DraftConfig) => void;
    onExit: () => void;
    myTeam?: FantasyTeam | null;
    scale: number;
}> = ({ onStart, onExit, myTeam, scale }) => {
    const [numTeams, setNumTeams] = useState(10);
    const [userSlot, setUserSlot] = useState(1);
    const [timer, setTimer] = useState(90);
    const [numRounds, setNumRounds] = useState(15);
    const [mockMode, setMockMode] = useState(true);
    // Pre-fill from the logged-in team; fall back to generic defaults
    const [teamName] = useState(myTeam?.name || 'My Team');
    const [ownerName] = useState(myTeam?.ownerName || 'You');
    const [showHelp, setShowHelp] = useState(false);

    // Clamp userSlot when numTeams changes
    const safeSlot = Math.min(userSlot, numTeams);

    const pill = (active: boolean) => ({
        padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
        fontWeight: 700, fontSize: '0.8rem', border: 'none',
        background: active ? '#eab308' : 'rgba(255,255,255,0.08)',
        color: active ? '#000' : '#9ca3af',
        transition: 'all 0.15s',
    } as React.CSSProperties);

    const inputStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(234,179,8,0.25)',
        borderRadius: '8px', color: '#fff', fontSize: '0.85rem',
        padding: '8px 12px', outline: 'none', fontFamily: 'inherit', width: '100%',
        boxSizing: 'border-box',
    };

    const label: React.CSSProperties = {
        fontSize: '0.62rem', fontWeight: 900, color: '#9ca3af',
        textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px',
        display: 'block',
    };

    return (
        <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: `url(${leatherTexture}), linear-gradient(135deg, rgba(17,24,39,0.97), rgba(31,41,55,0.97))`,
                backgroundBlendMode: 'overlay', backgroundSize: '150px, cover',
                border: '2px solid rgba(234,179,8,0.4)', borderRadius: '20px',
                padding: '32px 36px', width: '540px',
                boxShadow: '0 30px 60px rgba(0,0,0,0.7)',
                position: 'relative', overflow: 'hidden',
                zoom: scale,
            }}>
                {/* Info button — top-right corner, labeled so intent is obvious */}
                <button
                    onClick={() => setShowHelp(true)}
                    style={{
                        position: 'absolute', top: '14px', right: '14px',
                        background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)',
                        borderRadius: '20px', padding: '5px 12px',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        cursor: 'pointer', color: '#eab308', transition: 'all 0.15s',
                        fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.5px',
                        zIndex: 10,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(234,179,8,0.25)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(234,179,8,0.12)'; }}
                >
                    <Info size={12} />
                    HOW TO USE
                </button>

                {/* Help overlay — slides over the card content */}
                {showHelp && (
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: '18px',
                        background: 'linear-gradient(135deg, rgba(10,14,26,0.98) 0%, rgba(20,28,45,0.98) 100%)',
                        border: '1px solid rgba(234,179,8,0.3)',
                        padding: '24px 28px', overflowY: 'auto', zIndex: 20,
                        animation: 'slideIn 0.18s ease-out',
                    }}>
                        {/* Close */}
                        <button
                            onClick={() => setShowHelp(false)}
                            style={{
                                position: 'absolute', top: '14px', right: '14px',
                                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '50%', width: '28px', height: '28px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#9ca3af',
                            }}
                        >
                            <X size={13} />
                        </button>

                        <div style={{ fontFamily: "'Graduate', sans-serif", fontSize: '1rem', fontWeight: 900, color: '#eab308', marginBottom: '16px', letterSpacing: '2px' }}>
                            HOW IT WORKS
                        </div>

                        {[
                            {
                                heading: '🏈 Snake Draft Format',
                                body: 'Teams pick in order Round 1 (1→N), then reverse order Round 2 (N→1), alternating every round. The last slot in Round 1 picks first in Round 2 — the "snake bonus."',
                            },
                            {
                                heading: '🎯 Your Draft Slot',
                                body: 'Pick #1 gives you the first overall player. The last slot benefits from back-to-back picks at the turn (e.g. pick 10 then pick 11 in a 10-team league).',
                            },
                            {
                                heading: '🤖 AI Opponents',
                                body: 'AI teams draft by Average Draft Position (ADP) — best available player first. In later rounds they fill positional needs (QB, RB×2, WR×2, TE, K, DST). They won\'t triple-stack a single position early.',
                            },
                            {
                                heading: '⏱ Pick Timer',
                                body: 'When a timer is set and it\'s your turn, a countdown bar appears. If it expires the best available player is auto-picked for you. Set to "Off" for untimed practice.',
                            },
                            {
                                heading: '📋 Draft Room',
                                body: 'The left panel shows the full draft board by round. Your picks are highlighted in gold. The right panel is the player pool — filter by position tab or search by name. Click any player to draft them on your turn.',
                            },
                            {
                                heading: '🏆 Mock vs Real',
                                body: 'Mock Draft is pure practice — nothing is saved when it ends. Real Draft saves your picks as a new fantasy team you can use in league play.',
                            },
                            {
                                heading: '📊 Results & Grade',
                                body: 'After the draft ends you get a letter grade (A+→C) based on total projected points across your roster. You\'ll see every pick you made and can save or discard the team.',
                            },
                        ].map(({ heading, body }) => (
                            <div key={heading} style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#e5e7eb', marginBottom: '4px' }}>{heading}</div>
                                <div style={{ fontSize: '0.68rem', color: '#9ca3af', lineHeight: 1.6 }}>{body}</div>
                            </div>
                        ))}

                        <button
                            onClick={() => setShowHelp(false)}
                            style={{
                                marginTop: '8px', width: '100%', padding: '10px',
                                background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                                border: 'none', borderRadius: '10px', color: '#000',
                                fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer',
                                fontFamily: "'Graduate', sans-serif", letterSpacing: '1px',
                            }}
                        >
                            GOT IT — LET'S DRAFT
                        </button>
                    </div>
                )}

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <h1 style={{
                        fontFamily: "'Graduate', sans-serif", fontSize: '1.8rem',
                        fontWeight: 900, color: '#eab308', margin: 0,
                        textShadow: '0 0 20px rgba(234,179,8,0.4)',
                        textTransform: 'uppercase', letterSpacing: '3px',
                    }}>Draft Simulator</h1>
                    <div style={{ height: '3px', width: '60px', background: '#eab308', margin: '10px auto 0', borderRadius: '2px' }} />
                </div>

                {/* Logged-in identity — read from active team, no manual entry needed */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
                    borderRadius: '10px', padding: '10px 14px', marginBottom: '22px',
                }}>
                    <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>🏈</div>
                    <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#fff' }}>{teamName}</div>
                        <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '2px' }}>Owner: {ownerName}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Number of teams */}
                    <div style={{ gridColumn: '1 / 3' }}>
                        <span style={label}>Number of Teams</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {[4, 6, 8, 10, 12, 14, 16].map(n => (
                                <button key={n} style={pill(numTeams === n)} onClick={() => setNumTeams(n)}>{n}</button>
                            ))}
                        </div>
                    </div>

                    {/* Draft slot */}
                    <div>
                        <span style={label}>Your Draft Slot</span>
                        <select
                            value={safeSlot}
                            onChange={e => setUserSlot(Number(e.target.value))}
                            style={{ ...inputStyle, cursor: 'pointer' }}
                        >
                            {Array.from({ length: numTeams }, (_, i) => i + 1).map(s => (
                                <option key={s} value={s} style={{ background: '#1f2937' }}>
                                    Pick #{s}{s === 1 ? ' (1st Overall)' : s === numTeams ? ' (Last — snake bonus)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Rounds */}
                    <div>
                        <span style={label}>Rounds — {numRounds}</span>
                        <input
                            type="range" min={10} max={20} value={numRounds}
                            onChange={e => setNumRounds(Number(e.target.value))}
                            style={{ width: '100%', accentColor: '#eab308' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#6b7280', marginTop: '2px' }}>
                            <span>10</span><span>20</span>
                        </div>
                    </div>

                    {/* Timer */}
                    <div style={{ gridColumn: '1 / 3' }}>
                        <span style={label}>Pick Timer</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {[{ v: 0, l: 'Off' }, { v: 30, l: '30s' }, { v: 60, l: '60s' }, { v: 90, l: '90s' }].map(({ v, l }) => (
                                <button key={v} style={pill(timer === v)} onClick={() => setTimer(v)}>{l}</button>
                            ))}
                        </div>
                    </div>

                    {/* Mode */}
                    <div style={{ gridColumn: '1 / 3' }}>
                        <span style={label}>Draft Mode</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button style={pill(mockMode)} onClick={() => setMockMode(true)}>
                                🏈 Mock Draft (Practice)
                            </button>
                            <button style={pill(!mockMode)} onClick={() => setMockMode(false)}>
                                💾 Real Draft (Save Team)
                            </button>
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#6b7280', marginTop: '6px' }}>
                            {mockMode ? 'Mock drafts are for practice — nothing is saved.' : 'Real drafts save your picks as a new fantasy team.'}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
                    <button
                        onClick={onExit}
                        style={{
                            flex: '0 0 auto', padding: '12px 20px', borderRadius: '10px',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
                        }}
                    >← Back</button>
                    <button
                        onClick={() => onStart({ numTeams, userSlot: safeSlot, timerSeconds: timer, numRounds, mockMode, teamName: teamName || 'My Team', ownerName: ownerName || 'You' })}
                        style={{
                            flex: 1, padding: '14px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                            border: 'none', color: '#000', cursor: 'pointer',
                            fontSize: '1rem', fontWeight: 900, fontFamily: "'Graduate', sans-serif",
                            letterSpacing: '1px', textTransform: 'uppercase',
                            boxShadow: '0 4px 20px rgba(234,179,8,0.4)',
                        }}
                    >Start Draft 🏈</button>
                </div>
            </div>
        </div>
    );
};

// ── Draft Room ────────────────────────────────────────────────────────────────

const DraftRoom: React.FC<{
    config: DraftConfig;
    pool: Player[];
    teamNames: string[];
    onComplete: (picks: DraftPick[]) => void;
    scale: number;
}> = ({ config, pool, teamNames, onComplete, scale }) => {
    const [currentPick, setCurrentPick] = useState(1);
    const [picks, setPicks] = useState<DraftPick[]>([]);
    const [picksByTeam, setPicksByTeam] = useState<Record<number, Player[]>>({});
    const [available, setAvailable] = useState<Player[]>(
        [...pool].sort((a, b) => (a.adp ?? 999) - (b.adp ?? 999))
    );
    const [timeLeft, setTimeLeft] = useState(config.timerSeconds);
    const [posFilter, setPosFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const boardRef = useRef<HTMLDivElement>(null);

    const totalPicks = config.numTeams * config.numRounds;
    const currentTeamSlot = currentPick <= totalPicks ? getTeamForPick(currentPick, config.numTeams) : -1;
    const isUserTurn = currentTeamSlot === config.userSlot;
    const currentRound = Math.ceil(currentPick / config.numTeams);
    const isDraftOver = currentPick > totalPicks;

    const makePick = useCallback((player: Player, teamSlot: number) => {
        const round = Math.ceil(currentPick / config.numTeams);
        const pickInRound = currentPick - (round - 1) * config.numTeams;
        const pick: DraftPick = { overall: currentPick, round, pickInRound, teamSlot, player };

        setPicks(prev => {
            const next = [...prev, pick];
            if (next.length >= totalPicks) {
                // Schedule completion after state settles
                setTimeout(() => onComplete(next), 400);
            }
            return next;
        });
        setPicksByTeam(prev => ({
            ...prev,
            [teamSlot]: [...(prev[teamSlot] || []), player],
        }));
        setAvailable(prev => prev.filter(p => p.id !== player.id));
        setCurrentPick(prev => prev + 1);
        setTimeLeft(config.timerSeconds);
        setSearch('');
    }, [currentPick, config, totalPicks, onComplete]);

    // AI picks
    useEffect(() => {
        if (isDraftOver || isUserTurn) return;
        const t = setTimeout(() => {
            const picked = aiPickPlayer(currentTeamSlot, picksByTeam, available);
            if (picked) makePick(picked, currentTeamSlot);
        }, 650);
        return () => clearTimeout(t);
    }, [currentPick, isDraftOver, isUserTurn]);

    // Pick timer countdown
    useEffect(() => {
        if (!isUserTurn || config.timerSeconds <= 0 || isDraftOver) return;
        if (timeLeft <= 0) {
            const best = aiPickPlayer(config.userSlot, picksByTeam, available);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (best) makePick(best, config.userSlot);
            return;
        }
        const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
        return () => clearInterval(interval);
    }, [timeLeft, isUserTurn, isDraftOver]);

    // Reset timer when it becomes user's turn
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (isUserTurn && config.timerSeconds > 0) setTimeLeft(config.timerSeconds);
    }, [isUserTurn]);

    // Scroll draft board to keep current row visible
    useEffect(() => {
        if (boardRef.current && currentRound > 1) {
            const rowHeight = 32;
            boardRef.current.scrollTop = (currentRound - 2) * rowHeight;
        }
    }, [currentRound]);

    const filteredPlayers = useMemo(() => {
        return available.filter(p => {
            const matchPos = posFilter === 'ALL' || p.position === posFilter;
            const matchSearch = !search || `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase());
            return matchPos && matchSearch;
        });
    }, [available, posFilter, search]);

    const myPicks = picksByTeam[config.userSlot] || [];

    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* zoom wrapper: content is designed at the base 960×600 size, scaled up to fill the window */}
        <div style={{
            zoom: scale,
            width: `${(1 / scale) * 100}%`,
            height: `${(1 / scale) * 100}%`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

            {/* Top status bar */}
            <div style={{
                padding: '10px 20px', background: 'rgba(0,0,0,0.85)',
                borderBottom: '2px solid rgba(234,179,8,0.3)',
                display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0,
            }}>
                <div style={{ fontFamily: "'Graduate', sans-serif", color: '#eab308', fontSize: '1rem', fontWeight: 900, letterSpacing: '2px' }}>
                    DRAFT SIMULATOR
                </div>
                <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>
                    ROUND <span style={{ color: '#fff' }}>{currentRound}</span> OF <span style={{ color: '#fff' }}>{config.numRounds}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 }}>
                    PICK <span style={{ color: '#fff' }}>{currentPick}</span> OF <span style={{ color: '#fff' }}>{totalPicks}</span>
                </div>
                <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{
                    fontSize: '0.85rem', fontWeight: 900,
                    color: isUserTurn ? '#eab308' : '#e5e7eb',
                    textShadow: isUserTurn ? '0 0 12px rgba(234,179,8,0.6)' : 'none',
                }}>
                    {isUserTurn ? '🏈 YOUR PICK' : `${teamNames[currentTeamSlot - 1]} is on the clock`}
                </div>

                {/* Timer */}
                {isUserTurn && config.timerSeconds > 0 && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            fontSize: '1.4rem', fontWeight: 900,
                            color: timeLeft <= 10 ? '#ef4444' : '#10b981',
                            fontFamily: "'Graduate', sans-serif",
                            textShadow: timeLeft <= 10 ? '0 0 12px rgba(239,68,68,0.6)' : 'none',
                            animation: timeLeft <= 10 ? 'pulse 1s infinite' : 'none',
                        }}>{timeLeft}s</div>
                        <div style={{
                            width: '80px', height: '6px', borderRadius: '3px',
                            background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%', borderRadius: '3px', transition: 'width 1s linear',
                                width: `${(timeLeft / config.timerSeconds) * 100}%`,
                                background: timeLeft <= 10 ? '#ef4444' : '#10b981',
                            }} />
                        </div>
                    </div>
                )}
                {(!isUserTurn || config.timerSeconds === 0) && (
                    <div style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#4b5563', fontWeight: 700 }}>
                        {config.mockMode ? 'MOCK DRAFT' : 'REAL DRAFT'}
                    </div>
                )}
            </div>

            {/* Main area */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* Left: Draft board */}
                <div style={{
                    flex: '0 0 58%', display: 'flex', flexDirection: 'column',
                    borderRight: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
                }}>
                    <div style={{
                        padding: '8px 12px', background: 'rgba(0,0,0,0.6)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        fontSize: '0.6rem', fontWeight: 900, color: '#6b7280',
                        letterSpacing: '1.5px', textTransform: 'uppercase',
                    }}>
                        Draft Board
                    </div>

                    {/* Column headers */}
                    <div style={{
                        display: 'flex', background: 'rgba(0,0,0,0.7)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
                        overflowX: 'auto',
                    }}>
                        <div style={{ minWidth: '40px', flexShrink: 0, padding: '6px 4px', fontSize: '0.55rem', color: '#4b5563', fontWeight: 900, textAlign: 'center' }}>RND</div>
                        {teamNames.map((name, i) => (
                            <div key={i} style={{
                                minWidth: '90px', flex: 1, padding: '6px 4px',
                                fontSize: '0.55rem', fontWeight: 900, textAlign: 'center',
                                color: i + 1 === config.userSlot ? '#eab308' : '#6b7280',
                                background: i + 1 === config.userSlot ? 'rgba(234,179,8,0.06)' : 'transparent',
                                borderLeft: '1px solid rgba(255,255,255,0.04)',
                                textTransform: 'uppercase', letterSpacing: '0.5px',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {name}
                            </div>
                        ))}
                    </div>

                    {/* Pick grid */}
                    <div ref={boardRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#eab308 rgba(0,0,0,0.2)' }}>
                        {Array.from({ length: config.numRounds }, (_, r) => {
                            const round = r + 1;
                            return (
                                <div key={round} style={{
                                    display: 'flex', minHeight: '32px',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    background: round % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                }}>
                                    <div style={{
                                        minWidth: '40px', flexShrink: 0, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.6rem', color: '#4b5563', fontWeight: 700,
                                        borderRight: '1px solid rgba(255,255,255,0.04)',
                                    }}>{round}</div>
                                    {teamNames.map((_, ti) => {
                                        const teamSlot = ti + 1;
                                        // For this round, find which overall pick this is
                                        const pos = round % 2 === 1 ? teamSlot : config.numTeams - teamSlot + 1;
                                        const overall = (round - 1) * config.numTeams + pos;
                                        const pick = picks.find(p => p.overall === overall);
                                        const isCurrentCell = overall === currentPick;
                                        const isUserCol = teamSlot === config.userSlot;

                                        return (
                                            <div key={ti} style={{
                                                minWidth: '90px', flex: 1,
                                                borderLeft: '1px solid rgba(255,255,255,0.04)',
                                                padding: '4px 5px', display: 'flex',
                                                alignItems: 'center', overflow: 'hidden',
                                                background: isCurrentCell
                                                    ? 'rgba(234,179,8,0.15)'
                                                    : isUserCol ? 'rgba(234,179,8,0.03)' : 'transparent',
                                                outline: isCurrentCell ? '1px solid rgba(234,179,8,0.5)' : 'none',
                                            }}>
                                                {pick ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden' }}>
                                                        <span style={{
                                                            fontSize: '0.5rem', fontWeight: 900,
                                                            color: POS_COLOR[pick.player.position] || '#9ca3af',
                                                            background: `${POS_COLOR[pick.player.position]}18`,
                                                            padding: '1px 3px', borderRadius: '3px', flexShrink: 0,
                                                        }}>{pick.player.position}</span>
                                                        <span style={{
                                                            fontSize: '0.58rem', color: isUserCol ? '#fde68a' : '#d1d5db',
                                                            fontWeight: isUserCol ? 700 : 500,
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        }}>{pick.player.lastName}</span>
                                                    </div>
                                                ) : isCurrentCell ? (
                                                    <span style={{ fontSize: '0.6rem', color: '#eab308', animation: 'pulse 1s infinite' }}>●</span>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {/* My picks summary strip */}
                    <div style={{
                        padding: '8px 12px', background: 'rgba(0,0,0,0.75)',
                        borderTop: '1px solid rgba(234,179,8,0.2)', flexShrink: 0,
                    }}>
                        <div style={{ fontSize: '0.55rem', color: '#6b7280', fontWeight: 900, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '5px' }}>
                            Your Picks ({myPicks.length}/{config.numRounds})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {myPicks.map((p, i) => (
                                <span key={i} style={{
                                    fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px',
                                    background: `${POS_COLOR[p.position]}20`,
                                    color: POS_COLOR[p.position] || '#9ca3af',
                                    fontWeight: 700, border: `1px solid ${POS_COLOR[p.position]}40`,
                                }}>
                                    {p.position} {p.lastName}
                                </span>
                            ))}
                            {myPicks.length === 0 && (
                                <span style={{ fontSize: '0.6rem', color: '#4b5563', fontStyle: 'italic' }}>No picks yet</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Player list */}
                <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Position filter + search */}
                    <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.7)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            {POSITIONS.map(pos => (
                                <button key={pos} onClick={() => setPosFilter(pos)} style={{
                                    padding: '3px 8px', borderRadius: '12px', cursor: 'pointer',
                                    border: 'none', fontSize: '0.62rem', fontWeight: 800,
                                    background: posFilter === pos
                                        ? (POS_COLOR[pos] || '#eab308')
                                        : 'rgba(255,255,255,0.07)',
                                    color: posFilter === pos ? (pos === 'ALL' ? '#000' : '#000') : '#9ca3af',
                                    transition: 'all 0.12s',
                                }}>{pos}</button>
                            ))}
                        </div>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search players..."
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px', color: '#fff', fontSize: '0.75rem',
                                padding: '5px 10px', outline: 'none', fontFamily: 'inherit',
                            }}
                        />
                    </div>

                    {/* Player rows */}
                    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#eab308 rgba(0,0,0,0.2)' }}>
                        {filteredPlayers.slice(0, 100).map(player => (
                            <div
                                key={player.id}
                                onClick={() => isUserTurn && makePick(player, config.userSlot)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '7px 12px', cursor: isUserTurn ? 'pointer' : 'default',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    background: 'transparent', transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => {
                                    if (isUserTurn) (e.currentTarget as HTMLDivElement).style.background = 'rgba(234,179,8,0.08)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                                }}
                            >
                                {/* Position badge */}
                                <span style={{
                                    minWidth: '30px', textAlign: 'center',
                                    fontSize: '0.58rem', fontWeight: 900, padding: '2px 4px',
                                    borderRadius: '4px', flexShrink: 0,
                                    background: `${POS_COLOR[player.position] || '#9ca3af'}20`,
                                    color: POS_COLOR[player.position] || '#9ca3af',
                                    border: `1px solid ${POS_COLOR[player.position] || '#9ca3af'}40`,
                                }}>{player.position}</span>

                                {/* Name + team */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isUserTurn ? '#fff' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {player.firstName} {player.lastName}
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: '#4b5563', fontWeight: 600 }}>{player.team}</div>
                                </div>

                                {/* ADP */}
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: '0.62rem', color: '#6b7280', fontWeight: 700 }}>ADP</div>
                                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 900 }}>{player.adp ?? '—'}</div>
                                </div>

                                {/* Proj pts */}
                                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '40px' }}>
                                    <div style={{ fontSize: '0.62rem', color: '#6b7280', fontWeight: 700 }}>PROJ</div>
                                    <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 900 }}>{player.projectedPoints?.toFixed(0) ?? '—'}</div>
                                </div>
                            </div>
                        ))}
                        {filteredPlayers.length === 0 && (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#4b5563', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                No players available
                            </div>
                        )}
                    </div>

                    {/* On-clock prompt */}
                    {isUserTurn && (
                        <div style={{
                            padding: '10px 12px', background: 'rgba(234,179,8,0.1)',
                            borderTop: '1px solid rgba(234,179,8,0.3)', flexShrink: 0,
                            fontSize: '0.7rem', fontWeight: 900, color: '#eab308',
                            textAlign: 'center', letterSpacing: '1px',
                        }}>
                            🏈 YOU'RE ON THE CLOCK — CLICK A PLAYER TO DRAFT
                        </div>
                    )}
                </div>
            </div>
        </div>
        </div>
    );
};

// ── Results Screen ────────────────────────────────────────────────────────────

const ResultsScreen: React.FC<{
    config: DraftConfig;
    picks: DraftPick[];
    onSave: () => void;
    onDraftAgain: () => void;
    onExit: () => void;
    scale: number;
}> = ({ config, picks, onSave, onDraftAgain, onExit, scale }) => {
    const myPicks = picks
        .filter(p => p.teamSlot === config.userSlot)
        .sort((a, b) => a.round - b.round);

    const totalProj = myPicks.reduce((s, p) => s + (p.player.projectedPoints || 0), 0);

    const grade = totalProj > 1800 ? 'A+' : totalProj > 1600 ? 'A' : totalProj > 1400 ? 'B+' : totalProj > 1200 ? 'B' : totalProj > 1000 ? 'C+' : 'C';
    const gradeColor = grade.startsWith('A') ? '#10b981' : grade.startsWith('B') ? '#eab308' : '#ef4444';

    return (
        <div style={{
            position: 'absolute', inset: 0, overflow: 'auto',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '30px 20px',
        }}>
            <div style={{
                width: '630px',
                background: `url(${leatherTexture}), linear-gradient(135deg, rgba(17,24,39,0.97), rgba(31,41,55,0.97))`,
                backgroundBlendMode: 'overlay', backgroundSize: '150px, cover',
                border: '2px solid rgba(234,179,8,0.4)', borderRadius: '20px',
                padding: '28px', boxShadow: '0 30px 60px rgba(0,0,0,0.7)',
                zoom: scale,
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h2 style={{
                        fontFamily: "'Graduate', sans-serif", color: '#eab308',
                        fontSize: '1.6rem', margin: 0, textTransform: 'uppercase', letterSpacing: '3px',
                    }}>Draft Complete!</h2>
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#6b7280' }}>
                        {config.teamName} · {config.numRounds} rounds · {config.mockMode ? 'Mock Draft' : 'Real Draft'}
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: gradeColor, fontFamily: "'Graduate', sans-serif" }}>{grade}</div>
                            <div style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Draft Grade</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', fontFamily: "'Graduate', sans-serif" }}>{totalProj.toFixed(0)}</div>
                            <div style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Proj. Points</div>
                        </div>
                    </div>
                </div>

                <div style={{ height: '1px', background: 'rgba(234,179,8,0.2)', marginBottom: '16px' }} />

                {/* Pick list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#eab308 rgba(0,0,0,0.2)', marginBottom: '20px' }}>
                    {myPicks.map(pick => (
                        <div key={pick.overall} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 12px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                        }}>
                            <span style={{ fontSize: '0.6rem', color: '#4b5563', fontWeight: 700, minWidth: '40px' }}>
                                Rd {pick.round}
                            </span>
                            <span style={{
                                fontSize: '0.62rem', fontWeight: 900, padding: '2px 6px',
                                borderRadius: '4px', flexShrink: 0,
                                background: `${POS_COLOR[pick.player.position]}20`,
                                color: POS_COLOR[pick.player.position] || '#9ca3af',
                            }}>{pick.player.position}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>
                                    {pick.player.firstName} {pick.player.lastName}
                                </div>
                                <div style={{ fontSize: '0.62rem', color: '#6b7280' }}>{pick.player.team}</div>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 900 }}>
                                {pick.player.projectedPoints?.toFixed(1)} pts
                            </div>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onExit} style={{
                        flex: 1, padding: '11px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#9ca3af', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                    }}>← League</button>
                    <button onClick={onDraftAgain} style={{
                        flex: 1, padding: '11px', borderRadius: '10px',
                        background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)',
                        color: '#93c5fd', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                    }}>Draft Again</button>
                    {!config.mockMode && (
                        <button onClick={onSave} style={{
                            flex: 1, padding: '11px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                            border: 'none', color: '#000', cursor: 'pointer',
                            fontSize: '0.82rem', fontWeight: 900,
                        }}>💾 Save Team</button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const DraftSimulator: React.FC<DraftSimulatorProps> = ({ allPlayers, myTeam, onSaveTeam, onExit }) => {
    const [phase, setPhase] = useState<'config' | 'drafting' | 'complete'>('config');
    const [config, setConfig] = useState<DraftConfig | null>(null);
    const [completedPicks, setCompletedPicks] = useState<DraftPick[]>([]);
    const [teamNames, setTeamNames] = useState<string[]>([]);

    // Responsive scale: baseline 960×600 → at 1440×900 window gives ~1.5x (50% bigger than compact defaults)
    const [scale, setScale] = useState(() => Math.max(0.45, Math.min(window.innerWidth / 960, window.innerHeight / 600)));
    useEffect(() => {
        const update = () => setScale(Math.max(0.45, Math.min(window.innerWidth / 960, window.innerHeight / 600)));
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // Players with ADP, sorted ascending (lower ADP = earlier pick)
    const draftPool = useMemo(() =>
        allPlayers
            .filter(p => p.adp != null && p.adp > 0)
            .sort((a, b) => (a.adp ?? 999) - (b.adp ?? 999)),
        [allPlayers]
    );

    const handleStart = (cfg: DraftConfig) => {
        // Build team name list: user slot gets their name, others get AI names
        const shuffled = [...AI_NAMES].sort(() => Math.random() - 0.5);
        const names: string[] = [];
        let aiIdx = 0;
        for (let i = 1; i <= cfg.numTeams; i++) {
            names.push(i === cfg.userSlot ? cfg.teamName : shuffled[aiIdx++] ?? `Team ${i}`);
        }
        setTeamNames(names);
        setConfig(cfg);
        setPhase('drafting');
    };

    const handleComplete = (picks: DraftPick[]) => {
        setCompletedPicks(picks);
        setPhase('complete');
    };

    const handleSave = () => {
        if (!config) return;
        const myPicks = completedPicks
            .filter(p => p.teamSlot === config.userSlot)
            .map(p => p.player);
        const team = buildTeamFromPicks(myPicks, config.teamName, config.ownerName);
        onSaveTeam(team);
        onExit();
    };

    if (phase === 'config') {
        return <ConfigScreen onStart={handleStart} onExit={onExit} myTeam={myTeam} scale={scale} />;
    }

    if (phase === 'drafting' && config) {
        return (
            <DraftRoom
                key={`draft-${Date.now()}`} /* eslint-disable-line react-hooks/purity */
                config={config}
                pool={draftPool}
                teamNames={teamNames}
                onComplete={handleComplete}
                scale={scale}
            />
        );
    }

    if (phase === 'complete' && config) {
        return (
            <ResultsScreen
                config={config}
                picks={completedPicks}
                onSave={handleSave}
                onDraftAgain={() => setPhase('config')}
                onExit={onExit}
                scale={scale}
            />
        );
    }

    return null;
};
