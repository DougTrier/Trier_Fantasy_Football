import { useCallback, useEffect, useRef, useState } from 'react';
import { GameLockStore } from '../services/GameLockStore';
import { fetchLiveGameData } from '../utils/gamedayLogic';
import { NotificationService } from '../services/NotificationService';

export function useGameLocks(isCommissioner: boolean) {
    const [store] = useState(() => new GameLockStore(localStorage));
    const admin = useRef(isCommissioner);
    admin.current = isCommissioner;
    const [view, setView] = useState(() => ({ lockedNFLTeams: store.getLockedTeams(), manualLockedNFLTeams: store.getManual(), gameStatuses: store.getStatuses() }));
    const published = useRef(JSON.stringify(view));
    const inFlight = useRef<Promise<boolean> | null>(null);

    const publish = useCallback(() => {
        const next = { lockedNFLTeams: store.getLockedTeams(), manualLockedNFLTeams: store.getManual(), gameStatuses: store.getStatuses() };
        const serialized = JSON.stringify(next);
        if (published.current === serialized) return;
        published.current = serialized;
        store.persist();
        setView(next);
    }, [store]);

    const refresh = useCallback((): Promise<boolean> => {
        if (inFlight.current) return inFlight.current;
        inFlight.current = (async () => {
            try {
                store.accept(await fetchLiveGameData());
                publish();
                return true;
            } catch (error) {
                console.warn('[GameLocks] Schedule unavailable; retaining existing locks.', error);
                return false;
            } finally { inFlight.current = null; }
        })();
        return inFlight.current;
    }, [store, publish]);

    useEffect(() => {
        void refresh();
        // Poll every day, including Saturday games and sessions crossing midnight.
        const poll = setInterval(() => { void refresh(); }, 60_000);
        // Cached kickoff times enforce locks even between API polls or during outages.
        const tick = setInterval(publish, 1_000);
        const focus = () => { publish(); void refresh(); };
        window.addEventListener('focus', focus);
        document.addEventListener('visibilitychange', focus);
        return () => {
            clearInterval(poll);
            clearInterval(tick);
            window.removeEventListener('focus', focus);
            document.removeEventListener('visibilitychange', focus);
        };
    }, [refresh, publish]);

    const previousLocks = useRef(view.lockedNFLTeams);
    useEffect(() => {
        const count = view.lockedNFLTeams.filter(team => !previousLocks.current.includes(team)).length;
        previousLocks.current = view.lockedNFLTeams;
        if (count) NotificationService.gamedayLock(count);
    }, [view.lockedNFLTeams]);

    const setManualLocks = useCallback((teams: string[] | ((previous: string[]) => string[])) => {
        if (!admin.current) return;
        store.setManual(typeof teams === 'function' ? teams(store.getManual()) : teams, admin.current);
        publish();
    }, [store, publish]);
    const getLockedTeams = useCallback(() => store.getLockedTeams(), [store]);
    return { ...view, setManualLocks, refresh, getLockedTeams };
}
