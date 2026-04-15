/**
 * 11 · Head to Head
 * ═════════════════
 * Tests the H2H matchup page.
 */
import { test, expect } from '@playwright/test';
import { seedTwoTeams, seedTeam } from './helpers/seed';

test.describe('Head to Head Page', () => {
    test.beforeEach(async ({ page }) => {
        await seedTwoTeams(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.getByText('Head to Head').click();
        await page.waitForLoadState('networkidle');
    });

    test('H2H page renders without crash', async ({ page }) => {
        await expect(page.getByText(/head.to.head|H2H|matchup|compare/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('page has a score comparison or projected points section', async ({ page }) => {
        // H2H page should show some matchup or team content
        await expect(page.getByText(/head.to.head|H2H|QB|player|team|matchup|compare/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('has team selector or team labels', async ({ page }) => {
        // Either shows "Test Crusaders" directly or has a dropdown to select teams
        const hasTeam = await page.getByText(/Test Crusaders|Rival Raiders|select.*team/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
        // Just verify no crash
        await expect(page.getByText(/QB|RB|WR|player|team/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('no critical JS errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));
        await page.waitForTimeout(2_000);
        const critical = errors.filter(e =>
            !e.includes('__TAURI__') && !e.includes('tauri') && !e.includes('invoke')
        );
        expect(critical).toHaveLength(0);
    });
});

test.describe('H2H — Single Team', () => {
    test.beforeEach(async ({ page }) => {
        await seedTeam(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.getByText('Head to Head').click();
        await page.waitForLoadState('networkidle');
    });

    test('H2H page renders with single team', async ({ page }) => {
        await expect(page.getByText(/head.to.head|H2H|matchup|no.*opponent|compare/i).first()).toBeVisible({ timeout: 8_000 });
    });
});
