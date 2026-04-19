/**
 * Trier Fantasy Football
 * © 2026 Doug Trier
 *
 * Licensed under the MIT License.
 * See LICENSE file for details.
 *
 * "Trier OS" and "Trier Fantasy Football" are trademarks of Doug Trier.
 */

/**
 * DynastyPage — Keeper Selection & Draft Picks Hub
 * ==================================================
 * Central view for dynasty-mode leagues. Two tabs:
 *
 *   KEEPERS  — Each manager designates up to N players to retain into next
 *              season. Shows contract year if enabled. Managers can only
 *              toggle their own team's keepers; admins can see all teams.
 *
 *   DRAFT PICKS — Each team's pick inventory. Future-year picks received via
 *              trade are shown here. Admins can see the full pick board.
 *
 * Read-only for non-admins viewing other teams.
 */
import React, { useState } from 'react';
import { Star, Package, ChevronDown, ChevronUp, Shield, Info } from 'lucide-react';
import type { FantasyTeam, League, DynastySettings } from '../types';
import { DynastyService } from '../services/DynastyService';

interface Props {
    myTeam: FantasyTeam | null;
    allTeams: FantasyTeam[];
    league: League;
    isAdmin: boolean;
    onDesignateKeeper: (teamId: string, playerId: string, keep: boolean) => void;
}

const panelStyle: React.CSSProperties = {
    background: 'rgba(10,14,26,0.82)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '1.25rem',
};

const headerStyle: React.CSSProperties = {
    padding: '0.85rem 1.5rem',
    background: 'rgba(0,0,0,0.3)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '0.78rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#9ca3af',
};

export const DynastyPage: React.FC<Props> = ({
    myTeam,
    allTeams,
    league,
    isAdmin,
    onDesignateKeeper,
}) => {
    const [activeTab, setActiveTab] = useState<'keepers' | 'picks'>('keepers');
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set(myTeam ? [myTeam.id] : []));

    const ds: DynastySettings = league.settings?.dynastySettings ?? {
        enabled: true,
        maxKeepers: 3,
        contractYearsEnabled: false,
    };

    const toggleTeam = (id: string) => {
        setExpandedTeams(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Contract year badge colour
    const contractColor = (year?: number) => {
        if (!year) return '#6b7280';
        if (year === 1) return '#4ade80';
        if (year === 2) return '#facc15';
        return '#f87171';
    };

    const tabBtn = (active: boolean): React.CSSProperties => ({
        flex: 1, padding: '7px 14px', borderRadius: '7px', border: 'none',
        fontWeight: 800, fontSize: '0.78rem', letterSpacing: '1px', cursor: 'pointer',
        textTransform: 'uppercase', transition: 'all 0.15s',
        background: active ? 'rgba(234,179,8,0.2)' : 'transparent',
        color: active ? '#eab308' : '#6b7280',
    });

    // Which teams to show: admin sees all, others only see their own
    const visibleTeams = isAdmin ? allTeams : (myTeam ? [myTeam] : []);

    return (
        <div style={{ height: '100%', overflowY: 'auto', padding: '1.5rem 2rem', boxSizing: 'border-box' }}>

            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#eab308', fontFamily: "'Graduate', sans-serif", letterSpacing: '0.05em' }}>
                    DYNASTY MODE
                </h2>
                <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#6b7280' }}>
                    {ds.maxKeepers} keeper{ds.maxKeepers !== 1 ? 's' : ''} per team
                    {ds.contractYearsEnabled && ' · 3-year contract limit'}
                </div>
            </div>

            {/* Tab bar */}
            <div style={{ background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '5px', display: 'flex', gap: '4px', marginBottom: '1.25rem' }}>
                <button style={tabBtn(activeTab === 'keepers')} onClick={() => setActiveTab('keepers')}>
                    <Star size={12} style={{ display: 'inline', marginRight: 5 }} />Keepers
                </button>
                <button style={tabBtn(activeTab === 'picks')} onClick={() => setActiveTab('picks')}>
                    <Package size={12} style={{ display: 'inline', marginRight: 5 }} />Draft Picks
                </button>
            </div>

            {/* ── KEEPERS TAB ──────────────────────────────────────────────────────── */}
            {activeTab === 'keepers' && (
                <>
                    {/* Info banner */}
                    <div style={{ ...panelStyle, marginBottom: '1rem' }}>
                        <div style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.82rem', color: '#9ca3af', lineHeight: 1.5 }}>
                            <Info size={14} style={{ flexShrink: 0, marginTop: 2, color: '#60a5fa' }} />
                            <span>
                                Select up to <strong style={{ color: '#eab308' }}>{ds.maxKeepers}</strong> players to carry into next season.
                                When the commissioner archives this season, kept players will remain on your bench.
                                {ds.contractYearsEnabled && ' Players at Year 3 are ineligible.'}
                            </span>
                        </div>
                    </div>

                    {visibleTeams.map(team => {
                        const keptIds = new Set(team.keptPlayerIds ?? []);
                        const eligible = DynastyService.getEligibleKeepers(team, ds);
                        const allPlayers = [
                            ...Object.values(team.roster).filter(Boolean),
                            ...team.bench,
                        ] as typeof eligible;
                        const isMyTeam = team.id === myTeam?.id;
                        const canEdit = isMyTeam || isAdmin;
                        const isExpanded = expandedTeams.has(team.id);

                        return (
                            <div key={team.id} style={panelStyle}>
                                {/* Team header */}
                                <button
                                    onClick={() => toggleTeam(team.id)}
                                    style={{ width: '100%', ...headerStyle, cursor: 'pointer', background: 'rgba(0,0,0,0.3)', border: 'none', justifyContent: 'space-between' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <Shield size={14} color={isMyTeam ? '#eab308' : '#6b7280'} />
                                        <span style={{ color: isMyTeam ? '#eab308' : '#d1d5db' }}>{team.name}</span>
                                        <span style={{ color: '#6b7280', fontWeight: 400 }}>— {team.ownerName}</span>
                                        {/* Keeper count badge */}
                                        <span style={{
                                            background: keptIds.size > 0 ? 'rgba(234,179,8,0.2)' : 'rgba(107,114,128,0.2)',
                                            color: keptIds.size > 0 ? '#eab308' : '#6b7280',
                                            borderRadius: '12px', padding: '1px 8px', fontSize: '0.7rem',
                                        }}>
                                            {keptIds.size}/{ds.maxKeepers} kept
                                        </span>
                                    </div>
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>

                                {isExpanded && (
                                    <div style={{ padding: '0.75rem 1.25rem' }}>
                                        {allPlayers.length === 0 ? (
                                            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>No players on roster.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {allPlayers.map(player => {
                                                    const isKept = keptIds.has(player.id);
                                                    const isEligible = eligible.some(e => e.id === player.id);
                                                    const atCap = keptIds.size >= ds.maxKeepers && !isKept;
                                                    const disabled = !canEdit || !isEligible || atCap;

                                                    return (
                                                        <div key={player.id} style={{
                                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                            padding: '0.45rem 0.75rem', borderRadius: '7px',
                                                            background: isKept ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.02)',
                                                            border: isKept ? '1px solid rgba(234,179,8,0.3)' : '1px solid transparent',
                                                            opacity: disabled && !isKept ? 0.45 : 1,
                                                        }}>
                                                            {/* Position badge */}
                                                            <span style={{ fontSize: '0.68rem', fontWeight: 800, width: '2.2rem', textAlign: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '2px 4px', color: '#9ca3af', flexShrink: 0 }}>
                                                                {player.position}
                                                            </span>
                                                            {/* Name + team */}
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <span style={{ fontSize: '0.88rem', color: '#f3f4f6', fontWeight: 600 }}>
                                                                    {player.firstName} {player.lastName}
                                                                </span>
                                                                <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: '#6b7280' }}>{player.team}</span>
                                                            </div>
                                                            {/* Contract year */}
                                                            {ds.contractYearsEnabled && (
                                                                <span style={{ fontSize: '0.72rem', color: contractColor(player.contractYear), fontWeight: 700, flexShrink: 0 }}>
                                                                    {player.contractYear ? `Yr ${player.contractYear}` : 'Yr 1'}
                                                                    {!isEligible && ' (MAX)'}
                                                                </span>
                                                            )}
                                                            {/* Keep toggle */}
                                                            <button
                                                                onClick={() => !disabled && onDesignateKeeper(team.id, player.id, !isKept)}
                                                                disabled={disabled}
                                                                title={disabled ? (atCap ? 'Keeper limit reached' : 'Contract expired') : (isKept ? 'Remove keeper' : 'Designate keeper')}
                                                                style={{
                                                                    background: isKept ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.06)',
                                                                    border: `1px solid ${isKept ? '#eab308' : 'rgba(255,255,255,0.12)'}`,
                                                                    color: isKept ? '#eab308' : '#6b7280',
                                                                    borderRadius: '6px', padding: '0.3rem 0.65rem',
                                                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                                                    fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
                                                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                                    transition: 'all 0.15s',
                                                                }}
                                                            >
                                                                <Star size={11} fill={isKept ? '#eab308' : 'none'} />
                                                                {isKept ? 'Keeping' : 'Keep'}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}

            {/* ── DRAFT PICKS TAB ──────────────────────────────────────────────────── */}
            {activeTab === 'picks' && (
                <div style={panelStyle}>
                    <div style={headerStyle}>
                        <Package size={14} color="#60a5fa" />
                        <span>Draft Pick Inventory</span>
                        <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.72rem', color: '#6b7280' }}>
                            — picks acquired via trade or owned from this team
                        </span>
                    </div>

                    <div style={{ padding: '1rem 1.25rem' }}>
                        {visibleTeams.map(team => {
                            const picks = (team.draftPicks ?? []).sort((a, b) => a.year - b.year || a.round - b.round);
                            const myPicks   = picks.filter(p => p.currentTeamId === team.id);
                            const isMyTeam  = team.id === myTeam?.id;

                            if (myPicks.length === 0) return null;

                            return (
                                <div key={team.id} style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: isMyTeam ? '#eab308' : '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                        {team.name}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {myPicks.map(pick => (
                                            <div key={pick.id} style={{
                                                padding: '0.3rem 0.75rem',
                                                background: pick.originalTeamId !== team.id ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.05)',
                                                border: `1px solid ${pick.originalTeamId !== team.id ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                                borderRadius: '6px', fontSize: '0.78rem',
                                                color: pick.originalTeamId !== team.id ? '#93c5fd' : '#d1d5db',
                                            }}>
                                                <strong>{pick.year}</strong> R{pick.round}
                                                {pick.originalTeamId !== team.id && (
                                                    <span style={{ fontSize: '0.65rem', marginLeft: '0.3rem', opacity: 0.7 }}>
                                                        (via {allTeams.find(t => t.id === pick.originalTeamId)?.name || 'trade'})
                                                    </span>
                                                )}
                                                {pick.note && <span style={{ fontSize: '0.65rem', marginLeft: '0.3rem', opacity: 0.6 }}>{pick.note}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {visibleTeams.every(t => !(t.draftPicks ?? []).length) && (
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>
                                No draft picks yet. Picks are generated when the commissioner starts a new dynasty season.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
