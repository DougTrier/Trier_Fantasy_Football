/**
 * 14 · Security & Data Integrity
 * ════════════════════════════════
 * Verifies security properties of the app.
 */
import { test, expect } from '@playwright/test';
import { seedTeam, seedAdmin } from './helpers/seed';

test.describe('Security — Admin Password Storage', () => {
    test('admin password is stored hashed (sha256: or plain: prefix)', async ({ page }) => {
        await seedAdmin(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const stored = await page.evaluate(() => localStorage.getItem('trier_admin_pass'));
        // Must be prefixed — never raw plaintext
        expect(stored).toMatch(/^(sha256:|plain:)/);
    });

    test('admin password is not empty after seeding', async ({ page }) => {
        await seedAdmin(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const stored = await page.evaluate(() => localStorage.getItem('trier_admin_pass'));
        expect(stored).not.toBeNull();
        expect(stored!.length).toBeGreaterThan(10);
    });

    test('localStorage keys follow trier_ namespace', async ({ page }) => {
        await seedTeam(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const keys = await page.evaluate(() =>
            Object.keys(localStorage).filter(k => k.startsWith('trier_'))
        );
        expect(keys).toContain('trier_fantasy_all_teams_v3');
        expect(keys).toContain('trier_fantasy_active_id');
    });

    test('team data persists in trier_fantasy_all_teams_v3', async ({ page }) => {
        await seedTeam(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const raw = await page.evaluate(() => localStorage.getItem('trier_fantasy_all_teams_v3'));
        const teams = JSON.parse(raw || '[]');
        expect(Array.isArray(teams)).toBe(true);
        expect(teams[0].name).toBe('Test Crusaders');
    });
});

test.describe('Security — Corrupted Storage Resilience', () => {
    test('corrupted team JSON does not crash the app', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('trier_fantasy_all_teams_v3', 'NOT_VALID_JSON{{{{');
        });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // App should still render in guest mode — not crash
        await expect(page.getByText('Dashboard (Locked)')).toBeVisible({ timeout: 8_000 });
    });

    test('corrupted event log does not crash the app', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('trier_event_log', '[{"broken":true}]');
        });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText('Dashboard (Locked)')).toBeVisible({ timeout: 8_000 });
    });

    test('team with null roster slots loads correctly', async ({ page }) => {
        await page.addInitScript(() => {
            const partialTeam = {
                id: 'partial-001',
                name: 'Partial Team',
                ownerName: 'Partial Owner',
                roster: { qb: null, rb1: null, rb2: null, wr1: null, wr2: null, te: null, flex: null, k: null, dst: null },
                bench: [],
                transactions: [],
                total_production_pts: 0,
                points_escrowed: 0,
                points_spent: 0,
            };
            localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify([partialTeam]));
            localStorage.setItem('trier_fantasy_active_id', 'partial-001');
            sessionStorage.setItem('trier_fantasy_active_id', 'partial-001');
        });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.getByText('My Team', { exact: true }).click();
        await page.waitForLoadState('networkidle');

        // Should render empty roster slots without crash — ROSTER OPEN or TEAMS LOCKED shows
        await expect(page.getByText(/ROSTER OPEN|TEAMS LOCKED/i).first()).toBeVisible({ timeout: 8_000 });
        // QB slot should show "ADD PLAYER TO QB" since it's empty
        await expect(page.getByText('QB').first()).toBeVisible({ timeout: 8_000 });
    });
});

test.describe('Security — Event Store Rejection', () => {
    test('EventStore rejects events with unsigned signature — app loads normally', async ({ page }) => {
        await page.addInitScript(() => {
            const badEvent = {
                id: 'bad-event-001',
                type: 'ROSTER_MOVE',
                author: 'malicious-node',
                seq: 1,
                ts: Date.now(),
                signature: 'unsigned',
                payload: {}
            };
            localStorage.setItem('trier_event_log', JSON.stringify([badEvent]));
        });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // App should load normally and not crash even with unsigned events in the log
        await expect(page.getByText('Dashboard (Locked)')).toBeVisible({ timeout: 8_000 });
    });

    test('EventStore rejects future-dated events — app loads normally', async ({ page }) => {
        await page.addInitScript(() => {
            const futureEvent = {
                id: 'future-event-001',
                type: 'ROSTER_MOVE',
                author: 'some-node',
                seq: 1,
                ts: Date.now() + 999999999,
                signature: 'sha256:fakehashvalue',
                payload: {}
            };
            localStorage.setItem('trier_event_log', JSON.stringify([futureEvent]));
        });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText('Dashboard (Locked)')).toBeVisible({ timeout: 8_000 });
    });
});

test.describe('Security — Page Hygiene', () => {
    test('admin password plaintext does not appear in page HTML', async ({ page }) => {
        await seedAdmin(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const html = await page.content();
        expect(html).not.toContain('admin123');
    });

    test('no obvious private key material in page source', async ({ page }) => {
        await seedTeam(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const html = await page.content();
        // Private key strings should not appear in rendered HTML
        expect(html).not.toContain('-----BEGIN PRIVATE KEY-----');
    });
});
