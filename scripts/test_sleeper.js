// import fetch from 'node-fetch'; // Native in Node 18+

async function checkSleeper() {
    console.log('Fetching Sleeper API data...');
    try {
        const response = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (!response.ok) throw new Error(`Status: ${response.status}`);

        const data = await response.json();
        const keys = Object.keys(data);
        console.log(`Successfully fetched ${keys.length} players.`);

        // Show sample of a known player (e.g., Patrick Mahomes) to verify schema
        const sampleId = keys.find(k => data[k].search_full_name === 'patrickmahomes' || data[k].last_name === 'Mahomes');
        const sample = sampleId ? data[sampleId] : data[keys[0]];

        console.log('Sample Player Data:');
        console.log(JSON.stringify(sample, null, 2));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkSleeper();
