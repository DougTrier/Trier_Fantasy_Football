/**
 * H2HPage — Head-to-Head Hub
 * ===========================
 * Five tabs unified under one page:
 *
 *   Scout      — Pick any league rival or Global Top 10 team and run a
 *                per-player matchup analysis (OFF_VS_DEF, OFF_VS_OFF, etc.)
 *   This Week  — All league matchups for the current week with scores
 *   My Schedule — Full season calendar with W/L/T badges
 *   Standings  — W/L/PF table, top 4 advance to playoffs
 *   Playoffs   — Seeded bracket (top 4, weeks numWeeks+1 to numWeeks+3)
 *
 * Commissioner bar (isAdmin):
 *   Generate 14 or 16-week schedule, Complete Week with optional score overrides.
 */
import React, { useState, useMemo } from 'react';
import type { Player, FantasyTeam, League, Matchup } from '../types';
import { Shield, Zap, Target, Trophy, BarChart2, Calendar, ChevronRight, CheckCircle, Info, X } from 'lucide-react';
import h2hEmblem from '../assets/h2h_emblem_user.png';
import ScoutingReportModal from './ScoutingReportModal';
import type { H2HMatchupResult, MatchupMode } from '../utils/H2HEngine';
import { H2HEngine } from '../utils/H2HEngine';
import globalRivalsData from '../data/Global_Rivals/rivals.json';
import leatherTexture from '../assets/leather_texture.png';
import {
    generateSchedule, completeWeek,
    getStandings, getPlayoffSeeds,
    getWeekMatchups, getTeamMatchup, getPointsFor,
} from '../services/ScheduleService';

const globalRivals = globalRivalsData as unknown as FantasyTeam[];

// ── Shared constants ──────────────────────────────────────────────────────────

const GOLD  = '#eab308';
const PANEL = {
    background: `url(${leatherTexture}), linear-gradient(135deg, rgba(17,24,39,0.97), rgba(31,41,55,0.97))`,
    backgroundBlendMode: 'overlay' as const,
    backgroundSize: '150px, cover',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
};
const LABEL = { fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: '#6b7280' };

// ── HOW TO USE content ────────────────────────────────────────────────────────

const HELP_SECTIONS = [
    { title: 'Scout Tab', body: 'Pick any league rival or a pre-seeded Global Top 10 team and compare your roster against theirs. Choose a matchup mode (Offense vs Defense, etc.) to change what is being compared.' },
    { title: 'Advantage Score', body: 'Each player matchup is scored 0–100. Above 50 = you have the edge. The Global Team Advantage averages all matchup scores.' },
    { title: 'Generating a Schedule', body: 'Commissioners click "Generate 14-Week" or "Generate 16-Week" to create a balanced round-robin calendar for the season.' },
    { title: 'Completing a Week', body: 'After scores are in, the commissioner clicks "Complete Week X". You can enter score overrides before completing.' },
    { title: 'Standings', body: 'Ranked by Wins → Losses → Total Points Scored (PF). Top 4 qualify for the playoffs.' },
    { title: 'Playoffs', body: '1v4 and 2v3 semifinals followed by a championship. Bracket seeds are based on final regular-season standings.' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface H2HPageProps {
    userTeam: FantasyTeam;
    allTeams: FantasyTeam[];
    allPlayers: Player[];
    league: League;
    isAdmin: boolean;
    onLeagueChange: (updated: League) => void;
    onTeamsChange: (updated: FantasyTeam[]) => void;
}

// ── Golden seal SVG ───────────────────────────────────────────────────────────

const GoldenSeal: React.FC<{ size?: number }> = ({ size = 60 }) => (
    <div style={{ width: `${size}px`, height: `${size}px`, position: 'relative', filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))', flexShrink: 0, zIndex: 5 }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
                <linearGradient id="goldPlate" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff9c4" /><stop offset="25%" stopColor="#fde047" />
                    <stop offset="50%" stopColor="#ca8a04" /><stop offset="75%" stopColor="#a16207" />
                    <stop offset="100%" stopColor="#713f12" />
                </linearGradient>
                <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.4)" /><stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
                <filter id="metalEmboss" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
                    <feSpecularLighting in="blur" surfaceScale="10" specularConstant="1.2" specularExponent="40" lightingColor="#fff" result="specular">
                        <fePointLight x="-5000" y="-10000" z="20000" />
                    </feSpecularLighting>
                    <feComposite in="specular" in2="SourceAlpha" operator="in" result="gloss" />
                    <feComposite in="SourceGraphic" in2="gloss" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
                </filter>
            </defs>
            <circle cx="50" cy="50" r="49" fill="none" stroke="#ca8a04" strokeWidth="0.5" opacity="0.3" />
            <circle cx="50" cy="50" r="46" fill="url(#goldPlate)" stroke="#713f12" strokeWidth="2" filter="url(#metalEmboss)" />
            <path id="sealPath" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
            <text fill="#422006" style={{ fontSize: '7.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                <textPath href="#sealPath">TRIER FANTASY FOOTBALL • TRIER FANTASY FOOTBALL •</textPath>
            </text>
            <g filter="url(#metalEmboss)">
                <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(113,63,18,0.4)" strokeWidth="1" />
                <text x="50" y="60" textAnchor="middle" fill="#422006" style={{ fontSize: '22px', fontWeight: 950, fontFamily: "'Graduate', serif", letterSpacing: '2px' }}>TFF</text>
            </g>
            <circle cx="35" cy="35" r="10" fill="url(#ringGlow)" pointerEvents="none" />
        </svg>
    </div>
);

// ── Power bar ─────────────────────────────────────────────────────────────────

const PowerBar = ({ score, metric }: { score: number; metric: string }) => {
    const isAdv = score > 50;
    return (
        <div style={{ width: '100%', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <span>{metric}</span>
                <span style={{ color: isAdv ? '#10b981' : '#ef4444' }}>{score.toFixed(1)}% ADVANTAGE</span>
            </div>
            <div style={{ height: '12px', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                <div style={{ width: `${score}%`, height: '100%', background: isAdv ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#b91c1c,#ef4444)', boxShadow: `0 0 15px ${isAdv ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
                <div style={{ position: 'absolute', top: 0, left: '50%', width: '2px', height: '100%', background: 'rgba(255,255,255,0.3)', zIndex: 2 }} />
            </div>
        </div>
    );
};

// ── Matchup card (schedule) ───────────────────────────────────────────────────

const MatchupCard: React.FC<{
    matchup: Matchup;
    home: FantasyTeam | undefined;
    away: FantasyTeam | undefined;
    myTeamId?: string;
    scoreOverrides: Record<string, string>;
    onOverride: (teamId: string, val: string) => void;
    showInputs: boolean;
}> = ({ matchup, home, away, myTeamId, scoreOverrides, onOverride, showInputs }) => {
    const homeWon = matchup.completed && (matchup.homeScore ?? 0) > (matchup.awayScore ?? 0);
    const awayWon = matchup.completed && (matchup.awayScore ?? 0) > (matchup.homeScore ?? 0);
    const isMine  = home?.id === myTeamId || away?.id === myTeamId;

    return (
        <div style={{ ...PANEL, padding: '12px 16px', marginBottom: '8px', border: isMine ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(255,255,255,0.07)' }}>
            {[{ team: home, score: matchup.homeScore, won: homeWon }, { team: away, score: matchup.awayScore, won: awayWon }].map(({ team, score, won }) => (
                <div key={team?.id ?? Math.random()} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: won ? '#10b981' : 'transparent', border: won ? 'none' : '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: team?.id === myTeamId ? 900 : 600, color: team?.id === myTeamId ? GOLD : '#e5e7eb' }}>{team?.name ?? '—'}</span>
                        {team?.id === myTeamId && <span style={{ fontSize: '0.5rem', color: GOLD, fontWeight: 900 }}>YOU</span>}
                    </div>
                    {showInputs && team ? (
                        <input type="number" placeholder="pts" value={scoreOverrides[team.id] ?? ''} onChange={e => onOverride(team.id, e.target.value)}
                            style={{ width: '58px', padding: '3px 6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: '#fff', fontSize: '0.78rem', textAlign: 'right' }} />
                    ) : (
                        <span style={{ fontSize: '0.82rem', fontWeight: 900, color: won ? '#10b981' : score !== undefined ? '#e5e7eb' : '#4b5563', minWidth: '40px', textAlign: 'right' }}>
                            {score !== undefined ? score.toFixed(1) : matchup.completed ? '—' : 'TBD'}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
};

// ── Empty schedule state ──────────────────────────────────────────────────────

const EmptySchedule: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#4b5563' }}>
        <Calendar size={36} style={{ margin: '0 auto 12px', display: 'block', color: '#374151' }} />
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6b7280', marginBottom: '6px' }}>No schedule generated yet</div>
        {isAdmin
            ? <div style={{ fontSize: '0.72rem' }}>Use the Commissioner bar above to generate a schedule.</div>
            : <div style={{ fontSize: '0.72rem' }}>Ask the Commissioner to generate this season's schedule.</div>}
    </div>
);

// ── Playoff bracket ───────────────────────────────────────────────────────────

const BracketSlot: React.FC<{ team: FantasyTeam; seed: number; myTeamId?: string }> = ({ team, seed, myTeamId }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 900, color: GOLD, minWidth: '14px' }}>#{seed}</div>
        <div style={{ flex: 1, fontSize: '0.78rem', fontWeight: team.id === myTeamId ? 900 : 700, color: team.id === myTeamId ? GOLD : '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</div>
        <div style={{ fontSize: '0.62rem', color: '#4b5563' }}>{team.wins ?? 0}–{team.losses ?? 0}</div>
    </div>
);

const PlayoffBracket: React.FC<{ seeds: FantasyTeam[]; myTeamId?: string; numWeeks: number }> = ({ seeds, myTeamId, numWeeks }) => (
    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
        {[{ label: `SF1 — Wk ${numWeeks + 1}`, t1: seeds[0], s1: 1, t2: seeds[3], s2: 4 }, { label: `SF2 — Wk ${numWeeks + 1}`, t1: seeds[1], s1: 2, t2: seeds[2], s2: 3 }].map(({ label, t1, s1, t2, s2 }) => (
            <div key={label} style={{ flex: '1 1 200px', maxWidth: '260px' }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>{label}</div>
                <div style={{ ...PANEL, padding: '10px 14px', border: (t1.id === myTeamId || t2.id === myTeamId) ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(255,255,255,0.08)' }}>
                    <BracketSlot team={t1} seed={s1} myTeamId={myTeamId} />
                    <BracketSlot team={t2} seed={s2} myTeamId={myTeamId} />
                </div>
            </div>
        ))}
        <div style={{ flex: '1 1 200px', maxWidth: '260px' }}>
            <div style={{ fontSize: '0.55rem', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
                <Trophy size={11} style={{ display: 'inline', marginRight: '4px' }} />Championship — Wk {numWeeks + 3}
            </div>
            <div style={{ ...PANEL, padding: '10px 14px' }}>
                <div style={{ fontSize: '0.72rem', color: '#4b5563', fontStyle: 'italic', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Winner of SF1</div>
                <div style={{ fontSize: '0.72rem', color: '#4b5563', fontStyle: 'italic', padding: '6px 0' }}>Winner of SF2</div>
            </div>
        </div>
    </div>
);

// ── Shared button style ───────────────────────────────────────────────────────

const CONTENT_WRAP: React.CSSProperties = {
    background: 'rgba(10,14,26,0.82)',
    backdropFilter: 'blur(8px)',
    borderRadius: '12px',
    padding: '16px',
};

const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.5px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#e5e7eb', transition: 'background 0.15s',
};

// ── Main component ────────────────────────────────────────────────────────────

export const H2HPage: React.FC<H2HPageProps> = ({
    userTeam, allTeams, allPlayers, league, isAdmin, onLeagueChange, onTeamsChange,
}) => {
    const [tab, setTab] = useState<'scout' | 'week' | 'my' | 'standings' | 'playoffs'>('scout');
    const [showHelp, setShowHelp]         = useState(false);
    const [scoreOverrides, setScoreOverrides] = useState<Record<string, string>>({});

    // Scout tab state
    const [selectedOpponentId, setSelectedOpponentId] = useState<string>(
        allTeams.find(t => t.id !== userTeam.id)?.id || ''
    );
    const [activeMatchup, setActiveMatchup] = useState<H2HMatchupResult | null>(null);
    const [matchupMode, setMatchupMode]     = useState<MatchupMode>('OFF_VS_DEF');

    // Schedule state
    const currentWeek  = league.currentWeek ?? 1;
    const numWeeks     = league.numWeeks ?? 14;
    const hasSchedule  = (league.schedule?.length ?? 0) > 0;
    const teamMap      = useMemo(() => new Map(allTeams.map(t => [t.id, t])), [allTeams]);
    const weekMatchups = useMemo(() => getWeekMatchups(league, currentWeek), [league, currentWeek]);
    const standings    = useMemo(() => getStandings(allTeams), [allTeams]);
    const seeds        = useMemo(() => getPlayoffSeeds(allTeams), [allTeams]);
    const weekIsComplete = weekMatchups.every(m => m.completed);
    const canComplete    = hasSchedule && weekMatchups.length > 0 && !weekIsComplete;

    // Scout tab derived values
    const opponentTeam = useMemo(() => allTeams.find(t => t.id === selectedOpponentId) ?? globalRivals.find(t => t.id === selectedOpponentId), [allTeams, selectedOpponentId]);
    const starters     = useMemo(() => {
        const s = userTeam.roster;
        return [s.qb, s.rb1, s.rb2, s.wr1, s.wr2, s.te, s.flex, s.k, s.dst].filter(Boolean).map(p => ({ ...p!, ownerId: userTeam.id }));
    }, [userTeam]);
    const userDefense  = useMemo(() => {
        const dstTeam = userTeam.roster.dst?.team;
        return dstTeam ? allPlayers.filter(p => p.team === dstTeam && ['DL', 'LB', 'DB'].includes(p.position)).map(p => ({ ...p, ownerId: userTeam.id })) : [];
    }, [userTeam, allPlayers]);
    const opponentDefenders = useMemo(() => {
        const dstTeam = opponentTeam?.roster.dst?.team;
        return dstTeam ? allPlayers.filter(p => p.team === dstTeam && ['DL', 'LB', 'DB'].includes(p.position)) : [];
    }, [opponentTeam, allPlayers]);
    const rivalStarters = useMemo(() => {
        if (!opponentTeam) return [];
        const s = opponentTeam.roster;
        return [s.qb, s.rb1, s.rb2, s.wr1, s.wr2, s.te, s.flex, s.k, s.dst].filter(Boolean) as Player[];
    }, [opponentTeam]);
    const matchups      = useMemo(() => H2HEngine.getMatchups(starters, userDefense, rivalStarters, opponentDefenders, matchupMode), [starters, userDefense, rivalStarters, opponentDefenders, matchupMode]);
    const teamAdvantage = useMemo(() => matchups.length === 0 ? 50 : matchups.reduce((a, m) => a + m.advantageScore, 0) / matchups.length, [matchups]);

    // Commissioner actions
    const handleGenerate = (weeks: number) => {
        if (allTeams.length < 2) return;
        onLeagueChange({ ...league, schedule: generateSchedule(allTeams, weeks), currentWeek: 1, numWeeks: weeks });
    };
    const handleCompleteWeek = () => {
        const overrides: Record<string, number> = {};
        for (const [id, val] of Object.entries(scoreOverrides)) {
            const n = parseFloat(val);
            if (!isNaN(n)) overrides[id] = n;
        }
        const result = completeWeek(league, allTeams, currentWeek, Object.keys(overrides).length > 0 ? overrides : undefined);
        onLeagueChange(result.league);
        onTeamsChange(result.teams);
        setScoreOverrides({});
    };

    // ── Tabs definition ───────────────────────────────────────────────────────

    const TABS = [
        { id: 'scout'     as const, label: 'Scout',       icon: <Target size={13} /> },
        { id: 'week'      as const, label: 'This Week',   icon: <Calendar size={13} /> },
        { id: 'my'        as const, label: 'My Schedule', icon: <ChevronRight size={13} /> },
        { id: 'standings' as const, label: 'Standings',   icon: <BarChart2 size={13} /> },
        { id: 'playoffs'  as const, label: 'Playoffs',    icon: <Trophy size={13} /> },
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{ color: 'white', paddingBottom: '40px' }}>

            {/* Help overlay */}
            {showHelp && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ ...PANEL, padding: '28px 32px', width: '580px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 30px 60px rgba(0,0,0,0.8)', position: 'relative' }}>
                        <button onClick={() => setShowHelp(false)} style={{ position: 'absolute', top: '14px', right: '14px', background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                            <X size={16} />
                        </button>
                        <div style={{ fontSize: '0.6rem', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '18px' }}>Head to Head — How To Use</div>
                        {HELP_SECTIONS.map(s => (
                            <div key={s.title} style={{ marginBottom: '14px' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#e5e7eb', marginBottom: '4px' }}>{s.title}</div>
                                <div style={{ fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.5 }}>{s.body}</div>
                            </div>
                        ))}
                        <button onClick={() => setShowHelp(false)} style={{ marginTop: '10px', width: '100%', padding: '10px', background: `linear-gradient(90deg,${GOLD},#ca8a04)`, border: 'none', borderRadius: '8px', color: '#000', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}>
                            GOT IT
                        </button>
                    </div>
                </div>
            )}

            {/* Emblem header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '30px', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
                <img src={h2hEmblem} alt="Head to Head" style={{ maxWidth: '800px', width: '100%', height: 'auto', display: 'block', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
            </div>

            {/* ── Tab bar + HOW TO USE ──────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)', borderRadius: '12px', padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '7px 16px', borderRadius: '8px', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.5px',
                            background: tab === t.id ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.05)',
                            border: tab === t.id ? '1px solid rgba(234,179,8,0.5)' : '1px solid rgba(255,255,255,0.1)',
                            color: tab === t.id ? GOLD : '#9ca3af',
                            transition: 'all 0.15s',
                        }}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowHelp(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '20px', background: 'transparent', border: '1px solid rgba(234,179,8,0.45)', color: GOLD, fontSize: '0.62rem', fontWeight: 900, letterSpacing: '1px', cursor: 'pointer' }}>
                    <Info size={12} /> HOW TO USE
                </button>
            </div>

            {/* ── Commissioner bar (schedule tabs only) ─────────────────────── */}
            {isAdmin && tab !== 'scout' && (
                <div style={{ ...CONTENT_WRAP, padding: '10px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ ...LABEL, color: GOLD, flexShrink: 0 }}>Commissioner</div>
                    {!hasSchedule ? (
                        <>
                            <button onClick={() => handleGenerate(14)} style={btnStyle}>Generate 14-Week</button>
                            <button onClick={() => handleGenerate(16)} style={btnStyle}>Generate 16-Week</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => handleGenerate(numWeeks)} style={{ ...btnStyle, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}>Regenerate</button>
                            {canComplete && (
                                <button onClick={handleCompleteWeek} style={{ ...btnStyle, background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.4)', color: '#10b981' }}>
                                    <CheckCircle size={13} /> Complete Week {currentWeek}
                                </button>
                            )}
                            {weekIsComplete && <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700 }}>✓ Week {currentWeek - 1} complete</span>}
                        </>
                    )}
                </div>
            )}

            {/* ── SCOUT TAB ─────────────────────────────────────────────────── */}
            {tab === 'scout' && (
                <div style={CONTENT_WRAP}>
                    <div style={{ background: 'rgba(0,0,0,0.4)', padding: '20px 24px', borderRadius: '16px', border: '1px solid rgba(234,179,8,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', backdropFilter: 'blur(10px)', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <div style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#eab308,#d97706)', borderRadius: '50px', color: '#000', fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>SELECT RIVAL</div>
                            <select value={selectedOpponentId} onChange={e => setSelectedOpponentId(e.target.value)}
                                style={{ background: '#1f2937', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer', outline: 'none', minWidth: '200px' }}>
                                <optgroup label="LEAGUE RIVALS">
                                    {allTeams.filter(t => t.id !== userTeam.id).map(t => <option key={t.id} value={t.id}>{t.name} ({t.ownerName})</option>)}
                                </optgroup>
                                <optgroup label="GLOBAL TOP 10 RIVALS">
                                    {globalRivals.map(t => <option key={t.id} value={t.id}>{t.name} ⭐ ({t.ownerName})</option>)}
                                </optgroup>
                            </select>
                            <div style={{ width: '2px', height: '30px', background: 'rgba(234,179,8,0.2)' }} />
                            <div style={{ padding: '8px 20px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,179,8,0.5)', borderRadius: '50px', color: GOLD, fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>MODE</div>
                            <select value={matchupMode} onChange={e => setMatchupMode(e.target.value as MatchupMode)}
                                style={{ background: '#1f2937', color: 'white', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '8px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer', outline: 'none', minWidth: '180px' }}>
                                <option value="OFF_VS_DEF">OFFENSE VS DEFENSE</option>
                                <option value="OFF_VS_OFF">OFFENSE VS OFFENSE</option>
                                <option value="DEF_VS_OFF">DEFENSE VS OFFENSE</option>
                                <option value="DEF_VS_DEF">DEFENSE VS DEFENSE</option>
                            </select>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Global Team Advantage</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: teamAdvantage > 50 ? '#10b981' : '#ef4444', fontFamily: "'Graduate', sans-serif" }}>{teamAdvantage.toFixed(1)}%</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(400px,1fr))', gap: '20px' }}>
                        {matchups.map((m, idx) => (
                            <div key={idx} onClick={() => setActiveMatchup(m)}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '15px', backdropFilter: 'blur(5px)', transition: 'transform 0.2s', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: m.advantageScore > 50 ? '#10b981' : '#ef4444', opacity: 0.6 }} />
                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gridTemplateAreas: `"seal primary center rival" "seal powerbar powerbar powerbar"`, alignItems: 'center', gap: '15px' }}>
                                    <div style={{ gridArea: 'seal', display: 'flex', justifyContent: 'center', minWidth: '70px' }}>
                                        {m.primaryPlayer.ownerId === userTeam.id && <GoldenSeal size={60} />}
                                    </div>
                                    <div style={{ gridArea: 'primary' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 900, textTransform: 'uppercase' }}>{m.primaryPlayer.position}</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>{m.primaryPlayer.lastName}</div>
                                        <div style={{ fontSize: '0.8rem', color: GOLD, fontWeight: 700 }}>{m.primaryPlayer.team}</div>
                                    </div>
                                    <div style={{ gridArea: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                        {m.metric === 'PHYSICALITY' ? <Shield size={18} color={GOLD} /> : m.metric === 'SPEED' ? <Zap size={18} color="#10b981" /> : m.metric === 'PRODUCTION' ? <Target size={18} color="#fde047" /> : <Shield size={18} color="#60a5fa" />}
                                        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
                                    </div>
                                    <div style={{ gridArea: 'rival', textAlign: 'right' }}>
                                        {m.rivalPlayer ? (
                                            <>
                                                <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 900, textTransform: 'uppercase' }}>{m.rivalPlayer.position}</div>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>{m.rivalPlayer.lastName}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 700 }}>{m.rivalPlayer.team}</div>
                                            </>
                                        ) : (
                                            <div style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: 700, fontStyle: 'italic' }}>NO COVERAGE</div>
                                        )}
                                    </div>
                                    <div style={{ gridArea: 'powerbar' }}><PowerBar score={m.advantageScore} metric={m.metric} /></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {activeMatchup && <ScoutingReportModal matchup={activeMatchup} onClose={() => setActiveMatchup(null)} isOpen={true} />}
                </div>
            )}

            {/* ── THIS WEEK TAB ─────────────────────────────────────────────── */}
            {tab === 'week' && (
                <div style={{ ...CONTENT_WRAP, maxWidth: '680px', margin: '0 auto' }}>
                    {!hasSchedule ? <EmptySchedule isAdmin={isAdmin} /> : weekMatchups.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#4b5563', padding: '40px 0', fontSize: '0.85rem' }}>No matchups for week {currentWeek}.</div>
                    ) : (
                        <>
                            <div style={{ ...LABEL, marginBottom: '10px' }}>
                                Week {currentWeek} Matchups
                                <span style={{ marginLeft: '8px', color: weekIsComplete ? '#10b981' : '#6b7280' }}>· {weekIsComplete ? 'Complete' : 'In Progress'}</span>
                            </div>
                            {weekMatchups.map(m => (
                                <MatchupCard key={m.id} matchup={m} home={teamMap.get(m.homeTeamId)} away={teamMap.get(m.awayTeamId)} myTeamId={userTeam?.id} scoreOverrides={scoreOverrides} onOverride={(tid, val) => setScoreOverrides(prev => ({ ...prev, [tid]: val }))} showInputs={isAdmin && !weekIsComplete} />
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* ── MY SCHEDULE TAB ───────────────────────────────────────────── */}
            {tab === 'my' && (
                <div style={{ ...CONTENT_WRAP, maxWidth: '680px', margin: '0 auto' }}>
                    {!hasSchedule || !userTeam ? <EmptySchedule isAdmin={isAdmin} /> : (
                        <>
                            <div style={{ ...LABEL, marginBottom: '10px' }}>{userTeam.name} — Full Season</div>
                            {Array.from({ length: numWeeks }, (_, i) => i + 1).map(week => {
                                const matchup = getTeamMatchup(league, userTeam.id, week);
                                if (!matchup) return null;
                                const oppId    = matchup.homeTeamId === userTeam.id ? matchup.awayTeamId : matchup.homeTeamId;
                                const myScore  = matchup.homeTeamId === userTeam.id ? matchup.homeScore : matchup.awayScore;
                                const oppScore = matchup.homeTeamId === userTeam.id ? matchup.awayScore : matchup.homeScore;
                                const won  = matchup.completed && myScore !== undefined && oppScore !== undefined && myScore > oppScore;
                                const lost = matchup.completed && myScore !== undefined && oppScore !== undefined && oppScore > myScore;
                                const tie  = matchup.completed && myScore !== undefined && oppScore !== undefined && myScore === oppScore;
                                return (
                                    <div key={week} style={{ ...PANEL, padding: '10px 14px', marginBottom: '7px', display: 'grid', gridTemplateColumns: '38px 1fr auto auto', alignItems: 'center', gap: '10px', border: week === currentWeek ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 900, color: week === currentWeek ? GOLD : '#4b5563', textAlign: 'center' }}>WK{week}</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e5e7eb' }}>{teamMap.get(oppId)?.name ?? 'BYE'}</div>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#9ca3af', textAlign: 'right', minWidth: '80px' }}>
                                            {matchup.completed && myScore !== undefined && oppScore !== undefined ? `${myScore.toFixed(1)} – ${oppScore.toFixed(1)}` : week === currentWeek ? 'Live' : '—'}
                                        </div>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 900, padding: '2px 8px', borderRadius: '6px', textAlign: 'center', minWidth: '24px', background: won ? 'rgba(16,185,129,0.15)' : lost ? 'rgba(239,68,68,0.15)' : tie ? 'rgba(234,179,8,0.12)' : 'rgba(255,255,255,0.04)', color: won ? '#10b981' : lost ? '#ef4444' : tie ? GOLD : '#4b5563', border: `1px solid ${won ? 'rgba(16,185,129,0.3)' : lost ? 'rgba(239,68,68,0.3)' : tie ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                                            {won ? 'W' : lost ? 'L' : tie ? 'T' : '·'}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}

            {/* ── STANDINGS TAB ─────────────────────────────────────────────── */}
            {tab === 'standings' && (
                <div style={{ ...CONTENT_WRAP, maxWidth: '680px', margin: '0 auto' }}>
                    <div style={{ ...LABEL, marginBottom: '10px' }}>League Standings</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 44px 44px 44px 66px', gap: '8px', padding: '6px 14px', ...LABEL, color: '#4b5563' }}>
                        <span>#</span><span>Team</span><span style={{ textAlign: 'center' }}>W</span><span style={{ textAlign: 'center' }}>L</span><span style={{ textAlign: 'center' }}>T</span><span style={{ textAlign: 'right' }}>PF</span>
                    </div>
                    {standings.map((team, idx) => {
                        const pf = getPointsFor(team);
                        const isMe = team.id === userTeam?.id;
                        const isPlayoff = idx < 4 && hasSchedule;
                        return (
                            <div key={team.id} style={{ ...PANEL, display: 'grid', gridTemplateColumns: '28px 1fr 44px 44px 44px 66px', gap: '8px', padding: '10px 14px', marginBottom: '6px', alignItems: 'center', border: isMe ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(255,255,255,0.06)' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: isPlayoff ? GOLD : '#4b5563' }}>{idx + 1}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                    {isPlayoff && <Trophy size={11} style={{ color: GOLD, flexShrink: 0 }} />}
                                    <span style={{ fontSize: '0.8rem', fontWeight: isMe ? 900 : 700, color: isMe ? GOLD : '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
                                    {isMe && <span style={{ fontSize: '0.5rem', color: GOLD, fontWeight: 900 }}>YOU</span>}
                                </div>
                                <span style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 900, color: '#10b981' }}>{team.wins ?? 0}</span>
                                <span style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>{team.losses ?? 0}</span>
                                <span style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#6b7280' }}>{team.ties ?? 0}</span>
                                <span style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#9ca3af' }}>{pf > 0 ? pf.toFixed(1) : '—'}</span>
                            </div>
                        );
                    })}
                    {hasSchedule && <div style={{ ...LABEL, marginTop: '8px', color: '#4b5563' }}><Trophy size={10} style={{ display: 'inline', marginRight: '4px', color: GOLD }} />Top 4 advance to playoffs</div>}
                </div>
            )}

            {/* ── PLAYOFFS TAB ──────────────────────────────────────────────── */}
            {tab === 'playoffs' && (
                <div style={{ ...CONTENT_WRAP, maxWidth: '800px', margin: '0 auto' }}>
                    {seeds.length < 4 || !hasSchedule ? (
                        <div style={{ textAlign: 'center', color: '#4b5563', paddingTop: '40px' }}>
                            <Trophy size={32} style={{ margin: '0 auto 12px', display: 'block', color: '#374151' }} />
                            <div style={{ fontSize: '0.85rem' }}>Playoff bracket appears once 4+ teams have records.</div>
                        </div>
                    ) : (
                        <>
                            <div style={{ fontSize: '0.6rem', fontWeight: 900, color: GOLD, textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', marginBottom: '16px' }}>
                                Playoff Bracket — Weeks {numWeeks + 1}–{numWeeks + 3}
                            </div>
                            <PlayoffBracket seeds={seeds} myTeamId={userTeam?.id} numWeeks={numWeeks} />
                        </>
                    )}
                </div>
            )}

        </div>
    );
};
