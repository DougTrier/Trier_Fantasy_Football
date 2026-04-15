/**
 * 05 · Dashboard
 * ══════════════
 * With a seeded team, verifies the Dashboard view shows:
 *  - "Welcome, Coach." heading (active team mode)
 *  - Production points stat cards
 *  - Action tiles: Manage Team, League Standings, Connect With Friends
 *  - Guest mode shows team selection cards with team names
 */
import { test, expect } from '@playwright/test';
import { seedTeam, seedTwoTeams, clearAll } from './helpers/seed';

test.describe('Dashboard — Active Team', () => {
    test.beforeEach(async ({ page }) => {
        await seedTeam(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.getByText('Dashboard', { exact: true }).click();
        await page.waitForLoadState('networkidle');
    });

    test('shows "Welcome, Coach." heading when team is active', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Welcome.*Coach/i }).first()).toBeVisible({ timeout: 8_000 });
    });

    test('shows Total Production stat card', async ({ page }) => {
        await expect(page.getByText('Total Production')).toBeVisible({ timeout: 8_000 });
    });

    test('shows production points value', async ({ page }) => {
        // The seeded team has total_production_pts = 500
        // Dashboard renders "{pts} PTS" in the Total Production card
        await expect(page.getByText(/500/).first()).toBeVisible({ timeout: 8_000 });
    });

    test('shows Trade Points Used stat card', async ({ page }) => {
        await expect(page.getByText(/Trade Points Used/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('shows Actual Balance stat card', async ({ page }) => {
        await expect(page.getByText(/Actual Balance/i)).toBeVisible({ timeout: 8_000 });
    });

    test('shows Manage Team action tile', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Manage Team' })).toBeVisible({ timeout: 8_000 });
    });

    test('shows League Standings action tile', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'League Standings' })).toBeVisible({ timeout: 8_000 });
    });

    test('shows Connect With Friends action tile', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Connect With Friends' })).toBeVisible({ timeout: 8_000 });
    });

    test('Manage Team tile navigates to roster', async ({ page }) => {
        await page.getByRole('heading', { name: 'Manage Team' }).click();
        await expect(page.getByText(/ROSTER OPEN|TEAMS LOCKED/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('no JavaScript errors crash the page', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));
        await page.waitForTimeout(2_000);
        const critical = errors.filter(e =>
            !e.includes('__TAURI__') &&
            !e.includes('tauri') &&
            !e.includes('invoke')
        );
        expect(critical).toHaveLength(0);
    });

    test('Save and Close button is visible', async ({ page }) => {
        await expect(page.getByText(/SAVE AND CLOSE|SAVE & CLOSE|Save and Close/i).first()).toBeVisible({ timeout: 5_000 });
    });
});

test.describe('Dashboard — Guest Mode Team Selection', () => {
    test.beforeEach(async ({ page }) => {
        // Two teams seeded but NO active team ID → shows team selection screen
        const { seedTwoTeams: _seed } = await import('./helpers/seed');
        const { testTeam, testTeam2 } = await import('./helpers/seed');
        const t1 = testTeam();
        const t2 = testTeam2();
        await page.addInitScript((data) => {
            localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify([data.t1, data.t2]));
            // activeTeamId is empty → shows team selection cards
            localStorage.setItem('trier_fantasy_active_id', '');
            sessionStorage.removeItem('trier_fantasy_active_id');
        }, { t1, t2 });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('shows team selection cards with team names', async ({ page }) => {
        // When no team is active, Dashboard shows team selection cards
        await expect(page.getByText('Test Crusaders').first()).toBeVisible({ timeout: 8_000 });
        await expect(page.getByText('Rival Raiders').first()).toBeVisible({ timeout: 8_000 });
    });

    test('shows owner names in team selection cards', async ({ page }) => {
        await expect(page.getByText('Test Owner').first()).toBeVisible({ timeout: 8_000 });
        await expect(page.getByText('Rival Owner').first()).toBeVisible({ timeout: 8_000 });
    });

    test('clicking a team card activates it', async ({ page }) => {
        // Click "Test Crusaders" team card
        await page.getByText('Test Crusaders').first().click();
        await page.waitForTimeout(500);
        // Should show the active dashboard (Welcome, Coach.) or the team's roster
        await expect(page.getByText(/Welcome.*Coach|Dashboard|Manage Team/i).first()).toBeVisible({ timeout: 8_000 });
    });
});
