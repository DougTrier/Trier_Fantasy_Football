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
 * App.tsx — Root Application Shell
 * ==================================
 * Top-level React component. Owns all runtime game state and orchestrates
 * every service (P2P, Discovery, Sync, EventStore, Identity).
 *
 * STATE MODEL (Hybrid):
 *   React useState is the active runtime truth for all team/roster data.
 *   GlobalEventStore is the synchronization and audit layer.
 *   Every roster mutation (executeSwap) writes a canonical EventLogEntry,
 *   broadcasts it to verified peers, and also applies it to local React state.
 *   Inbound events from peers are applied via applyRosterMoveEvent() — the same
 *   pure function used locally, ensuring both paths produce identical state.
 *
 * P2P LIFECYCLE:
 *   Discovery → Connect Request → Handshake (VERIFYING) → VERIFIED → Sync
 *   Auto-sync fires only on VERIFIED — not on raw transport connect.
 *   Game data is gated on VERIFIED throughout the stack.
 *
 * KEY EXPORTS (used by peers and tests):
 *   applyRosterMoveEvent() — canonical pure state transformer for ROSTER_MOVE events.
 *   RosterMovePayload     — the wire payload type for roster change events.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useDialog } from './components/AppDialog';
import './index.css';
import type { Player, FantasyTeam, Transaction, League } from './types';
import { mockPlayers } from './data/mockDB';
import { LeagueTable } from './components/LeagueTable';
import { Roster } from './components/Roster';
import { Layout_Dashboard } from './components/Layout_Dashboard';
import { PlayerSelector } from './components/PlayerSelector';
import { PlayerTradingCard } from './components/PlayerTradingCard';
import { PlayersPage } from './components/PlayersPage';
import { SeasonProjectionsDashboard } from './components/SeasonProjectionsDashboard';
import { SeasonArchivePage } from './components/SeasonArchivePage';
import { RulesPage } from './components/RulesPage';
import { SettingsPage } from './components/SettingsPage';
import { H2HPage } from './components/H2HPage';
import { TradeOfferModal } from './components/TradeOfferModal';
import { TradeCenter } from './components/TradeCenter';
import { DraftSimulator } from './components/DraftSimulator';
import { WaiverPage } from './components/WaiverPage';
import { scrapePlayerStats, scrapePlayerPhoto } from './utils/scraper';
import stadiumBg from './assets/stadium_bg.png';
import leatherTexture from './assets/leather_texture.png';
import { isPlayerLocked, NFL_TEAMS, fetchLiveGameData, isGameday } from './utils/gamedayLogic';
import { processWaivers, ensureWaiverFields } from './services/WaiverService';
import { NotificationService } from './services/NotificationService';

import { Lock } from 'lucide-react';
import { SyncService } from './utils/SyncService';
import type { SidebandMessage } from './utils/SyncService';
import { DiscoveryService, type DiscoveredPeer } from './services/DiscoveryService';
import { P2PService } from './services/P2PService';
import { IdentityService } from './services/IdentityService';
import { NetworkPage } from './components/NetworkPage';
import { GlobalEventStore } from './services/EventStore';
import { ScoringEngine } from './utils/ScoringEngine';
import { SCORING_PRESETS } from './types';
import type { ScoringRuleset } from './types';
import { completeWeek } from './services/ScheduleService';
import type { EventLogEntry } from './types/P2P';

// ─────────────────────────────────────────────────────────────────────────────
// ROSTER_MOVE Event Payload
// Self-describing: contains enough info for any peer to apply the exact
// same transformation to their local state without additional context.
// ─────────────────────────────────────────────────────────────────────────────
export interface RosterMovePayload {
  teamId: string;
  candidatePlayerId: string;
  targetPlayerId: string | null;
  targetSlot: string;
  sourceSlot: string | null; // null = was on bench
}

// Per-session monotonic sequence counter. Starts at 1 each session.
let _localSeq = 0;
const nextSeq = () => ++_localSeq;

// ─────────────────────────────────────────────────────────────────────────────
// applyRosterMoveEvent — canonical, pure state transformer
// Used in BOTH the local and inbound peer paths. Same input = same output.
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export const applyRosterMoveEvent = (teams: FantasyTeam[], event: EventLogEntry): FantasyTeam[] => {
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
const formatInitialTeam = (): FantasyTeam => ({
  id: 'user-team',
  name: "Trier's Titans",
  ownerName: 'You',
  roster: {
    qb: null,
    rb1: null,
    rb2: null,
    wr1: null,
    wr2: null,
    te: null,
    flex: null,
    k: null,
    dst: null
  },
  bench: [],
  transactions: []
});

import { normalizeTeam } from './utils/dataNormalizer';

export default function App() {
  const { showAlert, showConfirm, showPrompt } = useDialog();

  // ─────────────────────────────────────────────────────────────────────────────
  // PERSISTENT STATE — initializers run once at mount, reading from localStorage
  // ─────────────────────────────────────────────────────────────────────────────
  const [userTeams, setUserTeams] = useState<FantasyTeam[]>(() => {
    const saved = localStorage.getItem('trier_fantasy_all_teams_v3');
    try {
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Normalize EVERY loaded team immediately — ensures missing fields get defaults
        return parsed.map(t => normalizeTeam(t));
      }
    } catch (e) { console.error("Failed to load V3 teams", e); }
    return [normalizeTeam(formatInitialTeam())];
  });

  const [activeTeamId, setActiveTeamId] = useState<string>(() => {
    // Session storage is window-scoped, perfect for multi-instance dev testing
    return sessionStorage.getItem('trier_fantasy_active_id') || localStorage.getItem('trier_fantasy_active_id') || '';
  });

  // Anti-Cheat: Game Day Locking Logic (Team-Specific)
  // Persisted across sessions so the commissioner's lock state survives a reload.
  const [lockedNFLTeams, setLockedNFLTeams] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('trier_locked_nfl_teams');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  // Per-team game status strings shown on locked roster slots (e.g. "Q3 7:42")
  const [gameStatuses, setGameStatuses] = useState<Record<string, string>>({});
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [hasNewOffers, setHasNewOffers] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const activeViewRef = useRef(activeView);
  useEffect(() => { activeViewRef.current = activeView; }, [activeView]);

  // Chat toast — shown when a chat arrives while not on the League page
  const [chatToast, setChatToast] = useState<{ id: string; sender: string; text: string } | null>(null);
  const chatToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shake animation — set to player ID briefly when a locked player click is attempted
  const [shakingPlayerId, setShakingPlayerId] = useState<string | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerShake = (playerId: string) => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShakingPlayerId(playerId);
    shakeTimer.current = setTimeout(() => setShakingPlayerId(null), 600);
  };

  const teamRef = useMemo(() => userTeams, [userTeams]); // Keep ref for closure

  // Sideband Sync Effect
  useEffect(() => {
    DiscoveryService.init().catch(e => console.error("Discovery Init Failed", e));
    P2PService.init().catch(e => console.error("P2P Init Failed", e));
    P2PService.setIpResolver((id) => DiscoveryService.peers.get(id));

    const handleMsg = (msg: SidebandMessage) => {
      if (msg.type === 'PING') {
        SyncService.pong();
        // Discovery handled by DiscoveryService now
      } else if (msg.type === 'PONG') {
        // Discovery handled by DiscoveryService now
      } else if (msg.type === 'SYNC_TEAMS') {
        // Only update if the received data is newer or different to prevent loops
        const incomingTeams = msg.payload as FantasyTeam[];
        if (JSON.stringify(incomingTeams) !== JSON.stringify(userTeams)) {
          console.log("[Sideband] Received sync from peer", msg.senderId);
          setUserTeams(incomingTeams);
        }
      } else if (msg.type === 'CHAT' && activeViewRef.current !== 'league') {
        // Show toast for incoming chat messages when not on the League page
        const p = msg.payload as { sender: string; text: string };
        if (p?.text?.trim()) {
          if (chatToastTimer.current) clearTimeout(chatToastTimer.current);
          setChatToast({ id: `${msg.senderId}-${msg.timestamp}`, sender: p.sender || 'Coach', text: p.text });
          chatToastTimer.current = setTimeout(() => setChatToast(null), 5000);
        }
      }
    };

    SyncService.addListener(handleMsg);
    SyncService.ping();

    // Broadcast changes
    SyncService.syncTeams(userTeams);



    // Auto-Sync on Verified Connect (fires only after mutual handshake completes)
    const unsubConn = P2PService.onConnectionStatus(({ status, peerId }) => {
      if (status === 'VERIFIED') {
        console.log(`[App] Peer ${peerId} verified. Auto-syncing teams + requesting delta events...`);
        SyncService.syncTeams(teamRef);
        // Delta sync: send our vector so the peer can fill in any events we missed
        P2PService.sendData(peerId, {
          type: 'SYNC_REQUEST',
          vector: GlobalEventStore.getVector()
        });
      }
    });

    // Remote Control Handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubControl = P2PService.onData(async (msg: any, peerId: string) => {
      if (msg.type === 'RESTART_REQUEST') {
        console.log("[App] Received Restart Request");
        const secret = localStorage.getItem('trier_p2p_secret');
        if (secret && msg.secret === secret) {
          console.warn("[App] Restart authorized. Relaunching...");
          try {
            const { relaunch } = await import('@tauri-apps/api/process');
            await relaunch();
          } catch (e) {
            console.error("Relaunch failed", e);
          }
        } else {
          console.warn("[App] Restart denied. Invalid/No secret.");
        }
      }

      // ── Delta sync request: peer wants events we have that they don't ────────
      if (msg.type === 'SYNC_REQUEST') {
        const missing = GlobalEventStore.getEventsSince(msg.vector || {});
        console.log(`[App] SYNC_REQUEST from ${peerId} — sending ${missing.length} missing events`);
        P2PService.sendData(peerId, { type: 'SYNC_RESPONSE', events: missing });
      }

      // ── Delta sync response: apply events the peer sent us ──────────────────
      if (msg.type === 'SYNC_RESPONSE') {
        // Cap batch size to prevent flooding attacks from a malicious verified peer
        const raw = (msg.events || []) as EventLogEntry[];
        if (raw.length > 500) {
          console.warn(`[App] SYNC_RESPONSE from ${peerId} contains ${raw.length} events — capping at 500`);
        }
        const events = raw.slice(0, 500);
        let applied = 0;
        for (const event of events) {
          // Verify signature against the peer's registered public key.
          // Events can be authored by any node (we may be relaying history), so we
          // look up the author's key. If unknown, we skip — we can't verify it.
          const authorKey = P2PService.getPeerPublicKey(event.author);
          if (!authorKey) {
            // Author not a directly connected verified peer — skip for now.
            // Future: trust-on-first-use or a key gossip layer could handle this.
            console.warn(`[App] SYNC_RESPONSE: no key for author "${event.author}" — skipping event ${event.id}`);
            continue;
          }
          const signStr = `${event.seq}|${event.type}|${JSON.stringify(event.payload)}|${event.ts}|${event.author}`;
          const valid = await IdentityService.verifySignature(authorKey, signStr, event.signature);
          if (!valid) {
            console.error(`[App] SYNC_RESPONSE: invalid signature for event ${event.id} from ${event.author} — dropping`);
            continue;
          }
          const accepted = GlobalEventStore.add(event);
          if (accepted && event.type === 'ROSTER_MOVE') {
            setUserTeams(prev => applyRosterMoveEvent(prev, event));
            applied++;
          }
        }
        console.log(`[App] SYNC_RESPONSE from ${peerId} — ${events.length} events checked, ${applied} ROSTER_MOVEs applied`);
      }

      // ── Inbound canonical event from a verified peer ────────────────────────
      if (msg.type === 'EVENT' && msg.event) {
        const event = msg.event as EventLogEntry;
        console.log(`[App] ← Inbound event from peer: ${event.type} seq=${event.seq} author=${event.author}`);

        // Verify the event signature against the sender's registered public key.
        // The sender must be the event's author — we don't accept events where a peer
        // claims to forward another node's signed event via this path (use SYNC_RESPONSE for that).
        const senderKey = P2PService.getPeerPublicKey(peerId);
        if (!senderKey) {
          console.error(`[App] EVENT from ${peerId}: no registered public key — dropping`);
          return;
        }
        if (event.author !== peerId) {
          console.error(`[App] EVENT author mismatch: sender=${peerId} author=${event.author} — dropping`);
          return;
        }
        const signStr = `${event.seq}|${event.type}|${JSON.stringify(event.payload)}|${event.ts}|${event.author}`;
        const valid = await IdentityService.verifySignature(senderKey, signStr, event.signature);
        if (!valid) {
          console.error(`[App] EVENT signature invalid from ${peerId} — dropping event ${event.id}`);
          return;
        }

        // Append to EventStore — deduplication and validation handled internally
        const accepted = GlobalEventStore.add(event);
        if (!accepted) {
          console.warn(`[App] Event ${event.id} rejected by EventStore (duplicate or invalid).`);
          return;
        }

        // Apply to local React state using the canonical pure function
        if (event.type === 'ROSTER_MOVE') {
          setUserTeams(prev => applyRosterMoveEvent(prev, event));
          console.log(`[App] ✅ ROSTER_MOVE applied from peer (seq: ${event.seq})`);
        }
      }
    });

    return () => {
      SyncService.removeListener(handleMsg);
      unsubConn();
      unsubControl();
    };
  }, [userTeams, activeTeamId]);

  // Subscribe to Discovery Service
  useEffect(() => {
    const unsub = DiscoveryService.subscribe((list) => {
      setPeers(list);
    });
    return () => unsub();
  }, []);

  // Track Verified Peers (app-level trust, not just transport)
  useEffect(() => {
    const updateConnected = () => {
      const active = Array.from(P2PService.connections.values())
        .filter(c => c.state === 'VERIFIED')
        .map(c => c.nodeId);
      setConnectedPeers(active);
    };

    const unsubConn = P2PService.onConnectionStatus(() => {
      updateConnected();
    });

    // Initial check
    updateConnected();

    return () => unsubConn();
  }, []);

  // Peer connect/disconnect notifications via NotificationService
  const prevConnectedRef = useRef<string[]>([]);
  useEffect(() => {
    const prev = prevConnectedRef.current;
    const added   = connectedPeers.filter(id => !prev.includes(id));
    const removed = prev.filter(id => !connectedPeers.includes(id));
    if (added.length === 0 && removed.length === 0) return;
    added.forEach(id => NotificationService.peerConnected(id));
    removed.forEach(id => NotificationService.peerDisconnected(id));
    prevConnectedRef.current = connectedPeers;
  }, [connectedPeers]);

  // Dynamic Discovery Identity Update
  // CRITICAL: We only update identity once the signaling port is confirmed from Rust.
  // This prevents Instance 2 from using Instance 1's "15432" identity temporarily.
  useEffect(() => {
    const currentTeam = userTeams.find(t => t.id === activeTeamId);

    // Define the update logic
    const tryUpdateIdentity = (assignedPort: number) => {
      if (currentTeam) {
        console.log(`[App] Port assigned (${assignedPort}). Updating Node ID...`);
        IdentityService.updateNodeId(currentTeam.name, assignedPort).then((newId: string) => {
          if (newId !== P2PService.myId && P2PService.myId !== 'Initializing...') {
            console.log(`[App] ID changed from ${P2PService.myId} to ${newId}. Re-initializing discovery...`);
            DiscoveryService.init();
          }
        });
        DiscoveryService.updateIdentity(currentTeam.id, currentTeam.name);
      }
    };

    // Subscribe to port assignment
    const unsubPort = P2PService.onPortAssigned((port) => {
      tryUpdateIdentity(port);
    });

    // If already assigned (race condition check), it fires immediately in onPortAssigned, 
    // but we also check if team changed while port was already assigned.
    if (P2PService.isPortAssigned && currentTeam) {
      tryUpdateIdentity(P2PService.port);
    }

    return () => {
      unsubPort();
    };
  }, [activeTeamId, userTeams]);


  // Handle peer expiration (simplified)
  useEffect(() => {
    const interval = setInterval(() => {
      setPeers([]); // Clear and re-ping
      SyncService.ping();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const myTeam = useMemo(() =>
    userTeams.find(t => t.id === activeTeamId) || (activeTeamId === '' ? null : userTeams[0]) || formatInitialTeam()
    , [userTeams, activeTeamId]);

  const [availablePlayers, setAvailablePlayers] = useState<Player[]>(mockPlayers);

  // FORCE REFRESH: Ensure availablePlayers gets latest metadata (socials, etc.) from mockPlayers on mount/update
  useEffect(() => {
    setAvailablePlayers(prev => prev.map(p => {
      const fresh = mockPlayers.find(mp => mp.id === p.id);
      if (fresh && JSON.stringify(p.socials) !== JSON.stringify(fresh.socials)) {
        return { ...p, ...fresh };
      }
      return p;
    }));
  }, []);

  // Save on Change — keep localStorage always current so close-from-X loses nothing
  useEffect(() => {
    localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify(userTeams));
    sessionStorage.setItem('trier_fantasy_active_id', activeTeamId);
    localStorage.setItem('trier_fantasy_active_id', activeTeamId);
  }, [userTeams, activeTeamId]);

  // Ref that always holds the latest userTeams — used in close handlers that are
  // registered once and can't close over a changing state value.
  const userTeamsRef = useRef(userTeams);
  useEffect(() => { userTeamsRef.current = userTeams; }, [userTeams]);

  // Handle window close via X button (Tauri) or tab close (browser).
  // Data is already continuously saved above; this handler just does the logout
  // (clears activeTeamId) so the next session starts on the team-select screen.
  useEffect(() => {
    const doLogout = () => {
      localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify(userTeamsRef.current));
      localStorage.setItem('trier_fantasy_active_id', '');
      sessionStorage.removeItem('trier_fantasy_active_id');
    };

    // Browser: beforeunload fires on tab/window close
    const handleBeforeUnload = () => doLogout();
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Tauri: CLOSE_REQUESTED is emitted by main.rs (close is already prevented)
    let unlisten: (() => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.__TAURI__) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<void>('CLOSE_REQUESTED', async () => {
          doLogout();
          try {
            const { exit } = await import('@tauri-apps/api/process');
            await exit(0);
          } catch {
            // Fallback if process API fails — close the window directly
            const { appWindow } = await import('@tauri-apps/api/window');
            await appWindow.close();
          }
        }).then(fn => { unlisten = fn; });
      });
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unlisten?.();
    };
  }, []); // Register once — reads latest state via userTeamsRef

  // System tray event listeners — wired to Rust tray menu items
  useEffect(() => {
    const win = window as any;
    if (!win.__TAURI__) return;
    const unlisteners: (() => void)[] = [];
    import('@tauri-apps/api/event').then(({ listen }) => {
      // Lock All / Unlock All from tray right-click menu
      listen<void>('TRAY_LOCK_ALL',   () => setLockedNFLTeams([...NFL_TEAMS])).then(fn => unlisteners.push(fn));
      listen<void>('TRAY_UNLOCK_ALL', () => setLockedNFLTeams([])).then(fn => unlisteners.push(fn));
    });
    return () => unlisteners.forEach(fn => fn());
  }, []);

  // Keep the tray badge in sync with pending trade offer state
  useEffect(() => {
    const win = window as any;
    if (!win.__TAURI__) return;
    import('@tauri-apps/api/tauri').then(({ invoke }) => {
      invoke('update_tray_badge', { hasOffers: hasNewOffers }).catch(() => {});
    });
  }, [hasNewOffers]);

  // Persist locked NFL teams across sessions
  useEffect(() => {
    localStorage.setItem('trier_locked_nfl_teams', JSON.stringify(lockedNFLTeams));
  }, [lockedNFLTeams]);

  // Auto-poll live NFL game data on gamedays (Sun / Mon / Thu).
  // Fires once on startup when it's a gameday, then every 60 minutes.
  // Keeps lockedNFLTeams and gameStatuses fresh without commissioner action.
  useEffect(() => {
    if (!isGameday()) return; // no-op on off-days
    const prevLockedRef = { current: [] as string[] };
    const poll = async () => {
      const { lockedTeams, statuses } = await fetchLiveGameData();
      // Notify only when new teams become locked (not on every poll)
      const newlyLocked = lockedTeams.filter(t => !prevLockedRef.current.includes(t));
      if (newlyLocked.length > 0) NotificationService.gamedayLock(newlyLocked.length);
      prevLockedRef.current = lockedTeams;
      setLockedNFLTeams(lockedTeams);
      setGameStatuses(statuses);
    };
    poll(); // immediate fetch on mount
    const id = setInterval(poll, 60 * 60 * 1000); // re-poll every hour
    return () => clearInterval(id);
  }, []);

  // Inactivity Logout Logic (5 Minutes)
  useEffect(() => {
    if (!activeTeamId) return;

    let timeout: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log("[Security] Auto-logging out due to 5 minutes of inactivity.");
        setActiveTeamId('');
        setActiveView('dashboard');
      }, 300000); // 5 minutes
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(name => document.addEventListener(name, resetTimer));

    resetTimer(); // Start timer on mount/login

    return () => {
      clearTimeout(timeout);
      events.forEach(name => document.removeEventListener(name, resetTimer));
    };
  }, [activeTeamId]);

  // Incoming Trade Offer detection — badge + push notification on new offers
  const prevOfferIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!myTeam) return;

    const myPlayerIds = new Set(
      [...Object.values(myTeam.roster), ...myTeam.bench].filter(Boolean).map(p => p!.id)
    );

    const incomingOffers = userTeams.flatMap(team =>
      (team.transactions || []).filter(tx =>
        tx.type === 'TRADE_OFFER' && tx.targetPlayerId && myPlayerIds.has(tx.targetPlayerId)
      ).map(tx => ({ tx, team }))
    );

    // Fire a notification only for offers that are genuinely new this render
    const prevIds = prevOfferIdsRef.current;
    incomingOffers
      .filter(({ tx }) => !prevIds.includes(tx.id))
      .forEach(({ tx, team }) => NotificationService.tradeOfferReceived(tx.playerName ?? 'your player', team.name));
    prevOfferIdsRef.current = incomingOffers.map(({ tx }) => tx.id);

    setHasNewOffers(incomingOffers.length > 0 && activeView !== 'trade');
  }, [userTeams, activeTeamId, activeView]);

  // Sync / Hydrate Data (Ensure stats are fresh)
  useEffect(() => {
    setUserTeams(prevTeams => prevTeams.map(team => {
      const refreshPlayer = (p: Player | null) => {
        if (!p) return null;
        const fresh = mockPlayers.find(mp => mp.id === p.id);
        return fresh ? { ...p, ...fresh } : p;
      };

      const newRoster = { ...team.roster };
      for (const slot in newRoster) {
        newRoster[slot as keyof typeof newRoster] = refreshPlayer(newRoster[slot as keyof typeof newRoster]);
      }

      // Safe access to bench
      const safeBench = Array.isArray(team.bench) ? team.bench : [];
      const hydratedBench = safeBench.map(p => refreshPlayer(p) as Player);
      const uniqueBench = Array.from(new Map(hydratedBench.map(p => [p.id, p])).values());

      return { ...team, roster: newRoster, bench: uniqueBench };
    }));
  }, []);

  /** Applies a functional update to the currently active team only. */
  const updateActiveTeam = (updater: (prev: FantasyTeam) => FantasyTeam) => {
    setUserTeams(prev => prev.map(t => t.id === activeTeamId ? updater(t) : t));
  };

  /** Appends an immutable transaction record to the active team's ledger. */
  const recordTransaction = (type: 'ADD' | 'DROP' | 'SWAP', description: string, playerName?: string) => {
    updateActiveTeam(prev => ({
      ...prev,
      transactions: [
        ...(prev.transactions || []),
        {
          id: `tx - ${Date.now()} -${Math.random().toString(36).substr(2, 9)} `, // UNIQUE ID FIX
          type,
          timestamp: Date.now(),
          description,
          playerName
        }
      ]
    }));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN / SECURITY
  // Admin mode is session-only (not persisted). The password hash is stored in
  // localStorage as "pbkdf2:<salt>:<hash>" — never as plaintext.
  // Legacy sha256: and plain: entries are migrated to PBKDF2 on mount.
  // ─────────────────────────────────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);
  // Holds the PBKDF2 hash of the admin password (never the plaintext).
  const adminPasswordHash = useRef<string>('');

  // Brute-force protection: tracks failed login attempts and lockout expiry.
  // Stored in sessionStorage so it resets on app restart (not persisted to disk).
  const adminLoginAttempts = useRef<number>(0);
  const adminLockoutUntil  = useRef<number>(0);

  // On mount: load the stored admin password hash and migrate legacy formats.
  useEffect(() => {
    const migrateAdminPassword = async () => {
      const { IdentityService } = await import('./services/IdentityService');
      const raw = localStorage.getItem('trier_admin_pass');

      if (!raw) {
        // First run — no password yet. Admin login handler will guide setup.
        adminPasswordHash.current = '';
        return;
      }

      if (raw.startsWith('pbkdf2:')) {
        // Current format — load as-is.
        adminPasswordHash.current = raw;
        return;
      }

      // Legacy sha256: or plain: — re-hash using PBKDF2 if possible.
      // We can only do this if we have the plaintext, which is only available
      // for the plain: format. sha256: hashes cannot be upgraded without re-login.
      if (raw.startsWith('plain:')) {
        const plaintext = raw.slice(6);
        try {
          const upgraded = await IdentityService.hashPassword(plaintext);
          localStorage.setItem('trier_admin_pass', upgraded);
          adminPasswordHash.current = upgraded;
          console.warn('[App] Admin password upgraded from plain: to PBKDF2.');
        } catch {
          // crypto.subtle unavailable — keep legacy hash in memory only
          adminPasswordHash.current = raw;
        }
        return;
      }

      // sha256: format — accept for this session but can only fully migrate on next login
      adminPasswordHash.current = raw;
      console.log('[App] Admin password is sha256: — will migrate to PBKDF2 on next login.');
    };
    migrateAdminPassword();
  }, []);

  // Strips HTML tags and control characters from free-text user inputs, and caps length.
  // React JSX already escapes on render; this is a defense-in-depth boundary at the storage layer.
  const sanitizeInput = (value: string, maxLength = 60): string =>
    value
      .replace(/<[^>]*>/g, '')          // strip any HTML tags
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '') // strip control characters
      .trim()
      .slice(0, maxLength);

  // Hash a team password before storing — team.password is always a pbkdf2: hash or undefined.
  const createNewTeam = async (name: string, ownerName: string, password?: string) => {
    const { IdentityService } = await import('./services/IdentityService');
    // Only hash non-empty passwords; undefined/empty means no password protection
    const hashedPassword = password ? await IdentityService.hashPassword(password) : undefined;
    const newTeam: FantasyTeam = {
      ...formatInitialTeam(),
      id: `team-${Date.now()}`,
      name:      sanitizeInput(name),
      ownerName: sanitizeInput(ownerName),
      password:  hashedPassword,
    };
    setUserTeams(prev => [...prev, newTeam]);
    setActiveTeamId(newTeam.id);
  };

  const deleteTeam = (teamId: string) => {
    if (!isAdmin) return; // Safeguard
    if (userTeams.length <= 1) {
      showAlert("Cannot delete the only team in the league. Create another team first.", "Cannot Delete");
      return;
    }
    setUserTeams(prev => {
      if (prev.length <= 1) {
        return prev;
      }
      const remaining = prev.filter(t => t.id !== teamId);
      if (activeTeamId === teamId && remaining.length > 0) {
        setActiveTeamId(remaining[0].id);
      }
      return remaining;
    });
  };

  // Hash the new password if one was provided before updating state; sanitize text fields.
  const updateTeamDetails = async (teamId: string, name: string, owner: string, password?: string) => {
    const { IdentityService } = await import('./services/IdentityService');
    const hashedPassword = password ? await IdentityService.hashPassword(password) : undefined;
    setUserTeams(prev => prev.map(t =>
      t.id === teamId
        ? {
            ...t,
            name:      sanitizeInput(name),
            ownerName: sanitizeInput(owner),
            ...(hashedPassword !== undefined ? { password: hashedPassword } : {}),
          }
        : t
    ));
  };

  const handleSaveAndClose = async () => {
    console.log("[App] Executing Save and Close Protocol...");

    // 1. FORCE SYNCHRONOUS SAVE
    localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify(userTeams));
    localStorage.setItem('trier_fantasy_active_id', ''); // Log out for security

    // 2. TAURI EXIT (DESKTOP)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.__TAURI__) {
      try {
        const { exit } = await import('@tauri-apps/api/process');
        await exit(0);
        return;
      } catch (e) {
        console.error("Tauri exit failed", e);
      }
    }

    // 3. BROWSER EXIT
    window.close();

    // 4. FALLBACK (If browser blocks close)
    setTimeout(() => {
      showAlert("Changes saved. You are now logged out. Please close this tab manually.", "Logged Out");
      setActiveTeamId(''); // Update UI state if still open
      setActiveView('dashboard');
    }, 500);
  };

  // Background Data Enrichment for Rostered Players
  useEffect(() => {
    const enrichStats = async () => {
      const rostered = [
        ...Object.values(myTeam.roster).filter(Boolean),
        ...myTeam.bench
      ] as Player[];

      for (const player of rostered) {
        // If career stats are missing, try to scrape them
        if ((!player.historicalStats || player.historicalStats.length === 0) && !player.isEnriched) {
          console.log(`[App] Enriching career stats for ${player.firstName} ${player.lastName} `);
          const careerData = await scrapePlayerStats(`${player.firstName} ${player.lastName} `);
          if (careerData) {
            updateActiveTeam(prev => {
              const updatePlayer = (p: Player | null) => {
                if (p?.id === player.id) return { ...p, historicalStats: careerData };
                return p;
              };
              const newRoster = { ...prev.roster };
              for (const k in newRoster) {
                newRoster[k as keyof typeof newRoster] = updatePlayer(newRoster[k as keyof typeof newRoster]);
              }
              const newBench = (prev.bench || []).map(updatePlayer) as Player[];
              return { ...prev, roster: newRoster, bench: newBench };
            });
          }
        }
      }
    };

    enrichStats();
  }, [myTeam.id]); // Run once on load for this team

  // View State (Moved Up)

  // Modal States
  const [activePlayerCard, setActivePlayerCard] = useState<Player | null>(null);
  const [submittingTradeFor, setSubmittingTradeFor] = useState<Player | null>(null);
  const [recruitingSlot, setRecruitingSlot] = useState<string | null>(null); // For Draft Modal
  const [isScraping, setIsScraping] = useState<string | null>(null); // Track which ID is scanning
  const [swapCandidate, setSwapCandidate] = useState<Player | null>(null); // For Roster Swapping Logic

  // Trigger Scrape when player is opened in modal (with Persistence and Locking)
  useEffect(() => {
    if (activePlayerCard && !activePlayerCard.isEnriched && isScraping !== activePlayerCard.id) {
      const needsStats = (!activePlayerCard.historicalStats || activePlayerCard.historicalStats.length === 0) && !activePlayerCard.isEnriched;
      const needsPhoto = !activePlayerCard.photoUrl || activePlayerCard.photoUrl.includes('placeholder') || activePlayerCard.photoUrl === '';

      if (needsStats || needsPhoto) {
        console.log(`[App] Triggering enrichment(stats: ${needsStats}, photo: ${needsPhoto}) for ${activePlayerCard.firstName} ${activePlayerCard.lastName} `);
        setIsScraping(activePlayerCard.id);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promises: Promise<any>[] = [];
        if (needsStats) promises.push(scrapePlayerStats(`${activePlayerCard.firstName} ${activePlayerCard.lastName} `));
        else promises.push(Promise.resolve(activePlayerCard.historicalStats));

        if (needsPhoto) promises.push(scrapePlayerPhoto(`${activePlayerCard.firstName} ${activePlayerCard.lastName} `));
        else promises.push(Promise.resolve(activePlayerCard.photoUrl));

        Promise.all(promises).then(([stats, photo]) => {
          const enrichedPlayer = {
            ...activePlayerCard,
            historicalStats: stats || activePlayerCard.historicalStats,
            photoUrl: photo || activePlayerCard.photoUrl,
            isEnriched: true
          };

          setActivePlayerCard(enrichedPlayer);
          setAvailablePlayers(prev => prev.map(p => p.id === enrichedPlayer.id ? enrichedPlayer : p));

          updateActiveTeam(prev => {
            const updateP = (p: Player | null) => (p?.id === activePlayerCard.id ? enrichedPlayer : p);
            const newRoster = { ...prev.roster };
            for (const k in newRoster) newRoster[k as keyof typeof newRoster] = updateP(newRoster[k as keyof typeof newRoster]);
            const newBench = prev.bench.map(updateP) as Player[];
            return { ...prev, roster: newRoster, bench: newBench };
          });
          setIsScraping(null);
        }).catch(() => {
          setIsScraping(null);
        });
      }
    }
  }, [activePlayerCard?.id]);

  // Background Hydrator: Proactively enrich available players in the background
  useEffect(() => {
    // Only run if not already scraping and we have players to enrich
    if (isScraping) return;

    // 1. Prioritize User's Roster (Active + Bench)
    const currentTeam = userTeams.find(t => t.id === activeTeamId) || userTeams[0];
    if (!currentTeam) return; // Safeguard against empty state
    const rosteredIds = new Set([
      ...Object.values(currentTeam.roster || {}).filter(Boolean).map(p => p?.id),
      ...(currentTeam.bench || []).map(p => p.id)
    ]);

    const unenrichedRosterPlayer = availablePlayers.find(p =>
      rosteredIds.has(p.id) &&
      !p.isEnriched &&
      (!p.photoUrl || p.photoUrl.includes('placeholder') || p.photoUrl === '')
    );

    // 2. Fallback to high-ADP stars if roster is done
    const nextToEnrich = unenrichedRosterPlayer || availablePlayers
      .filter(p => !p.isEnriched && (!p.photoUrl || p.photoUrl.includes('placeholder') || p.photoUrl === ''))
      .sort((a, b) => (a.adp || 999) - (b.adp || 999))[0];

    if (nextToEnrich) {
      const timer = setTimeout(() => {
        // Double check after timeout that we aren't busy
        if (isScraping) return;

        console.log(`[Hydrator] Proactively enriching ${nextToEnrich.firstName} ${nextToEnrich.lastName} (ADP: #${nextToEnrich.adp || 'N/A'})`);
        setIsScraping(nextToEnrich.id);

        const photoPromise = scrapePlayerPhoto(`${nextToEnrich.firstName} ${nextToEnrich.lastName} `, { skipGoogle: true });
        const statsPromise = scrapePlayerStats(`${nextToEnrich.firstName} ${nextToEnrich.lastName} `, { skipGoogle: true });

        Promise.all([photoPromise, statsPromise]).then(([photo, stats]) => {
          const enriched = {
            ...nextToEnrich,
            photoUrl: photo || nextToEnrich.photoUrl,
            historicalStats: stats || nextToEnrich.historicalStats,
            isEnriched: true
          };

          setAvailablePlayers(prev => prev.map(p => p.id === enriched.id ? enriched : p));
          setIsScraping(null);
        }).catch(err => {
          console.warn("[Hydrator] Error (likely rate limit), pausing 10s", err);
          setIsScraping('PAUSED'); // Temporary lock
          setTimeout(() => setIsScraping(null), 10000);
        });
      }, 3000); // 3 second delay between proactive scrapes to be polite

      return () => clearTimeout(timer);
    }
  }, [availablePlayers.filter(p => !p.isEnriched).length, isScraping]);


  // League State (Standings + H2H Schedule)
  const [league, setLeague] = useState<League>(() => {
    try {
      const saved = localStorage.getItem('trier_fantasy_league_v1');
      if (saved) return JSON.parse(saved) as League;
    } catch { /* fall through */ }
    return { id: 'league-1', name: "Trier's Fantasy League", teams: [], history: [] };
  });
  // Persist league and keep ScoringEngine in sync with the active ruleset.
  useEffect(() => {
    localStorage.setItem('trier_fantasy_league_v1', JSON.stringify(league));
    ScoringEngine.setRuleset(league.settings?.ruleset ?? SCORING_PRESETS.PPR);
  }, [league]);

  // Handler passed to SettingsPage — updates league.settings.ruleset and persists.
  const handleUpdateRuleset = (ruleset: ScoringRuleset) => {
    setLeague(prev => ({
      ...prev,
      settings: { budget: prev.settings?.budget ?? 100, maxPlayers: prev.settings?.maxPlayers ?? 15, ruleset },
    }));
  };

  // Derived League State (Merges My Team with others + Updates History Points)
  const displayLeague = useMemo(() => {
    // Calculate current team points for history display (Starting Roster ONLY)
    let myPoints = 0;
    Object.values(myTeam.roster).forEach(p => {
      if (p) {
        // Use projectedPoints for now, could be dynamic in future
        myPoints += p.projectedPoints || 0;
      }
    });

    const updatedHistory = league.history?.map(h =>
      h.year === ScoringEngine.getOrchestrationStatus().season ? { ...h, points: myPoints } : h
    );

    return {
      ...league,
      // Show ALL user teams in the league + any external/internet teams (currently empty)
      teams: [...league.teams, ...userTeams.filter(ut => !league.teams.find(t => t.id === ut.id))],
      history: updatedHistory
    };
  }, [league, userTeams]);

  const addToRoster = (player: Player, targetSlot?: string) => {
    if (!targetSlot) return;

    // Single-Owner Ownership Enforcement
    const owner = userTeams.find(t =>
      [...Object.values(t.roster), ...t.bench].some(p => p && p.id === player.id)
    );
    if (owner && owner.id !== activeTeamId) {
      showAlert(`${player.firstName} ${player.lastName} is already on ${owner.name} (Coach ${owner.ownerName}).`, "Player Unavailable");
      return;
    }

    updateActiveTeam(prev => {
      const newRoster = { ...prev.roster };
      const newBench = [...prev.bench];
      let added = false;

      if (targetSlot.startsWith('bench-')) {
        if (newBench.length < 7) {
          newBench.push(player);
          added = true;
        }
      } else {
        newRoster[targetSlot as keyof typeof newRoster] = player;
        added = true;
      }

      if (added) {
        // Safe Deduplication
        const uniqueBench = Array.from(new Map(newBench.map(p => [p.id, p])).values());
        setAvailablePlayers(aprev => aprev.filter(p => p.id !== player.id));
        setRecruitingSlot(null);
        setActivePlayerCard(null);

        recordTransaction('ADD', `Added ${player.firstName} ${player.lastName} to ${targetSlot.toUpperCase()} `, `${player.firstName} ${player.lastName} `);

        return { ...prev, roster: newRoster, bench: uniqueBench };
      }
      return prev;
    });
  };

  const RemoveFromRoster = (player: Player) => {
    updateActiveTeam(prev => {
      const newRoster = { ...prev.roster };
      let removed = false;

      // Check Roster Slots
      for (const key in newRoster) {
        if (newRoster[key as keyof typeof newRoster]?.id === player.id) {
          newRoster[key as keyof typeof newRoster] = null;
          removed = true;
          break;
        }
      }

      // Check Bench
      const filteredBench = prev.bench.filter(p => p.id !== player.id);
      const wasInBench = filteredBench.length !== prev.bench.length;

      if (removed || wasInBench) {
        // Add back to pool
        setAvailablePlayers(aprev => {
          if (aprev.find(p => p.id === player.id)) return aprev;
          return [...aprev, player];
        });

        recordTransaction('DROP', `Released ${player.firstName} ${player.lastName} `, `${player.firstName} ${player.lastName} `);

        return { ...prev, roster: newRoster, bench: filteredBench };
      }
      return prev;
    });
  };

  const movePlayer = (player: Player) => {
    if (isPlayerLocked(player, lockedNFLTeams)) {
      triggerShake(player.id);
      showAlert(`${player.firstName} ${player.lastName} is currently playing and cannot be moved.`, "Player Locked");
      return;
    }
    setSwapCandidate(player);
    setActivePlayerCard(null);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isValidSwap = (candidate: Player, targetSlot: string, targetPlayer: Player | null, currentRoster: any): { valid: boolean; reason?: string } => {
    if (targetSlot.startsWith('bench')) return { valid: true };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidateCurrentSlot = Object.keys(currentRoster).find((k: string) => (currentRoster[k] as any)?.id === candidate.id);

    const checkPos = (p: Player, slot: string) => {
      const s = slot.toLowerCase();
      if (s.startsWith('qb')) return p.position === 'QB';
      if (s.startsWith('rb')) return p.position === 'RB';
      if (s.startsWith('wr')) return p.position === 'WR';
      if (s.startsWith('te')) return p.position === 'TE';
      if (s.startsWith('k')) return p.position === 'K';
      if (s.startsWith('dst')) return p.position === 'DST';
      if (s.startsWith('flex')) return ['RB', 'WR', 'TE'].includes(p.position);
      return true; // Bench
    };

    if (!checkPos(candidate, targetSlot)) {
      return { valid: false, reason: `Position Mismatch: A ${candidate.position} cannot fill the ${targetSlot.toUpperCase()} slot.` };
    }

    if (targetPlayer && candidateCurrentSlot) {
      if (!checkPos(targetPlayer, candidateCurrentSlot)) {
        return { valid: false, reason: `Double Mismatch: Swapping these players would put ${targetPlayer.position} in an invalid ${candidateCurrentSlot.toUpperCase()} slot.` };
      }
    }

    return { valid: true };
  };

  /**
   * executeSwap — The canonical roster mutation entry point.
   * Validates the move, applies it to local state via applyRosterMoveEvent,
   * signs the resulting EventLogEntry with ECDSA, and broadcasts it to all
   * VERIFIED peers. All of this runs in a single synchronous state update batch.
   */
  const executeSwap = async (targetPlayer: Player | null, targetSlot?: string) => {
    if (!swapCandidate) return;

    // Check if swapCandidate is locked
    if (isPlayerLocked(swapCandidate, lockedNFLTeams)) {
      triggerShake(swapCandidate.id);
      showAlert(`${swapCandidate.firstName} ${swapCandidate.lastName} is locked — their game is in progress.`, "Player Locked");
      setSwapCandidate(null);
      return;
    }

    // Check if targetPlayer is locked (if we are swapping with another player)
    if (targetPlayer && isPlayerLocked(targetPlayer, lockedNFLTeams)) {
      triggerShake(targetPlayer.id);
      showAlert(`${targetPlayer.firstName} ${targetPlayer.lastName} is locked — their game is in progress.`, "Player Locked");
      setSwapCandidate(null);
      return;
    }

    // ── Capture the event payload during the state update ────────────────────
    // We compute it inside the setter so we have access to the current roster
    // snapshot (prev). Captured synchronously before React batches the update.
    let capturedPayload: RosterMovePayload | null = null;

    updateActiveTeam(prev => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const effectiveTargetSlot = targetSlot || Object.keys(prev.roster).find(k => (prev.roster as any)[k]?.id === targetPlayer?.id) || 'bench';
      const validation = isValidSwap(swapCandidate, effectiveTargetSlot, targetPlayer, prev.roster);

      if (!validation.valid) {
        showAlert(validation.reason ?? 'Invalid move.', "Invalid Move");
        return prev;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceStarterSlot = Object.keys(prev.roster).find(k => (prev.roster as any)[k]?.id === swapCandidate!.id) || null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newRoster = { ...prev.roster } as any;
      let newBench = [...prev.bench];

      // 1. Remove source from where they were
      if (sourceStarterSlot) {
        newRoster[sourceStarterSlot] = null;
      } else {
        newBench = newBench.filter(p => p.id !== swapCandidate!.id);
      }

      // 2. Perform Swap
      if (targetPlayer) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetStarterSlot = Object.keys(prev.roster).find(k => (prev.roster as any)[k]?.id === targetPlayer.id);

        if (targetStarterSlot) {
          newRoster[targetStarterSlot] = swapCandidate;
        } else {
          newBench.push(swapCandidate!);
        }

        if (sourceStarterSlot) {
          newRoster[sourceStarterSlot] = targetPlayer;
        } else {
          newBench = newBench.filter(p => p.id !== targetPlayer.id);
          newBench.push(targetPlayer);
        }
      } else if (targetSlot) {
        if (targetSlot.startsWith('bench')) {
          newBench.push(swapCandidate!);
        } else {
          newRoster[targetSlot] = swapCandidate;
        }
      }

      // FINAL DEDUPLICATION
      const uniqueBench = Array.from(new Map(newBench.map(p => [p.id, p])).values());

      // RECORD SWAP (existing transaction log — unchanged)
      const desc = targetPlayer
        ? `Swapped ${swapCandidate!.lastName} with ${targetPlayer.lastName} `
        : `Moved ${swapCandidate!.lastName} to ${effectiveTargetSlot.toUpperCase()} `;
      recordTransaction('SWAP', desc, swapCandidate!.lastName);

      // ── Capture canonical event payload (sync — happens before React batches) ──
      capturedPayload = {
        teamId: prev.id,
        candidatePlayerId: swapCandidate!.id,
        targetPlayerId: targetPlayer?.id ?? null,
        targetSlot: effectiveTargetSlot,
        sourceSlot: sourceStarterSlot,
      };

      return { ...prev, roster: newRoster, bench: uniqueBench };
    });

    // ── Emit canonical ROSTER_MOVE event ─────────────────────────────────────
    // Runs after the synchronous setter callback completes.
    if (capturedPayload) {
      const identity = IdentityService.get();
      const seq = nextSeq();
      const ts = Date.now();

      // Sign the event to prove authorship
      const signStr = `${seq}|ROSTER_MOVE|${JSON.stringify(capturedPayload)}|${ts}|${identity.nodeId}`;
      let signature: string;
      try {
        signature = await IdentityService.sign(signStr);
      } catch (e) {
        // Signing threw unexpectedly — abort. Don't emit an unverifiable event.
        console.error('[executeSwap] Event signing threw — aborting broadcast:', e);
        setSwapCandidate(null);
        return;
      }

      const event: EventLogEntry = {
        seq,
        id: crypto.randomUUID(),
        type: 'ROSTER_MOVE',
        payload: capturedPayload,
        ts,
        author: identity.nodeId,
        signature,
      };

      // Append locally (deduplication + validation in EventStore)
      // Note: EventStore.validate() rejects signature === 'unsigned', so in HTTP dev mode
      // (where crypto.subtle is absent) the event won't be stored or broadcast.
      const accepted = GlobalEventStore.add(event);
      if (!accepted) {
        // Likely unsigned (crypto.subtle unavailable in HTTP dev mode) — roster move
        // applied to local state above but not persisted or broadcast. This is expected
        // when running over plain HTTP without a secure context.
        console.warn('[executeSwap] Event rejected by EventStore (unsigned or invalid) — local-only move.');
        setSwapCandidate(null);
        return;
      }

      // Broadcast to all verified peers — P2PService gates on VERIFIED internally
      P2PService.broadcast({ type: 'EVENT', event });

      console.log(`[App] → ROSTER_MOVE event emitted: seq=${seq} id=${event.id}`);
    }

    setSwapCandidate(null);
  };

  const handleImport = async (importedTeam: FantasyTeam) => {
    const exists = userTeams.find(t => t.id === importedTeam.id);
    if (exists) {
      const ok = await showConfirm(
        `"${importedTeam.name}" already exists in this league. Overwrite it with the imported data?`,
        "Overwrite Team",
        "OVERWRITE"
      );
      if (!ok) return;
    }
    setUserTeams(prev => {
      if (prev.some(t => t.id === importedTeam.id)) {
        return prev.map(t => t.id === importedTeam.id ? importedTeam : t);
      }
      return [...prev, importedTeam];
    });
  };

  const handleOpenTradeOffer = (player: Player) => {
    setSubmittingTradeFor(player);
  };

  const handleMakeOffer = (amount: number) => {
    if (!submittingTradeFor || !myTeam) return;

    console.log(`[Trade] MAKING OFFER: ${amount} pts for ${submittingTradeFor.lastName}`);

    const newTx: Transaction = {
      id: `trade - ${Date.now()} `,
      type: 'TRADE_OFFER',
      timestamp: Date.now(),
      description: `Offered ${amount} pts for ${submittingTradeFor.firstName} ${submittingTradeFor.lastName} `,
      amount: amount,
      targetPlayerId: submittingTradeFor.id,
      playerName: `${submittingTradeFor.firstName} ${submittingTradeFor.lastName} `
    };

    const updatedTeam = {
      ...myTeam,
      points_escrowed: (myTeam.points_escrowed || 0) + amount,
      transactions: [newTx, ...(myTeam.transactions || [])]
    };

    setUserTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t));
    setSubmittingTradeFor(null);
    setActivePlayerCard(null);
  };

  const handleAcceptOffer = (offer: Transaction, offeringTeam: FantasyTeam) => {
    if (!myTeam) return;

    console.log(`[Trade] ACCEPTING OFFER: ${offer.amount} pts from ${offeringTeam.name} for player ${offer.targetPlayerId}`);

    // 1. Find the player being traded
    const playerToTrade = [...Object.values(myTeam.roster), ...myTeam.bench].find(p => p?.id === offer.targetPlayerId);
    if (!playerToTrade) return;

    // 2. Remove player from my team (Seller)
    const sellerRoster = { ...myTeam.roster };
    for (const key in sellerRoster) {
      if (sellerRoster[key as keyof typeof sellerRoster]?.id === playerToTrade.id) {
        sellerRoster[key as keyof typeof sellerRoster] = null;
      }
    }
    const sellerBench = myTeam.bench.filter(p => p && p.id !== playerToTrade.id);

    // Add point gain to my ledger
    const sellerTx: Transaction = {
      id: `trade-accepted-${Date.now()}`,
      type: 'TRADE_ACCEPT',
      timestamp: Date.now(),
      description: `Sold ${playerToTrade.lastName} for ${offer.amount} pts`,
      amount: offer.amount,
      playerName: playerToTrade.lastName
    };

    const updatedSeller = {
      ...myTeam,
      roster: sellerRoster,
      bench: sellerBench,
      total_production_pts: (myTeam.total_production_pts || 0) + (offer.amount || 0),
      transactions: [sellerTx, ...(myTeam.transactions || [])]
    };

    // 3. Update Buyer Team
    const buyerTx: Transaction = {
      id: `trade-complete-${Date.now()}`,
      type: 'ADD',
      timestamp: Date.now(),
      description: `Acquired ${playerToTrade.lastName} via Trade`,
      playerName: playerToTrade.lastName
    };

    const updatedBuyer = {
      ...offeringTeam,
      points_escrowed: (offeringTeam.points_escrowed || 0) - (offer.amount || 0),
      points_spent: (offeringTeam.points_spent || 0) + (offer.amount || 0),
      bench: [...offeringTeam.bench, { ...playerToTrade, ownerId: offeringTeam.id }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactions: (offeringTeam.transactions || []).map(t => t.id === offer.id ? { ...t, type: 'ADD' as any } : t).concat(buyerTx)
    };

    // 4. Persistence
    setUserTeams(prev => prev.map(t => {
      if (t.id === updatedSeller.id) return updatedSeller;
      if (t.id === updatedBuyer.id) return updatedBuyer;
      return t;
    }));

    setAvailablePlayers(prev => prev.filter(p => p.id !== playerToTrade.id));
    NotificationService.tradeAccepted(playerToTrade.lastName, offeringTeam.name);
    showAlert(`${playerToTrade.lastName} has been traded to ${offeringTeam.name}.`, "Trade Complete");
  };

  const handleDeclineOffer = (offer: Transaction, offeringTeam: FantasyTeam) => {
    if (!myTeam) return;

    // Refund escrow to buyer
    const updatedBuyer = {
      ...offeringTeam,
      points_escrowed: (offeringTeam.points_escrowed || 0) - (offer.amount || 0),
      transactions: (offeringTeam.transactions || []).filter(t => t.id !== offer.id) // Remove the offer
    };

    setUserTeams(prev => prev.map(t => t.id === updatedBuyer.id ? updatedBuyer : t));
    NotificationService.tradeDeclined(offer.playerName ?? 'player', myTeam?.name ?? 'seller');
    showAlert("Trade offer declined. Escrowed points have been returned to the buyer.", "Offer Declined");
  };

  const handleCancelMyOffer = (offerId: string) => {
    if (!myTeam) return;
    const offer = (myTeam.transactions || []).find(t => t.id === offerId);
    if (!offer) return;

    const updatedTeam = {
      ...myTeam,
      points_escrowed: (myTeam.points_escrowed || 0) - (offer.amount || 0),
      transactions: (myTeam.transactions || []).filter(t => t.id !== offerId)
    };

    setUserTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t));
  };

  // ── Commissioner overrides ─────────────────────────────────────────────────

  const handleAdminForceAccept = (offer: Transaction, buyerTeam: FantasyTeam, sellerTeam: FantasyTeam) => {
    const playerToTrade = [...Object.values(sellerTeam.roster), ...sellerTeam.bench].find(p => p?.id === offer.targetPlayerId);
    if (!playerToTrade) { showAlert("Player not found on the seller's roster.", "Error"); return; }

    // Remove from seller
    const sellerRoster = { ...sellerTeam.roster };
    for (const key in sellerRoster) {
      if (sellerRoster[key as keyof typeof sellerRoster]?.id === playerToTrade.id) {
        sellerRoster[key as keyof typeof sellerRoster] = null;
      }
    }
    const sellerBench = sellerTeam.bench.filter(p => p && p.id !== playerToTrade.id);
    const sellerTx: Transaction = {
      id: `trade-accepted-${Date.now()}`,
      type: 'TRADE_ACCEPT',
      timestamp: Date.now(),
      description: `[Commissioner] Sold ${playerToTrade.lastName} for ${offer.amount} pts`,
      amount: offer.amount,
      playerName: playerToTrade.lastName
    };
    const updatedSeller = {
      ...sellerTeam,
      roster: sellerRoster,
      bench: sellerBench,
      total_production_pts: (sellerTeam.total_production_pts || 0) + (offer.amount || 0),
      transactions: [sellerTx, ...(sellerTeam.transactions || [])]
    };

    // Move player to buyer
    const buyerTx: Transaction = {
      id: `trade-complete-${Date.now()}`,
      type: 'ADD',
      timestamp: Date.now(),
      description: `[Commissioner] Acquired ${playerToTrade.lastName} via Trade`,
      playerName: playerToTrade.lastName
    };
    const updatedBuyer = {
      ...buyerTeam,
      points_escrowed: (buyerTeam.points_escrowed || 0) - (offer.amount || 0),
      points_spent: (buyerTeam.points_spent || 0) + (offer.amount || 0),
      bench: [...buyerTeam.bench, { ...playerToTrade, ownerId: buyerTeam.id }],
      transactions: (buyerTeam.transactions || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map(t => t.id === offer.id ? { ...t, type: 'ADD' as any } : t)
        .concat(buyerTx)
    };

    setUserTeams(prev => prev.map(t => {
      if (t.id === updatedSeller.id) return updatedSeller;
      if (t.id === updatedBuyer.id) return updatedBuyer;
      return t;
    }));
    setAvailablePlayers(prev => prev.filter(p => p.id !== playerToTrade.id));
  };

  const handleAdminForceCancel = (offerId: string, offeringTeamId: string) => {
    // (declaration must stay here — referenced by JSX below)
    setUserTeams(prev => prev.map(t => {
      if (t.id !== offeringTeamId) return t;
      const offer = (t.transactions || []).find(tx => tx.id === offerId);
      if (!offer) return t;
      return {
        ...t,
        points_escrowed: (t.points_escrowed || 0) - (offer.amount || 0),
        transactions: (t.transactions || []).filter(tx => tx.id !== offerId)
      };
    }));
  };

  // Commissioner dashboard event listeners — actions triggered from http://localhost:15434.
  // Placed here (after handleAcceptOffer/handleDeclineOffer) to avoid TDZ errors.
  useEffect(() => {
    const win = window as any;
    if (!win.__TAURI__) return;
    const unlisteners: (() => void)[] = [];
    import('@tauri-apps/api/event').then(({ listen }) => {

      // Lock grid change from dashboard
      listen<{ set: string[] }>('COMM_SET_LOCKS', e => {
        setLockedNFLTeams(e.payload.set ?? []);
      }).then(fn => unlisteners.push(fn));

      // Trade approve / decline from dashboard — locate offer by ID, delegate to existing handlers
      listen<{ offerId: string; action: 'approve' | 'decline' }>('COMM_TRADE_ACTION', e => {
        const { offerId, action } = e.payload;
        let foundOffer: Transaction | null = null;
        let offeringTeam: FantasyTeam | null = null;
        setUserTeams(prev => {
          for (const t of prev) {
            const match = (t.transactions ?? []).find(tx => tx.id === offerId && tx.type === 'TRADE_OFFER');
            if (match) { foundOffer = match; offeringTeam = t; break; }
          }
          return prev;
        });
        if (foundOffer && offeringTeam) {
          if (action === 'approve') handleAcceptOffer(foundOffer, offeringTeam);
          else handleDeclineOffer(foundOffer, offeringTeam);
        }
      }).then(fn => unlisteners.push(fn));

      // Announcement broadcast — show locally and forward to P2P peers
      listen<{ text: string }>('COMM_ANNOUNCE', e => {
        const text = e.payload.text ?? '';
        showAlert(text, '📢 Commissioner Announcement');
        P2PService.broadcast({ type: 'COMMISSIONER_ANNOUNCEMENT', payload: { text } });
      }).then(fn => unlisteners.push(fn));

      // Advance current week — same logic as SchedulePage's Complete Week button
      listen<void>('COMM_ADVANCE_WEEK', () => {
        setLeague(prev => {
          const result = completeWeek(prev, userTeams, prev.currentWeek ?? 1);
          setTimeout(() => {
            setLeague(result.league);
            setUserTeams(result.teams);
          }, 0);
          return prev;
        });
      }).then(fn => unlisteners.push(fn));

    });
    return () => unlisteners.forEach(fn => fn());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push league state snapshot to Rust every 5 s while admin is active.
  useEffect(() => {
    const win = window as any;
    if (!win.__TAURI__ || !isAdmin) return;

    const push = () => {
      const teamSummaries = userTeams.map(t => ({
        id: t.id, name: t.name, owner: t.owner,
        wins: t.wins ?? 0, losses: t.losses ?? 0,
        totalPts: t.total_production_pts ?? 0,
      }));
      const pendingOffers = userTeams.flatMap(t =>
        (t.transactions ?? []).filter(tx => tx.type === 'TRADE_OFFER')
          .map(tx => ({ ...tx, fromTeamId: t.id }))
      );
      import('@tauri-apps/api/tauri').then(({ invoke }) => {
        invoke('sync_commissioner_state', {
          data: {
            teams_json: JSON.stringify(teamSummaries),
            trades_json: JSON.stringify(pendingOffers),
            league_json: JSON.stringify({
              currentWeek: league.currentWeek ?? 1,
              numWeeks: league.numWeeks ?? 14,
              schedule: league.schedule ?? [],
            }),
            locked_teams: lockedNFLTeams,
            ruleset_name: (league.settings?.ruleset ?? SCORING_PRESETS.PPR).name,
            league_name: league.name,
          },
        }).catch(() => {});
      });
    };

    push();
    const interval = setInterval(push, 5000);
    return () => clearInterval(interval);
  }, [isAdmin, userTeams, league, lockedNFLTeams]);

  return (
    <>
    {/* Chat toast — appears when a chat message arrives while not on League page */}
    {chatToast && (
      <div
        key={chatToast.id}
        onClick={() => { setChatToast(null); setActiveView('league'); }}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, rgba(10,15,30,0.97) 0%, rgba(17,24,39,0.97) 100%)',
          border: '1px solid rgba(234,179,8,0.4)',
          borderRadius: '14px',
          padding: '12px 16px',
          maxWidth: '320px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(234,179,8,0.15)',
          backdropFilter: 'blur(16px)',
          cursor: 'pointer',
          animation: 'dialogIn 0.2s ease-out',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}
      >
        <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: '1px' }}>💬</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#eab308', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '3px' }}>
            {chatToast.sender} · League Chat
          </div>
          <div style={{ fontSize: '0.82rem', color: '#e5e7eb', lineHeight: 1.4, wordBreak: 'break-word', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {chatToast.text}
          </div>
          <div style={{ fontSize: '0.58rem', color: '#6b7280', marginTop: '5px', fontWeight: 600 }}>Click to open League Chat</div>
        </div>
      </div>
    )}
    <Layout_Dashboard
      activeView={activeView}
      onNavigate={setActiveView}
      userTeams={userTeams}
      activeTeamId={activeTeamId}
      onSelectTeam={setActiveTeamId}
      onSaveAndClose={handleSaveAndClose}
      hasNewOffers={hasNewOffers}
    >
      {activeView === 'dashboard' && (
        !activeTeamId || activeTeamId === 'guest' || !myTeam ? (
          /* PUBLIC WELCOME / SELECT TEAM SCREEN */
          <div style={{ textAlign: 'center', paddingTop: 'clamp(5px, 2vh, 10px)', color: 'white', minHeight: '100vh', backgroundImage: `linear - gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9)), url(${stadiumBg})`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px' }}>
            <h1 style={{ fontSize: 'clamp(2rem, 6vh, 3.5rem)', fontWeight: 900, marginBottom: 'clamp(5px, 1.5vh, 10px)', textShadow: '0 4px 15px rgba(0,0,0,0.8)' }}>TFL STRATEGY ROOM</h1>
            <p className="text-outline" style={{ fontSize: 'clamp(0.9rem, 2vh, 1.2rem)', color: '#e5e7eb', maxWidth: '700px', margin: '0 auto clamp(20px, 4vh, 40px)', lineHeight: '1.6', fontWeight: 600 }}>
              Welcome to the official Trier Fantasy League management suite.
              Scout players, check league standings, or create your elite franchise to start competing.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '900px', margin: '0 auto' }}>
              {userTeams.filter(t => t.id !== 'guest').map(t => (
                <div key={t.id} onClick={async () => {
                  if (t.password && !isAdmin) {
                    const p = await showPrompt(`Enter the password for ${t.name}:`, t.name);
                    if (p === null) return; // cancelled
                    if (p === t.password) setActiveTeamId(t.id);
                    else showAlert("Incorrect password. Access denied.", "Wrong Password");
                  } else {
                    setActiveTeamId(t.id);
                  }
                }} style={{
                  background: 'rgba(255,255,255,0.05)', padding: 'clamp(15px, 3vh, 25px)', borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#eab308'; e.currentTarget.style.transform = 'translateY(-5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#eab308', marginBottom: '5px' }}>{t.name}</div>
                  <div style={{ color: '#9ca3af', fontWeight: 600 }}>Coach: {t.ownerName}</div>
                  {t.password && <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Lock size={12} /> SECURE</div>}
                </div>
              ))}

              <div onClick={() => setActiveView('settings')} style={{
                background: 'rgba(234, 179, 8, 0.1)', padding: '25px', borderRadius: '20px',
                border: '2px dashed #eab308', cursor: 'pointer', transition: 'all 0.3s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(234, 179, 8, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(234, 179, 8, 0.1)'}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#eab308' }}>+ CREATE FRANCHISE</div>
                <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '5px' }}>Head to Settings to begin</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            paddingTop: 'clamp(20px, 6vh, 50px)',
            minHeight: '100vh',
            backgroundImage: `linear - gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.8)), url(${stadiumBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            padding: '0 20px'
          }}>
            <h1 style={{
              fontSize: 'clamp(2rem, 6vh, 4rem)',
              fontWeight: '900',
              marginBottom: 'clamp(10px, 2.5vh, 20px)',
              color: 'transparent',
              backgroundImage: `url(${leatherTexture})`,
              backgroundSize: '150px',
              backgroundPosition: 'center',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              fontFamily: "'Graduate', 'Impact', sans-serif",
              WebkitTextStroke: '1px rgba(255,255,255,0.95)',
              textShadow: '0 5px 15px rgba(0,0,0,0.9)'
            }}>
              Welcome, Coach.
            </h1>
            <p style={{
              color: '#fff',
              fontSize: 'clamp(1rem, 2.5vh, 1.4rem)',
              maxWidth: '700px',
              margin: '0 auto clamp(20px, 5vh, 40px)',
              textShadow: '0 2px 8px rgba(0,0,0,1)',
              fontWeight: 600,
              background: 'rgba(0,0,0,0.3)',
              padding: '10px 20px',
              borderRadius: '12px',
              backdropFilter: 'blur(4px)'
            }}>
              Your season starts here. Manage your lineup, scout players, and dominate the league.
            </p>

            {/* LEAGUE LEDGER METRICS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', maxWidth: '1000px', margin: '0 auto 40px' }}>
              <div style={{ background: 'rgba(0,0,0,0.6)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.4)', backdropFilter: 'blur(12px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Total Production</div>
                <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#fff', fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 15px rgba(255,255,255,0.2)' }}>{(myTeam.total_production_pts || 0).toLocaleString()} <span style={{ fontSize: '1rem', color: '#9ca3af' }}>PTS</span></div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.6)', padding: '24px', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.4)', backdropFilter: 'blur(12px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Trade Points Used</div>
                <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#ef4444', fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 20px rgba(239, 68, 68, 0.3)' }}>{((myTeam.points_spent || 0) + (myTeam.points_escrowed || 0)).toLocaleString()} <span style={{ fontSize: '1rem', color: '#9ca3af' }}>PTS</span></div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '6px', fontWeight: 700 }}>INCLUDES {(myTeam.points_escrowed || 0).toLocaleString()} IN ESCROW</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.6)', padding: '24px', borderRadius: '20px', border: '2px solid #eab308', backdropFilter: 'blur(12px)', boxShadow: '0 0 25px rgba(234, 179, 8, 0.2)' }}>
                <div style={{ fontSize: '0.85rem', color: '#eab308', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>Actual Balance</div>
                <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#eab308', fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 25px rgba(234, 179, 8, 0.4)' }}>{((myTeam.total_production_pts || 0) - (myTeam.points_spent || 0)).toLocaleString()} <span style={{ fontSize: '1rem', color: '#eab308', opacity: 0.8 }}>PTS</span></div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '800px', margin: '0 auto' }}>
              <div onClick={() => setActiveView('roster')} style={{
                background: 'rgba(0,0,0,0.6)', padding: '30px', borderRadius: '20px', cursor: 'pointer', border: '1px solid rgba(234, 179, 8, 0.4)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 8px 25px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)'
              }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.background = 'rgba(0,0,0,0.75)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}>
                <h3 style={{ color: '#eab308', marginBottom: '10px', fontSize: '1.5rem', fontWeight: 900, textShadow: '0 2px 4px rgba(0,0,0,1)' }}>Manage Team</h3>
                <p style={{ color: '#fff', fontWeight: 500, textShadow: '0 1px 3px rgba(0,0,0,1)' }}>Edit your starting lineup and check projected points.</p>
              </div>
              <div onClick={() => setActiveView('league')} style={{
                background: 'rgba(0,0,0,0.6)', padding: '30px', borderRadius: '20px', cursor: 'pointer', border: '1px solid rgba(234, 179, 8, 0.4)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 8px 25px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)'
              }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.background = 'rgba(0,0,0,0.75)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}>
                <h3 style={{ color: '#eab308', marginBottom: '10px', fontSize: '1.5rem', fontWeight: 900, textShadow: '0 2px 4px rgba(0,0,0,1)' }}>League Standings</h3>
                <p style={{ color: '#fff', fontWeight: 500, textShadow: '0 1px 3px rgba(0,0,0,1)' }}>See how you stack up against the competition.</p>
              </div>

              <div onClick={() => setActiveView('network')} style={{
                background: 'rgba(0,0,0,0.6)', padding: '30px', borderRadius: '20px', cursor: 'pointer', border: '1px solid rgba(74, 222, 128, 0.4)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 8px 25px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
                gridColumn: '1 / -1' // Full width
              }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.background = 'rgba(0,0,0,0.75)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}>
                <h3 style={{ color: '#4ade80', marginBottom: '10px', fontSize: '1.5rem', fontWeight: 900, textShadow: '0 2px 4px rgba(0,0,0,1)' }}>Connect With Friends</h3>
                <p style={{ color: '#fff', fontWeight: 500, textShadow: '0 1px 3px rgba(0,0,0,1)' }}>Connect with other coaches on LAN or Secure WAN.</p>
              </div>
            </div>
          </div>
        ))}

      {activeView === 'roster' && (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            marginBottom: '24px',
            padding: '20px 24px',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: lockedNFLTeams.length > 0 ? '#ef4444' : '#10b981',
                  boxShadow: lockedNFLTeams.length > 0 ? '0 0 15px #ef4444' : '0 0 15px #10b981',
                  animation: lockedNFLTeams.length > 0 ? 'pulse 1.5s infinite' : 'none'
                }} />
                <div>
                  <div style={{ fontWeight: 900, fontSize: '1rem', color: lockedNFLTeams.length > 0 ? '#ef4444' : '#10b981', textTransform: 'uppercase', letterSpacing: '2px' }}>
                    {lockedNFLTeams.length > 0 ? `${lockedNFLTeams.length} TEAMS LOCKED` : 'ROSTER OPEN (OFF-SEASON)'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 500 }}>
                    {lockedNFLTeams.length > 0
                      ? 'Specific players on playing teams are locked in your lineup.'
                      : 'All players can be swapped, added or dropped.'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setLockedNFLTeams(lockedNFLTeams.length > 0 ? [] : [...NFL_TEAMS])}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  {lockedNFLTeams.length > 0 ? 'UNLOCK ALL' : 'SIMULATE SUNDAY (LOCK ALL)'}
                </button>
              </div>
            </div>

            {/* QUICK TEAM TOGGLES */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {['KC', 'SF', 'BAL', 'DET', 'DAL', 'PHI', 'BUF', 'CIN', 'MIA', 'GB'].map(team => (
                <button
                  key={team}
                  onClick={() => {
                    setLockedNFLTeams(prev =>
                      prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]
                    );
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    border: '1px solid',
                    background: lockedNFLTeams.includes(team) ? '#ef4444' : 'transparent',
                    color: lockedNFLTeams.includes(team) ? '#fff' : '#aaa',
                    borderColor: lockedNFLTeams.includes(team) ? '#ef4444' : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.1s'
                  }}
                >
                  {team}
                </button>
              ))}
            </div>
          </div>

          {myTeam ? (
            <Roster
              team={myTeam}
              lockedTeams={lockedNFLTeams}
              gameStatuses={gameStatuses}
              swapCandidate={swapCandidate}
              shakingPlayerId={shakingPlayerId}
              onSelectSlot={(slotId) => {
                if (swapCandidate) executeSwap(null, slotId);
                else setRecruitingSlot(slotId);
              }}
              onSelectPlayer={(player) => {
                if (swapCandidate) {
                  if (swapCandidate.id === player.id) setSwapCandidate(null);
                  else executeSwap(player);
                } else {
                  setActivePlayerCard(player);
                }
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'white', padding: 50 }}>
              <h2 style={{ color: '#eab308' }}>Restricted Access</h2>
              <p>Please Log In to manage your lineup.</p>
              <button onClick={() => setActiveView('dashboard')} style={{ marginTop: 20, padding: '10px 20px', cursor: 'pointer', background: '#eab308', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>Go to Login</button>
            </div>
          )}
        </div>
      )}

      {activeView === 'league' && (
        <LeagueTable league={displayLeague} myTeamName={myTeam?.name} />
      )}

      {activeView === 'rules' && <RulesPage />}
      {activeView === 'h2h' && (
        <H2HPage
          userTeam={myTeam}
          allTeams={userTeams}
          allPlayers={availablePlayers}
          league={league}
          isAdmin={isAdmin}
          onLeagueChange={setLeague}
          onTeamsChange={setUserTeams}
        />
      )}

      {activeView === 'players' && (
        <PlayersPage
          players={availablePlayers}
          onAddPlayers={(newPlayers) => {
            if (!myTeam) return;
            const updatedTeam = { ...myTeam, bench: [...myTeam.bench, ...newPlayers] };
            setUserTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t));
          }}
          onMakeOffer={handleOpenTradeOffer}
          onUpdatePlayer={(updated) =>
            setAvailablePlayers(prev => prev.map(p => p.id === updated.id ? updated : p))
          }
        />
      )}

      {activeView === 'projections' && <SeasonProjectionsDashboard />}

      {activeView === 'archive' && (
        <SeasonArchivePage
          league={displayLeague}
          allTeams={userTeams}
          players={availablePlayers}
          isAdmin={isAdmin}
          onLeagueChange={setLeague}
        />
      )}

      {activeView === 'network' && (
        <NetworkPage />
      )}

      {activeView === 'trade' && myTeam && (
        <TradeCenter
          userTeam={myTeam}
          allTeams={userTeams}
          allPlayers={availablePlayers}
          isAdmin={isAdmin}
          onAccept={handleAcceptOffer}
          onDecline={handleDeclineOffer}
          onCancel={handleCancelMyOffer}
          onCounterOffer={(offer, counterAmount, buyerTeam) => {
            setUserTeams(prev => prev.map(t =>
              t.id === buyerTeam.id
                ? { ...t, transactions: (t.transactions || []).map(tx => tx.id === offer.id ? { ...tx, amount: counterAmount, description: `Counter: ${counterAmount} PTS for ${offer.playerName}` } : tx) }
                : t
            ));
          }}
          onAdminForceAccept={handleAdminForceAccept}
          onAdminForceCancel={handleAdminForceCancel}
        />
      )}

      {activeView === 'draft' && (
        <DraftSimulator
          allPlayers={availablePlayers}
          myTeam={myTeam}
          onSaveTeam={(team) => setUserTeams(prev => [...prev, team])}
          onExit={() => setActiveView('league')}
        />
      )}

      {activeView === 'waiver' && myTeam && (
        <WaiverPage
          allPlayers={availablePlayers}
          allTeams={userTeams}
          myTeam={ensureWaiverFields(myTeam, userTeams.indexOf(myTeam) + 1)}
          isAdmin={isAdmin}
          onUpdateTeam={(updated) => setUserTeams(prev => prev.map(t => t.id === updated.id ? updated : t))}
          onProcessWaivers={() => setUserTeams(prev => processWaivers(
            prev.map((t, i) => ensureWaiverFields(t, i + 1)),
            availablePlayers
          ))}
        />
      )}

      {activeView === 'settings' && (
        <SettingsPage
          teams={userTeams}
          activeTeamId={activeTeamId}
          isAdmin={isAdmin}
          onResetOwnerPassword={async (teamId: string, newPassword?: string) => {
            // Hash the new password before storing; clear it if empty (removes lock)
            const { IdentityService } = await import('./services/IdentityService');
            const hashed = newPassword ? await IdentityService.hashPassword(newPassword) : '';
            setUserTeams(prev => prev.map(t => t.id === teamId ? { ...t, password: hashed } : t));
          }}
          onToggleAdmin={async () => {
            if (isAdmin) { setIsAdmin(false); return; }
            const { IdentityService } = await import('./services/IdentityService');

            // ── Lockout check ──────────────────────────────────────────────
            // Block login if currently in a backoff period from failed attempts.
            const now = Date.now();
            if (adminLockoutUntil.current > now) {
              const secsLeft = Math.ceil((adminLockoutUntil.current - now) / 1000);
              showAlert(`Too many failed attempts. Try again in ${secsLeft} seconds.`, 'Locked Out');
              return;
            }

            // First run — no password has ever been set. Guide commissioner through setup.
            if (!adminPasswordHash.current) {
              await showAlert(
                "No Commissioner password is set. You'll create one now.",
                "First-Time Setup"
              );
              const newPass = await showPrompt("Create a Commissioner password:", "Set Password", { placeholder: "Choose a strong password" });
              if (!newPass || !newPass.trim()) return;
              const confirm = await showPrompt("Confirm your password:", "Confirm Password", { placeholder: "Re-enter password" });
              if (newPass !== confirm) {
                showAlert("Passwords don't match. Try again.", "Mismatch");
                return;
              }
              const hashed = await IdentityService.hashPassword(newPass);
              localStorage.setItem('trier_admin_pass', hashed);
              adminPasswordHash.current = hashed;
              // Successful setup counts as a clean slate
              adminLoginAttempts.current = 0;
              adminLockoutUntil.current  = 0;
              setIsAdmin(true);
              showAlert("Commissioner password set. You are now logged in.", "Password Created");
              return;
            }

            const code = await showPrompt("Enter the Commissioner password:", "Commissioner Login", { placeholder: "Password" });
            if (!code) return;

            const ok = await IdentityService.verifyPassword(code, adminPasswordHash.current);
            if (ok) {
              // Success — reset attempt counter and migrate hash to PBKDF2 if still on legacy format
              adminLoginAttempts.current = 0;
              adminLockoutUntil.current  = 0;
              if (!adminPasswordHash.current.startsWith('pbkdf2:')) {
                // Opportunistic migration: re-hash with PBKDF2 now that we have the plaintext
                try {
                  const upgraded = await IdentityService.hashPassword(code);
                  localStorage.setItem('trier_admin_pass', upgraded);
                  adminPasswordHash.current = upgraded;
                  console.log('[App] Admin password migrated to PBKDF2.');
                } catch { /* non-fatal — old hash still works */ }
              }
              setIsAdmin(true);
            } else {
              // Failure — apply exponential backoff: 5s, 30s, 5min for attempts 1/2/3+
              adminLoginAttempts.current += 1;
              const attempt = adminLoginAttempts.current;
              const delayMs = attempt >= 3 ? 300_000 : attempt === 2 ? 30_000 : 5_000;
              adminLockoutUntil.current = Date.now() + delayMs;
              const delayLabel = attempt >= 3 ? '5 minutes' : attempt === 2 ? '30 seconds' : '5 seconds';
              showAlert(`Incorrect password. Too many failures — locked for ${delayLabel}.`, 'Access Denied');
            }
          }}
          onSwitchTeam={async (teamId: string, password?: string) => {
            if (teamId === activeTeamId) return;
            const target = userTeams.find(t => t.id === teamId);
            // Admin always bypasses; no-password teams are open; otherwise verify PBKDF2 hash
            if (isAdmin || !target?.password) {
              setActiveTeamId(teamId);
              setActiveView('dashboard');
              return;
            }
            if (password === undefined) {
              showAlert("A password is required to access this team.", "Password Required");
              return;
            }
            const { IdentityService } = await import('./services/IdentityService');
            const ok = await IdentityService.verifyPassword(password, target.password);
            if (ok) {
              setActiveTeamId(teamId);
              setActiveView('dashboard');
            } else {
              showAlert("Incorrect password. Access denied.", "Wrong Password");
            }
          }}
          onDeleteTeam={deleteTeam}
          onUpdateDetails={updateTeamDetails}
          onCreateTeam={createNewTeam}
          peers={peers.map(p => p.id)} // Pass ID strings as expected by SettingsPage
          connectedPeers={connectedPeers}
          onImportTeam={handleImport}
          lockedNFLTeams={lockedNFLTeams}
          onToggleLock={(team) => setLockedNFLTeams(prev => prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team])}
          onLockAll={() => setLockedNFLTeams([...NFL_TEAMS])}
          onUnlockAll={() => setLockedNFLTeams([])}
          onFetchSchedule={async () => {
            const { lockedTeams, statuses } = await fetchLiveGameData();
            setLockedNFLTeams(lockedTeams);
            setGameStatuses(statuses);
            showAlert(
              lockedTeams.length > 0
                ? `${lockedTeams.length} teams are currently in active games: ${lockedTeams.join(', ')}`
                : 'No NFL games are in progress right now. All rosters are open.',
              lockedTeams.length > 0 ? 'Teams Locked' : 'No Active Games'
            );
          }}
          scoringRuleset={league.settings?.ruleset ?? SCORING_PRESETS.PPR}
          onUpdateRuleset={handleUpdateRuleset}
        />
      )}

      {/* Modals */}
      <PlayerSelector
        isOpen={!!recruitingSlot}
        targetSlotId={recruitingSlot}
        availablePlayers={availablePlayers}
        onClose={() => setRecruitingSlot(null)}
        onSelect={(player) => addToRoster(player, recruitingSlot!)}
      />

      {activePlayerCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '90%', maxWidth: '400px', height: '90%' }}>
            <PlayerTradingCard
              player={activePlayerCard}
              owningTeam={userTeams.find(t => [...Object.values(t.roster), ...t.bench].some(p => p && p.id === activePlayerCard.id))}
              onClose={() => setActivePlayerCard(null)}
              onDraft={async () => {
                if (activePlayerCard.ownerId && activePlayerCard.ownerId !== myTeam?.id) {
                  await showAlert("This player is owned by another coach. Use 'Make Trade Offer' instead.", "Player Owned");
                  return;
                }
                if (isPlayerLocked(activePlayerCard, lockedNFLTeams)) {
                  await showAlert("Cannot modify roster — this player's game is in progress.", "Player Locked");
                  return;
                }
                const isOwnedByMe = Object.values(myTeam?.roster || {}).concat(myTeam?.bench || []).some(p => p && p.id === activePlayerCard.id);
                if (isOwnedByMe) {
                  RemoveFromRoster(activePlayerCard);
                } else {
                  addToRoster(activePlayerCard, recruitingSlot || 'bench-0');
                }
                setActivePlayerCard(null);
                setRecruitingSlot(null);
              }}
              onSwapSlot={() => {
                movePlayer(activePlayerCard);
                setActivePlayerCard(null);
              }}
              isDrafted={Object.values(myTeam?.roster || {}).concat(myTeam?.bench || []).some(p => p && p.id === activePlayerCard.id)}
              actionLabel={Object.values(myTeam?.roster || {}).concat(myTeam?.bench || []).some(p => p && p.id === activePlayerCard.id) ? "Release Player" : "Draft Player"}
              actionColor={Object.values(myTeam?.roster || {}).concat(myTeam?.bench || []).some(p => p && p.id === activePlayerCard.id) ? "#ef4444" : "#2563eb"}
              teamTransactions={myTeam?.transactions?.filter(t => t.playerName?.includes(activePlayerCard.lastName))}
              onMakeOffer={activePlayerCard.ownerId && activePlayerCard.ownerId !== myTeam?.id ? () => setSubmittingTradeFor(activePlayerCard) : undefined}
            />
          </div>
        </div>
      )}

      {submittingTradeFor && myTeam && (
        <TradeOfferModal
          player={submittingTradeFor}
          userTeam={myTeam}
          onClose={() => setSubmittingTradeFor(null)}
          onSubmit={handleMakeOffer}
        />
      )}

    </Layout_Dashboard>
    </>
  );
}
