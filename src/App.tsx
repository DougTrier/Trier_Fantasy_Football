import { useState, useEffect, useMemo } from 'react';
import './index.css';
import type { Player, FantasyTeam, Transaction, League } from './types';
import { mockPlayers } from './data/mockDB';
import { LeagueTable } from './components/LeagueTable';
import { Roster } from './components/Roster';
import { Layout_Dashboard } from './components/Layout_Dashboard';
import { PlayerSelector } from './components/PlayerSelector';
import { PlayerTradingCard } from './components/PlayerTradingCard';
import { PlayersPage } from './components/PlayersPage';
import { RulesPage } from './components/RulesPage';
import { SettingsPage } from './components/SettingsPage';
import { H2HPage } from './components/H2HPage';
import { TradeOfferModal } from './components/TradeOfferModal';
import { TradeCenter } from './components/TradeCenter';
import { scrapePlayerStats, scrapePlayerPhoto } from './utils/scraper';
import stadiumBg from './assets/stadium_bg.png';
import leatherTexture from './assets/leather_texture.png';
import { isPlayerLocked, NFL_TEAMS } from './utils/gamedayLogic';

import { Lock } from 'lucide-react';
import { SyncService } from './utils/SyncService';
import type { SidebandMessage } from './utils/SyncService';
import { DiscoveryService, type DiscoveredPeer } from './services/DiscoveryService';
import { P2PService } from './services/P2PService';
import { IdentityService } from './services/IdentityService';
import { NetworkPage } from './components/NetworkPage';
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
  const [userTeams, setUserTeams] = useState<FantasyTeam[]>(() => {
    const saved = localStorage.getItem('trier_fantasy_all_teams_v3');
    try {
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Normalize EVERY loaded team immediately
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
  const [lockedNFLTeams, setLockedNFLTeams] = useState<string[]>([]);
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [hasNewOffers, setHasNewOffers] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');

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
      }
    };

    SyncService.addListener(handleMsg);
    SyncService.ping();

    // Broadcast changes
    SyncService.syncTeams(userTeams);



    // Auto-Sync on Connect
    const unsubConn = P2PService.onConnectionStatus(({ status, peerId }) => {
      if (status === 'CONNECTED') {
        console.log(`[App] Auto-syncing with new peer ${peerId}`);
        SyncService.syncTeams(teamRef);
      }
    });

    // Remote Control Handler
    const unsubControl = P2PService.onData(async (msg: any) => {
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

  // Track Connected Peers
  useEffect(() => {
    const updateConnected = () => {
      const active = Array.from(P2PService.connections.values())
        .filter(c => c.state === 'CONNECTED')
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

  // Save on Change
  useEffect(() => {
    localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify(userTeams));
    sessionStorage.setItem('trier_fantasy_active_id', activeTeamId);
    // Also update localStorage as a fallback for the primary window
    localStorage.setItem('trier_fantasy_active_id', activeTeamId);
  }, [userTeams, activeTeamId]);

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

  // Incoming Trade Offer Notification Engine
  useEffect(() => {
    if (!myTeam) return;

    // Check if there are any incoming offers in other teams' transactions that target my players
    const incomingOffers = userTeams.flatMap(team =>
      (team.transactions || []).filter(tx =>
        tx.type === 'TRADE_OFFER' &&
        tx.targetPlayerId &&
        [...Object.values(myTeam.roster), ...myTeam.bench].some(p => p && p.id === tx.targetPlayerId)
      )
    );

    if (incomingOffers.length > 0 && activeView !== 'trade') {
      setHasNewOffers(true);
    } else {
      setHasNewOffers(false);
    }
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

  const updateActiveTeam = (updater: (prev: FantasyTeam) => FantasyTeam) => {
    setUserTeams(prev => prev.map(t => t.id === activeTeamId ? updater(t) : t));
  };

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

  const [isAdmin, setIsAdmin] = useState(false); // Global Admin Mode
  const [adminPassword] = useState(localStorage.getItem('trier_admin_pass') || 'Elliot126d9u2');

  const createNewTeam = (name: string, ownerName: string, password?: string) => {
    const newTeam: FantasyTeam = {
      ...formatInitialTeam(),
      id: `team - ${Date.now()} `,
      name,
      ownerName,
      password // Store password
    };
    setUserTeams(prev => [...prev, newTeam]);
    setActiveTeamId(newTeam.id);
  };

  const deleteTeam = (teamId: string) => {
    if (!isAdmin) return; // Safeguard
    setUserTeams(prev => {
      if (prev.length <= 1) {
        alert("Cannot delete the only team in the league. Create another team first.");
        return prev;
      }
      const remaining = prev.filter(t => t.id !== teamId);
      if (activeTeamId === teamId && remaining.length > 0) {
        setActiveTeamId(remaining[0].id);
      }
      return remaining;
    });
  };

  const updateTeamDetails = (teamId: string, name: string, owner: string, password?: string) => {
    setUserTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, name, ownerName: owner, ...(password !== undefined ? { password } : {}) } : t
    ));
  };

  const handleSaveAndClose = async () => {
    console.log("[App] Executing Save and Close Protocol...");

    // 1. FORCE SYNCHRONOUS SAVE
    localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify(userTeams));
    localStorage.setItem('trier_fantasy_active_id', ''); // Log out for security

    // 2. TAURI EXIT (DESKTOP)
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
      alert("Changes Saved. You are now logged out. Please close this tab manually.");
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


  // League State (Standings)
  const [league] = useState<League>({
    id: 'league-1',
    name: "Trier's Fantasy League",
    teams: [],
    history: []
  });

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
      h.year === 2025 ? { ...h, points: myPoints } : h
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
      alert(`Player Already Selected by ${owner.ownerName} (${owner.name})`);
      return;
    }

    updateActiveTeam(prev => {
      const newRoster = { ...prev.roster };
      let newBench = [...prev.bench];
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
      alert(`${player.firstName} ${player.lastName} is currently playing and is locked in the lineup.`);
      return;
    }
    setSwapCandidate(player);
    setActivePlayerCard(null);
  };

  const isValidSwap = (candidate: Player, targetSlot: string, targetPlayer: Player | null, currentRoster: any): { valid: boolean; reason?: string } => {
    if (targetSlot.startsWith('bench')) return { valid: true };

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

  const executeSwap = (targetPlayer: Player | null, targetSlot?: string) => {
    if (!swapCandidate) return;

    // Check if swapCandidate is locked
    if (isPlayerLocked(swapCandidate, lockedNFLTeams)) {
      alert(`${swapCandidate.firstName} ${swapCandidate.lastName} is locked.`);
      setSwapCandidate(null);
      return;
    }

    // Check if targetPlayer is locked (if we are swapping with another player)
    if (targetPlayer && isPlayerLocked(targetPlayer, lockedNFLTeams)) {
      alert(`${targetPlayer.firstName} ${targetPlayer.lastName} is locked.`);
      setSwapCandidate(null);
      return;
    }

    updateActiveTeam(prev => {
      const effectiveTargetSlot = targetSlot || Object.keys(prev.roster).find(k => (prev.roster as any)[k]?.id === targetPlayer?.id) || 'bench';
      const validation = isValidSwap(swapCandidate, effectiveTargetSlot, targetPlayer, prev.roster);

      if (!validation.valid) {
        alert(validation.reason);
        return prev;
      }

      const sourceStarterSlot = Object.keys(prev.roster).find(k => (prev.roster as any)[k]?.id === swapCandidate.id);
      let newRoster = { ...prev.roster } as any;
      let newBench = [...prev.bench];

      // 1. Remove source from where they were
      if (sourceStarterSlot) {
        newRoster[sourceStarterSlot] = null;
      } else {
        newBench = newBench.filter(p => p.id !== swapCandidate.id);
      }

      // 2. Perform Swap
      if (targetPlayer) {
        const targetStarterSlot = Object.keys(prev.roster).find(k => (prev.roster as any)[k]?.id === targetPlayer.id);

        if (targetStarterSlot) {
          newRoster[targetStarterSlot] = swapCandidate;
        } else {
          newBench.push(swapCandidate);
        }

        if (sourceStarterSlot) {
          newRoster[sourceStarterSlot] = targetPlayer;
        } else {
          newBench = newBench.filter(p => p.id !== targetPlayer.id);
          newBench.push(targetPlayer);
        }
      } else if (targetSlot) {
        if (targetSlot.startsWith('bench')) {
          newBench.push(swapCandidate);
        } else {
          newRoster[targetSlot] = swapCandidate;
        }
      }

      // FINAL DEDUPLICATION
      const uniqueBench = Array.from(new Map(newBench.map(p => [p.id, p])).values());

      // RECORD SWAP
      const desc = targetPlayer
        ? `Swapped ${swapCandidate.lastName} with ${targetPlayer.lastName} `
        : `Moved ${swapCandidate.lastName} to ${effectiveTargetSlot.toUpperCase()} `;

      recordTransaction('SWAP', desc, swapCandidate.lastName);

      return { ...prev, roster: newRoster, bench: uniqueBench };
    });

    setSwapCandidate(null);
  };

  const handleImport = (importedTeam: FantasyTeam) => {
    setUserTeams(prev => {
      const exists = prev.find(t => t.id === importedTeam.id);
      if (exists) {
        if (confirm(`Team "${importedTeam.name}"(ID: ${importedTeam.id}) already exists.Overwrite ? `)) {
          return prev.map(t => t.id === importedTeam.id ? importedTeam : t);
        }
        return prev;
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
      transactions: (offeringTeam.transactions || []).map(t => t.id === offer.id ? { ...t, type: 'ADD' as any } : t).concat(buyerTx)
    };

    // 4. Persistence
    setUserTeams(prev => prev.map(t => {
      if (t.id === updatedSeller.id) return updatedSeller;
      if (t.id === updatedBuyer.id) return updatedBuyer;
      return t;
    }));

    setAvailablePlayers(prev => prev.filter(p => p.id !== playerToTrade.id));
    alert(`${playerToTrade.lastName} has been traded to ${offeringTeam.name}!`);
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
    alert("Trade offer declined and points returned to coach.");
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

  return (
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
            <p style={{ fontSize: 'clamp(0.9rem, 2vh, 1.2rem)', color: '#d1d5db', maxWidth: '700px', margin: '0 auto clamp(20px, 4vh, 40px)', lineHeight: '1.6' }}>
              Welcome to the official **Trier Fantasy League** management suite.
              Scout players, check league standings, or create your elite franchise to start competing.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '900px', margin: '0 auto' }}>
              {userTeams.filter(t => t.id !== 'guest').map(t => (
                <div key={t.id} onClick={() => {
                  if (t.password && !isAdmin) {
                    const p = prompt(`Enter password for ${t.name}: `);
                    if (p === t.password) setActiveTeamId(t.id);
                    else alert("Incorrect Password");
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
              swapCandidate={swapCandidate}
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
        <LeagueTable league={displayLeague} />
      )}

      {activeView === 'rules' && <RulesPage />}
      {activeView === 'h2h' && (
        <H2HPage userTeam={myTeam} allTeams={userTeams} allPlayers={availablePlayers} />
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
        />
      )}

      {activeView === 'network' && (
        <NetworkPage />
      )}

      {activeView === 'trade' && myTeam && (
        <TradeCenter
          userTeam={myTeam}
          allTeams={userTeams}
          onAccept={handleAcceptOffer}
          onDecline={handleDeclineOffer}
          onCancel={handleCancelMyOffer}
        />
      )}

      {activeView === 'settings' && (
        <SettingsPage
          teams={userTeams}
          activeTeamId={activeTeamId}
          isAdmin={isAdmin}
          onResetOwnerPassword={(teamId: string, newPassword?: string) => {
            setUserTeams(prev => prev.map(t => t.id === teamId ? { ...t, password: newPassword || '' } : t));
          }}
          onToggleAdmin={() => {
            if (!adminPassword) {
              alert("Please set an Admin Password in Settings first!");
              return;
            }
            if (isAdmin) setIsAdmin(false);
            else {
              const code = prompt("Enter Admin Password:");
              if (code === adminPassword) setIsAdmin(true);
              else alert("Incorrect Password");
            }
          }}
          onSwitchTeam={(teamId: string, password?: string) => {
            if (teamId === activeTeamId) return;
            const target = userTeams.find(t => t.id === teamId);
            if (isAdmin || !target?.password || (password !== undefined && password === target.password)) {
              setActiveTeamId(teamId);
              setActiveView('dashboard');
            } else {
              alert("Incorrect Password!");
            }
          }}
          onDeleteTeam={deleteTeam}
          onUpdateDetails={updateTeamDetails}
          onCreateTeam={createNewTeam}
          peers={peers.map(p => p.id)} // Pass ID strings as expected by SettingsPage
          connectedPeers={connectedPeers}
          onImportTeam={handleImport}
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
              onDraft={() => {
                if (activePlayerCard.ownerId && activePlayerCard.ownerId !== myTeam?.id) {
                  alert("This player is owned by another coach. Use 'Make Trade Offer' instead.");
                  return;
                }
                if (isPlayerLocked(activePlayerCard, lockedNFLTeams)) {
                  alert("Cannot modify roster for players in active games.");
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
  );
}
