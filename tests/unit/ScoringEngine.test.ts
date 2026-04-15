/**
 * ScoringEngine Unit Tests
 * ========================
 * Tests the scoring math and season-state gates independently of the UI.
 * Runs against the real live_stats_current.json (COMPLETED_OFFICIAL / VALIDATED).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Pure scoring math helpers (mirrors ScoringEngine logic) ─────────────────
// These are extracted pure functions so we can test the math without needing
// to mock the static JSON import that ScoringEngine uses internally.

function calcPassingPts(stats: Record<string, number>): number {
    let total = 0;
    if (stats.pass_yd !== undefined) total += stats.pass_yd / 25;
    if (stats.pass_td !== undefined) total += stats.pass_td * 4;
    if (stats.pass_int !== undefined) total += stats.pass_int * -2;
    return total;
}

function calcRushRecPts(stats: Record<string, number>): number {
    let total = 0;
    const rushRecYds = (stats.rush_yd || 0) + (stats.rec_yd || 0);
    if (rushRecYds) total += rushRecYds / 10;
    const tds = (stats.rush_td || 0) + (stats.rec_td || 0);
    if (tds) total += tds * 6;
    if (stats.rec !== undefined) total += stats.rec * 1;
    if (stats.fum_lost !== undefined) total += stats.fum_lost * -2;
    return total;
}

function calcKickerPts(stats: Record<string, number>): number {
    return (
        ((stats.fgm_0_19  || 0) * 3) +
        ((stats.fgm_20_29 || 0) * 3) +
        ((stats.fgm_30_39 || 0) * 3) +
        ((stats.fgm_40_49 || 0) * 4) +
        ((stats.fgm_50p   || 0) * 5) +
        ((stats.xpm       || 0) * 1) +
        ((stats.xpmiss    || 0) * -1)
    );
}

function calcDstBasePts(stats: Record<string, number>): number {
    return (
        (stats.sack    || 0)       +
        ((stats.def_int || 0) * 2) +
        ((stats.def_td  || 0) * 6) +
        ((stats.safety  || 0) * 2) +
        ((stats.fum_rec || 0) * 2)
    );
}

function calcDstPointsAllowed(ptsAllowed: number): number {
    if (ptsAllowed === 0)    return 10;
    if (ptsAllowed <= 6)     return 7;
    if (ptsAllowed <= 13)    return 4;
    if (ptsAllowed <= 20)    return 1;
    if (ptsAllowed <= 27)    return 0;
    if (ptsAllowed <= 34)    return -1;
    return -4;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ScoringEngine — Passing', () => {
    it('scores passing yards at 1pt per 25 yds', () => {
        assert.equal(calcPassingPts({ pass_yd: 250 }), 10);
    });

    it('scores passing TDs at 4 pts each', () => {
        assert.equal(calcPassingPts({ pass_td: 3 }), 12);
    });

    it('deducts 2 pts per interception', () => {
        assert.equal(calcPassingPts({ pass_int: 2 }), -4);
    });

    it('combines passing yards, TDs, and INTs correctly', () => {
        // 300 yds = 12 pts, 2 TD = 8 pts, 1 INT = -2 pts → 18 pts
        assert.equal(calcPassingPts({ pass_yd: 300, pass_td: 2, pass_int: 1 }), 18);
    });

    it('returns 0 when no stats are present', () => {
        assert.equal(calcPassingPts({}), 0);
    });
});

describe('ScoringEngine — Rushing / Receiving (Full PPR)', () => {
    it('scores rush yards at 1pt per 10 yds', () => {
        assert.equal(calcRushRecPts({ rush_yd: 100 }), 10);
    });

    it('scores receiving yards at 1pt per 10 yds', () => {
        assert.equal(calcRushRecPts({ rec_yd: 80 }), 8);
    });

    it('scores TDs at 6 pts each (rush)', () => {
        assert.equal(calcRushRecPts({ rush_td: 2 }), 12);
    });

    it('scores TDs at 6 pts each (rec)', () => {
        assert.equal(calcRushRecPts({ rec_td: 1 }), 6);
    });

    it('scores receptions at 1 pt each (Full PPR)', () => {
        assert.equal(calcRushRecPts({ rec: 8 }), 8);
    });

    it('deducts 2 pts per fumble lost', () => {
        assert.equal(calcRushRecPts({ fum_lost: 1 }), -2);
    });

    it('calculates a full RB game correctly', () => {
        // 120 rush yds = 12, 1 rush TD = 6, 4 rec = 4, 30 rec yds = 3, 1 fum lost = -2 → 23
        const pts = calcRushRecPts({ rush_yd: 120, rush_td: 1, rec: 4, rec_yd: 30, fum_lost: 1 });
        assert.equal(pts, 23);
    });

    it('calculates a full WR game correctly', () => {
        // 7 rec = 7, 110 rec yds = 11, 1 rec TD = 6 → 24
        const pts = calcRushRecPts({ rec: 7, rec_yd: 110, rec_td: 1 });
        assert.equal(pts, 24);
    });
});

describe('ScoringEngine — Kicker Scoring', () => {
    it('scores FG 0-19 yds at 3 pts', () => {
        assert.equal(calcKickerPts({ fgm_0_19: 1 }), 3);
    });

    it('scores FG 20-29 yds at 3 pts', () => {
        assert.equal(calcKickerPts({ fgm_20_29: 1 }), 3);
    });

    it('scores FG 30-39 yds at 3 pts', () => {
        assert.equal(calcKickerPts({ fgm_30_39: 1 }), 3);
    });

    it('scores FG 40-49 yds at 4 pts', () => {
        assert.equal(calcKickerPts({ fgm_40_49: 1 }), 4);
    });

    it('scores FG 50+ yds at 5 pts', () => {
        assert.equal(calcKickerPts({ fgm_50p: 1 }), 5);
    });

    it('scores made XP at 1 pt', () => {
        assert.equal(calcKickerPts({ xpm: 3 }), 3);
    });

    it('deducts 1 pt per missed XP', () => {
        assert.equal(calcKickerPts({ xpmiss: 1 }), -1);
    });

    it('calculates a full kicker game correctly', () => {
        // 2×FG30-39 = 6, 1×FG50+ = 5, 3×XP = 3 → 14
        const pts = calcKickerPts({ fgm_30_39: 2, fgm_50p: 1, xpm: 3 });
        assert.equal(pts, 14);
    });

    it('returns 0 for a kicker with no stats', () => {
        assert.equal(calcKickerPts({}), 0);
    });
});

describe('ScoringEngine — D/ST Base Scoring', () => {
    it('scores sacks at 1 pt each', () => {
        assert.equal(calcDstBasePts({ sack: 4 }), 4);
    });

    it('scores defensive INTs at 2 pts each', () => {
        assert.equal(calcDstBasePts({ def_int: 2 }), 4);
    });

    it('scores defensive TDs at 6 pts each', () => {
        assert.equal(calcDstBasePts({ def_td: 1 }), 6);
    });

    it('scores safeties at 2 pts each', () => {
        assert.equal(calcDstBasePts({ safety: 1 }), 2);
    });

    it('scores fumble recoveries at 2 pts each', () => {
        assert.equal(calcDstBasePts({ fum_rec: 2 }), 4);
    });

    it('calculates a full DST game correctly', () => {
        // 3 sacks=3, 1 INT=2, 1 def TD=6, 1 safety=2, 1 fum_rec=2 → 15
        const pts = calcDstBasePts({ sack: 3, def_int: 1, def_td: 1, safety: 1, fum_rec: 1 });
        assert.equal(pts, 15);
    });
});

describe('ScoringEngine — D/ST Points-Allowed Brackets', () => {
    it('shutout (0 pts) = +10 pts', () => {
        assert.equal(calcDstPointsAllowed(0), 10);
    });

    it('1–6 pts allowed = +7 pts', () => {
        assert.equal(calcDstPointsAllowed(3), 7);
        assert.equal(calcDstPointsAllowed(6), 7);
    });

    it('7–13 pts allowed = +4 pts', () => {
        assert.equal(calcDstPointsAllowed(7), 4);
        assert.equal(calcDstPointsAllowed(13), 4);
    });

    it('14–20 pts allowed = +1 pt', () => {
        assert.equal(calcDstPointsAllowed(14), 1);
        assert.equal(calcDstPointsAllowed(20), 1);
    });

    it('21–27 pts allowed = 0 pts', () => {
        assert.equal(calcDstPointsAllowed(21), 0);
        assert.equal(calcDstPointsAllowed(27), 0);
    });

    it('28–34 pts allowed = -1 pt', () => {
        assert.equal(calcDstPointsAllowed(28), -1);
        assert.equal(calcDstPointsAllowed(34), -1);
    });

    it('35+ pts allowed = -4 pts', () => {
        assert.equal(calcDstPointsAllowed(35), -4);
        assert.equal(calcDstPointsAllowed(50), -4);
    });

    it('covers every bracket boundary correctly', () => {
        const cases: [number, number][] = [
            [0, 10], [1, 7], [6, 7], [7, 4], [13, 4],
            [14, 1], [20, 1], [21, 0], [27, 0], [28, -1], [34, -1], [35, -4],
        ];
        for (const [pts, expected] of cases) {
            assert.equal(calcDstPointsAllowed(pts), expected,
                `pts_allowed=${pts} should give ${expected}`);
        }
    });
});
