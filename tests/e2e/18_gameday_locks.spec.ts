import { test, expect } from '@playwright/test';
import { seedTeamAndAdmin } from './helpers/seed';

test.use({ timezoneId: 'America/Chicago' });

const kickoff = '2026-09-13T17:00:00Z';
const scoreboard = (state: string) => ({ events: [{ date: kickoff, competitions: [{
    status: { type: { state }, period: 1, clock: 900 },
    competitors: ['KC', 'SF'].map(abbreviation => ({ team: { abbreviation } })),
}] }] });
const readLocks = (page: import('@playwright/test').Page) => page.evaluate(() =>
    JSON.parse(localStorage.getItem('trier_locked_nfl_teams') ?? '[]'));

test.beforeEach(async ({ page }) => {
    await seedTeamAndAdmin(page);
    await page.clock.install({ time: new Date('2026-09-13T16:59:30Z') });
});

test('non-commissioner roster has no lock controls', async ({ page }) => {
    await page.route('**/football/nfl/scoreboard**', route => route.fulfill({ json: scoreboard('in') }));
    await page.goto('/');
    await page.getByText('My Team', { exact: true }).click();
    await expect(page.getByText('2 TEAMS LOCKED', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /CLEAR MANUAL LOCKS|UNLOCK ALL|LOCK ALL/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'KC', exact: true })).toHaveCount(0);
});

test('commissioner can clear manual locks while active games stay protected', async ({ page }) => {
    await page.route('**/football/nfl/scoreboard**', route => route.fulfill({ json: scoreboard('in') }));
    await page.goto('/');
    await page.getByText('Settings / Create Team', { exact: true }).click();
    await page.getByRole('button', { name: 'LOG IN', exact: true }).click();
    await page.getByPlaceholder('Password', { exact: true }).fill('admin123');
    await page.getByRole('button', { name: 'CONFIRM', exact: true }).click();
    await expect(page.getByRole('button', { name: 'EXIT ADMIN' })).toBeVisible();
    await page.getByRole('button', { name: 'LOCK ALL', exact: true }).click();
    await expect.poll(async () => (await readLocks(page)).length).toBe(32);
    await page.getByRole('button', { name: 'CLEAR MANUAL LOCKS' }).click();
    await expect.poll(() => readLocks(page)).toEqual(['KC', 'SF']);
    await expect(page.getByRole('button', { name: 'KC', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'EXIT ADMIN' }).click();
    await page.getByText('My Team', { exact: true }).click();
    await expect(page.getByRole('button', { name: /CLEAR MANUAL LOCKS|LOCK ALL/ })).toHaveCount(0);
});

test('manual locks survive empty refresh and reload', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('trier_locked_nfl_teams', '["BUF"]'));
    await page.route('**/football/nfl/scoreboard**', route => route.fulfill({ json: { events: [] } }));
    await page.goto('/');
    await expect.poll(() => readLocks(page)).toEqual(['BUF']);
    await page.clock.fastForward(61000);
    await expect.poll(() => readLocks(page)).toEqual(['BUF']);
    await page.reload();
    await expect.poll(() => readLocks(page)).toEqual(['BUF']);
});

test('failed refresh retains active locks and a successful final clears them', async ({ page }) => {
    let mode = 'in';
    let calls = 0;
    await page.route('**/football/nfl/scoreboard**', route => {
        calls++;
        return mode === 'error' ? route.fulfill({ status: 503, body: '' }) : route.fulfill({ json: scoreboard(mode) });
    });
    await page.goto('/');
    await expect.poll(() => readLocks(page)).toEqual(['KC', 'SF']);
    const previous = calls;
    mode = 'error';
    await page.clock.fastForward(61000);
    await expect.poll(() => calls).toBeGreaterThan(previous);
    await expect.poll(() => readLocks(page)).toEqual(['KC', 'SF']);
    mode = 'post';
    await page.clock.fastForward(61000);
    await expect.poll(() => readLocks(page)).toEqual([]);
});

test('cached kickoff locks players before the next API poll', async ({ page }) => {
    let calls = 0;
    await page.route('**/football/nfl/scoreboard**', route => { calls++; return route.fulfill({ json: scoreboard('pre') }); });
    await page.goto('/');
    await expect.poll(() => calls).toBeGreaterThan(0);
    await expect.poll(() => readLocks(page)).toEqual([]);
    const previous = calls;
    await page.clock.fastForward(31000);
    await expect.poll(() => readLocks(page)).toEqual(['KC', 'SF']);
    expect(calls).toBe(previous);
});

test('polling continues when a Saturday session crosses into Sunday', async ({ page }) => {
    await page.clock.setSystemTime(new Date('2026-09-13T04:59:30Z'));
    let calls = 0;
    await page.route('**/football/nfl/scoreboard**', route => { calls++; return route.fulfill({ json: scoreboard('pre') }); });
    await page.goto('/');
    await expect.poll(() => calls).toBeGreaterThan(0);
    const previous = calls;
    await page.clock.fastForward(61000);
    await expect.poll(() => calls).toBeGreaterThan(previous);
});
