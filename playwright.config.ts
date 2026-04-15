import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    expect: { timeout: 8_000 },
    fullyParallel: false, // Sequential — tests share state patterns
    retries: 0,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],

    use: {
        baseURL: 'http://localhost:1425',
        browserName: 'chromium',
        headless: true,
        viewport: { width: 1440, height: 900 },
        // Capture on failure
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:1425',
        reuseExistingServer: true,
        timeout: 30_000,
        stdout: 'ignore',
        stderr: 'pipe',
    },
});
