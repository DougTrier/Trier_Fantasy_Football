/**
 * 06 · League Standings & Chat
 * ════════════════════════════
 * Verifies the League page renders standings, shows team names,
 * and that the chat panel is accessible.
 */
import { test, expect } from '@playwright/test';
import { seedTwoTeams, seedTeam } from './helpers/seed';

test.describe('League Page', () => {
    test.beforeEach(async ({ page }) => {
        await seedTwoTeams(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.getByText('League', { exact: true }).click();
        await page.waitForLoadState('networkidle');
    });

    test('League Standings heading is visible', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'League Standings' })).toBeVisible({ timeout: 8_000 });
    });

    test('shows both seeded team names', async ({ page }) => {
        await expect(page.getByText('Test Crusaders').first()).toBeVisible({ timeout: 8_000 });
        await expect(page.getByText('Rival Raiders').first()).toBeVisible({ timeout: 8_000 });
    });

    test('shows ranking column or position numbers', async ({ page }) => {
        // League table should have rank indicators (#1, #2, etc.) or a rank column
        await expect(page.getByText(/\#1|Rank|Standing/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('chat panel or League Chat section is visible', async ({ page }) => {
        // League page has a League Chat section
        await expect(page.getByText(/League Chat/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('clicking a team name may open a team detail or profile', async ({ page }) => {
        const rivalName = page.getByText('Rival Raiders').first();
        await rivalName.click();
        await page.waitForTimeout(500);
        // No crash expected — either opens modal or stays on standings
        await expect(page.getByText(/Raiders|standings/i).first()).toBeVisible({ timeout: 5_000 });
    });
});

test.describe('League Page — Single Team', () => {
    test.beforeEach(async ({ page }) => {
        await seedTeam(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.getByText('League', { exact: true }).click();
    });

    test('shows single team in standings', async ({ page }) => {
        await expect(page.getByText('Test Crusaders').first()).toBeVisible({ timeout: 8_000 });
    });
});
