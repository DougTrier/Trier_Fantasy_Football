/**
 * NFLTeamColumn — AFC or NFC vertical intelligence panel
 * =======================================================
 * Renders a scrollable column of all teams in one conference, grouped by
 * division. Each row shows the team abbreviation, W-L record, and a live
 * score badge when the team is currently playing. Clicking a row triggers
 * the onTeamClick callback so the parent can show the TeamSnapshotPanel.
 *
 * Gameday: rows with an active game pulse red and show the live score.
 * Off-season / no games: rows show only records — still fully interactive.
 * Both AFC and NFC render identically: logo-left rows centered under each
 * division header.
 */
import React from 'react';
import { type LiveGame, type TeamRecord, ScoreboardService } from '../../services/ScoreboardService';
import { getTeamTheme } from '../../utils/teamThemes';
import afcLogo from '../../assets/afc_logo.png';
import nfcLogo from '../../assets/nfc_logo.png';

interface NFLTeamColumnProps {
    conference: 'AFC' | 'NFC';
    divisions: Record<string, string[]>;   // division name → team abbreviations
    selectedTeam: string | null;           // currently selected team abbr
    onTeamClick: (abbr: string) => void;
    align: 'left' | 'right';              // column position — used for snapshot overlay placement
}

// Row for a single team — always logo-left, text-left, natural width
const TeamRow: React.FC<{
    abbr: string;
    record: TeamRecord;
    liveGame: LiveGame | null;
    isSelected: boolean;
    onClick: () => void;
}> = ({ abbr, record, liveGame, isSelected, onClick }) => {
    const theme = getTeamTheme(abbr);
    const isLive = liveGame?.status === 'in';
    const recLabel = record.ties > 0
        ? `${record.wins}-${record.losses}-${record.ties}`
        : `${record.wins}-${record.losses}`;

    // Build score string if game is active or final
    let scoreLabel = '';
    if (liveGame && liveGame.status !== 'pre') {
        const myScore  = liveGame.homeTeam === abbr ? liveGame.homeScore : liveGame.awayScore;
        const oppScore = liveGame.homeTeam === abbr ? liveGame.awayScore : liveGame.homeScore;
        scoreLabel = `${myScore}-${oppScore}`;
    }

    return (
        <div
            onClick={onClick}
            title={ScoreboardService.getFullName(abbr)}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '1px',
                background: isSelected
                    ? `rgba(${hexToRgb(theme.primary)}, 0.25)`
                    : isLive ? 'rgba(239,68,68,0.20)' : 'rgba(0,0,0,0.72)',
                backdropFilter: 'blur(6px)',
                border: isSelected
                    ? `1px solid ${theme.primary}60`
                    : '1px solid transparent',
                transition: 'background 0.15s',
            }}
            onMouseEnter={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.85)';
            }}
            onMouseLeave={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background =
                    isLive ? 'rgba(239,68,68,0.20)' : 'rgba(0,0,0,0.72)';
            }}
        >
            {/* Team logo — ESPN CDN, same source as player cards */}
            <img
                src={theme.logoUrl}
                alt={abbr}
                style={{
                    width: 22, height: 22,
                    objectFit: 'contain',
                    flexShrink: 0,
                    filter: isLive ? `drop-shadow(0 0 5px ${theme.primary})` : 'none',
                    animation: isLive ? 'pulse 1.5s infinite' : 'none',
                    opacity: isSelected ? 1 : 0.9,
                }}
            />

            {/* Name + record stacked vertically */}
            <div style={{ minWidth: '28px' }}>
                <div style={{
                    fontSize: '0.50rem', fontWeight: 800,
                    color: isSelected ? '#fff' : '#e5e7eb',
                    letterSpacing: '0.5px', lineHeight: 1,
                    textAlign: 'left',
                }}>
                    {abbr}
                </div>
                <div style={{
                    fontSize: '0.41rem',
                    color: isLive ? '#ef4444' : '#6b7280',
                    fontWeight: isLive ? 700 : 500,
                    lineHeight: 1, marginTop: '2px',
                    textAlign: 'left',
                }}>
                    {isLive && scoreLabel ? scoreLabel : recLabel}
                    {/* Quarter status on a second micro-line when live */}
                    {isLive && liveGame && (
                        <span style={{ display: 'block', fontSize: '0.38rem', color: '#ef4444', marginTop: '1px' }}>
                            {liveGame.statusDetail}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// Convert #rrggbb to "r,g,b" for rgba() usage
function hexToRgb(hex: string): string {
    const h = hex.replace('#', '');
    if (h.length !== 6) return '255,255,255';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `${r},${g},${b}`;
}

// ─── Main Column Component ────────────────────────────────────────────────────

export const NFLTeamColumn: React.FC<NFLTeamColumnProps> = ({
    conference, divisions, selectedTeam, onTeamClick,
}) => {
    return (
        <div style={{
            width: '100%',
            maxWidth: '200px',
            height: 'auto',
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
            overflowY: 'visible',
            zoom: 1.1,
        }}>
            {/* Conference logo centered at top */}
            <div style={{
                marginBottom: '8px',
                textAlign: 'center',
                padding: '0 8px',
            }}>
                <img
                    src={conference === 'AFC' ? afcLogo : nfcLogo}
                    alt={conference}
                    style={{ height: '29px', width: 'auto', objectFit: 'contain', opacity: 0.9 }}
                />
            </div>

            {/* Divisions stacked with consistent spacing */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
            }}>
                {Object.entries(divisions).map(([divName, teams]) => (
                    <div key={divName}>
                        {/* Division header centered */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            width: '100%',
                            marginBottom: '4px',
                        }}>
                            <span style={{
                                fontSize: '0.52rem',
                                fontWeight: 900,
                                color: conference === 'AFC' ? '#ff3333' : '#00d4ff',
                                letterSpacing: '1.5px',
                                textTransform: 'uppercase',
                                textDecoration: 'underline',
                                textDecorationColor: conference === 'AFC' ? 'rgba(255,51,51,0.45)' : 'rgba(0,212,255,0.45)',
                                textUnderlineOffset: '3px',
                                whiteSpace: 'nowrap',
                                textShadow: conference === 'AFC' ? '0 0 8px rgba(255,51,51,0.6)' : '0 0 8px rgba(0,212,255,0.55)',
                                background: 'rgba(0,0,0,0.65)',
                                padding: '2px 10px',
                                borderRadius: '4px',
                            }}>
                                {divName}
                            </span>
                        </div>

                        {/* Team rows centered as a block under the division header */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {teams.map(abbr => (
                                <TeamRow
                                    key={abbr}
                                    abbr={abbr}
                                    record={ScoreboardService.getRecord(abbr)}
                                    liveGame={ScoreboardService.getLiveGame(abbr)}
                                    isSelected={selectedTeam === abbr}
                                    onClick={() => onTeamClick(abbr)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
