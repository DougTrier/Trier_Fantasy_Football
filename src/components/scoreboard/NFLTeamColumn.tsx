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
                gap: '6px',
                padding: '5px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '2px',
                flexDirection: align === 'right' ? 'row-reverse' : 'row',
                // Highlight selected team with a subtle team-colored border
                background: isSelected
                    ? `rgba(${hexToRgb(theme.primary)}, 0.15)`
                    : isLive ? 'rgba(239,68,68,0.08)' : 'transparent',
                border: isSelected
                    ? `1px solid ${theme.primary}60`
                    : '1px solid transparent',
                transition: 'background 0.15s',
            }}
            onMouseEnter={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background =
                    isLive ? 'rgba(239,68,68,0.08)' : 'transparent';
            }}
        >
            {/* Team color dot */}
            <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: theme.primary, flexShrink: 0,
                // Pulse animation when game is live
                animation: isLive ? 'pulse 1.5s infinite' : 'none',
                boxShadow: isLive ? `0 0 6px ${theme.primary}` : 'none',
            }} />

            {/* Abbreviation */}
            <span style={{
                fontSize: '0.7rem', fontWeight: 800,
                color: isSelected ? '#fff' : '#d1d5db',
                letterSpacing: '0.5px', minWidth: '28px',
                textAlign: align === 'right' ? 'right' : 'left',
            }}>
                {abbr}
            </span>

            {/* Record or live score */}
            <span style={{
                fontSize: '0.62rem', color: isLive ? '#ef4444' : '#6b7280',
                fontWeight: isLive ? 700 : 400, flexShrink: 0,
                marginLeft: align === 'left' ? 'auto' : undefined,
                marginRight: align === 'right' ? 'auto' : undefined,
            }}>
                {isLive && scoreLabel ? scoreLabel : recLabel}
            </span>

            {/* Live status badge */}
            {isLive && liveGame && (
                <span style={{
                    fontSize: '0.55rem', color: '#ef4444', fontWeight: 700,
                    background: 'rgba(239,68,68,0.15)', padding: '1px 4px',
                    borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                    {liveGame.statusDetail}
                </span>
            )}
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
        <div style={{
            width: '100%',
            maxWidth: '170px',
            // Align the column to the edge nearest the main content
            marginLeft: align === 'right' ? 'auto' : undefined,
            marginRight: align === 'left'  ? 'auto' : undefined,
            overflowY: 'auto',
            overflowX: 'hidden',
            maxHeight: 'calc(100vh - 120px)',
            paddingBottom: '20px',
        }}>
            {/* Conference header */}
            <div style={{
                fontSize: '0.65rem', fontWeight: 900, letterSpacing: '2px',
                color: conference === 'AFC' ? '#3b82f6' : '#10b981',
                textTransform: 'uppercase', marginBottom: '10px',
                textAlign: align === 'right' ? 'right' : 'left',
                paddingLeft: align === 'left' ? '8px' : undefined,
                paddingRight: align === 'right' ? '8px' : undefined,
            }}>
                {conference}
            </div>

            {/* Division groups */}
            {Object.entries(divisions).map(([divName, teams]) => (
                <div key={divName} style={{ marginBottom: '12px' }}>
                    {/* Division label */}
                    <div style={{
                        fontSize: '0.55rem', color: '#4b5563', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '1px',
                        marginBottom: '4px',
                        textAlign: align === 'right' ? 'right' : 'left',
                        paddingLeft: align === 'left' ? '8px' : undefined,
                        paddingRight: align === 'right' ? '8px' : undefined,
                    }}>
                        {divName.replace('AFC ', '').replace('NFC ', '')} {/* "East", "North" etc. */}
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
    );
};
