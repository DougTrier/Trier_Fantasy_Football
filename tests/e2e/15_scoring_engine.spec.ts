/**
 * 15 · Scoring Engine (via Dashboard + Roster)
 * ════════════════════════════════════════════
 * Verifies that the scoring engine produces correct values visible in the UI.
 * With season_state = "COMPLETED_OFFICIAL", scores should be rendered.
 *
 * The seeded team has total_production_pts = 500 from the direct seed,
 * not from the live engine. These tests verify the UI displays it correctly.
 *
 * For engine accuracy, we rely on the unit tests in tests/unit/EventStore.test.ts.
 */
import { test, expect } from '@playwright/test';
import { seedTeam, seedTwoTeams } from './helpers/seed';

test.describe('Scoring Engine — Season State Display', () => {
    test.beforeEach(async ({ page }) => {
        await seedTeam(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('season state COMPLETED_OFFICIAL is shown in sidebar', async ({ page }) => {
        await expect(page.getByText(/COMPLETED_OFFICIAL/i)).toBeVisible({ timeout: 8_000 });
    });

    test('data status VALIDATED is shown', async ({ page }) => {
        await expect(page.getByText(/VALIDATED/i)).toBeVisible({ timeout: 8_000 });
    });

    test('Dashboard shows non-zero production points', async ({ page }) => {
        // Already on dashboard from beforeEach goto('/') — just verify 500 pts visible
        await expect(page.getByText(/500/).first()).toBeVisible({ timeout: 8_000 });
    });

    test('League standings shows points for all teams', async ({ page }) => {
        await page.getByText('League', { exact: true }).click();
        await page.waitForLoadState('networkidle');
        // Should show some numeric value for points
        await expect(page.getByText(/\d+(\.\d+)?\s*pts?/i).first()).toBeVisible({ timeout: 8_000 });
    });
});

test.describe('Scoring Engine — Full PPR Indicator', () => {
    test.beforeEach(async ({ page }) => {
        await seedTeam(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('PPR scoring type is indicated on dashboard or league page', async ({ page }) => {
        // PPR should be visible somewhere in the UI
        await page.getByText('League', { exact: true }).click();
        const hasPPR = await page.getByText(/PPR|Full PPR/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
        if (!hasPPR) {
            // Check Rules page as fallback
            await page.getByText('Rules & Info').click();
            await expect(page.getByText(/Full PPR/i).first()).toBeVisible({ timeout: 8_000 });
        }
    });
});
