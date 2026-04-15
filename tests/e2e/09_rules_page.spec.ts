/**
 * 09 · Rules & Info Page
 * ══════════════════════
 * Verifies the Rules page renders all sections with accurate content.
 */
import { test, expect } from '@playwright/test';
import { clearAll } from './helpers/seed';

test.describe('Rules & Info Page', () => {
    test.beforeEach(async ({ page }) => {
        await clearAll(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.getByText('Rules & Info').click();
        await page.waitForLoadState('networkidle');
    });

    test('page heading is visible', async ({ page }) => {
        await expect(page.getByText(/Trier Rules/i)).toBeVisible({ timeout: 8_000 });
    });

    test('subtitle mentions current Season year', async ({ page }) => {
        // Subtitle shows dynamic season year (2026 in off-season, current year during active season)
        await expect(page.getByText(/\d{4} Season/i).first()).toBeVisible({ timeout: 8_000 });
    });

    // ─── Roster Composition card ────────────────────────────────────────────────

    test('Roster Composition card is present', async ({ page }) => {
        await expect(page.getByText('Roster Composition')).toBeVisible({ timeout: 8_000 });
    });

    test('Roster Composition lists QB', async ({ page }) => {
        await expect(page.getByText(/Quarterback.*QB/i)).toBeVisible({ timeout: 8_000 });
    });

    test('Roster Composition lists 7 bench slots', async ({ page }) => {
        await expect(page.getByText(/7 Bench/i)).toBeVisible({ timeout: 8_000 });
    });

    // ─── Scoring System card ───────────────────────────────────────────────────

    test('Scoring System card with Full PPR heading is present', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Scoring System.*Full PPR/i }).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Scoring shows Passing TD is 4 pts', async ({ page }) => {
        await expect(page.getByText(/Passing TD.*4/i)).toBeVisible({ timeout: 8_000 });
    });

    test('Scoring shows Reception is 1 pt (Full PPR)', async ({ page }) => {
        await expect(page.getByText(/Reception.*1 pt.*Full PPR/i)).toBeVisible({ timeout: 8_000 });
    });

    test('Scoring shows interception thrown penalty of -2 pts', async ({ page }) => {
        await expect(page.getByText(/Interception thrown.*-2/i)).toBeVisible({ timeout: 8_000 });
    });

    test('Scoring shows fumble lost penalty of -2 pts', async ({ page }) => {
        await expect(page.getByText(/Fumble lost.*-2/i)).toBeVisible({ timeout: 8_000 });
    });

    // ─── D/ST Scoring card ─────────────────────────────────────────────────────

    test('Defense / ST Scoring card is present', async ({ page }) => {
        // The card title includes "Defense" and "Scoring"
        await expect(page.getByText(/Defense.*Scoring/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('D/ST shows Sack is 1 pt', async ({ page }) => {
        await expect(page.getByText(/Sack.*1 pt/i)).toBeVisible({ timeout: 8_000 });
    });

    test('D/ST shows Safety is 2 pts', async ({ page }) => {
        await expect(page.getByText(/Safety.*2 pts/i)).toBeVisible({ timeout: 8_000 });
    });

    // ─── Kicker card ───────────────────────────────────────────────────────────

    test('Kicker Scoring card heading is present', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Kicker Scoring/i })).toBeVisible({ timeout: 8_000 });
    });

    test('Kicker section shows FG distance brackets', async ({ page }) => {
        await expect(page.getByText(/FG 0.39 yds.*3 pts/i)).toBeVisible({ timeout: 8_000 });
    });

    test('Kicker section shows 50+ yard FG value', async ({ page }) => {
        await expect(page.getByText(/FG 50\+.*5 pts/i)).toBeVisible({ timeout: 8_000 });
    });

    // ─── Game Day Locking card ─────────────────────────────────────────────────

    test('Game Day Locking rule card is present', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Game Day Locking' })).toBeVisible({ timeout: 8_000 });
    });

    test('Game Day Locking mentions prevents lineup changes', async ({ page }) => {
        await expect(page.getByText(/Prevents lineup changes/i)).toBeVisible({ timeout: 8_000 });
    });

    // ─── Trade Center rule card ────────────────────────────────────────────────

    test('Trade Center rule card heading is present', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Trade Center' })).toBeVisible({ timeout: 8_000 });
    });

    test('Trade Center card mentions escrow', async ({ page }) => {
        // The Rule card's content mentions "escrow"
        await expect(page.getByText(/Buyer escrows/i)).toBeVisible({ timeout: 8_000 });
    });

    // ─── P2P card ──────────────────────────────────────────────────────────────

    test('P2P League Sync card heading is present', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'P2P League Sync' })).toBeVisible({ timeout: 8_000 });
    });

    test('P2P card mentions LAN discovery via mDNS', async ({ page }) => {
        await expect(page.getByText(/LAN discovery via mDNS/i)).toBeVisible({ timeout: 8_000 });
    });

    test('P2P card mentions ECDSA mutual auth', async ({ page }) => {
        await expect(page.getByText(/ECDSA mutual auth/i)).toBeVisible({ timeout: 8_000 });
    });

    // ─── Season State card ─────────────────────────────────────────────────────

    test('Season State Protocol card heading is present', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Season State Protocol' }).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Season State lists PRESEASON state', async ({ page }) => {
        await expect(page.getByText(/PRESEASON.*scouting/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Season State lists ACTIVE_UNOFFICIAL state', async ({ page }) => {
        // Specifically the rule card content (not the sidebar badge)
        await expect(page.getByText(/ACTIVE_UNOFFICIAL.*provisional scoring/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Season State lists COMPLETED_OFFICIAL state', async ({ page }) => {
        await expect(page.getByText(/COMPLETED_OFFICIAL.*scores final/i).first()).toBeVisible({ timeout: 8_000 });
    });

    // ─── NFL Data Pipeline card ────────────────────────────────────────────────

    test('NFL Data Pipeline card heading is present', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'NFL Data Pipeline' })).toBeVisible({ timeout: 8_000 });
    });

    test('Data Pipeline mentions post-draft pull', async ({ page }) => {
        await expect(page.getByText(/Post-draft.*rookies/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Data Pipeline mentions Sleeper API', async ({ page }) => {
        await expect(page.getByText(/Sleeper API/i).first()).toBeVisible({ timeout: 8_000 });
    });

    test('Data Pipeline mentions in-season Mon \/ Wed \/ Fri cadence', async ({ page }) => {
        await expect(page.getByText(/Mon.*Wed.*Fri/i).first()).toBeVisible({ timeout: 8_000 });
    });

    // ─── FAQ Section ───────────────────────────────────────────────────────────

    test('App Guide & FAQ section is visible', async ({ page }) => {
        await expect(page.getByText('App Guide & FAQ')).toBeVisible({ timeout: 8_000 });
    });

    test('FAQ Managing Your Team section is present', async ({ page }) => {
        await expect(page.getByText('Managing Your Team')).toBeVisible({ timeout: 8_000 });
    });

    test('FAQ Trades & Points section is present', async ({ page }) => {
        await expect(page.getByText('Trades & Points')).toBeVisible({ timeout: 8_000 });
    });

    test('FAQ P2P Networking section is present', async ({ page }) => {
        await expect(page.getByText('P2P Networking')).toBeVisible({ timeout: 8_000 });
    });

    test('Protocol Note about local-first architecture is present', async ({ page }) => {
        await expect(page.getByText(/Protocol Note/).first()).toBeVisible({ timeout: 8_000 });
        await expect(page.getByText(/local-first/i).first()).toBeVisible({ timeout: 8_000 });
    });

    // ─── GitHub credit (added in current session) ──────────────────────────────

    test('GitHub link for Doug Trier is present', async ({ page }) => {
        await expect(page.getByText('github.com/DougTrier')).toBeVisible({ timeout: 8_000 });
    });

    test('GitHub link opens correct URL', async ({ page }) => {
        const link = page.getByRole('link', { name: /github\.com\/DougTrier/i });
        await expect(link).toBeVisible({ timeout: 8_000 });
        await expect(link).toHaveAttribute('href', 'https://github.com/DougTrier');
    });
});
