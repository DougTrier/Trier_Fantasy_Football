import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VERIFIED_DATA = path.resolve(__dirname, '../src/data/verified_videos.json');

(async () => {
    console.log("Starting Playback Reliability Test...");

    // 1. Load Verified IDs
    let validIds = [];
    try {
        const data = JSON.parse(fs.readFileSync(VERIFIED_DATA, 'utf8'));
        validIds = data.safe;
    } catch (e) {
        console.warn("Could not load verified_videos.json. Using fallback.");
        validIds = ['M7lc1UVf-VE', 'dQw4w9WgXcQ'];
    }

    if (validIds.length === 0) {
        console.error("No verified videos to test!");
        process.exit(1);
    }

    // Pick 5 random (or all if < 5)
    const testSet = validIds.sort(() => 0.5 - Math.random()).slice(0, 5);
    console.log(`Testing Playback for: ${testSet.join(', ')}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
    });
    const page = await browser.newPage();

    // 2. Inject a Minimal Test Page
    // We create a data URI that loads the YouTube Iframe API and tries to play the video.
    // This isolates the library/network from the React app complexity to verify "Basic Playability".

    let passedCount = 0;

    for (const id of testSet) {
        process.stdout.write(`Testing ${id}... `);

        try {
            const html = `
                <html>
                <body>
                    <div id="player"></div>
                    <script>
                        var tag = document.createElement('script');
                        tag.src = "https://www.youtube.com/iframe_api";
                        var firstScriptTag = document.getElementsByTagName('script')[0];
                        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

                        var player;
                        function onYouTubeIframeAPIReady() {
                            console.log("API Ready");
                            player = new YT.Player('player', {
                                height: '390',
                                width: '640',
                                videoId: '${id}',
                                playerVars: {
                                    'autoplay': 1,
                                    'muted': 1,
                                    'controls': 0,
                                    'origin': 'http://localhost'
                                },
                                events: {
                                    'onReady': onPlayerReady,
                                    'onStateChange': onPlayerStateChange,
                                    'onError': onPlayerError
                                }
                            });
                        }

                        function onPlayerReady(event) {
                            console.log("Player Ready");
                            event.target.mute();
                            event.target.playVideo();
                        }

                        function onPlayerStateChange(event) {
                            if (event.data == 1) window.reportStatus('PLAYING');
                        }

                        function onPlayerError(event) {
                            window.reportStatus('ERROR_' + event.data);
                        }
                    </script>
                </body>
                </html>
            `;

            await page.goto(`data:text/html,${encodeURIComponent(html)}`, { waitUntil: 'networkidle0' });

            // Expose a binding to capture the status
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => resolve('TIMEOUT'), 10000);

                page.exposeFunction('reportStatus', (status) => {
                    clearTimeout(timeout);
                    resolve(status);
                }).catch(() => { }); // If already exposed, ignore
            });

            if (result === 'PLAYING') {
                console.log("✅ PLAYING");
                passedCount++;
            } else {
                console.log(`❌ FAILED (${result})`);
            }

        } catch (e) {
            console.log(`❌ ERROR (${e.message})`);
        }
    }

    console.log(`\nResults: ${passedCount}/${testSet.length} Passed.`);
    await browser.close();

    if (passedCount === testSet.length) {
        process.exit(0);
    } else {
        process.exit(1);
    }

})();
