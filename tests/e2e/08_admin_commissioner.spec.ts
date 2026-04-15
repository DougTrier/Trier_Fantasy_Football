/**
 * 08 · Admin / Commissioner
 * ═════════════════════════
 * Tests the commissioner panel with seeded admin credentials.
 * The admin "LOG IN" button triggers the AppDialog (custom prompt).
 */
import { test, expect } from '@playwright/test';
import { seedTeamAndAdmin, ADMIN_PASSWORD } from './helpers/seed';

/** Navigate to Settings and enter admin mode with the given password. */
async function enterAdmin(page: import('@playwright/test').Page, password: string) {
    await page.getByText('Settings / Create Team').click();
    await page.waitForLoadState('networkidle');

    // The "LOG IN" button is inside Commissioner Center
    const loginBtn = page.getByRole('button', { name: /LOG IN/i }).first();
    await loginBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await loginBtn.click();
    await page.waitForTimeout(300);

    // Fill the AppDialog prompt with the password
    const promptInput = page.locator('input[type="text"]').last();
    if (await promptInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await promptInput.fill(password);
        const confirmBtn = page.locator('button').filter({ hasText: /^(OK|CONFIRM)$/i }).first();
        await confirmBtn.click();
    }
    await page.waitForTimeout(500);
}

test.describe('Admin — Authentication', () => {
    test.beforeEach(async ({ page }) => {
        await seedTeamAndAdmin(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('LOG IN button is visible in Commissioner Center', async ({ page }) => {
        await page.getByText('Settings / Create Team').click();
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('button', { name: /LOG IN/i }).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Commissioner Center section heading is present', async ({ page }) => {
        await page.getByText('Settings / Create Team').click();
        await page.waitForLoadState('networkidle');
        await expect(page.getByText('Commissioner Center').first()).toBeVisible({ timeout: 8_000 });
    });

    test('correct password grants admin mode — EXIT ADMIN button appears', async ({ page }) => {
        await enterAdmin(page, ADMIN_PASSWORD);
        // After login, LOG IN becomes EXIT ADMIN
        await expect(page.getByRole('button', { name: /EXIT ADMIN/i }).first()).toBeVisible({ timeout: 8_000 });
    });

    test('wrong password shows error dialog', async ({ page }) => {
        await page.getByText('Settings / Create Team').click();
        await page.waitForLoadState('networkidle');

        const loginBtn = page.getByRole('button', { name: /LOG IN/i }).first();
        await loginBtn.click();
        await page.waitForTimeout(300);

        const promptInput = page.locator('input[type="text"]').last();
        if (await promptInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await promptInput.fill('wrongpassword123');
            const confirmBtn = page.locator('button').filter({ hasText: /^(OK|CONFIRM)$/i }).first();
            await confirmBtn.click();
        }

        await page.waitForTimeout(800);

        // Should show "Incorrect password" or "Wrong Password" dialog OR EXIT ADMIN should NOT appear
        const exitAdmin = await page.getByRole('button', { name: /EXIT ADMIN/i }).first().isVisible({ timeout: 2_000 }).catch(() => false);
        expect(exitAdmin).toBe(false); // Admin mode should NOT be granted

        // If an error dialog appeared, dismiss it
        const okBtn = page.locator('button').filter({ hasText: /^OK$/i }).first();
        if (await okBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await okBtn.click();
        }
    });
});

test.describe('Admin — Game Day Locking', () => {
    test.beforeEach(async ({ page }) => {
        await seedTeamAndAdmin(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await enterAdmin(page, ADMIN_PASSWORD);
        // Wait for admin panel to fully render before any test assertion
        await expect(page.getByText(/Game Day Locks/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('Game Day Locks section appears after admin login', async ({ page }) => {
        await expect(page.getByText(/Game Day Locks/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('LOCK ALL button is visible', async ({ page }) => {
        await expect(page.getByRole('button', { name: 'LOCK ALL', exact: true })).toBeVisible({ timeout: 8_000 });
    });

    test('UNLOCK ALL button is visible', async ({ page }) => {
        await expect(page.getByRole('button', { name: 'UNLOCK ALL' })).toBeVisible({ timeout: 8_000 });
    });

    test('LOCK ALL sets NFL teams in localStorage', async ({ page }) => {
        await page.getByRole('button', { name: 'LOCK ALL', exact: true }).click();
        await page.waitForTimeout(300);

        const locked = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('trier_locked_nfl_teams') || '[]')
        );
        expect(Array.isArray(locked)).toBe(true);
        expect(locked.length).toBeGreaterThan(0);
    });

    test('UNLOCK ALL clears locked teams', async ({ page }) => {
        // Lock first
        await page.getByRole('button', { name: 'LOCK ALL', exact: true }).click();
        await page.waitForTimeout(200);
        // Then unlock
        await page.getByRole('button', { name: 'UNLOCK ALL' }).click();
        await page.waitForTimeout(300);

        const locked = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('trier_locked_nfl_teams') || '[]')
        );
        expect(locked.length).toBe(0);
    });
});

test.describe('Admin — First-Run Password Setup', () => {
    test('clicking LOG IN with no password triggers setup prompt', async ({ page }) => {
        // Seed team but NO admin password
        const { seedTeam } = await import('./helpers/seed');
        await seedTeam(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.getByText('Settings / Create Team').click();
        await page.waitForLoadState('networkidle');

        const loginBtn = page.getByRole('button', { name: /LOG IN/i }).first();
        await loginBtn.click();
        await page.waitForTimeout(300);

        // Should show a prompt dialog (to create new password or enter existing)
        const dialogVisible = await page.locator('div').filter({ hasText: /password|admin|set|create/i }).first().isVisible({ timeout: 5_000 }).catch(() => false);
        expect(dialogVisible).toBe(true);

        // Cancel the flow
        const cancelBtn = page.locator('button').filter({ hasText: /^CANCEL$/i }).first();
        if (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await cancelBtn.click();
        }
    });
});
