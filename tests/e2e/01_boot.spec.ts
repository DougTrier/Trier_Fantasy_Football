/**
 * 01 · App Boot
 * ═════════════
 * Verifies the app loads without crash and enters guest mode when no
 * franchise is active. Also verifies the sidebar and key UI landmarks.
 */
import { test, expect } from '@playwright/test';
import { clearAll } from './helpers/seed';

test.describe('App Boot — Guest Mode', () => {
    test.beforeEach(async ({ page }) => {
        await clearAll(page);
        await page.goto('/');
        // Allow React to render
        await page.waitForLoadState('networkidle');
    });

    test('page title is trier-fantasy', async ({ page }) => {
        await expect(page).toHaveTitle('trier-fantasy');
    });

    test('sidebar is visible', async ({ page }) => {
        // The sidebar h1 says TRIER FANTASY FOOTBALL
        await expect(page.getByRole('heading', { name: /TRIER FANTASY FOOTBALL/i }).first()).toBeVisible();
    });

    test('guest mode shows locked Dashboard and My Team', async ({ page }) => {
        await expect(page.getByText('Dashboard (Locked)')).toBeVisible();
        await expect(page.getByText('My Team (Locked)')).toBeVisible();
    });

    test('Settings / Create Team nav item is visible and clickable', async ({ page }) => {
        const settingsLink = page.getByText('Settings / Create Team');
        await expect(settingsLink).toBeVisible();
        await settingsLink.click();
        // Should navigate to settings — the League Settings heading appears
        await expect(page.getByText('League Settings')).toBeVisible();
        // The ADD FRANCHISE dashed card is present
        await expect(page.getByText('ADD FRANCHISE')).toBeVisible();
    });

    test('League nav item navigates to league standings', async ({ page }) => {
        await page.getByText('League', { exact: true }).click();
        await expect(page.getByRole('heading', { name: 'League Standings' })).toBeVisible();
    });

    test('Rules & Info nav item is visible', async ({ page }) => {
        await page.getByText('Rules & Info').click();
        await expect(page.getByText(/Trier Rules/i)).toBeVisible();
    });

    test('Network nav item is visible', async ({ page }) => {
        await page.getByText('Network').click();
        // Should show network page heading or P2P content
        await expect(page.getByText(/P2P|Network|Discovery/i).first()).toBeVisible();
    });

    test('Players nav item navigates to player browser', async ({ page }) => {
        await page.getByText('Players', { exact: true }).click();
        await expect(page.getByText(/players|pool|roster/i).first()).toBeVisible();
    });

    test('season state badge shows COMPLETED_OFFICIAL', async ({ page }) => {
        await expect(page.getByText(/COMPLETED_OFFICIAL/i)).toBeVisible();
    });
});
