/**
 * Playwright Test Seed Helpers
 * ==============================
 * Provides localStorage seeding utilities for Trier Fantasy Football E2E tests.
 *
 * Usage:
 *   await seedTeam(page);           // Injects a pre-built team + activates it
 *   await seedAdmin(page);          // Injects admin password (plain:admin123)
 *   await clearAll(page);           // Wipes all trier_ keys from localStorage
 *
 * Architecture note:
 *   page.addInitScript() runs BEFORE the React app hydrates, so localStorage
 *   values are visible on first read. Call these before page.goto().
 */

import type { Page } from '@playwright/test';

// ─── Minimal Player factory ───────────────────────────────────────────────────

export const makePlayer = (
    id: string,
    pos: string,
    first: string,
    last: string,
    nflTeam: string,
    pts = 10
) => ({
    id,
    firstName: first,
    lastName: last,
    position: pos,
    team: nflTeam,
    projectedPoints: pts,
    total_actual_fantasy_points: pts,
    isEnriched: false,
});

// ─── Static test team ─────────────────────────────────────────────────────────

export const TEST_TEAM_ID = 'e2e-team-001';
export const TEST_TEAM_2_ID = 'e2e-team-002';
export const ADMIN_PASSWORD = 'admin123';

export const testTeam = () => ({
    id: TEST_TEAM_ID,
    name: 'Test Crusaders',
    ownerName: 'Test Owner',
    roster: {
        qb:   makePlayer('e2e-qb1', 'QB', 'Patrick', 'Mahomes',    'KC',  30),
        rb1:  makePlayer('e2e-rb1', 'RB', 'Christian','McCaffrey', 'SF',  22),
        rb2:  makePlayer('e2e-rb2', 'RB', 'Derrick',  'Henry',     'MIA', 18),
        wr1:  makePlayer('e2e-wr1', 'WR', 'Tyreek',   'Hill',      'MIA', 20),
        wr2:  makePlayer('e2e-wr2', 'WR', 'Stefon',   'Diggs',     'HOU', 14),
        te:   makePlayer('e2e-te1', 'TE', 'Travis',   'Kelce',     'KC',  16),
        flex: makePlayer('e2e-fl1', 'RB', 'Saquon',   'Barkley',   'PHI', 15),
        k:    makePlayer('e2e-k1',  'K',  'Justin',   'Tucker',    'BAL',  8),
        dst:  makePlayer('e2e-d1',  'DST','San Francisco','49ers', 'SF',  10),
    },
    bench: [
        makePlayer('e2e-bn1', 'QB', 'Lamar',  'Jackson', 'BAL', 25),
        makePlayer('e2e-bn2', 'RB', 'Austin', 'Ekeler',  'LAC', 12),
        makePlayer('e2e-bn3', 'WR', 'Justin', 'Jefferson','MIN', 19),
        makePlayer('e2e-bn4', 'TE', 'Mark',   'Andrews', 'BAL', 14),
    ],
    transactions: [],
    total_production_pts: 500,
    points_escrowed: 0,
    points_spent: 50,
    ownerId: 'node-e2e-001',
});

export const testTeam2 = () => ({
    id: TEST_TEAM_2_ID,
    name: 'Rival Raiders',
    ownerName: 'Rival Owner',
    roster: {
        qb:   makePlayer('r-qb1', 'QB', 'Josh',   'Allen',    'BUF', 28),
        rb1:  makePlayer('r-rb1', 'RB', 'Dalvin', 'Cook',     'NYJ', 12),
        rb2:  makePlayer('r-rb2', 'RB', 'Kareem', 'Hunt',     'CLE', 10),
        wr1:  makePlayer('r-wr1', 'WR', 'Davante','Adams',    'LV',  17),
        wr2:  makePlayer('r-wr2', 'WR', 'DeAndre','Hopkins',  'TEN', 13),
        te:   makePlayer('r-te1', 'TE', 'Darren', 'Waller',   'NYG', 11),
        flex: makePlayer('r-fl1', 'WR', 'Cooper', 'Kupp',     'LAR', 14),
        k:    makePlayer('r-k1',  'K',  'Harrison','Butker',  'KC',   9),
        dst:  makePlayer('r-d1',  'DST','Dallas', 'Cowboys',  'DAL',  8),
    },
    bench: [
        makePlayer('r-bn1', 'QB',  'Tua',     'Tagovailoa', 'MIA', 18),
        makePlayer('r-bn2', 'WR',  'CeeDee',  'Lamb',       'DAL', 20),
    ],
    transactions: [],
    total_production_pts: 420,
    points_escrowed: 0,
    points_spent: 30,
    ownerId: 'node-e2e-002',
});

// ─── Seeding helpers ──────────────────────────────────────────────────────────

/**
 * Seed a single test team and activate it (no password).
 * Call BEFORE page.goto().
 */
export async function seedTeam(page: Page): Promise<void> {
    const team = testTeam();
    await page.addInitScript((data) => {
        localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify([data.team]));
        localStorage.setItem('trier_fantasy_active_id', data.id);
        sessionStorage.setItem('trier_fantasy_active_id', data.id);
    }, { team, id: TEST_TEAM_ID });
}

/**
 * Seed two teams — first is active (no password), second is a rival.
 * Enables trade / H2H tests.
 */
export async function seedTwoTeams(page: Page): Promise<void> {
    const t1 = testTeam();
    const t2 = testTeam2();
    await page.addInitScript((data) => {
        localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify([data.t1, data.t2]));
        localStorage.setItem('trier_fantasy_active_id', data.id);
        sessionStorage.setItem('trier_fantasy_active_id', data.id);
    }, { t1, t2, id: TEST_TEAM_ID });
}

/**
 * Seed admin password as plain:admin123 — verifiable without SHA-256 in the seed.
 * The app's verifyPassword() handles the plain: prefix.
 */
export async function seedAdmin(page: Page): Promise<void> {
    await page.addInitScript(() => {
        localStorage.setItem('trier_admin_pass', 'plain:admin123');
    });
}

/**
 * Seed both a team and admin credentials.
 */
export async function seedTeamAndAdmin(page: Page): Promise<void> {
    const team = testTeam();
    await page.addInitScript((data) => {
        localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify([data.team]));
        localStorage.setItem('trier_fantasy_active_id', data.id);
        sessionStorage.setItem('trier_fantasy_active_id', data.id);
        localStorage.setItem('trier_admin_pass', 'plain:admin123');
    }, { team, id: TEST_TEAM_ID });
}

/**
 * Seed two teams and admin.
 */
export async function seedTwoTeamsAndAdmin(page: Page): Promise<void> {
    const t1 = testTeam();
    const t2 = testTeam2();
    await page.addInitScript((data) => {
        localStorage.setItem('trier_fantasy_all_teams_v3', JSON.stringify([data.t1, data.t2]));
        localStorage.setItem('trier_fantasy_active_id', data.id);
        sessionStorage.setItem('trier_fantasy_active_id', data.id);
        localStorage.setItem('trier_admin_pass', 'plain:admin123');
    }, { t1, t2, id: TEST_TEAM_ID });
}

/**
 * Clear all Trier-related localStorage keys.
 */
export async function clearAll(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('trier_'));
        keys.forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
    });
}

// ─── Dialog helpers ───────────────────────────────────────────────────────────

/**
 * Dismiss the AppDialog by clicking the OK/CONFIRM button.
 */
export async function dismissDialog(page: Page): Promise<void> {
    const ok = page.locator('button').filter({ hasText: /^(OK|CONFIRM)$/i }).first();
    await ok.waitFor({ state: 'visible', timeout: 5_000 });
    await ok.click();
}

/**
 * Cancel the AppDialog by clicking CANCEL.
 */
export async function cancelDialog(page: Page): Promise<void> {
    const cancel = page.locator('button').filter({ hasText: /^CANCEL$/i }).first();
    await cancel.waitFor({ state: 'visible', timeout: 5_000 });
    await cancel.click();
}

/**
 * Fill in a prompt dialog and confirm.
 */
export async function fillPrompt(page: Page, value: string): Promise<void> {
    const input = page.locator('input[type="text"]').last();
    await input.waitFor({ state: 'visible', timeout: 5_000 });
    await input.fill(value);
    await dismissDialog(page);
}
