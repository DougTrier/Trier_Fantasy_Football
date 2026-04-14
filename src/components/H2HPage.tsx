import React, { useState, useMemo } from 'react';
import type { Player, FantasyTeam } from '../types';


import { Shield, Zap, Target } from 'lucide-react';
import h2hEmblem from '../assets/h2h_emblem_user.png';
import ScoutingReportModal from './ScoutingReportModal';
import type { H2HMatchupResult, MatchupMode } from '../utils/H2HEngine';
import { H2HEngine } from '../utils/H2HEngine';
import globalRivalsData from '../data/Global_Rivals/rivals.json';

const globalRivals = globalRivalsData as any[] as FantasyTeam[];

const GoldenSeal: React.FC<{ size?: number }> = ({ size = 60 }) => (
    <div style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))',
        flexShrink: 0,
        zIndex: 5
    }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
                <linearGradient id="goldPlate" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff9c4" />
                    <stop offset="25%" stopColor="#fde047" />
                    <stop offset="50%" stopColor="#ca8a04" />
                    <stop offset="75%" stopColor="#a16207" />
                    <stop offset="100%" stopColor="#713f12" />
                </linearGradient>
                <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
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
            {/* Outer Protective Ring */}
            <circle cx="50" cy="50" r="49" fill="none" stroke="#ca8a04" strokeWidth="0.5" opacity="0.3" />

            {/* Base Platter */}
            <circle cx="50" cy="50" r="46" fill="url(#goldPlate)" stroke="#713f12" strokeWidth="2" filter="url(#metalEmboss)" />

            {/* Perimeter Text */}
            <path id="sealPath" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
            <text fill="#422006" style={{ fontSize: '7.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8px', filter: 'drop-shadow(0.5px 0.5px 0px rgba(255,255,255,0.2))' }}>
                <textPath href="#sealPath">
                    TRIER FANTASY FOOTBALL • TRIER FANTASY FOOTBALL •
                </textPath>
            </text>

            {/* Inner Recess Group */}
            <g filter="url(#metalEmboss)">
                <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(113,63,18,0.4)" strokeWidth="1" />
                <text x="50" y="60" textAnchor="middle" fill="#422006" style={{
                    fontSize: '22px',
                    fontWeight: 950,
                    fontFamily: "'Graduate', serif",
                    letterSpacing: '2px',
                    textShadow: '1px 1px 0px rgba(255,255,255,0.4)'
                }}>
                    TFF
                </text>
            </g>

            {/* High-Gloss Highlights Overlay */}
            <circle cx="35" cy="35" r="10" fill="url(#ringGlow)" pointerEvents="none" />
        </svg>
    </div>
);

interface H2HPageProps {
    userTeam: FantasyTeam;
    allTeams: FantasyTeam[];
    allPlayers: Player[];
}

const PowerBar = ({ score, metric }: { score: number, metric: string }) => {
    const isAdvantage = score > 50;
    const percentage = score;

    return (
        <div style={{ width: '100%', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.7rem', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <span>{metric}</span>
                <span style={{ color: isAdvantage ? '#10b981' : '#ef4444' }}>{score.toFixed(1)}% ADVANTAGE</span>
            </div>
            <div style={{ height: '12px', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: isAdvantage
                        ? 'linear-gradient(90deg, #059669 0%, #10b981 100%)'
                        : 'linear-gradient(90deg, #b91c1c 0%, #ef4444 100%)',
                    boxShadow: `0 0 15px ${isAdvantage ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                }} />
                {/* Center marker */}
                <div style={{ position: 'absolute', top: 0, left: '50%', width: '2px', height: '100%', background: 'rgba(255,255,255,0.3)', zIndex: 2 }} />
            </div>
        </div>
    );
};

export const H2HPage: React.FC<H2HPageProps> = ({ userTeam, allTeams, allPlayers }) => {
    const [selectedOpponentId, setSelectedOpponentId] = useState<string>(
        allTeams.find(t => t.id !== userTeam.id)?.id || ''
    );
    const [activeMatchup, setActiveMatchup] = useState<H2HMatchupResult | null>(null);
    const [matchupMode, setMatchupMode] = useState<MatchupMode>('OFF_VS_DEF');

    const opponentTeam = useMemo(() => {
        const localOpponent = allTeams.find(t => t.id === selectedOpponentId);
        if (localOpponent) return localOpponent;
        return globalRivals.find(t => t.id === selectedOpponentId);
    }, [allTeams, selectedOpponentId]);

    const starters = useMemo(() => {
        const s = userTeam.roster;
        const pts = [s.qb, s.rb1, s.rb2, s.wr1, s.wr2, s.te, s.flex, s.k, s.dst].filter(Boolean) as Player[];
        // Ensure local user ownership is tagged for the Golden Seal
        return pts.map(p => ({ ...p, ownerId: userTeam.id }));
    }, [userTeam]);


    const userDefense = useMemo(() => {
        const dstTeam = userTeam.roster.dst?.team;
        if (!dstTeam) return [];
        return allPlayers
            .filter(p => p.team === dstTeam && ['DL', 'LB', 'DB'].includes(p.position))
            .map(p => ({ ...p, ownerId: userTeam.id }));
    }, [userTeam, allPlayers]);

    const opponentDefenders = useMemo(() => {
        const dstTeam = opponentTeam?.roster.dst?.team;
        if (!dstTeam) return [];
        return allPlayers.filter(p => p.team === dstTeam && ['DL', 'LB', 'DB'].includes(p.position));
    }, [opponentTeam, allPlayers]);

    const rivalStarters = useMemo(() => {
        if (!opponentTeam) return [];
        const s = opponentTeam.roster;
        return [s.qb, s.rb1, s.rb2, s.wr1, s.wr2, s.te, s.flex, s.k, s.dst].filter(Boolean) as Player[];
    }, [opponentTeam]);

    const matchups = useMemo(() => {
        return H2HEngine.getMatchups(starters, userDefense, rivalStarters, opponentDefenders, matchupMode);
    }, [starters, userDefense, rivalStarters, opponentDefenders, matchupMode]);

    const teamAdvantage = useMemo(() => {
        if (matchups.length === 0) return 50;
        return matchups.reduce((acc, m) => acc + m.advantageScore, 0) / matchups.length;
    }, [matchups]);

    return (
        <div style={{ color: 'white' }}>
            {/* Header: Isolated 3D Emblem */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: '30px',
                marginBottom: '70px',
                position: 'relative',
                zIndex: 10
            }}>
                <img
                    src={h2hEmblem}
                    alt="Head to Head Emblem"
                    style={{
                        maxWidth: '800px', // Adjusted for better visibility of high-res asset
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        borderRadius: '8px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}
                />
            </div>

            {/* Selection Bar */}
            <div style={{
                background: 'rgba(0,0,0,0.4)',
                padding: '20px 30px',
                borderRadius: '16px',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '30px',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                        padding: '8px 20px',
                        background: 'linear-gradient(135deg, #eab308 0%, #d97706 100%)',
                        borderRadius: '50px',
                        color: '#000',
                        fontWeight: 900,
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        boxShadow: '0 4px 10px rgba(234,179,8,0.3)'
                    }}>
                        SELECT RIVAL
                    </div>
                    <select
                        value={selectedOpponentId}
                        onChange={(e) => setSelectedOpponentId(e.target.value)}
                        style={{
                            background: '#1f2937',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none',
                            minWidth: '200px'
                        }}
                        title="Choose an opponent to compare your lineup against."
                    >
                        <optgroup label="LEAGUE RIVALS">
                            {allTeams.filter(t => t.id !== userTeam.id).map(team => (
                                <option key={team.id} value={team.id}>{team.name} ({team.ownerName})</option>
                            ))}
                        </optgroup>
                        <optgroup label="GLOBAL TOP 10 RIVALS">
                            {globalRivals.map(team => (
                                <option key={team.id} value={team.id}>{team.name} ⭐ ({team.ownerName})</option>
                            ))}
                        </optgroup>
                    </select>

                    <div style={{ width: '2px', height: '30px', background: 'rgba(234,179,8,0.2)', margin: '0 10px' }} />

                    <div style={{
                        padding: '8px 20px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(234,179,8,0.5)',
                        borderRadius: '50px',
                        color: '#eab308',
                        fontWeight: 900,
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        MODE
                    </div>
                    <select
                        value={matchupMode}
                        onChange={(e) => setMatchupMode(e.target.value as MatchupMode)}
                        style={{
                            background: '#1f2937',
                            color: 'white',
                            border: '1px solid rgba(234,179,8,0.3)',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none',
                            minWidth: '180px'
                        }}
                        title="Change comparison logic (e.g., Your Offense vs Their Defense)."
                    >
                        <option value="OFF_VS_DEF">OFFENSE VS DEFENSE</option>
                        <option value="OFF_VS_OFF">OFFENSE VS OFFENSE</option>
                        <option value="DEF_VS_OFF">DEFENSE VS OFFENSE</option>
                        <option value="DEF_VS_DEF">DEFENSE VS DEFENSE</option>
                    </select>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Global Team Advantage</div>
                    <div style={{
                        fontSize: '2rem',
                        fontWeight: 900,
                        color: teamAdvantage > 50 ? '#10b981' : '#ef4444',
                        fontFamily: "'Graduate', sans-serif"
                    }}>
                        {teamAdvantage.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Matchups Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
                {matchups.map((m, idx) => (
                    <div key={idx} style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px',
                        backdropFilter: 'blur(5px)',
                        transition: 'transform 0.2s',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        onClick={() => setActiveMatchup(m)}
                        title="Click to view full scouting report and player metrics."
                    >
                        {/* Glow effect */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '4px',
                            height: '100%',
                            background: m.advantageScore > 50 ? '#10b981' : '#ef4444',
                            opacity: 0.6
                        }} />

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto 1fr',
                            gridTemplateAreas: `
                                "seal primary center rival"
                                "seal powerbar powerbar powerbar"
                            `,
                            alignItems: 'center',
                            gap: '15px'
                        }}>
                            {/* Dedicated Ownership Badge Area */}
                            <div style={{ gridArea: 'seal', display: 'flex', justifyContent: 'center', minWidth: '70px' }}>
                                {m.primaryPlayer.ownerId === userTeam.id && <GoldenSeal size={60} />}
                            </div>

                            {/* Offense / Primary */}
                            <div style={{ gridArea: 'primary' }}>
                                <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 900, textTransform: 'uppercase' }}>{m.primaryPlayer.position}</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>{m.primaryPlayer.lastName}</div>
                                <div style={{ fontSize: '0.8rem', color: '#eab308', fontWeight: 700 }}>{m.primaryPlayer.team}</div>
                            </div>

                            <div style={{ gridArea: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                {m.metric === 'PHYSICALITY' ? <Shield size={18} color="#eab308" /> :
                                    m.metric === 'SPEED' ? <Zap size={18} color="#10b981" /> :
                                        m.metric === 'PRODUCTION' ? <Target size={18} color="#fde047" /> :
                                            m.metric === 'EFFICIENCY' ? <Shield size={18} color="#60a5fa" /> :
                                                <Target size={18} color="#ef4444" />}
                                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
                            </div>

                            {/* Defense / Rival */}
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

                            <div style={{ gridArea: 'powerbar' }}>
                                <PowerBar score={m.advantageScore} metric={m.metric} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {activeMatchup && (
                <ScoutingReportModal
                    matchup={activeMatchup}
                    onClose={() => setActiveMatchup(null)}
                    isOpen={true}
                />
            )}
        </div>
    );
};
