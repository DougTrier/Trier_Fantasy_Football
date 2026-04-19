import React from 'react';
import { TrendingUp, Shield, History, Download, Wallet, Star } from 'lucide-react';
import type { Player, Transaction, FantasyTeam } from '../../types';
import { ScoringEngine } from '../../utils/ScoringEngine';
import { getTeamTheme } from '../../utils/teamThemes';
import { CURRENT_SEASON, formatHeight } from './cardUtils';

interface CardBackFaceProps {
    player: Player;
    owningTeam?: FantasyTeam;
    teamTransactions: Transaction[];
    isFlipped: boolean;
    isExporting: boolean;
    backPage: 'career' | 'fantasy' | 'combine';
    setBackPage: (page: 'career' | 'fantasy' | 'combine') => void;
    downloadCareerStats: () => void;
    backRef: React.RefObject<HTMLDivElement | null>;
}

export const CardBackFace: React.FC<CardBackFaceProps> = ({
    player,
    owningTeam,
    teamTransactions,
    isFlipped,
    isExporting,
    backPage,
    setBackPage,
    downloadCareerStats,
    backRef
}) => {
    const theme = getTeamTheme(player.team);

    return (
        <div
            ref={backRef}
            style={{
                position: 'absolute',
                width: '100%',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                border: `8px solid ${theme.primary}`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: isFlipped ? 'auto' : 'none',
                boxSizing: 'border-box',
                height: isExporting ? 'auto' : '100%'
            }}>
            <div
                style={{
                    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                    padding: 'clamp(8px, 1.5vh, 12px) 4%',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1vh',
                    overflow: isExporting ? 'visible' : 'hidden',
                    minHeight: 0,
                    boxSizing: 'border-box',
                    flex: isExporting ? 'none' : 1,
                    height: isExporting ? 'auto' : undefined
                }}>
                {/* INTEGRATED PREMIUM TABS */}
                <div style={{
                    width: '100%',
                    display: 'flex',
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: '10px',
                    padding: '2px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    marginBottom: '5px',
                    flexShrink: 0,
                    zIndex: 100
                }}>
                    {(['career', 'combine', 'fantasy'] as const).map(page => (
                        <button
                            key={page}
                            onClick={(e) => { e.stopPropagation(); setBackPage(page); }}
                            title={`Switch to ${page === 'career' ? 'Career Stats' : page === 'combine' ? 'Combine Metrics' : 'Trade Ledger'} view`}
                            style={{
                                flex: 1,
                                padding: '8px 2px',
                                border: 'none',
                                background: backPage === page ? '#fff' : 'transparent',
                                color: backPage === page ? theme.primary : '#fff',
                                borderRadius: '8px',
                                fontSize: '0.65rem',
                                fontWeight: 900,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textTransform: 'uppercase',
                                fontFamily: "'Graduate', sans-serif"
                            }}
                        >
                            {page === 'career' ? 'Stats' : page === 'combine' ? 'Combine' : 'Ledger'}
                        </button>
                    ))}
                </div>

                {/* BACK HEADER WITH NAME AND MASCOT */}
                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.2)',
                    paddingBottom: '8px',
                    marginBottom: '4px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontFamily: "'Graduate', sans-serif", fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase' }}>
                            {player.firstName} {player.lastName}
                        </div>
                        <img src={theme.logoUrl} style={{ height: '24px', width: 'auto', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} alt="Team Mascot" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {player.nflProfileUrl && (
                            <a
                                href={player.nflProfileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    fontSize: '0.55rem',
                                    background: 'rgba(255,255,255,0.2)',
                                    color: '#fff',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    textDecoration: 'none',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                    border: '1px solid rgba(255,255,255,0.4)',
                                    whiteSpace: 'nowrap'
                                }}
                                title="View Official NFL Bio"
                                onClick={(e) => e.stopPropagation()}
                            >
                                BIO <TrendingUp size={10} />
                            </a>
                        )}
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                            {player.position}
                        </div>
                    </div>
                </div>

                {backPage === 'career' ? (
                    <>
                        {/* SCROLLABLE CAREER STATS */}
                        <div style={{
                            background: '#fff',
                            padding: '2%',
                            borderRadius: '8px',
                            color: '#111',
                            fontSize: 'clamp(0.4rem, 1.2vh, 0.65rem)',
                            overflowY: isExporting ? 'visible' : 'auto',
                            flex: isExporting ? 'none' : 1,
                            height: isExporting ? 'auto' : undefined,
                            minHeight: '60px',
                            border: '1px solid #ddd',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}>
                            {/* CURRENT SEASON PROJECTION SECTION */}
                            {player.projectedStats && (
                                <div style={{ marginBottom: '10px', background: '#ecfdf5', borderRadius: '6px', padding: '6px', border: '1px solid #10b981' }}>
                                    <div style={{ fontWeight: 900, color: '#047857', borderBottom: '1px solid #34d399', paddingBottom: '2px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{CURRENT_SEASON} SEASON OUTLOOK (PROJ)</span>
                                        <span>{player.projectedStats.fantasyPoints.toFixed(1)} PTS</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>GP</div>
                                            <div style={{ fontWeight: 800 }}>{player.projectedStats.gamesPlayed}</div>
                                        </div>
                                        {player.position === 'QB' ? (
                                            <>
                                                <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>YDS</div><div style={{ fontWeight: 800 }}>{player.projectedStats.passingYards}</div></div>
                                                <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>TD</div><div style={{ fontWeight: 800 }}>{player.projectedStats.passingTDs}</div></div>
                                                <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>INT</div><div style={{ fontWeight: 800 }}>{player.projectedStats.interceptions}</div></div>
                                            </>
                                        ) : player.position === 'RB' ? (
                                            <>
                                                <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>RUSH</div><div style={{ fontWeight: 800 }}>{player.projectedStats.rushingYards}</div></div>
                                                <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>REC</div><div style={{ fontWeight: 800 }}>{player.projectedStats.receivingYards}</div></div>
                                                <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>TD</div><div style={{ fontWeight: 800 }}>{(player.projectedStats.rushingTDs || 0) + (player.projectedStats.receivingTDs || 0)}</div></div>
                                            </>
                                        ) : (
                                            <>
                                                <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>REC</div><div style={{ fontWeight: 800 }}>{player.projectedStats.receivingYards}</div></div>
                                                <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>TD</div><div style={{ fontWeight: 800 }}>{player.projectedStats.receivingTDs}</div></div>
                                                <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>Y/G</div><div style={{ fontWeight: 800 }}>{((player.projectedStats.receivingYards || 0) / player.projectedStats.gamesPlayed).toFixed(0)}</div></div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div style={{ fontWeight: 900, marginBottom: '6px', borderBottom: '1px solid #ddd', paddingBottom: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>HISTORICAL CAREER PERF</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); downloadCareerStats(); }}
                                        disabled={isExporting}
                                        title="Download CSV"
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: isExporting ? 'wait' : 'pointer',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: theme.primary,
                                            opacity: isExporting ? 0.5 : 1
                                        }}
                                    >
                                        <Download size={14} />
                                    </button>
                                </div>
                                <span style={{ color: theme.primary }}>{player.position}</span>
                            </div>

                            {/* Best season = year with highest fantasyPoints */}
                            {(() => {
                                const bestYear = player.historicalStats?.reduce((best, s) =>
                                    (s.fantasyPoints ?? 0) > (best?.fantasyPoints ?? 0) ? s : best
                                , player.historicalStats?.[0]);
                                const bestSeason = bestYear;

                                return (!player.historicalStats || player.historicalStats.length === 0) ? (
                                <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontStyle: 'italic', fontSize: '0.65rem' }}>
                                    No official NFL career stats available.<br />(Rookie / No prior experience)
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                    <thead>
                                        <tr style={{ background: '#f3f4f6', fontWeight: 800 }}>
                                            <th style={{ padding: '2px' }}>YR</th>
                                            <th style={{ padding: '2px' }}>TM</th>
                                            <th style={{ padding: '2px' }}>GP</th>
                                            {(player.position === 'QB') && (
                                                <>
                                                    <th style={{ padding: '2px' }}>PASS YDS</th>
                                                    <th style={{ padding: '2px' }}>TD</th>
                                                </>
                                            )}
                                            {(player.position === 'WR' || player.position === 'TE') && (
                                                <>
                                                    <th style={{ padding: '2px' }}>REC YDS</th>
                                                    <th style={{ padding: '2px' }}>TD</th>
                                                </>
                                            )}
                                            {(player.position === 'RB') && (
                                                <>
                                                    <th style={{ padding: '2px' }}>RUSH YDS</th>
                                                    <th style={{ padding: '2px' }}>TD</th>
                                                </>
                                            )}
                                            <th style={{ padding: '2px' }}>PTS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {player.historicalStats?.map(s => {
                                            const isBest = bestSeason && s.year === bestSeason.year;
                                            return (
                                                <tr key={s.year} style={{ borderBottom: '1px solid #eee', background: isBest ? '#fefce8' : 'transparent' }}>
                                                    <td style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px', paddingTop: '3px' }}>
                                                        {isBest && <Star size={9} color="#ca8a04" fill="#ca8a04" />}
                                                        {s.year}
                                                    </td>
                                                    <td style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700 }}>{s.team}</td>
                                                    <td>{s.gamesPlayed}</td>
                                                    {player.position === 'QB' && (
                                                        <>
                                                            <td>{s.passingYards || 0}</td>
                                                            <td style={{ color: '#059669', fontWeight: 700 }}>{s.passingTDs || 0}</td>
                                                        </>
                                                    )}
                                                    {(player.position === 'WR' || player.position === 'TE') && (
                                                        <>
                                                            <td>{s.receivingYards || 0}</td>
                                                            <td style={{ color: '#059669', fontWeight: 700 }}>{s.receivingTDs || 0}</td>
                                                        </>
                                                    )}
                                                    {player.position === 'RB' && (
                                                        <>
                                                            <td>{s.rushingYards || 0}</td>
                                                            <td style={{ color: '#059669', fontWeight: 700 }}>{s.rushingTDs || 0}</td>
                                                        </>
                                                    )}
                                                    <td style={{ background: isBest ? '#fef08a' : '#fefce8', fontWeight: 800, color: isBest ? '#92400e' : undefined }}>
                                                        {s.year === CURRENT_SEASON
                                                            ? (ScoringEngine.calculatePoints(player).total ?? 0).toFixed(1)
                                                            : (((s.fantasyPoints || 0) % 1 === 0) ? (s.fantasyPoints || 0) : (s.fantasyPoints || 0).toFixed(1))
                                                        }
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* TOTALS ROW */}
                                        <tr style={{ background: '#000', color: '#fff', fontWeight: 900, borderTop: '2px solid #333' }}>
                                            <td style={{ padding: '4px' }}>CAREER</td>
                                            <td style={{ padding: '4px' }}>TOT</td>
                                            <td style={{ padding: '4px' }}>{player.historicalStats?.reduce((acc, s) => acc + s.gamesPlayed, 0)}</td>
                                            {player.position === 'QB' && (
                                                <>
                                                    <td style={{ padding: '4px' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.passingYards || 0), 0)}</td>
                                                    <td style={{ padding: '4px', color: '#34d399' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.passingTDs || 0), 0)}</td>
                                                </>
                                            )}
                                            {(player.position === 'WR' || player.position === 'TE') && (
                                                <>
                                                    <td style={{ padding: '4px' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.receivingYards || 0), 0)}</td>
                                                    <td style={{ padding: '4px', color: '#34d399' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.receivingTDs || 0), 0)}</td>
                                                </>
                                            )}
                                            {(player.position === 'RB') && (
                                                <>
                                                    <td style={{ padding: '4px' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.rushingYards || 0), 0)}</td>
                                                    <td style={{ padding: '4px', color: '#34d399' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.rushingTDs || 0), 0)}</td>
                                                </>
                                            )}
                                            <td style={{ padding: '4px', color: '#facc15' }}>
                                                {player.historicalStats?.reduce((acc, s) => {
                                                    const pts = s.year === CURRENT_SEASON
                                                        ? (ScoringEngine.calculatePoints(player).total ?? 0)
                                                        : (s.fantasyPoints || 0);
                                                    return acc + pts;
                                                }, 0).toFixed(1)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            );
                            })()}
                        </div>
                    </>
                ) : backPage === 'combine' ? (
                    <div style={{
                        background: '#fff',
                        padding: 'clamp(8px, 2vh, 12px)',
                        borderRadius: '12px',
                        color: '#111',
                        flex: isExporting ? 'none' : 1,
                        height: isExporting ? 'auto' : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: isExporting ? 'visible' : 'auto',
                        minHeight: 0,
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                        width: '100%',
                        boxSizing: 'border-box',
                        fontSize: 'clamp(0.4rem, 1.2vh, 0.75rem)'
                    }}>
                        <div style={{ fontWeight: 900, fontSize: '0.9rem', borderBottom: '2px solid #333', paddingBottom: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>NFL COMBINE METRICS</span>
                            <div style={{ fontSize: '0.6rem', background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>OFFICIAL</div>
                        </div>

                        {player.combineStats ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {/* Physicals Grid */}
                                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Physical Measurements</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>HEIGHT</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900 }}>{player.combineStats.measurements.height_in ? `${Math.floor(player.combineStats.measurements.height_in / 12)}' ${player.combineStats.measurements.height_in % 12}"` : 'N/A'}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>WEIGHT</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900 }}>{player.combineStats.measurements.weight_lb} <span style={{ fontSize: '0.6rem' }}>LBS</span></div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>ARM LENGTH</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900 }}>{player.combineStats.measurements.arm_length_in || 'N/A'}"</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>HAND SIZE</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 900 }}>{player.combineStats.measurements.hand_size_in || 'N/A'}"</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Athletic Testing Table */}
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Athletic Testing</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                        {[
                                            { label: '40-Yard Dash', value: player.combineStats.forty_yard, unit: 's' },
                                            { label: 'Vertical Jump', value: player.combineStats.vertical_in, unit: '"' },
                                            { label: 'Broad Jump', value: player.combineStats.broad_jump_in, unit: '"' },
                                            { label: 'Bench Press', value: player.combineStats.bench_press_reps, unit: ' reps' },
                                            { label: '3-Cone Drill', value: player.combineStats.three_cone, unit: 's' },
                                            { label: '20-Yd Shuttle', value: player.combineStats.shuttle, unit: 's' }
                                        ].map(stat => (
                                            <div key={stat.label} style={{ background: '#f1f5f9', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{stat.label}</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: stat.value ? theme.primary : '#cbd5e1' }}>
                                                    {stat.value ? `${stat.value}${stat.unit}` : '-'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {player.combineStats.source_url && (
                                    <div style={{ textAlign: 'center', marginTop: '5px' }}>
                                        <a href={player.combineStats.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.6rem', color: '#3b82f6', textDecoration: 'none' }}>
                                            View Verified Source &rarr;
                                        </a>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', textAlign: 'center', gap: '10px' }}>
                                <TrendingUp size={32} />
                                <div style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                                    No NFL Combine data available for this player.
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* FANTASY LEDGER VIEW */}
                        <div style={{
                            background: '#fff',
                            padding: 'clamp(8px, 2vh, 12px)',
                            borderRadius: '12px',
                            color: '#111',
                            flex: isExporting ? 'none' : 1,
                            height: isExporting ? 'auto' : undefined,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: isExporting ? 'visible' : 'hidden',
                            minHeight: 0,
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                            width: '100%',
                            boxSizing: 'border-box',
                            fontSize: 'clamp(0.4rem, 1.2vh, 0.75rem)'
                        }}>
                            <div style={{ fontWeight: 900, fontSize: '0.8rem', borderBottom: '2px solid #333', paddingBottom: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>LIFETIME FANTASY LEDGER</span>
                                <div style={{ color: theme.primary, fontSize: '0.6rem' }}>CHAMPION TRACKER</div>
                            </div>

                            {/* SCROLLABLE LEDGER CONTENT */}
                            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minHeight: 0 }}>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 900, color: '#666', marginBottom: '8px', textTransform: 'uppercase', marginTop: '5px' }}>
                                    <Wallet size={12} />
                                    Team Economy (Franchise Ledger)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '15px' }}>
                                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                                        <div style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 800 }}>TOTAL PRODUCTION</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>{(owningTeam?.total_production_pts || 0).toLocaleString()}</div>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                                        <div style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 800 }}>POINTS USED</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#eab308' }}>{((owningTeam?.points_spent || 0) + (owningTeam?.points_escrowed || 0)).toLocaleString()}</div>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #10b981' }}>
                                        <div style={{ fontSize: '0.5rem', color: '#10b981', fontWeight: 800 }}>LEAGUE BALANCE</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#10b981' }}>{((owningTeam?.total_production_pts || 0) - (owningTeam?.points_spent || 0)).toLocaleString()}</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 900, color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    <Shield size={12} />
                                    Historical Performance
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', fontSize: '0.6rem', color: '#666', fontWeight: 800, borderBottom: '1px solid #eee' }}>
                                            <th style={{ padding: '8px 4px' }}>SEASON</th>
                                            <th style={{ padding: '8px 4px' }}>TEAM / EVENT</th>
                                            <th style={{ padding: '8px 4px', textAlign: 'right' }}>PTS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Active Orchestrated Season */}
                                        <tr style={{ background: 'rgba(234, 179, 8, 0.05)', fontSize: '0.7rem' }}>
                                            <td style={{ padding: '10px 4px', fontWeight: 900 }}>{CURRENT_SEASON}</td>
                                            <td style={{ padding: '10px 4px' }}>
                                                {ScoringEngine.getOrchestrationStatus().season_state === 'COMPLETED_OFFICIAL' ? 'Official Season Record' : 'Current Active Season'}
                                            </td>
                                            <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 900, color: theme.primary }}>
                                                {(ScoringEngine.calculatePoints(player).total ?? 0).toFixed(1)}
                                            </td>
                                        </tr>

                                        {/* Historical Records (current season filtered out — shown in row above) */}
                                        {player.historicalStats?.filter(s => s.year !== CURRENT_SEASON).sort((a, b) => b.year - a.year).map(s => (
                                            <tr key={s.year} style={{ fontSize: '0.7rem', borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '10px 4px', fontWeight: 800 }}>{s.year}</td>
                                                <td style={{ padding: '10px 4px' }}>{s.team} Yearly Total</td>
                                                <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700 }}>{(s.fantasyPoints || 0).toFixed(1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* TRANSACTION HISTORY SECTION */}
                                <div style={{ marginBottom: '15px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 900, color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                                        <History size={12} />
                                        Recent Transactions
                                    </div>
                                    {teamTransactions.length > 0 ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.65rem' }}>
                                            <tbody>
                                                {teamTransactions.slice(0, 5).map(tx => (
                                                    <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '6px 0', fontWeight: 800, color: tx.type === 'ADD' ? '#059669' : tx.type === 'DROP' ? '#dc2626' : '#eab308' }}>
                                                            {tx.type}
                                                        </td>
                                                        <td style={{ padding: '6px 0', color: '#444' }}>{tx.description}</td>
                                                        <td style={{ padding: '6px 0', textAlign: 'right', color: '#94a3b8', fontSize: '0.55rem' }}>
                                                            {new Date(tx.timestamp).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>No local transaction history.</div>
                                    )}
                                </div>
                            </div>

                            <div style={{
                                marginTop: '10px',
                                paddingTop: '10px',
                                borderTop: '2px solid #eee',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline'
                            }}>
                                <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#666' }}>LIFETIME POINTS DOMINANCE</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: theme.primary }}>
                                    {((player.historicalStats?.filter(s => s.year !== CURRENT_SEASON).reduce((sum, s) => sum + (s.fantasyPoints || 0), 0) || 0) +
                                        (ScoringEngine.calculatePoints(player).total || 0)).toFixed(1)}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Player Bio Stats */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px', width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '0.65rem' }}>
                        <div><span style={{ color: '#eee', fontWeight: 600 }}>Height:</span> {formatHeight(player.height)}</div>
                        <div><span style={{ color: '#eee', fontWeight: 600 }}>Weight:</span> {player.weight || "220"}</div>
                        <div><span style={{ color: '#eee', fontWeight: 600 }}>Age:</span> {player.age || "27"}</div>
                        <div><span style={{ color: '#eee', fontWeight: 600 }}>College:</span> {player.college || "N/A"}</div>
                    </div>
                </div>

                {/* Scouting Report */}
                <div style={{ background: 'rgba(255,255,255,0.9)', padding: '8px 10px', borderRadius: '8px', color: '#111', borderLeft: `4px solid ${theme.secondary}`, width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.6rem', fontStyle: 'italic', lineHeight: '1.2' }}>
                        {player.lastName === 'Allen'
                            ? '"Safety Jordan Whitehead of the Bills might have a knack for it. Of Allen, he said: Throws a lot of touchdowns, a lot of passing yards. His superpower is the deep ball."'
                            : '"A dynamic threat through the air and on the ground. Defensive coordinators lose sleep trying to contain his versatility and speed. A perennial MVP contender."'}
                    </div>
                </div>
            </div>

            {/* Back Footer */}
            <div style={{ background: '#fff', padding: '6px', textAlign: 'center', flexShrink: 0, borderTop: '1px solid #eee' }}>
                <div style={{ fontSize: '0.5rem', color: '#777', fontWeight: 800, letterSpacing: '1px' }}>{CURRENT_SEASON} TRIER FANTASY FOOTBALL</div>
            </div>
        </div>
    );
};
