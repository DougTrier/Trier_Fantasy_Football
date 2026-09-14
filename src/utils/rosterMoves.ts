import type { FantasyTeam, Player } from '../types';
import type { EventLogEntry } from '../types/P2P';
import { isPlayerLocked } from './gamedayLogic';

export interface RosterMovePayload {
  teamId: string;
  candidatePlayerId: string;
  targetPlayerId: string | null;
  targetSlot: string;
  sourceSlot: string | null; // null = was on bench
}

/** Full-state sync must not provide a second route around roster move checks. */
export function preservesLockedPlayers(current: FantasyTeam[], incoming: FantasyTeam[], lockedTeams: string[]): boolean {
  if (!Array.isArray(incoming) || incoming.some(team => !team?.roster || !Array.isArray(team.bench))) return false;
  const ids = new Set<string>();
  for (const team of incoming) {
    for (const player of [...Object.values(team.roster), ...team.bench]) {
      if (player === null) continue;
      if (!player || typeof player.id !== 'string' || typeof player.team !== 'string' || ids.has(player.id)) return false;
      ids.add(player.id);
    }
  }
  const positions = (teams: FantasyTeam[]) => new Map(teams.flatMap(team => [
    ...Object.entries(team.roster).filter(([, player]) => !!player).map(([slot, player]) =>
      [player!.id, { player: player!, location: `${team.id}:${slot}` }] as const),
    ...team.bench.map(player => [player.id, { player, location: `${team.id}:bench` }] as const),
  ]));
  const before = positions(current);
  const after = positions(incoming);
  for (const [id, entry] of before) {
    if (isPlayerLocked(entry.player, lockedTeams) &&
        (after.get(id)?.location !== entry.location || after.get(id)?.player.team !== entry.player.team)) return false;
  }
  // New teams may arrive on initial sync. Existing teams cannot add locked players.
  const knownTeams = new Set(current.map(team => team.id));
  for (const team of incoming) {
    if (!knownTeams.has(team.id)) continue;
    for (const player of [...Object.values(team.roster), ...team.bench]) {
      if (player && isPlayerLocked(player, lockedTeams) && before.get(player.id)?.location !== after.get(player.id)?.location) return false;
    }
  }
  return true;
}

/** Validate against the receiver's roster and locks before accepting a peer event. */
export function validateRosterMove(teams: FantasyTeam[], event: EventLogEntry, lockedTeams: string[]): boolean {
  const p = event.payload as RosterMovePayload | undefined;
  if (!p || typeof p.teamId !== 'string' || typeof p.candidatePlayerId !== 'string' ||
      typeof p.targetSlot !== 'string' || (p.sourceSlot !== null && typeof p.sourceSlot !== 'string') ||
      (p.targetPlayerId !== null && typeof p.targetPlayerId !== 'string')) return false;
  const team = teams.find(team => team.id === p.teamId);
  if (!team) return false;
  const roster = team.roster as unknown as Record<string, Player | null>;
  const players = [...Object.values(roster).filter((player): player is Player => !!player), ...team.bench];
  const candidate = players.find(player => player.id === p.candidatePlayerId);
  const target = p.targetPlayerId ? players.find(player => player.id === p.targetPlayerId) : null;
  if (!candidate || (p.targetPlayerId && !target) || candidate.id === target?.id) return false;
  const source = Object.keys(roster).find(slot => roster[slot]?.id === candidate.id) ?? null;
  if (source !== p.sourceSlot) return false;
  const targetSource = target ? Object.keys(roster).find(slot => roster[slot]?.id === target.id) ?? null : null;
  const benchTarget = /^bench(?:-\d+)?$/.test(p.targetSlot);
  if (!benchTarget && !Object.hasOwn(roster, p.targetSlot)) return false;
  if (target && (targetSource ? targetSource !== p.targetSlot : !benchTarget)) return false;
  if (!target && !benchTarget && roster[p.targetSlot]) return false;
  return !isPlayerLocked(candidate, lockedTeams) && !isPlayerLocked(target ?? null, lockedTeams);
}

export const applyRosterMoveEvent = (teams: FantasyTeam[], event: EventLogEntry, lockedTeams: string[]): FantasyTeam[] => {
  if (!validateRosterMove(teams, event, lockedTeams)) return teams;
  const p = event.payload as RosterMovePayload;
  if (!p?.teamId || !p?.candidatePlayerId) {
    console.warn('[EventStore] applyRosterMoveEvent: invalid payload', event);
    return teams;
  }

  return teams.map(team => {
    if (team.id !== p.teamId) return team;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newRoster = { ...team.roster } as any;
    let newBench = [...team.bench];

    const allPlayers = [...Object.values(team.roster).filter(Boolean), ...team.bench] as Player[];
    const candidate = allPlayers.find(pl => pl.id === p.candidatePlayerId);
    if (!candidate) {
      console.warn(`[EventStore] applyRosterMoveEvent: candidate ${p.candidatePlayerId} not found in team ${p.teamId}`);
      return team;
    }

    const targetPlayer = p.targetPlayerId
      ? allPlayers.find(pl => pl.id === p.targetPlayerId) ?? null
      : null;

    // 1. Remove candidate from source position
    if (p.sourceSlot) {
      newRoster[p.sourceSlot] = null;
    } else {
      newBench = newBench.filter(pl => pl.id !== p.candidatePlayerId);
    }

    // 2. Place candidate at target, displace any existing player back to source
    if (targetPlayer && p.targetPlayerId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetStarterSlot = Object.keys(team.roster).find(k => (team.roster as any)[k]?.id === p.targetPlayerId);
      if (targetStarterSlot) {
        newRoster[targetStarterSlot] = candidate;
      } else {
        newBench.push(candidate);
      }
      if (p.sourceSlot) {
        newRoster[p.sourceSlot] = targetPlayer;
      } else {
        newBench = newBench.filter(pl => pl.id !== p.targetPlayerId);
        newBench.push(targetPlayer);
      }
    } else {
      if (p.targetSlot.startsWith('bench')) {
        newBench.push(candidate);
      } else {
        newRoster[p.targetSlot] = candidate;
      }
    }

    const uniqueBench = Array.from(new Map(newBench.map(pl => [pl.id, pl])).values());
    return { ...team, roster: newRoster, bench: uniqueBench };
  });
};
