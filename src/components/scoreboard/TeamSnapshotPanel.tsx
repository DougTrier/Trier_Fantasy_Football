/**
 * TeamSnapshotPanel — per-team detail card
 * =========================================
 * Shows when a team row is clicked in NFLTeamColumn. Displays the team's
 * current record, last game result, and next scheduled game. Falls back
 * gracefully when ESPN schedule data hasn't loaded yet.
 *
 * A "View on NFL.com" button opens the team page in the default browser
 * via Tauri shell.open (already permitted in tauri.conf.json allowlist).
 */
import React from 'react';
import { X, ExternalLink, Loader } from 'lucide-react';
import { type TeamSnapshot } from '../../services/ScoreboardService';
import { getTeamTheme } from '../../utils/teamThemes';

// Ensures a hex color is bright enough to read on a dark background.
// If luminance is too low (dark team colors like Cowboys navy, Raiders black),
// blend toward white so text stays legible without losing team identity.
function readableOnDark(hex: string): string {
    const h = hex.replace('#', '');
    if (h.length !== 6) return '#ffffff';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum > 0.28) return hex;
    const mix = (c: number) => Math.round(c + (255 - c) * 0.55);
    return `#${mix(r).toString(16).padStart(2,'0')}${mix(g).toString(16).padStart(2,'0')}${mix(b).toString(16).padStart(2,'0')}`;
}

// ESPN team page slug — maps abbr to the URL path segment
const ESPN_SLUGS: Record<string, string> = {
    ARI:'arizona-cardinals', ATL:'atlanta-falcons',    BAL:'baltimore-ravens',
    BUF:'buffalo-bills',     CAR:'carolina-panthers',  CHI:'chicago-bears',
    CIN:'cincinnati-bengals',CLE:'cleveland-browns',   DAL:'dallas-cowboys',
    DEN:'denver-broncos',    DET:'detroit-lions',       GB:'green-bay-packers',
    HOU:'houston-texans',    IND:'indianapolis-colts', JAX:'jacksonville-jaguars',
    KC:'kansas-city-chiefs', LAC:'los-angeles-chargers',LAR:'los-angeles-rams',
    LV:'las-vegas-raiders',  MIA:'miami-dolphins',     MIN:'minnesota-vikings',
    NE:'new-england-patriots',NO:'new-orleans-saints', NYG:'new-york-giants',
    NYJ:'new-york-jets',     PHI:'philadelphia-eagles',PIT:'pittsburgh-steelers',
    SF:'san-francisco-49ers',SEA:'seattle-seahawks',   TB:'tampa-bay-buccaneers',
    TEN:'tennessee-titans',  WAS:'washington-commanders',
};

interface TeamSnapshotPanelProps {
    snapshot: TeamSnapshot | null; // null = loading
    align: 'left' | 'right';
    onClose: () => void;
}

export const TeamSnapshotPanel: React.FC<TeamSnapshotPanelProps> = ({ snapshot, align, onClose }) => {
    const theme = getTeamTheme(snapshot?.abbr ?? '');

    const openNFL = () => {
        const slug = snapshot ? (ESPN_SLUGS[snapshot.abbr] ?? '') : '';
        const url = `https://www.nfl.com/teams/${slug}`;
        // shell.open is permitted in tauri.conf.json — falls back to window.open in browser mode
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tauri = (window as any).__TAURI__;
        if (tauri?.shell?.open) {
            tauri.shell.open(url);
        } else {
            window.open(url, '_blank', 'noopener');
        }
    };

    return (
        <div style={{
            marginTop: '8px',
            background: `linear-gradient(135deg, rgba(17,24,39,0.95) 0%, rgba(31,41,55,0.95) 100%)`,
            border: `1px solid ${theme.primary}50`,
            borderRadius: '10px',
            padding: '12px',
            maxWidth: '170px',
            boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px ${theme.primary}20`,
            position: 'relative',
            // Slide in from the column's edge
            animation: 'slideIn 0.15s ease-out',
        }}>
            {/* Close button */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute', top: '6px',
                    right: align === 'right' ? undefined : '6px',
                    left: align === 'right' ? '6px' : undefined,
                    background: 'none', border: 'none',
                    color: '#6b7280', cursor: 'pointer', padding: '2px',
                }}
            >
                <X size={12} />
            </button>

            {/* Loading state */}
            {!snapshot && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                    <Loader size={16} color="#6b7280" className="spin" />
                </div>
            )}

            {snapshot && (
                <>
                    {/* Team logo + name + record */}
                    <div style={{ marginBottom: '10px', paddingRight: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                            src={theme.logoUrl}
                            alt={snapshot.abbr}
                            style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
                        />
                        <div>
                            <div style={{
                                fontSize: '0.72rem', fontWeight: 900, color: '#fff',
                                letterSpacing: '0.5px', lineHeight: 1.2,
                            }}>
                                {snapshot.fullName}
                            </div>
                            <div style={{
                                fontSize: '1rem', fontWeight: 900,
                                color: readableOnDark(theme.primary), marginTop: '2px',
                            }}>
                                {snapshot.record}
                            </div>
                        </div>
                    </div>

                    {/* Last game */}
                    <div style={{ marginBottom: '8px' }}>
                        <div style={{
                            fontSize: '0.55rem', color: '#4b5563', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px',
                        }}>
                            Last Game
                        </div>
                        {snapshot.lastGame ? (
                            <div style={{ fontSize: '0.7rem', color: '#d1d5db' }}>
                                {/* Result badge */}
                                <span style={{
                                    fontWeight: 900,
                                    color: snapshot.lastGame.result === 'W' ? '#10b981'
                                        : snapshot.lastGame.result === 'L' ? '#ef4444' : '#f59e0b',
                                    marginRight: '4px',
                                }}>
                                    {snapshot.lastGame.result}
                                </span>
                                {snapshot.lastGame.teamScore}–{snapshot.lastGame.oppScore}
                                <span style={{ color: '#6b7280', marginLeft: '4px' }}>
                                    vs {snapshot.lastGame.opponentAbbr} · {snapshot.lastGame.dateLabel}
                                </span>
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.65rem', color: '#4b5563' }}>No data</div>
                        )}
                    </div>

                    {/* Next game */}
                    <div style={{ marginBottom: '10px' }}>
                        <div style={{
                            fontSize: '0.55rem', color: '#4b5563', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px',
                        }}>
                            Next Game
                        </div>
                        {snapshot.nextGame ? (
                            <div style={{ fontSize: '0.68rem', color: '#d1d5db', lineHeight: 1.4 }}>
                                <span style={{ color: '#9ca3af' }}>
                                    {snapshot.nextGame.isHome ? 'vs' : '@'}
                                </span>
                                {' '}{snapshot.nextGame.opponentAbbr}
                                <br />
                                <span style={{ color: '#6b7280', fontSize: '0.62rem' }}>
                                    {snapshot.nextGame.dateLabel}
                                </span>
                                <br />
                                <span style={{ color: '#6b7280', fontSize: '0.62rem' }}>
                                    {snapshot.nextGame.timeLabel}
                                </span>
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.65rem', color: '#4b5563' }}>Season complete</div>
                        )}
                    </div>

                    {/* NFL.com link */}
                    <button
                        onClick={openNFL}
                        style={{
                            width: '100%', padding: '5px 8px',
                            background: `${theme.primary}20`,
                            border: `1px solid ${theme.primary}40`,
                            borderRadius: '6px', color: readableOnDark(theme.primary),
                            fontSize: '0.62rem', fontWeight: 700,
                            cursor: 'pointer', letterSpacing: '0.5px',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: '4px',
                        }}
                    >
                        <ExternalLink size={10} />
                        VIEW ON NFL.COM
                    </button>
                </>
            )}
        </div>
    );
};
