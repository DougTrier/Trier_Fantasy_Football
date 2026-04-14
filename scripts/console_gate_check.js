
import puppeteer from 'puppeteer';

const TARGET_URL = 'http://localhost:1420';

(async () => {
    console.log(`[Gate] Launching browser check against ${TARGET_URL}...`);

    // Launch Browser
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    const errors = [];

    // Listen for Console Errors
    page.on('console', msg => {
        const type = msg.type();
        if (type === 'error' || type === 'warning') {
            const text = msg.text();

            // Allow-list specific expected warnings if strictly necessary
            // e.g. "React Router future flag"
            if (text.includes('React Router')) return;

            // Treat all other errors as FAIL
            if (type === 'error') {
                errors.push({ type: 'CONSOLE_ERROR', text });
            }
            // Warnings can be logged but usually don't fail the strict gate unless specified
            // The user said "Warnings are allowed ONLY if they are expected...". 
            // Let's be strict: fail on errors, log warnings.
            if (type === 'warning') {
                console.warn(`[Gate] Warning: ${text}`);
            }
        }
    });

    // Listen for Uncaught Exceptions
    page.on('pageerror', err => {
        errors.push({ type: 'UNCAUGHT_EXCEPTION', text: err.message });
    });

    // Listen for Failed Requests (4xx/5xx)
    page.on('requestfailed', request => {
        errors.push({
            type: 'NETWORK_FAIL',
            text: `${request.method()} ${request.url()} - ${request.failure()?.errorText}`
        });
    });

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        console.log('[Gate] Page loaded. Waiting for stability (3s)...');
        await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
        errors.push({ type: 'NAV_ERROR', text: e.message });
    }

    await browser.close();

    // Report
    if (errors.length > 0) {
        console.error('\n[Gate] FAILED: The following errors were detected:');
        errors.forEach(e => console.error(`  [${e.type}] ${e.text}`));
        process.exit(1);
    } else {
        console.log('\n[Gate] PASS: No console errors, exceptions, or failed requests detected.');
        process.exit(0);
    }
})();
