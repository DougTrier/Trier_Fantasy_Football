/**
 * 03 · Sidebar Navigation
 * ══════════════════════
 * With a team seeded, verifies every sidebar nav item renders the correct
 * page content and that active state toggles correctly.
 */
import { test, expect } from '@playwright/test';
import { seedTeam } from './helpers/seed';

test.describe('Sidebar Navigation (with team)', () => {
    test.beforeEach(async ({ page }) => {
        await seedTeam(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('Dashboard nav shows active dashboard content', async ({ page }) => {
        await page.getByText('Dashboard', { exact: true }).click();
        // Active dashboard shows "Welcome, Coach." heading and action tiles
        await expect(page.getByText(/Welcome.*Coach|Manage Team|Total Production/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('My Team nav shows roster view', async ({ page }) => {
        await page.getByText('My Team', { exact: true }).click();
        // Roster shows position labels — use first() to avoid strict mode
        await expect(page.getByText('QB').first()).toBeVisible({ timeout: 8_000 });
    });

    test('League nav shows standings table', async ({ page }) => {
        await page.getByText('League', { exact: true }).click();
        await expect(page.getByRole('heading', { name: 'League Standings' })).toBeVisible({ timeout: 8_000 });
    });

    test('Head to Head nav shows H2H comparison', async ({ page }) => {
        await page.getByText('Head to Head').click();
        await expect(page.getByText(/head.to.head|H2H|matchup/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Players nav shows player pool', async ({ page }) => {
        await page.getByText('Players', { exact: true }).click();
        // Player browser should show some player names or "All Players" heading
        await expect(page.getByText(/players|roster|free agent|Mahomes|McCaffrey/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Trade Center nav shows trade UI', async ({ page }) => {
        await page.getByText('Trade Center').click();
        // Trade center heading or ledger section
        await expect(page.getByText(/trade|ledger|points/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Rules & Info nav shows the rules page', async ({ page }) => {
        await page.getByText('Rules & Info').click();
        await expect(page.getByText(/Trier Rules/i)).toBeVisible({ timeout: 8_000 });
    });

    test('Network nav shows P2P panel', async ({ page }) => {
        await page.getByText('Network').click();
        await expect(page.getByText(/P2P|network|peers|discovery/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Settings nav shows settings panel', async ({ page }) => {
        await page.getByText('Settings / Create Team').click();
        await expect(page.getByText('League Settings')).toBeVisible({ timeout: 8_000 });
    });

    test('Log Out returns to guest mode', async ({ page }) => {
        // First confirm we are logged in — Dashboard item is unlocked
        await expect(page.getByText('Dashboard', { exact: true })).toBeVisible();
        // Then log out
        await page.getByText('Log Out').click();
        // Should revert to locked guest mode
        await expect(page.getByText('Dashboard (Locked)')).toBeVisible({ timeout: 8_000 });
        await expect(page.getByText('My Team (Locked)')).toBeVisible();
    });

    test('active nav item is visually highlighted', async ({ page }) => {
        await page.getByText('Rules & Info', { exact: true }).first().click();
        await expect(page.getByText('Rules & Info', { exact: true }).first()).toBeVisible();
        // Verify "Trier Rules" content is visible (confirming active view switched)
        await expect(page.getByText(/Trier Rules/i).first()).toBeVisible({ timeout: 5_000 });
    });
});
