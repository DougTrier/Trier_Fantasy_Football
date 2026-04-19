/**
 * SchedulePage — H2H Weekly Schedule & Standings
 * ================================================
 * Four tabs:
 *   This Week  — all league matchups for the current week, live score
 *   My Schedule — full season calendar for the logged-in team with W/L badges
 *   Standings  — W/L/PF/PA table, tiebroken by total production points
 *   Playoffs   — seeded bracket (top 4 teams, weeks 15–17)
 *
 * Commissioner bar (isAdmin):
 *   Generate Schedule (14 or 16 weeks) — creates the full round-robin calendar.
 *   Complete Week — marks the current week complete, records scores, advances week.
 *   Score overrides — inline numeric inputs before completing a week.
 */
import React, { useState, useMemo } from 'react';
import { Calendar, Trophy, BarChart2, ChevronRight, CheckCircle, Info, X } from 'lucide-react';
import type { FantasyTeam, League, Matchup } from '../types';
import {
    generateSchedule, completeWeek,
    getStandings, getPlayoffSeeds,
    getWeekMatchups, getTeamMatchup, getPointsFor,
} from '../services/ScheduleService';
import leatherTexture from '../assets/leather_texture.png';

// ── Shared style constants ────────────────────────────────────────────────────

const GOLD   = '#eab308';
const PANEL  = {
    background: `url(${leatherTexture}), linear-gradient(135deg, rgba(17,24,39,0.97), rgba(31,41,55,0.97))`,
    backgroundBlendMode: 'overlay' as const,
    backgroundSize: '150px, cover',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
};
const LABEL  = { fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: '#6b7280' };
const SECTION_HDR = { fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '2px', color: GOLD, marginBottom: '10px' };

// ── Help overlay content ──────────────────────────────────────────────────────

const HELP_SECTIONS = [
    { title: 'What is H2H?', body: 'Head-to-Head mode gives every team a weekly opponent. Your fantasy points that week are compared to your opponent\'s — the higher score wins.' },
    { title: 'Generating a Schedule', body: 'The commissioner clicks "Generate 14-Week" or "Generate 16-Week". A balanced round-robin is created so every team plays each other as evenly as possible.' },
    { title: 'Completing a Week', body: 'After scores are in, the commissioner clicks "Complete Week X". You can optionally override individual team scores in the inputs provided before clicking.' },
    { title: 'Standings', body: 'Teams are ranked by Wins, then Losses, then Total Points Scored (PF). The top 4 teams qualify for the playoff bracket.' },
    { title: 'Playoffs', body: 'The top 4 seeds play semifinals in weeks 15–16. The two winners meet in the championship in week 17. Bracket is seeded 1v4 and 2v3.' },
    { title: 'Points For (PF)', body: 'PF is the sum of all weekly scores — it is the primary tiebreaker when two teams have identical W/L records.' },
    { title: 'Score Overrides', body: 'Before completing a week, the commissioner can type a custom score for any team in the override boxes. Leave blank to use the team\'s recorded Production Points.' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface SchedulePageProps {
    league: League;
    allTeams: FantasyTeam[];
    myTeam: FantasyTeam | null;
    isAdmin: boolean;
    onLeagueChange: (updated: League) => void;
    onTeamsChange: (updated: FantasyTeam[]) => void;
}

// ── Matchup Card ─────────────────────────────────────────────────────────────

const MatchupCard: React.FC<{
    matchup: Matchup;
    home: FantasyTeam | undefined;
    away: FantasyTeam | undefined;
    myTeamId?: string;
    scoreOverrides: Record<string, string>;
    onOverride: (teamId: string, val: string) => void;
    showInputs: boolean;
}> = ({ matchup, home, away, myTeamId, scoreOverrides, onOverride, showInputs }) => {
    const homeScore = matchup.homeScore;
    const awayScore = matchup.awayScore;
    const homeWon = matchup.completed && homeScore !== undefined && awayScore !== undefined && homeScore > awayScore;
    const awayWon = matchup.completed && homeScore !== undefined && awayScore !== undefined && awayScore > homeScore;
    const isMine  = home?.id === myTeamId || away?.id === myTeamId;

    return (
        <div style={{
            ...PANEL,
            padding: '14px 18px',
            marginBottom: '10px',
            border: isMine ? `1px solid rgba(234,179,8,0.35)` : '1px solid rgba(255,255,255,0.07)',
            boxShadow: isMine ? '0 0 12px rgba(234,179,8,0.08)' : 'none',
        }}>
            {/* Home team row */}
            {[{ team: home, score: homeScore, won: homeWon, isHome: true }, { team: away, score: awayScore, won: awayWon, isHome: false }].map(({ team, score, won }) => (
                <div key={team?.id ?? 'unknown'} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Win indicator */}
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: won ? '#10b981' : 'transparent', border: won ? 'none' : '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: team?.id === myTeamId ? 900 : 600, color: team?.id === myTeamId ? GOLD : '#e5e7eb' }}>
                            {team?.name ?? '—'}
                        </span>
                        {team?.id === myTeamId && <span style={{ fontSize: '0.55rem', color: GOLD, fontWeight: 900 }}>YOU</span>}
                    </div>

                    {/* Score / override input */}
                    {showInputs && team ? (
                        <input
                            type="number"
                            placeholder="pts"
                            value={scoreOverrides[team.id] ?? ''}
                            onChange={e => onOverride(team.id, e.target.value)}
                            style={{
                                width: '58px', padding: '3px 6px', background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
                                color: '#fff', fontSize: '0.78rem', textAlign: 'right',
                            }}
                        />
                    ) : (
                        <span style={{ fontSize: '0.85rem', fontWeight: 900, color: won ? '#10b981' : score !== undefined ? '#e5e7eb' : '#4b5563', minWidth: '40px', textAlign: 'right' }}>
                            {score !== undefined ? score.toFixed(1) : matchup.completed ? '—' : 'TBD'}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const SchedulePage: React.FC<SchedulePageProps> = ({
    league, allTeams, myTeam, isAdmin, onLeagueChange, onTeamsChange,
}) => {
    const [tab, setTab]               = useState<'week' | 'my' | 'standings' | 'playoffs'>('week');
    const [showHelp, setShowHelp]     = useState(false);
    const [scoreOverrides, setScoreOverrides] = useState<Record<string, string>>({});

    // Responsive zoom
    const [scale, setScale] = useState(() => Math.max(0.55, Math.min(window.innerWidth / 1200, window.innerHeight / 700)));
    React.useEffect(() => {
        const onResize = () => setScale(Math.max(0.55, Math.min(window.innerWidth / 1200, window.innerHeight / 700)));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const currentWeek = league.currentWeek ?? 1;
    const numWeeks    = league.numWeeks ?? 14;
    const hasSchedule = (league.schedule?.length ?? 0) > 0;

    // Map team ID → FantasyTeam for quick lookups
    const teamMap = useMemo(() => new Map(allTeams.map(t => [t.id, t])), [allTeams]);

    // This week's matchups
    const weekMatchups = useMemo(() => getWeekMatchups(league, currentWeek), [league, currentWeek]);

    // Standings (sorted)
    const standings = useMemo(() => getStandings(allTeams), [allTeams]);

    // Top 4 playoff seeds
    const seeds = useMemo(() => getPlayoffSeeds(allTeams), [allTeams]);

    // ── Commissioner actions ───────────────────────────────────────────────────

    const handleGenerate = (weeks: number) => {
        if (allTeams.length < 2) return;
        const schedule = generateSchedule(allTeams, weeks);
        onLeagueChange({ ...league, schedule, currentWeek: 1, numWeeks: weeks });
    };

    const handleCompleteWeek = () => {
        // Convert string override values to numbers
        const overrideNums: Record<string, number> = {};
        for (const [id, val] of Object.entries(scoreOverrides)) {
            const n = parseFloat(val);
            if (!isNaN(n)) overrideNums[id] = n;
        }
        const result = completeWeek(league, allTeams, currentWeek, Object.keys(overrideNums).length > 0 ? overrideNums : undefined);
        onLeagueChange(result.league);
        onTeamsChange(result.teams);
        setScoreOverrides({});
    };

    const weekIsComplete = weekMatchups.every(m => m.completed);
    const canComplete    = hasSchedule && weekMatchups.length > 0 && !weekIsComplete;

    // ── Tabs ──────────────────────────────────────────────────────────────────

    const TABS: { id: typeof tab; label: string; icon: React.ReactNode }[] = [
        { id: 'week',      label: 'This Week',   icon: <Calendar size={13} /> },
        { id: 'my',        label: 'My Schedule', icon: <ChevronRight size={13} /> },
        { id: 'standings', label: 'Standings',   icon: <BarChart2 size={13} /> },
        { id: 'playoffs',  label: 'Playoffs',    icon: <Trophy size={13} /> },
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{
            position: 'absolute', inset: 0, overflow: 'auto',
            padding: '24px 32px',
        }}>
            {/* Zoom wrapper */}
            <div style={{
                zoom: scale,
                width:  `${(1 / scale) * 100}%`,
                minHeight: `${(1 / scale) * 100}%`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center',
            }}>
            {/* ── Centered card ─────────────────────────────────────────── */}
            <div style={{
                width: '100%', maxWidth: '900px',
                background: `url(${leatherTexture}), linear-gradient(160deg, rgba(10,14,26,0.97) 0%, rgba(17,24,39,0.97) 100%)`,
                backgroundBlendMode: 'overlay', backgroundSize: '150px, cover',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: '18px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
            }}>

            {/* ── Help Overlay ────────────────────────────────────────────── */}
            {showHelp && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 200,
                    background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{
                        ...PANEL,
                        padding: '28px 32px', width: '640px', maxWidth: '90vw', maxHeight: '80vh',
                        overflowY: 'auto', boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
                        position: 'relative',
                    }}>
                        <button onClick={() => setShowHelp(false)} style={{
                            position: 'absolute', top: '14px', right: '14px',
                            background: 'transparent', border: 'none', color: '#6b7280',
                            cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                        }}>
                            <X size={16} />
                        </button>
                        <div style={{ ...SECTION_HDR, marginBottom: '18px', fontSize: '0.65rem' }}>
                            H2H Schedule — How To Use
                        </div>
                        {HELP_SECTIONS.map(s => (
                            <div key={s.title} style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#e5e7eb', marginBottom: '4px' }}>{s.title}</div>
                                <div style={{ fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.5 }}>{s.body}</div>
                            </div>
                        ))}
                        <button onClick={() => setShowHelp(false)} style={{
                            marginTop: '10px', width: '100%', padding: '10px',
                            background: `linear-gradient(90deg, ${GOLD}, #ca8a04)`,
                            border: 'none', borderRadius: '8px', color: '#000',
                            fontWeight: 900, fontSize: '0.75rem', letterSpacing: '1px', cursor: 'pointer',
                        }}>
                            GOT IT — LET'S PLAY
                        </button>
                    </div>
                </div>
            )}

            {/* ── Header bar ──────────────────────────────────────────────── */}
            <div style={{
                padding: '18px 28px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
                <div>
                    <div style={LABEL}>Head-to-Head Season</div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>
                        SCHEDULE
                        {hasSchedule && (
                            <span style={{ marginLeft: '12px', fontSize: '0.7rem', color: GOLD, fontWeight: 700 }}>
                                WEEK {currentWeek} / {numWeeks}
                            </span>
                        )}
                    </h2>
                </div>

                {/* HOW TO USE pill */}
                <button onClick={() => setShowHelp(true)} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: '20px',
                    background: 'transparent', border: `1px solid rgba(234,179,8,0.45)`,
                    color: GOLD, fontSize: '0.62rem', fontWeight: 900,
                    letterSpacing: '1px', cursor: 'pointer',
                }}>
                    <Info size={12} /> HOW TO USE
                </button>
            </div>

            {/* ── Commissioner bar ────────────────────────────────────────── */}
            {isAdmin && (
                <div style={{
                    padding: '10px 28px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flexShrink: 0,
                }}>
                    <div style={{ ...LABEL, color: GOLD, flexShrink: 0 }}>Commissioner</div>

                    {!hasSchedule ? (
                        <>
                            <button onClick={() => handleGenerate(14)} style={btnStyle}>Generate 14-Week Schedule</button>
                            <button onClick={() => handleGenerate(16)} style={btnStyle}>Generate 16-Week Schedule</button>
                        </>
                    ) : (
                        <>
                            {/* Reset */}
                            <button onClick={() => handleGenerate(numWeeks)} style={{ ...btnStyle, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}>
                                Regenerate
                            </button>

                            {/* Complete week button */}
                            {canComplete && (
                                <button onClick={handleCompleteWeek} style={{ ...btnStyle, background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.4)', color: '#10b981' }}>
                                    <CheckCircle size={13} /> Complete Week {currentWeek}
                                </button>
                            )}
                            {weekIsComplete && currentWeek <= numWeeks && (
                                <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700 }}>
                                    ✓ Week {currentWeek - 1} complete
                                </span>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── Tab bar ─────────────────────────────────────────────────── */}
            <div style={{
                display: 'flex', gap: '6px',
                padding: '12px 28px', flexShrink: 0,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                        fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.5px',
                        background: tab === t.id ? `rgba(234,179,8,0.15)` : 'rgba(255,255,255,0.04)',
                        border: tab === t.id ? `1px solid rgba(234,179,8,0.5)` : '1px solid rgba(255,255,255,0.08)',
                        color: tab === t.id ? GOLD : '#9ca3af',
                        transition: 'all 0.15s',
                    }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── Tab content ─────────────────────────────────────────────── */}
            <div style={{ padding: '16px 28px 28px' }}>

                {/* ── THIS WEEK ─────────────────────────────────────────── */}
                {tab === 'week' && (
                    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                        {!hasSchedule ? (
                            <EmptySchedule isAdmin={isAdmin} />
                        ) : weekMatchups.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#4b5563', paddingTop: '40px', fontSize: '0.85rem' }}>
                                No matchups found for week {currentWeek}.
                            </div>
                        ) : (
                            <>
                                <div style={{ ...LABEL, marginBottom: '10px' }}>
                                    Week {currentWeek} Matchups
                                    {weekIsComplete && <span style={{ marginLeft: '8px', color: '#10b981' }}>· Complete</span>}
                                    {!weekIsComplete && <span style={{ marginLeft: '8px', color: '#6b7280' }}>· In Progress</span>}
                                </div>
                                {weekMatchups.map(m => (
                                    <MatchupCard
                                        key={m.id}
                                        matchup={m}
                                        home={teamMap.get(m.homeTeamId)}
                                        away={teamMap.get(m.awayTeamId)}
                                        myTeamId={myTeam?.id}
                                        scoreOverrides={scoreOverrides}
                                        onOverride={(tid, val) => setScoreOverrides(prev => ({ ...prev, [tid]: val }))}
                                        showInputs={isAdmin && !weekIsComplete}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* ── MY SCHEDULE ───────────────────────────────────────── */}
                {tab === 'my' && (
                    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                        {!hasSchedule || !myTeam ? (
                            <EmptySchedule isAdmin={isAdmin} />
                        ) : (
                            <>
                                <div style={{ ...LABEL, marginBottom: '10px' }}>
                                    {myTeam.name} — Full Season
                                </div>
                                {Array.from({ length: numWeeks }, (_, i) => i + 1).map(week => {
                                    const matchup = getTeamMatchup(league, myTeam.id, week);
                                    if (!matchup) return null;
                                    const oppId  = matchup.homeTeamId === myTeam.id ? matchup.awayTeamId : matchup.homeTeamId;
                                    const opp    = teamMap.get(oppId);
                                    const myScore = matchup.homeTeamId === myTeam.id ? matchup.homeScore : matchup.awayScore;
                                    const oppScore = matchup.homeTeamId === myTeam.id ? matchup.awayScore : matchup.homeScore;
                                    const won  = matchup.completed && myScore !== undefined && oppScore !== undefined && myScore > oppScore;
                                    const lost = matchup.completed && myScore !== undefined && oppScore !== undefined && oppScore > myScore;
                                    const tie  = matchup.completed && myScore !== undefined && oppScore !== undefined && myScore === oppScore;

                                    return (
                                        <div key={week} style={{
                                            ...PANEL,
                                            padding: '12px 16px', marginBottom: '8px',
                                            display: 'grid', gridTemplateColumns: '40px 1fr auto auto',
                                            alignItems: 'center', gap: '12px',
                                            border: week === currentWeek ? `1px solid rgba(234,179,8,0.35)` : '1px solid rgba(255,255,255,0.06)',
                                        }}>
                                            {/* Week number */}
                                            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: week === currentWeek ? GOLD : '#4b5563', textAlign: 'center' }}>
                                                WK{week}
                                            </div>

                                            {/* Opponent */}
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e5e7eb' }}>
                                                {opp?.name ?? 'BYE'}
                                            </div>

                                            {/* Score */}
                                            <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#9ca3af', textAlign: 'right', minWidth: '80px' }}>
                                                {matchup.completed && myScore !== undefined && oppScore !== undefined
                                                    ? `${myScore.toFixed(1)} – ${oppScore.toFixed(1)}`
                                                    : week === currentWeek ? 'Live' : '—'}
                                            </div>

                                            {/* W/L badge */}
                                            <div style={{
                                                fontSize: '0.6rem', fontWeight: 900, padding: '2px 8px',
                                                borderRadius: '6px', textAlign: 'center', minWidth: '28px',
                                                background: won ? 'rgba(16,185,129,0.15)' : lost ? 'rgba(239,68,68,0.15)' : tie ? 'rgba(234,179,8,0.12)' : 'rgba(255,255,255,0.04)',
                                                color: won ? '#10b981' : lost ? '#ef4444' : tie ? GOLD : '#4b5563',
                                                border: `1px solid ${won ? 'rgba(16,185,129,0.3)' : lost ? 'rgba(239,68,68,0.3)' : tie ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                            }}>
                                                {won ? 'W' : lost ? 'L' : tie ? 'T' : '·'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                )}

                {/* ── STANDINGS ─────────────────────────────────────────── */}
                {tab === 'standings' && (
                    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
                        {allTeams.length === 0 ? (
                            <EmptySchedule isAdmin={isAdmin} />
                        ) : (
                            <>
                                <div style={{ ...LABEL, marginBottom: '10px' }}>League Standings</div>

                                {/* Column headers */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '28px 1fr 48px 48px 48px 70px',
                                    gap: '8px', padding: '6px 16px',
                                    ...LABEL, color: '#4b5563',
                                }}>
                                    <span>#</span>
                                    <span>Team</span>
                                    <span style={{ textAlign: 'center' }}>W</span>
                                    <span style={{ textAlign: 'center' }}>L</span>
                                    <span style={{ textAlign: 'center' }}>T</span>
                                    <span style={{ textAlign: 'right' }}>PF</span>
                                </div>

                                {standings.map((team, idx) => {
                                    const pf  = getPointsFor(team);
                                    const isMe = team.id === myTeam?.id;
                                    const isPlayoff = idx < 4 && hasSchedule;
                                    return (
                                        <div key={team.id} style={{
                                            ...PANEL,
                                            display: 'grid', gridTemplateColumns: '28px 1fr 48px 48px 48px 70px',
                                            gap: '8px', padding: '10px 16px', marginBottom: '6px',
                                            alignItems: 'center',
                                            border: isMe ? `1px solid rgba(234,179,8,0.35)` : idx === 3 && hasSchedule ? '1px dashed rgba(234,179,8,0.18)' : '1px solid rgba(255,255,255,0.06)',
                                        }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: isPlayoff ? GOLD : '#4b5563' }}>{idx + 1}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                                {isPlayoff && <Trophy size={11} style={{ color: GOLD, flexShrink: 0 }} />}
                                                <span style={{ fontSize: '0.82rem', fontWeight: isMe ? 900 : 700, color: isMe ? GOLD : '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {team.name}
                                                </span>
                                                {isMe && <span style={{ fontSize: '0.5rem', color: GOLD, fontWeight: 900 }}>YOU</span>}
                                            </div>
                                            <span style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 900, color: '#10b981' }}>{team.wins ?? 0}</span>
                                            <span style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>{team.losses ?? 0}</span>
                                            <span style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#6b7280' }}>{team.ties ?? 0}</span>
                                            <span style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#9ca3af' }}>{pf > 0 ? pf.toFixed(1) : '—'}</span>
                                        </div>
                                    );
                                })}

                                {hasSchedule && (
                                    <div style={{ ...LABEL, marginTop: '8px', color: '#4b5563' }}>
                                        <Trophy size={10} style={{ display: 'inline', marginRight: '4px', color: GOLD }} />
                                        Top 4 advance to playoffs
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── PLAYOFFS ──────────────────────────────────────────── */}
                {tab === 'playoffs' && (
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        {seeds.length < 4 || !hasSchedule ? (
                            <div style={{ textAlign: 'center', color: '#4b5563', paddingTop: '40px' }}>
                                <Trophy size={32} style={{ margin: '0 auto 12px', display: 'block', color: '#374151' }} />
                                <div style={{ fontSize: '0.85rem' }}>Playoff bracket appears once 4+ teams have records.</div>
                            </div>
                        ) : (
                            <PlayoffBracket seeds={seeds} myTeamId={myTeam?.id} numWeeks={numWeeks} />
                        )}
                    </div>
                )}

            </div>
            </div>{/* end centered card */}
            </div>{/* end zoom wrapper */}
        </div>
    );
};

// ── Playoff Bracket ───────────────────────────────────────────────────────────

const PlayoffBracket: React.FC<{ seeds: FantasyTeam[]; myTeamId?: string; numWeeks: number }> = ({ seeds, myTeamId, numWeeks }) => {
    const sf1Home = seeds[0]; // 1 seed
    const sf1Away = seeds[3]; // 4 seed
    const sf2Home = seeds[1]; // 2 seed
    const sf2Away = seeds[2]; // 3 seed

    return (
        <div>
            <div style={{ ...SECTION_HDR, textAlign: 'center', marginBottom: '20px' }}>
                PLAYOFF BRACKET — WEEKS {numWeeks + 1}–{numWeeks + 3}
            </div>

            <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Semifinal 1 */}
                <BracketMatchup
                    label={`Semifinal — Week ${numWeeks + 1}`}
                    team1={sf1Home} seed1={1}
                    team2={sf1Away} seed2={4}
                    myTeamId={myTeamId}
                />

                {/* Championship */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
                    <div style={{ ...SECTION_HDR, textAlign: 'center' }}>
                        <Trophy size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        Championship — Week {numWeeks + 3}
                    </div>
                    <div style={{ ...PANEL, padding: '18px 24px', textAlign: 'center', width: '100%' }}>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '6px' }}>TBD</div>
                        <div style={{ fontSize: '0.75rem', color: '#4b5563', fontStyle: 'italic' }}>Winner of SF1</div>
                        <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '8px 0', color: GOLD, fontWeight: 900, fontSize: '0.7rem' }}>VS</div>
                        <div style={{ fontSize: '0.75rem', color: '#4b5563', fontStyle: 'italic' }}>Winner of SF2</div>
                    </div>
                </div>

                {/* Semifinal 2 */}
                <BracketMatchup
                    label={`Semifinal — Week ${numWeeks + 1}`}
                    team1={sf2Home} seed1={2}
                    team2={sf2Away} seed2={3}
                    myTeamId={myTeamId}
                />
            </div>
        </div>
    );
};

const BracketMatchup: React.FC<{
    label: string;
    team1: FantasyTeam; seed1: number;
    team2: FantasyTeam; seed2: number;
    myTeamId?: string;
}> = ({ label, team1, seed1, team2, seed2, myTeamId }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
        <div style={{ ...SECTION_HDR, textAlign: 'center', fontSize: '0.55rem' }}>{label}</div>
        <div style={{
            ...PANEL,
            padding: '14px 18px', width: '100%',
            border: (team1.id === myTeamId || team2.id === myTeamId) ? `1px solid rgba(234,179,8,0.35)` : '1px solid rgba(255,255,255,0.08)',
        }}>
            {[{ team: team1, seed: seed1 }, { team: team2, seed: seed2 }].map(({ team, seed }) => (
                <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: GOLD, minWidth: '14px' }}>#{seed}</div>
                    <div style={{ flex: 1, fontSize: '0.78rem', fontWeight: team.id === myTeamId ? 900 : 700, color: team.id === myTeamId ? GOLD : '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {team.name}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: '#4b5563' }}>
                        {team.wins ?? 0}–{team.losses ?? 0}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptySchedule: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => (
    <div style={{ textAlign: 'center', paddingTop: '60px', color: '#4b5563' }}>
        <Calendar size={40} style={{ margin: '0 auto 14px', display: 'block', color: '#374151' }} />
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#6b7280', marginBottom: '8px' }}>No schedule generated yet</div>
        {isAdmin
            ? <div style={{ fontSize: '0.75rem' }}>Use the Commissioner bar above to generate a 14 or 16-week schedule.</div>
            : <div style={{ fontSize: '0.75rem' }}>Ask the Commissioner to generate this season's schedule.</div>}
    </div>
);

// ── Shared button style ───────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.5px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#e5e7eb', transition: 'background 0.15s',
};
