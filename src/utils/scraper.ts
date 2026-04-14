// scraper.ts - Multi-Source Player Data Fetcher
import type { Player } from '../types';

// Helper to strip HTML tags and decode entities
const cleanText = (html: string) => {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html.replace(/<(br|div|p|li)[^>]*>/gi, ' ');
    return (temp.textContent || '').replace(/\s+/g, ' ').trim();
};

// Global Throttler: Ensures we don't hit proxies too fast
let lastRequestTime = 0;
const MIN_REQUEST_GAP = 1200; // 1.2s between calls

const throttle = async () => {
    const now = Date.now();
    const wait = Math.max(0, lastRequestTime + MIN_REQUEST_GAP - now);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastRequestTime = Date.now();
};

export interface ScrapedBio {
    height?: string;
    weight?: string;
    age?: string;
    college?: string;
    financials?: {
        nflContract: {
            amount: number;
            year: number;
        };
        lifetimeEarnings: number;
    };
    stats?: {
        passingYards?: string;
        passingTDs?: string;
        rushingYards?: string;
        rushingTDs?: string;
        receivingYards?: string;
        receivingTDs?: string;
        receptions?: string;
    };
}

export interface ScraperOptions {
    skipGoogle?: boolean;
}

export const scrapePlayerStats = async (playerName: string, options: ScraperOptions = {}): Promise<Player['historicalStats'] | null> => {
    console.log(`[scraper] Scraping career stats for: ${playerName} ${options.skipGoogle ? '(Skipping Google)' : ''}`);

    // Strategy 1: Wikipedia Table Parsing (High Reliability)
    try {
        const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(playerName)}&limit=1&namespace=0&format=json&origin=*`;
        const wSearchRes = await fetch(wikiSearchUrl);
        const wSearchData = await wSearchRes.json();

        if (wSearchData[1] && wSearchData[1].length > 0) {
            const title = wSearchData[1][0];
            const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&origin=*&redirects=1`;
            const parseRes = await fetch(parseUrl);
            const parseData = await parseRes.json();

            if (parseData.parse?.text) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(parseData.parse.text['*'], 'text/html');

                // Look for tables with "Regular season" or "Career statistics"
                const tables = Array.from(doc.querySelectorAll('table.wikitable'));

                // Try to find the best table (Regular season + relevant stats)
                let statsTable = tables.find(t =>
                    t.textContent?.toLowerCase().includes('regular season') &&
                    (t.textContent?.toLowerCase().includes('passing') || t.textContent?.toLowerCase().includes('rushing'))
                );

                if (statsTable) {
                    const rows = Array.from(statsTable.querySelectorAll('tr'));

                    // Identify all header rows (usually 1 or 2)
                    const headerRows = rows.filter(r => r.querySelectorAll('th').length > 0);
                    if (headerRows.length === 0) return null;

                    // Build a flat mapping of labels to column indices
                    // We look at ALL headers to find the best match for each category
                    const headerMap: Record<string, number> = {};
                    headerRows.forEach(hRow => {
                        const ths = Array.from(hRow.querySelectorAll('th, td'));
                        ths.forEach((th, idx) => {
                            const text = th.textContent?.trim().toLowerCase() || '';

                            // Map specific keywords to indices
                            if (text.includes('year')) headerMap['year'] = idx;
                            if (text === 'gp' || text === 'g' || text === 'games') headerMap['gp'] = idx;

                            // For nested headers (e.g., Rushing -> Yds), we rely on cumulative index if colspan > 1
                            // But for simplicity, we'll try to find unique text first
                            if (text === 'att' || text === 'att.') headerMap['att'] = idx;
                            if (text === 'yds' || text === 'yds.') {
                                // Ambiguous! Check if parent or previous header was "Rushing" or "Receiving"
                                // Heuristic: Common Wiki order is Rushing then Receiving
                                if (headerMap['rushYds'] === undefined) headerMap['rushYds'] = idx;
                                else headerMap['recYds'] = idx;
                            }
                            if (text === 'td' || text === 'tds') {
                                if (headerMap['rushTD'] === undefined) headerMap['rushTD'] = idx;
                                else headerMap['recTD'] = idx;
                            }
                            if (text === 'receptions' || text === 'rec' || text === 'rec.') headerMap['rec'] = idx;

                            // Specific long versions
                            if (text.includes('rushing yards')) headerMap['rushYds'] = idx;
                            if (text.includes('rushing touchdowns')) headerMap['rushTD'] = idx;
                            if (text.includes('receiving yards')) headerMap['recYds'] = idx;
                            if (text.includes('receiving touchdowns')) headerMap['recTD'] = idx;
                        });
                    });

                    const careerStats: Player['historicalStats'] = [];
                    const dataRows = rows.filter(r => r.querySelectorAll('td').length > 5);

                    dataRows.forEach(row => {
                        const cols = Array.from(row.querySelectorAll('td, th')).map(c => c.textContent?.trim() || '');
                        const yearMatch = cols[headerMap['year']]?.match(/20\d{2}/);

                        if (yearMatch) {
                            const year = parseInt(yearMatch[0]);
                            const gp = parseInt(cols[headerMap['gp']]) || 16;

                            // Rushing
                            const rY = parseInt(cols[headerMap['rushYds']]?.replace(/,/g, '')) || 0;
                            const rT = parseInt(cols[headerMap['rushTD']]?.replace(/,/g, '')) || 0;

                            // Receiving
                            const recY = parseInt(cols[headerMap['recYds']]?.replace(/,/g, '')) || 0;
                            const recT = parseInt(cols[headerMap['recTD']]?.replace(/,/g, '')) || 0;
                            const recs = parseInt(cols[headerMap['rec']]?.replace(/,/g, '')) || 0;

                            if (year >= 2018 && year <= 2024) {
                                careerStats.push({
                                    year,
                                    gamesPlayed: gp,
                                    rushingYards: rY,
                                    rushingTDs: rT,
                                    receivingYards: recY,
                                    receivingTDs: recT,
                                    fantasyPoints: (rY * 0.1) + (rT * 6) + (recY * 0.1) + (recT * 6) + (recs * 1.0)
                                });
                            }
                        }
                    });

                    if (careerStats.length > 0) return careerStats;
                }
            }
        }
    } catch (e) {
        console.warn("[scraper] Wiki stats failed", e);
    }

    // Strategy 2: Google SERP Fallback (DISABLED TO PREVENT 429s)
    /*
    if (options.skipGoogle) return null;
    await throttle();

    try {
        const query = `${playerName} career stats by year passing rushing fantasy points`;
        const proxy = `https://corsproxy.io/?${encodeURIComponent(`https://www.google.com/search?q=${encodeURIComponent(query)}`)}`;
        const res = await fetch(proxy);
        const html = await res.text();
        
        // ... (Existing regex logic commented out) ...
        return null; 
    } catch (e) {
        console.error("[scraper] Stats scrape failed", e);
        return null;
    }
    */
    return null;
};

/**
 * Scrapes a player's headshot or card photo from various sources.
 * Returns a high-res URL or null.
 */
export const scrapePlayerPhoto = async (playerName: string, options: ScraperOptions = {}): Promise<string | null> => {
    // 1. CHECK LOCAL CACHE FIRST
    try {
        const cache = JSON.parse(localStorage.getItem('tff_photo_cache') || '{}');
        if (cache[playerName]) {
            console.log(`[scraper] Returning cached photo for: ${playerName}`);
            return cache[playerName];
        }
    } catch (e) {
        console.warn("Cache read error", e);
    }

    console.log(`[scraper] Attempting photo recovery for: ${playerName} ${options.skipGoogle ? '(Skipping Google)' : ''}`);

    // Strategy 1: Wikipedia Page Image (High Reliability)
    try {
        const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(playerName)}&limit=1&namespace=0&format=json&origin=*`;
        const wSearchRes = await fetch(wikiSearchUrl);
        const wSearchData = await wSearchRes.json();

        if (wSearchData[1] && wSearchData[1].length > 0) {
            const title = wSearchData[1][0];
            // Use pageimages API for a clean, direct thumbnail
            const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=1000&origin=*`;
            const imgRes = await fetch(imgUrl);
            const imgData = await imgRes.json();

            const pages = imgData.query?.pages;
            if (pages) {
                const pageId = Object.keys(pages)[0];
                const thumb = pages[pageId].thumbnail?.source;
                if (thumb) {
                    console.log(`[scraper] Found Wikipedia thumbnail: ${thumb}`);
                    // SAVE TO CACHE
                    try {
                        const cache = JSON.parse(localStorage.getItem('tff_photo_cache') || '{}');
                        cache[playerName] = thumb;
                        localStorage.setItem('tff_photo_cache', JSON.stringify(cache));
                    } catch (e) { console.warn("Cache write error", e); }

                    return thumb;
                }
            }
        }
    } catch (e) {
        console.warn("[scraper] Wiki photo lookup failed", e);
    }

    if (options.skipGoogle) return null;
    await throttle();

    // Strategy 2: ESPN Headshot via Search Snippet
    try {
        const query = `${playerName} ESPN headshot full resolution`;
        const proxy = `https://corsproxy.io/?${encodeURIComponent(`https://www.google.com/search?q=${encodeURIComponent(query)}`)}`;
        const res = await fetch(proxy);
        const html = await res.text();

        // ESPN Headshot pattern: https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/3117251.png
        // Improved regex to handle potential URL encoding or slight variations
        const espnMatch = html.match(/https?:\/\/a\.espncdn\.com\/combiner\/i\?img=\/i\/headshots\/nfl\/players\/full\/\d+\.png/i);
        if (espnMatch) {
            console.log(`[scraper] Found ESPN headshot: ${espnMatch[0]}`);
            // SAVE TO CACHE
            try {
                const cache = JSON.parse(localStorage.getItem('tff_photo_cache') || '{}');
                cache[playerName] = espnMatch[0];
                localStorage.setItem('tff_photo_cache', JSON.stringify(cache));
            } catch (e) { console.warn("Cache write error", e); }
            return espnMatch[0];
        }

        // Fallback: Check for just the ID and rebuild
        const idMatch = html.match(/headshots\/nfl\/players\/full\/(\d+)\.png/i);
        if (idMatch) {
            const url = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${idMatch[1]}.png`;
            console.log(`[scraper] Rebuilt ESPN headshot from ID: ${url}`);
            // SAVE TO CACHE
            try {
                const cache = JSON.parse(localStorage.getItem('tff_photo_cache') || '{}');
                cache[playerName] = url;
                localStorage.setItem('tff_photo_cache', JSON.stringify(cache));
            } catch (e) { console.warn("Cache write error", e); }
            return url;
        }
    } catch (e) {
        console.warn("[scraper] ESPN photo lookup failed");
    }

    // Strategy 2: NFL.com / Sleeper Static Assets (Hardcoded Fallbacks)
    // Most players follow a predictable pattern if we had their NFL ID, but we don't always.

    // Strategy 3: eBay / Trading Card Fallback (Real High-Res Imagery)
    try {
        const query = `${playerName} donruss optic trading card site:ebay.com`;
        const proxy = `https://corsproxy.io/?${encodeURIComponent(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`)}`; // Image search
        const res = await fetch(proxy);
        const html = await res.text();

        // This is tricky without a headless browser for image search, but we might find img tags in the raw HTML
        const imgMatch = html.match(/https?:\/\/[^"']+\.(?:jpg|jpeg|png)(?=[^"']*ebayimg\.com)/i);
        if (imgMatch) {
            console.log(`[scraper] Found eBay card image: ${imgMatch[0]}`);
            return imgMatch[0];
        }
    } catch (e) {
        console.warn("[scraper] eBay card image lookup failed");
    }

    return null;
};

export const scrapePlayerBio = async (source: string, knownName?: string): Promise<ScrapedBio | null> => {
    console.log(`[scraper] Starting scrape for: ${source} (Known: ${knownName})`);

    // 1. Determine Player Name
    let playerName = '';

    if (source.includes('nfl.com/players/')) {
        const parts = source.split('/players/');
        if (parts[1]) {
            const slug = parts[1].split('/')[0];
            playerName = slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        }
    } else if (source.includes('wikipedia.org/wiki/')) {
        const parts = source.split('/wiki/');
        if (parts[1]) playerName = decodeURIComponent(parts[1]).replace(/_/g, ' ');
    } else if (source.includes('spotrac.com')) {
        // spotrac.com/nfl/player/_/id/19119/tyreek-hill
        const parts = source.split('/');
        const slug = parts[parts.length - 1] || parts[parts.length - 2];
        if (slug) playerName = slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    }

    // Priority 2: Use Known Name (Fallback)
    if (!playerName && knownName) {
        playerName = knownName;
    }

    // Priority 3: Assume Source IS the name (if it's not a URL)
    if (!playerName && !source.includes('http')) {
        playerName = source;
    }

    if (!playerName) {
        console.warn("[scraper] Could not determine player name.");
        return null;
    }

    const bio: ScrapedBio = {};

    // ============================================================
    // STRATEGY 1: GOOGLE SERP SCRAPE (Text Snippets)
    // ============================================================
    // We run two searches: one for Bio, one for Money.
    try {
        console.log(`[scraper] Google Search: ${playerName}`);

        // QUERY 1: Bio (Height, Weight, Age, College)
        const bioQuery = `${playerName} height weight age college`;
        // Encode ONLY the query param, pass full URL to proxy
        // corsproxy.io usage: https://corsproxy.io/?https://www.google.com...
        const bioProxy = `https://corsproxy.io/?${encodeURIComponent(`https://www.google.com/search?q=${encodeURIComponent(bioQuery)}`)}`;

        const bioRes = await fetch(bioProxy);
        const bioHtml = await bioRes.text(); // corsproxy returns raw text, not JSON wrapped

        if (bioHtml) {
            const html = bioHtml;
            // Google Snippets often formatted as: "5 ft 10 in" or "191 lbs"

            // Height
            const hMatch = html.match(/(\d+)\s*ft\s*(\d+)\s*in/i) || html.match(/(\d+)'\s*(\d+)"/);
            if (hMatch) {
                // If it's already in Ft/In, convert to inches for Sleeper-standard storage
                const inches = (parseInt(hMatch[1]) * 12) + parseInt(hMatch[2]);
                bio.height = inches.toString();
            } else {
                // Fallback for raw inches if found
                const rawInchesMatch = html.match(/(\d{2})\s*inches/i);
                if (rawInchesMatch) bio.height = rawInchesMatch[1];
            }

            // Weight
            const wMatch = html.match(/(\d{3})\s*(lb|lbs)/i) || html.match(/(\d{2,3})\s*kg/i);
            if (wMatch) bio.weight = wMatch[1];


            // Age - restricted to realistic range (18-50) to avoid "6 years experience"
            const ageMatch = html.match(/(\d{2})\s*years/i) || html.match(/Age\s*(\d{2})/i);
            if (ageMatch) {
                const ageVal = parseInt(ageMatch[1]);
                if (ageVal > 18 && ageVal < 50) bio.age = ageMatch[1];
            }

            // College
            // Look for "College: University of X" or similar structure in knowledge graph
            // This is harder in raw HTML, skipping for now to rely on Wiki for College.
        }

        // Rate Limit Prevention: Wait 1.5s before second proxy call
        await new Promise(resolve => setTimeout(resolve, 1500));

        // QUERY 2: Contract (Spotrac/OverTheCap snippet)
        const moneyQuery = `${playerName} contract spotrac`;
        const moneyProxy = `https://corsproxy.io/?${encodeURIComponent(`https://www.google.com/search?q=${encodeURIComponent(moneyQuery)}`)}`;

        const moneyRes = await fetch(moneyProxy);
        const moneyHtml = await moneyRes.text();

        if (moneyHtml) {
            const html = moneyHtml;
            // Look for "$30,000,000" patterns in close proximity to "average" or "contract"

            // Regex for dollar amounts greater than 1 million
            const moneyMatches = html.match(/\$\d{1,3}(,\d{3})*(,\d{3})/g);
            if (moneyMatches && moneyMatches.length > 0) {
                // Take the largest number found? Or the first?
                // Usually snippets show "signed a 3 year $X contract" or "avg salary $Y"
                // Let's grab the biggest number assuming it's total value, or a frequent large number

                // Clean and parse
                const values = moneyMatches.map(s => parseInt(s.replace(/[^0-9]/g, '')));
                const maxVal = Math.max(...values);

                // Heuristic: If maxVal > 1,000,000, assume it's a relevant contract number
                if (maxVal > 1000000) {
                    bio.financials = {
                        nflContract: {
                            amount: Math.round(maxVal / 3), // Rough guess: Total / 3 years = Avg? 
                            // Or just display the specific number if we found "Average"
                            year: new Date().getFullYear()
                        },
                        lifetimeEarnings: 0
                    };
                }
            }
        }

    } catch (e) {
        console.error("[scraper] Google scrape failed", e);
    }

    // ============================================================
    // STRATEGY 2: WIKIPEDIA API (Reliable Fallback & Stats)
    // ============================================================
    try {
        const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(playerName)}&limit=1&namespace=0&format=json&origin=*`;
        const wSearchRes = await fetch(wikiSearchUrl);
        const wSearchData = await wSearchRes.json();

        if (wSearchData[1] && wSearchData[1].length > 0) {
            const title = wSearchData[1][0];
            const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&origin=*&redirects=1`;
            const parseRes = await fetch(parseUrl);
            const parseData = await parseRes.json();

            if (parseData.parse?.text) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(parseData.parse.text['*'], 'text/html');
                const infobox = doc.querySelector('.infobox');

                if (infobox) {
                    const getRow = (keys: string[]) => {
                        const ths = Array.from(infobox.querySelectorAll('th'));
                        const found = ths.find(th => keys.some(k => th.textContent?.toLowerCase().includes(k.toLowerCase())));
                        if (found && found.nextElementSibling) {
                            return cleanText(found.nextElementSibling.innerHTML);
                        }
                    };

                    // Fill in gaps left by Google
                    if (!bio.height) {
                        const h = getRow(['Height']);
                        if (h) {
                            const imp = h.match(/(\d+)\s*ft\s*(\d+)\s*in/i);
                            if (imp) bio.height = `${imp[1]}-${imp[2]}`;
                        }
                    }
                    if (!bio.weight) {
                        const w = getRow(['Weight']);
                        if (w) {
                            const lb = w.match(/(\d+)\s*lb/i);
                            if (lb) bio.weight = `${lb[1]}lb`;
                        }
                    }
                    if (!bio.age) {
                        const d = getRow(['Date of birth', 'Born']);
                        const am = d?.match(/\(age\s*(\d+)\)/);
                        if (am) bio.age = am[1];
                    }
                    if (!bio.college) bio.college = getRow(['College', 'Education'])?.split(',')[0];

                    // Stats
                    bio.stats = {
                        receptions: getRow(['Receptions']),
                        receivingYards: getRow(['Receiving yards']),
                        receivingTDs: getRow(['Receiving touchdowns']),
                        rushingYards: getRow(['Rushing yards']),
                        rushingTDs: getRow(['Rushing touchdowns']),
                        passingYards: getRow(['Passing yards']),
                        passingTDs: getRow(['Passing touchdowns'])
                    };
                }
            }
        }
    } catch (e) {
        console.error("[scraper] Wiki failed", e);
    }

    console.log("[scraper] Final Bio:", bio);
    return bio;
};
