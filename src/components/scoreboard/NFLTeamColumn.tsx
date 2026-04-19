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
    align: 'left' | 'right';              // column position — affects text alignment
}

// Row for a single team
const TeamRow: React.FC<{
    abbr: string;
    record: TeamRecord;
    liveGame: LiveGame | null;
    isSelected: boolean;
    align: 'left' | 'right';
    onClick: () => void;
}> = ({ abbr, record, liveGame, isSelected, align, onClick }) => {
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
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                marginBottom: '3px',
                flexDirection: 'row', // logo always left so division label center matches visual center
                background: isSelected
                    ? `rgba(${hexToRgb(theme.primary)}, 0.18)`
                    : isLive ? 'rgba(239,68,68,0.08)' : 'transparent',
                border: isSelected
                    ? `1px solid ${theme.primary}60`
                    : '1px solid transparent',
                transition: 'background 0.15s',
            }}
            onMouseEnter={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background =
                    isLive ? 'rgba(239,68,68,0.08)' : 'transparent';
            }}
        >
            {/* Team logo — ESPN CDN, same source as player cards */}
            <img
                src={theme.logoUrl}
                alt={abbr}
                style={{
                    width: 36, height: 36,
                    objectFit: 'contain',
                    flexShrink: 0,
                    filter: isLive ? `drop-shadow(0 0 5px ${theme.primary})` : 'none',
                    animation: isLive ? 'pulse 1.5s infinite' : 'none',
                    opacity: isSelected ? 1 : 0.9,
                }}
            />

            {/* Name + record stacked vertically — record sits tight under the abbr */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: '0.85rem', fontWeight: 800,
                    color: isSelected ? '#fff' : '#e5e7eb',
                    letterSpacing: '0.5px', lineHeight: 1,
                    textAlign: align === 'right' ? 'right' : 'left',
                }}>
                    {abbr}
                </div>
                <div style={{
                    fontSize: '0.68rem',
                    color: isLive ? '#ef4444' : '#6b7280',
                    fontWeight: isLive ? 700 : 500,
                    lineHeight: 1, marginTop: '2px',
                    textAlign: align === 'right' ? 'right' : 'left',
                }}>
                    {isLive && scoreLabel ? scoreLabel : recLabel}
                    {/* Quarter status on a second micro-line when live */}
                    {isLive && liveGame && (
                        <span style={{ display: 'block', fontSize: '0.58rem', color: '#ef4444', marginTop: '1px' }}>
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
    conference, divisions, selectedTeam, onTeamClick, align,
}) => {
    return (
        // height: 100% fills the stretched grid cell; flex column lets logo stay fixed
        // while the divisions area grows to fill remaining space
        <div style={{
            width: '100%',
            maxWidth: '200px',
            marginLeft: align === 'right' ? 'auto' : undefined,
            marginRight: align === 'left'  ? 'auto' : undefined,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
        }}>
            {/* Conference logo — centered over the column, slightly larger than v1 */}
            <div style={{
                marginBottom: '10px',
                textAlign: 'center',
                padding: '0 8px',
            }}>
                <img
                    src={conference === 'AFC' ? afcLogo : nfcLogo}
                    alt={conference}
                    style={{ height: '50px', width: 'auto', objectFit: 'contain', opacity: 0.9 }}
                />
            </div>

            {/* Divisions fill remaining height; space-evenly distributes groups top-to-bottom */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-evenly',
                overflow: 'hidden',
            }}>
                {Object.entries(divisions).map(([divName, teams]) => (
                    <div key={divName}>
                        {/* Division header: full-width flex row so label centers over the teams */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            width: '100%',
                            marginBottom: '5px',
                        }}>
                            <span style={{
                                fontSize: '0.9rem',
                                fontWeight: 900,
                                // AFC = neon red, NFC = neon blue
                                color: conference === 'AFC' ? '#ff3333' : '#00d4ff',
                                letterSpacing: '1.5px',
                                textTransform: 'uppercase',
                                textDecoration: 'underline',
                                textDecorationColor: conference === 'AFC' ? 'rgba(255,51,51,0.45)' : 'rgba(0,212,255,0.45)',
                                textUnderlineOffset: '3px',
                                whiteSpace: 'nowrap',
                                textShadow: conference === 'AFC' ? '0 0 8px rgba(255,51,51,0.6)' : '0 0 8px rgba(0,212,255,0.55)',
                                // dark pill ensures readability over the chalk background
                                background: 'rgba(0,0,0,0.65)',
                                padding: '2px 10px',
                                borderRadius: '4px',
                            }}>
                                {divName}
                            </span>
                        </div>

                        {/* Team rows */}
                        {teams.map(abbr => (
                            <TeamRow
                                key={abbr}
                                abbr={abbr}
                                record={ScoreboardService.getRecord(abbr)}
                                liveGame={ScoreboardService.getLiveGame(abbr)}
                                isSelected={selectedTeam === abbr}
                                align={align}
                                onClick={() => onTeamClick(abbr)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};
