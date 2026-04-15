/**
 * 02 · Franchise Creation
 * ══════════════════════
 * Tests the "Establish Franchise" flow in Settings.
 *
 * Flow:
 *   Settings page → click "ADD FRANCHISE" dashed card
 *   → modal opens: Team Name, Coach Name, Password (all required)
 *   → click "ESTABLISH FRANCHISE" button
 *   → modal closes, team becomes active
 */
import { test, expect } from '@playwright/test';
import { clearAll, dismissDialog } from './helpers/seed';

test.describe('Franchise Creation', () => {
    test.beforeEach(async ({ page }) => {
        await clearAll(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        // Navigate to Settings
        await page.getByText('Settings / Create Team').click();
        await expect(page.getByText('League Settings')).toBeVisible({ timeout: 8_000 });
    });

    test('League Settings page has ADD FRANCHISE card', async ({ page }) => {
        await expect(page.getByText('ADD FRANCHISE')).toBeVisible({ timeout: 8_000 });
    });

    test('clicking ADD FRANCHISE opens the modal', async ({ page }) => {
        await page.getByText('ADD FRANCHISE').click();
        await expect(page.getByText('Establish New Franchise')).toBeVisible({ timeout: 5_000 });
    });

    test('modal has Team Name, Coach Name, and Password fields', async ({ page }) => {
        await page.getByText('ADD FRANCHISE').click();
        await expect(page.getByText('Establish New Franchise')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByPlaceholder(/Gotham Knights/i)).toBeVisible();
        await expect(page.getByPlaceholder(/Bruce Wayne/i)).toBeVisible();
        await expect(page.getByPlaceholder(/strong password/i)).toBeVisible();
    });

    test('create a franchise with all required fields', async ({ page }) => {
        await page.getByText('ADD FRANCHISE').click();
        await expect(page.getByText('Establish New Franchise')).toBeVisible({ timeout: 5_000 });

        await page.getByPlaceholder(/Gotham Knights/i).fill('Iron Eagles');
        await page.getByPlaceholder(/Bruce Wayne/i).fill('Coach Doug');
        await page.getByPlaceholder(/strong password/i).fill('eagles123');

        // Click the ESTABLISH FRANCHISE submit button
        await page.getByRole('button', { name: /ESTABLISH FRANCHISE/i }).click();

        // After creation, Dashboard and My Team should be unlocked
        await expect(page.getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 8_000 });
        await expect(page.getByText('Dashboard (Locked)')).not.toBeVisible({ timeout: 3_000 });
    });

    test('submitting without required fields shows validation alert', async ({ page }) => {
        await page.getByText('ADD FRANCHISE').click();
        await expect(page.getByText('Establish New Franchise')).toBeVisible({ timeout: 5_000 });

        // Leave all fields empty — click ESTABLISH FRANCHISE
        await page.getByRole('button', { name: /ESTABLISH FRANCHISE/i }).click();

        // Should show alert: "Team Name, Coach Name, and Password are all required."
        await expect(page.getByText('Team Name, Coach Name, and Password are all required.')).toBeVisible({ timeout: 5_000 });
        // Dismiss the alert
        await dismissDialog(page);
        // Modal should still be open
        await expect(page.getByText('Establish New Franchise')).toBeVisible({ timeout: 3_000 });
    });

    test('CANCEL closes the modal without creating a team', async ({ page }) => {
        await page.getByText('ADD FRANCHISE').click();
        await expect(page.getByText('Establish New Franchise')).toBeVisible({ timeout: 5_000 });

        await page.getByRole('button', { name: /^CANCEL$/i }).click();
        // Modal should close
        await expect(page.getByText('Establish New Franchise')).not.toBeVisible({ timeout: 3_000 });
        // Guest mode stays active
        await expect(page.getByText('Dashboard (Locked)')).toBeVisible({ timeout: 5_000 });
    });

    test('team appears in franchise list after creation', async ({ page }) => {
        await page.getByText('ADD FRANCHISE').click();
        await expect(page.getByText('Establish New Franchise')).toBeVisible({ timeout: 5_000 });

        await page.getByPlaceholder(/Gotham Knights/i).fill('Storm Riders');
        await page.getByPlaceholder(/Bruce Wayne/i).fill('Coach Storm');
        await page.getByPlaceholder(/strong password/i).fill('storm999');

        await page.getByRole('button', { name: /ESTABLISH FRANCHISE/i }).click();

        // Navigate back to settings — team should appear in the list
        await page.getByText('Settings / Create Team').click();
        await expect(page.getByText('Storm Riders')).toBeVisible({ timeout: 8_000 });
    });
});
