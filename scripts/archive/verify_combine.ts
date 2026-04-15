
import { mockPlayers } from '../src/data/mockDB';

console.log('Verifying Combine Stats Data Injection...');

const checkPlayer = (name: string, id: string) => {
    // Loose match by ID or Name
    const player = mockPlayers.find(p => p.id === id || (p.firstName + ' ' + p.lastName) === name);

    console.log(`\nChecking ${name} (${id})...`);

    if (!player) {
        console.error(`❌ Player not found!`);
        return;
    }

    if (player.combineStats) {
        console.log(`✅ Combine Stats found!`);
        console.log(`   Detailed Data:`);
        console.log(`   - Height: ${player.combineStats.measurements.height_in}"`);
        console.log(`   - Weight: ${player.combineStats.measurements.weight_lb} lbs`);

        if (player.combineStats.forty_yard) {
            console.log(`   - 40-Yard: ${player.combineStats.forty_yard}s`);
        } else {
            console.log(`   - 40-Yard: N/A (Opted out or Null)`);
        }

        if (player.combineStats.source_url) {
            console.log(`   - Source: Verified`);
        }
    } else {
        console.error(`❌ No Combine Stats attached.`);
    }
};

// 1. Check Jayden Daniels (Control - Opt Out)
checkPlayer('Jayden Daniels', '11566');

// 2. Check Xavier Worthy (New Batch - Record Holder)
checkPlayer('Xavier Worthy', '11624');

// 3. Check Adonai Mitchell (New Batch - Broad Jump)
checkPlayer('Adonai Mitchell', '11625');
