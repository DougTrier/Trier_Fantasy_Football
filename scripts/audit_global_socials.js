import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const players = require('../src/data/all_players_pool.json');
const socialHandles = require('../src/data/social_handles.json');

const handleMap = new Set(socialHandles.map(s => String(s.player_id)));

// Filter for ALL missing players
const audit = players.map(p => {
    const idStr = String(p.id);
    const espnIdStr = p.espnId ? String(p.espnId) : null;
    const hasSocials = handleMap.has(idStr) || (espnIdStr && handleMap.has(espnIdStr));

    return {
        name: `${p.firstName} ${p.lastName}`,
        id: p.id,
        espnId: p.espnId,
        team: p.team,
        position: p.position,
        proj: p.projectedPoints || 0,
        hasSocials: hasSocials
    };
});

const missing = audit.filter(p => !p.hasSocials && p.proj > 100); // Filter for verified relevance (starters/flex)
const missingSorted = missing.sort((a, b) => b.proj - a.proj).slice(0, 50); // Top 50 missing

console.log(`Total Players Audited: ${audit.length}`);
console.log(`Total Missing (All): ${audit.filter(p => !p.hasSocials).length}`);
console.log(`Total Missing (Relevant > 100pts): ${missing.length}`);
console.log('\n--- Top 20 Priority Targets ---');
console.log(JSON.stringify(missingSorted.slice(0, 20), null, 2));
