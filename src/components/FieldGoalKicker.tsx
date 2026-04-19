/**
 * FieldGoalKicker — Head-to-Head Football Mini-Game
 * =====================================================
 * Kicker is centered at the 50-yard line. The RIGHT goal post (your target)
 * moves on THREE independent axes simultaneously:
 *   • Lateral   (left/right in the end zone)   → track with ← →
 *   • Depth     (closer/farther from kicker)   → affects post size + power needed
 *   • Crossbar  (rises and falls)              → track with ↑ ↓
 *
 * Use ALL FOUR arrow keys to keep the 2D crosshair inside the post opening,
 * then hold SPACE past the MIN line and release to kick.
 *
 * MODES:
 *   Practice  — no opponent, no timer
 *   VS CPU    — 2-min game; posts move faster, CPU ~55% accuracy
 *   VS League — Challenge a league member (P2P stub, falls back to CPU)
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';

// ── Canvas ─────────────────────────────────────────────────────────────────────
const W = 920, H = 480;
const CROWD_H = 178;
const FIELD_Y = CROWD_H;

// ── Kicker (centered) ──────────────────────────────────────────────────────────
const KICKER_X = W / 2;
const KICKER_Y = FIELD_Y + 55;

// ── Left post (CPU target) — fixed canvas position ────────────────────────────
const L_POST_BASE_X = 92;
const L_POST_HALF   = 50;   // no depth scaling on left post
const L_CB_BASE_Y   = FIELD_Y + 30;
const L_UP_TOP_Y    = L_CB_BASE_Y - 54;
const POST_FOOT     = FIELD_Y + 68;

// ── Right post (player target) — depth canvas position + scaled geometry ──────
const R_POST_FAR_X  = 828;  // canvas x when post is at maximum distance
const R_POST_NEAR_X = 660;  // canvas x when post is at minimum distance
const R_POST_HALF   = 50;   // base half-width (scaled by depth)
const R_CB_BASE_Y   = FIELD_Y + 30;

// Drift / oscillation amplitudes
const LAT_AMP    = 40;   // lateral drift ± px
const CB_AMP     = 30;   // crossbar height ± px

// ── Power ─────────────────────────────────────────────────────────────────────
const MAX_POWER  = 100;
const POWER_RATE = 1.0;   // units per frame — slower for more precision

// ── Flight ────────────────────────────────────────────────────────────────────
const FLIGHT_F = 52;

// ── Game ─────────────────────────────────────────────────────────────────────
const GAME_SECS = 120;
const AIM_SPEED = 2.4; // px per frame for aim movement

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase    = 'IDLE' | 'PLAYING' | 'GAME_OVER';
type GameMode = 'practice' | 'cpu' | 'league';

interface Ball {
    active: boolean;
    sx: number; sy: number;
    tx: number; ty: number;
    arcH: number;
    frame: number;
    success: boolean;
    short: boolean;
}

function freshBall(sx: number, sy: number): Ball {
    return { active: false, sx, sy, tx: 0, ty: 0, arcH: 55, frame: 0, success: false, short: false };
}

function loadBest(mode: GameMode): number {
    try { return parseInt(localStorage.getItem(`trier_fg_best_${mode}`) || '0', 10) || 0; }
    catch { return 0; }
}
function saveBest(mode: GameMode, n: number) {
    try { localStorage.setItem(`trier_fg_best_${mode}`, String(n)); } catch { /* non-fatal */ }
}

interface Props {
    isGameday: boolean;
    myTeamName: string;
    onStreakChange?: (n: number) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
export const FieldGoalKicker: React.FC<Props> = ({ isGameday, myTeamName }) => {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const phaseRef    = useRef<Phase>('IDLE');
    const modeRef     = useRef<GameMode>('cpu');
    const keysRef     = useRef<Set<string>>(new Set());

    // ── 2D aim crosshair (all 4 arrow keys) ───────────────────────────────────
    const aimXRef = useRef((R_POST_FAR_X + R_POST_NEAR_X) / 2);
    const aimYRef = useRef(R_CB_BASE_Y - 20); // default: just above crossbar

    const powerRef    = useRef(0);
    const chargingRef = useRef(false);

    // ── Left post state ────────────────────────────────────────────────────────
    const lLatPhaseRef = useRef(0);
    const lCBPhaseRef  = useRef(Math.PI * 0.8);
    const lPostXRef    = useRef(L_POST_BASE_X);  // current canvas x
    const lCBYRef      = useRef(L_CB_BASE_Y);    // current crossbar y

    // ── Right post state (3 axes) ──────────────────────────────────────────────
    const rLatPhaseRef  = useRef(Math.PI * 0.65); // lateral
    const rDepPhaseRef  = useRef(0);              // depth / distance
    const rCBPhaseRef   = useRef(Math.PI * 0.3);  // crossbar height

    // Derived right-post quantities (recomputed each tick)
    const rPostXRef   = useRef(R_POST_FAR_X);  // canvas x (depth + lateral)
    const rScaleRef   = useRef(1.0);            // depth scale (0.75 far → 1.35 close)
    const rCBYRef     = useRef(R_CB_BASE_Y);    // current crossbar y
    const rHalfRef    = useRef(R_POST_HALF);    // scaled upright half-width
    const rUpTopYRef  = useRef(R_CB_BASE_Y - 54); // scaled upright top
    const rMinPwrRef  = useRef(50);             // adjusted min power based on depth
    const rDistRef    = useRef(45);             // display distance in yards

    // ── Drift speed (set per mode) ─────────────────────────────────────────────
    const driftSpeedRef = useRef(0.013);

    // ── Balls ─────────────────────────────────────────────────────────────────
    const yourBallRef = useRef<Ball>(freshBall(KICKER_X, KICKER_Y));
    const oppBallRef  = useRef<Ball>(freshBall(KICKER_X, KICKER_Y));

    // ── Score / timer ──────────────────────────────────────────────────────────
    const yourScoreRef = useRef(0);
    const oppScoreRef  = useRef(0);
    const timeLeftRef  = useRef(GAME_SECS);
    const timerAccRef  = useRef(0);
    const aiTimerRef   = useRef(6000 + Math.random() * 4000);
    const aiAccRef     = useRef(0);
    const prevTsRef    = useRef(0);
    const rafRef       = useRef(0);
    const flashTimeRef = useRef<ReturnType<typeof setTimeout>>();

    const [yourScore, setYourScore] = useState(0);
    const [oppScore,  setOppScore]  = useState(0);
    const [timeLeft,  setTimeLeft]  = useState(GAME_SECS);
    const [phase,     setPhase]     = useState<Phase>('IDLE');
    const [gameMode,  setGameMode]  = useState<GameMode>('cpu');
    const [flash,     setFlash]     = useState<{ text: string; good: boolean } | null>(null);
    const [bestScore, setBestScore] = useState(0);
    const [leagueWait, setLeagueWait] = useState(false);

    const showFlash = useCallback((text: string, good: boolean) => {
        setFlash({ text, good });
        clearTimeout(flashTimeRef.current);
        flashTimeRef.current = setTimeout(() => setFlash(null), 1300);
    }, []);

    // ── Start game ─────────────────────────────────────────────────────────────
    const startGame = useCallback((mode: GameMode) => {
        modeRef.current = mode;
        setGameMode(mode);
        setBestScore(loadBest(mode));
        driftSpeedRef.current = mode === 'cpu' ? 0.020 : mode === 'league' ? 0.017 : 0.012;

        yourScoreRef.current = 0; oppScoreRef.current = 0;
        setYourScore(0); setOppScore(0);
        const secs = mode === 'practice' ? -1 : GAME_SECS;
        timeLeftRef.current = secs; setTimeLeft(secs);
        timerAccRef.current = 0; aiAccRef.current = 0;
        aiTimerRef.current = (mode === 'cpu' ? 4500 : 5000) + Math.random() * 4000;
        aimXRef.current = (R_POST_FAR_X + R_POST_NEAR_X) / 2;
        aimYRef.current = R_CB_BASE_Y - 20;
        powerRef.current = 0; chargingRef.current = false;
        yourBallRef.current = freshBall(KICKER_X, KICKER_Y);
        oppBallRef.current  = freshBall(KICKER_X, KICKER_Y);
        prevTsRef.current = 0;
        phaseRef.current = 'PLAYING'; setPhase('PLAYING');
    }, []);

    // ── Recompute right-post derived state (called each tick) ──────────────────
    const updateRightPost = useCallback(() => {
        const speed = driftSpeedRef.current;

        // Depth: slow oscillation — determines canvas X + scale
        rDepPhaseRef.current += speed * 0.35;
        const depthT = (1 + Math.sin(rDepPhaseRef.current)) / 2; // 0=far, 1=close
        const scale  = 0.78 + depthT * 0.54;   // 0.78 (far) to 1.32 (close)
        rScaleRef.current = scale;
        rHalfRef.current  = Math.round(R_POST_HALF * scale);
        rUpTopYRef.current = Math.round(rCBYRef.current - 54 * scale);

        // Canvas X shifts: close = near X, far = far X
        const baseCanvasX = R_POST_FAR_X - depthT * (R_POST_FAR_X - R_POST_NEAR_X);

        // Lateral drift on top of depth position
        rLatPhaseRef.current += speed;
        const lateral = Math.sin(rLatPhaseRef.current) * LAT_AMP;
        rPostXRef.current = baseCanvasX + lateral;

        // Crossbar moves up/down independently
        rCBPhaseRef.current += speed * 0.75;
        rCBYRef.current = R_CB_BASE_Y + Math.sin(rCBPhaseRef.current) * CB_AMP;

        // Recalculate upright top after CB move
        rUpTopYRef.current = Math.round(rCBYRef.current - 54 * scale);

        // Minimum power scales with distance: far = needs more power
        rMinPwrRef.current = Math.round(28 + (1 - depthT) * 38); // 28% (close) to 66% (far)

        // Yard distance display
        rDistRef.current = Math.round(25 + (1 - depthT) * 35); // 25 yd to 60 yd
    }, []);

    const updateLeftPost = useCallback(() => {
        const speed = driftSpeedRef.current;
        lLatPhaseRef.current += speed;
        lPostXRef.current = L_POST_BASE_X + Math.sin(lLatPhaseRef.current) * LAT_AMP;
        lCBPhaseRef.current += speed * 0.7;
        lCBYRef.current = L_CB_BASE_Y + Math.sin(lCBPhaseRef.current) * 20;
    }, []);

    // ── Draw ───────────────────────────────────────────────────────────────────
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const ph    = phaseRef.current;
        const mode  = modeRef.current;
        const lx    = lPostXRef.current;
        const lCBY  = lCBYRef.current;
        const rx    = rPostXRef.current;
        const rHalf = rHalfRef.current;
        const rCBY  = rCBYRef.current;
        const rUpT  = rUpTopYRef.current;
        const rMin  = rMinPwrRef.current;
        const rDist = rDistRef.current;
        const power = powerRef.current;
        const ax    = aimXRef.current;
        const ay    = aimYRef.current;
        const yb    = yourBallRef.current;
        const ob    = oppBallRef.current;

        ctx.clearRect(0, 0, W, H);

        // ── Stadium background ────────────────────────────────────────────────
        const stadGrd = ctx.createLinearGradient(0, 0, 0, CROWD_H);
        stadGrd.addColorStop(0, '#03070e'); stadGrd.addColorStop(0.5, '#091526'); stadGrd.addColorStop(1, '#0d1e35');
        ctx.fillStyle = stadGrd; ctx.fillRect(0, 0, W, CROWD_H);

        ctx.fillStyle = 'rgba(14,22,38,0.96)';
        for (let i = 0; i < 36; i++) {
            const cx = (i / 36) * W;
            ctx.fillRect(cx, 38 + Math.sin(i * 1.7) * 16 + (i % 4) * 9, 19 + (i % 3) * 5, 36 + (i % 4) * 10);
        }
        ctx.fillStyle = 'rgba(9,16,28,0.9)';
        for (let i = 0; i < 28; i++) {
            ctx.fillRect((i / 28) * W + 10, 80 + Math.cos(i * 2.1) * 11 + (i % 3) * 7, 26, 28 + (i % 3) * 5);
        }
        [W * 0.08, W * 0.26, W * 0.5, W * 0.74, W * 0.92].forEach(lx2 => {
            const lg = ctx.createRadialGradient(lx2, -5, 1, lx2, 30, 90);
            lg.addColorStop(0, 'rgba(255,255,215,1)'); lg.addColorStop(0.13, 'rgba(210,230,255,0.55)');
            lg.addColorStop(0.45, 'rgba(120,160,255,0.18)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = lg; ctx.fillRect(lx2 - 90, 0, 180, CROWD_H);
        });

        // ── Field ─────────────────────────────────────────────────────────────
        const fg = ctx.createLinearGradient(0, FIELD_Y, 0, H);
        fg.addColorStop(0, '#0e3d1f'); fg.addColorStop(0.4, '#165c2d'); fg.addColorStop(1, '#1a6b35');
        ctx.fillStyle = fg; ctx.fillRect(0, FIELD_Y, W, H - FIELD_Y);
        for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.09)'; ctx.fillRect(i * (W / 10), FIELD_Y, W / 10, H - FIELD_Y); }
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, FIELD_Y); ctx.lineTo(W, FIELD_Y); ctx.stroke();
        const yardLines = [W * 0.2, W * 0.35, W * 0.5, W * 0.65, W * 0.8];
        const yardNums  = ['30', '40', '50', '40', '30'];
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
        yardLines.forEach((x, i) => {
            ctx.beginPath(); ctx.moveTo(x, FIELD_Y); ctx.lineTo(x, H); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
            ctx.fillText(yardNums[i], x, FIELD_Y + 20);
        });
        ctx.fillStyle = 'rgba(234,179,8,0.05)';
        ctx.fillRect(0, FIELD_Y, 165, H - FIELD_Y);
        ctx.fillRect(W - 165, FIELD_Y, 165, H - FIELD_Y);

        // ── Left goal post ────────────────────────────────────────────────────
        const drawLeftPost = () => {
            const upT = lCBY - 54;
            ctx.shadowColor = '#eab308'; ctx.shadowBlur = 10; ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.moveTo(lx - L_POST_HALF, lCBY); ctx.lineTo(lx - L_POST_HALF, upT); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(lx + L_POST_HALF, lCBY); ctx.lineTo(lx + L_POST_HALF, upT); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(lx - L_POST_HALF, lCBY); ctx.lineTo(lx + L_POST_HALF, lCBY); ctx.stroke();
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(lx, lCBY); ctx.lineTo(lx, POST_FOOT); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(234,179,8,0.5)'; ctx.textAlign = 'center';
            ctx.fillText('YOUR END', lx, FIELD_Y - 9);
        };
        drawLeftPost();

        // ── Right goal post (scaled by depth) ─────────────────────────────────
        const drawRightPost = () => {
            // Success zone highlight (between uprights, above crossbar)
            ctx.fillStyle = 'rgba(74,222,128,0.07)';
            ctx.fillRect(rx - rHalf, rUpT, rHalf * 2, rCBY - rUpT);

            ctx.shadowColor = '#eab308'; ctx.shadowBlur = 14; ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.moveTo(rx - rHalf, rCBY); ctx.lineTo(rx - rHalf, rUpT); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rx + rHalf, rCBY); ctx.lineTo(rx + rHalf, rUpT); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rx - rHalf, rCBY); ctx.lineTo(rx + rHalf, rCBY); ctx.stroke();
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(rx, rCBY); ctx.lineTo(rx, POST_FOOT); ctx.stroke();
            ctx.shadowBlur = 0;

            // Distance label
            ctx.font = 'bold 11px monospace'; ctx.fillStyle = 'rgba(234,179,8,0.75)'; ctx.textAlign = 'center';
            ctx.fillText(`${rDist} YD`, rx, FIELD_Y - 9);
            ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillText('OPP END', rx, FIELD_Y - 20);
        };
        drawRightPost();

        // ── Kicker marker (centered) ──────────────────────────────────────────
        if (ph === 'PLAYING') {
            ctx.beginPath(); ctx.arc(KICKER_X, KICKER_Y + 12, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#60a5fa'; ctx.fill();
            ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(96,165,250,0.6)'; ctx.textAlign = 'center';
            ctx.fillText('YOU', KICKER_X, KICKER_Y + 27);
            if (mode !== 'practice') {
                ctx.beginPath(); ctx.arc(KICKER_X, KICKER_Y + 12, 5, 0, Math.PI * 2);
                // Draw CPU marker slightly offset
                ctx.beginPath(); ctx.arc(KICKER_X + 18, KICKER_Y + 12, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#f87171'; ctx.fill();
                ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(248,113,113,0.6)';
                ctx.fillText('CPU', KICKER_X + 18, KICKER_Y + 27);
            }
        }

        // ── 2D aim crosshair + trajectory preview ────────────────────────────
        if (ph === 'PLAYING' && !yb.active) {
            const inX = ax >= rx - rHalf && ax <= rx + rHalf;
            const inY = ay <= rCBY - 3;
            const willReach = !chargingRef.current || power >= rMin;
            const col = (inX && inY && willReach) ? 'rgba(74,222,128,0.95)'
                       : (inX && inY)              ? 'rgba(251,191,36,0.95)'
                       : 'rgba(248,113,113,0.9)';

            // Trajectory preview arc
            ctx.save();
            ctx.strokeStyle = col.replace('0.9', '0.18').replace('0.95', '0.18');
            ctx.lineWidth = 1; ctx.setLineDash([5, 7]);
            ctx.beginPath(); ctx.moveTo(KICKER_X, KICKER_Y);
            ctx.quadraticCurveTo((KICKER_X + ax) / 2, ay - 55, ax, ay);
            ctx.stroke(); ctx.setLineDash([]); ctx.restore();

            // Crosshair: horizontal + vertical lines
            ctx.strokeStyle = col; ctx.lineWidth = 1.5;
            // Horizontal line of crosshair
            ctx.beginPath(); ctx.moveTo(ax - 14, ay); ctx.lineTo(ax + 14, ay); ctx.stroke();
            // Vertical line of crosshair
            ctx.beginPath(); ctx.moveTo(ax, ay - 14); ctx.lineTo(ax, ay + 14); ctx.stroke();
            // Center dot
            ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();

            // Charging status text
            if (chargingRef.current) {
                ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
                ctx.fillStyle = willReach ? '#4ade80' : '#fbbf24';
                ctx.fillText(willReach ? 'RELEASE!' : 'HOLD...', ax, rUpT - 14);
            }
        }

        // ── Power bar ─────────────────────────────────────────────────────────
        if (chargingRef.current && ph === 'PLAYING') {
            const bw = 16, bh = 100, bx = KICKER_X - 60, by = FIELD_Y + 58;
            ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx, by, bw, bh);
            const fill = (power / MAX_POWER) * bh;
            ctx.fillStyle = power < rMin ? '#ef4444' : power < 80 ? '#4ade80' : '#facc15';
            ctx.fillRect(bx, by + bh - fill, bw, fill);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
            // MIN threshold line (adjusts with depth)
            const threshY = by + bh - (rMin / MAX_POWER) * bh;
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(bx - 2, threshY); ctx.lineTo(bx + bw + 2, threshY); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
            ctx.fillText('MIN', bx + bw + 4, threshY + 3);
            ctx.fillStyle = '#fff'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
            ctx.fillText('PWR', bx + bw / 2, by - 5);
        }

        // ── Balls in flight ───────────────────────────────────────────────────
        const drawBall = (ball: Ball) => {
            if (!ball.active) return;
            const t  = ball.frame / FLIGHT_F;
            const bx = ball.sx + (ball.tx - ball.sx) * t;
            const by = ball.sy + (ball.ty - ball.sy) * t - Math.sin(t * Math.PI) * ball.arcH;
            ctx.beginPath(); ctx.ellipse(bx, POST_FOOT - 3, 6 * (1 - t * 0.4), 2, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
            ctx.beginPath(); ctx.arc(bx, by, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = '#92400e'; ctx.fill();
            ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(bx - 2, by - 3); ctx.lineTo(bx + 2, by + 3); ctx.stroke();
        };
        drawBall(yb); drawBall(ob);

        // ── Score / timer panel ───────────────────────────────────────────────
        const mm = timeLeftRef.current < 0 ? '--' : String(Math.floor(timeLeftRef.current / 60));
        const ss = timeLeftRef.current < 0 ? '--' : String(timeLeftRef.current % 60).padStart(2, '0');
        const timerStr = timeLeftRef.current < 0 ? 'PRACTICE' : `${mm}:${ss}`;
        const panelW = 340, panelH = 44, px = W / 2 - panelW / 2, py = 8;
        ctx.fillStyle = 'rgba(8,12,24,0.88)';
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void }).roundRect(px, py, panelW, panelH, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(234,179,8,0.4)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#94a3b8';
        ctx.fillText(myTeamName.toUpperCase().slice(0, 11), px + 10, py + 16);
        ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#4ade80';
        ctx.fillText(String(yourScoreRef.current), px + 10, py + 37);
        if (mode !== 'practice') {
            ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#94a3b8';
            ctx.fillText(mode === 'league' ? 'LEAGUE' : 'CPU', px + panelW - 10, py + 16);
            ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#f87171';
            ctx.fillText(String(oppScoreRef.current), px + panelW - 10, py + 37);
        }
        ctx.font = timeLeftRef.current < 0 ? 'bold 11px monospace' : 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = timeLeftRef.current >= 0 && timeLeftRef.current <= 10 ? '#ef4444' : '#eab308';
        ctx.fillText(timerStr, W / 2, py + (timeLeftRef.current < 0 ? 28 : 29));

        // ── Controls hint ─────────────────────────────────────────────────────
        if (ph === 'PLAYING') {
            ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.textAlign = 'center';
            ctx.fillText('← → track lateral  ·  ↑ ↓ track crossbar  ·  hold SPACE past MIN · release', W / 2, H - 6);
        }

        // ── IDLE overlay ──────────────────────────────────────────────────────
        if (ph === 'IDLE') {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(W / 2 - 240, H / 2 - 40, 480, 80);
            ctx.fillStyle = '#eab308'; ctx.font = "bold 16px 'Graduate',monospace"; ctx.textAlign = 'center';
            ctx.fillText('HEAD-TO-HEAD FIELD GOAL', W / 2, H / 2 - 10);
            ctx.fillStyle = '#9ca3af'; ctx.font = '11px monospace';
            ctx.fillText('Post moves in 3 directions — use all 4 arrows + SPACE', W / 2, H / 2 + 15);
            ctx.fillStyle = '#6b7280'; ctx.font = '10px monospace';
            ctx.fillText('Select a mode below', W / 2, H / 2 + 34);
        }

        // ── GAME OVER overlay ─────────────────────────────────────────────────
        if (ph === 'GAME_OVER') {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.beginPath();
            (ctx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void }).roundRect(W / 2 - 195, H / 2 - 68, 390, 136, 12);
            ctx.fill();
            const won  = yourScoreRef.current > oppScoreRef.current;
            const tied = yourScoreRef.current === oppScoreRef.current;
            ctx.fillStyle = won ? '#4ade80' : tied ? '#eab308' : '#f87171';
            ctx.font = "bold 26px 'Graduate',monospace"; ctx.textAlign = 'center';
            ctx.fillText(won ? 'YOU WIN!' : tied ? 'TIE GAME' : 'CPU WINS', W / 2, H / 2 - 28);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace';
            ctx.fillText(`${yourScoreRef.current} FG  —  ${oppScoreRef.current} FG`, W / 2, H / 2 + 2);
            ctx.fillStyle = '#9ca3af'; ctx.font = '11px monospace';
            ctx.fillText('Choose a mode below to play again', W / 2, H / 2 + 28);
            if (bestScore > 0) {
                ctx.fillStyle = '#eab308'; ctx.font = '10px monospace';
                ctx.fillText(`Best: ${bestScore} FG`, W / 2, H / 2 + 50);
            }
        }
    }, [myTeamName, bestScore]);

    // ── Game loop ──────────────────────────────────────────────────────────────
    const tick = useCallback((ts: number) => {
        const dt  = prevTsRef.current ? Math.min(ts - prevTsRef.current, 50) : 16;
        prevTsRef.current = ts;
        const ph   = phaseRef.current;
        const mode = modeRef.current;
        const keys = keysRef.current;

        // Posts drift every frame regardless of phase
        updateRightPost();
        updateLeftPost();

        if (ph === 'PLAYING') {
            // ── Timer ─────────────────────────────────────────────────────────
            if (timeLeftRef.current >= 0) {
                timerAccRef.current += dt;
                if (timerAccRef.current >= 1000) {
                    timerAccRef.current -= 1000;
                    const nt = Math.max(0, timeLeftRef.current - 1);
                    timeLeftRef.current = nt; setTimeLeft(nt);
                    if (nt === 0) {
                        phaseRef.current = 'GAME_OVER'; setPhase('GAME_OVER');
                        const s = yourScoreRef.current;
                        if (s > loadBest(mode)) { saveBest(mode, s); setBestScore(s); }
                        draw(); return;
                    }
                }
            }

            // ── 2D aim movement (all 4 arrow keys) ────────────────────────────
            if (!yourBallRef.current.active) {
                // Horizontal: follow lateral + depth range of right post
                const rxc = rPostXRef.current;
                const rh  = rHalfRef.current;
                const loX = rxc - rh - 40, hiX = rxc + rh + 40;
                if (keys.has('ArrowLeft'))  aimXRef.current = Math.max(loX, aimXRef.current - AIM_SPEED);
                if (keys.has('ArrowRight')) aimXRef.current = Math.min(hiX, aimXRef.current + AIM_SPEED);
                // Vertical: from well above uprights to below crossbar
                const loY = rUpTopYRef.current - 30, hiY = POST_FOOT + 10;
                if (keys.has('ArrowUp'))   aimYRef.current = Math.max(loY, aimYRef.current - AIM_SPEED);
                if (keys.has('ArrowDown')) aimYRef.current = Math.min(hiY, aimYRef.current + AIM_SPEED);
            }

            // ── Power ─────────────────────────────────────────────────────────
            if (chargingRef.current && !yourBallRef.current.active)
                powerRef.current = Math.min(MAX_POWER, powerRef.current + POWER_RATE);

            // ── Advance your ball ─────────────────────────────────────────────
            const yb = yourBallRef.current;
            if (yb.active) {
                yb.frame++;
                if (yb.frame >= FLIGHT_F) {
                    yb.active = false;
                    if (yb.short)        showFlash('SHORT!', false);
                    else if (yb.success) { yourScoreRef.current++; setYourScore(s => s + 1); showFlash('GOOD!', true); }
                    else                  showFlash('NO GOOD', false);
                }
            }

            // ── Advance CPU ball ──────────────────────────────────────────────
            const ob = oppBallRef.current;
            if (ob.active) {
                ob.frame++;
                if (ob.frame >= FLIGHT_F) {
                    ob.active = false;
                    if (ob.success) { oppScoreRef.current++; setOppScore(s => s + 1); }
                }
            }

            // ── CPU auto-kick ─────────────────────────────────────────────────
            if (mode !== 'practice' && !ob.active) {
                aiAccRef.current += dt;
                if (aiAccRef.current >= aiTimerRef.current) {
                    aiAccRef.current = 0;
                    aiTimerRef.current = (mode === 'cpu' ? 4500 : 5000) + Math.random() * 4500;
                    const accuracy = mode === 'cpu' ? 0.55 : 0.60;
                    const makes    = Math.random() < accuracy;
                    const lcx      = lPostXRef.current;
                    const lcby     = lCBYRef.current;
                    const aiAimX   = makes ? lcx + (Math.random() - 0.5) * L_POST_HALF * 1.2
                                           : lcx + (L_POST_HALF + 8 + Math.random() * 25) * (Math.random() > 0.5 ? 1 : -1);
                    const aiAimY   = makes ? lcby - 10 - Math.random() * 20
                                           : lcby + 5 + Math.random() * 15;
                    ob.active = true; ob.sx = KICKER_X + 18; ob.sy = KICKER_Y;
                    ob.tx = aiAimX; ob.ty = aiAimY; ob.arcH = 50 + Math.random() * 20;
                    ob.frame = 0; ob.success = makes; ob.short = false;
                }
            }
        }

        draw();
        rafRef.current = requestAnimationFrame(tick);
    }, [draw, showFlash, updateRightPost, updateLeftPost]);

    // ── Keyboard ───────────────────────────────────────────────────────────────
    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            // Prevent arrow keys from scrolling the page while game is active
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key) && phaseRef.current === 'PLAYING')
                e.preventDefault();
            keysRef.current.add(e.key);
            if (e.key === ' ' && phaseRef.current === 'PLAYING'
                && !yourBallRef.current.active && !chargingRef.current) {
                chargingRef.current = true; powerRef.current = 0;
            }
        };
        const onUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.key);
            if (e.key === ' ' && phaseRef.current === 'PLAYING' && chargingRef.current) {
                chargingRef.current = false;
                const power = powerRef.current;
                const minP  = rMinPwrRef.current;
                const rxc   = rPostXRef.current;
                const rh    = rHalfRef.current;
                const rCBY  = rCBYRef.current;
                const ax = aimXRef.current, ay = aimYRef.current;

                const reachesPost = power >= minP;
                const inX = ax >= rxc - rh && ax <= rxc + rh;
                const inY = ay <= rCBY - 2; // above crossbar

                const tx = reachesPost ? ax : KICKER_X + (power / minP) * (ax - KICKER_X) * 0.88;
                const ty = reachesPost ? ay : POST_FOOT;
                const arcH = reachesPost ? Math.max(28, 80 - power * 0.54) : 22 + power * 0.25;

                const yb = yourBallRef.current;
                yb.active = true; yb.sx = KICKER_X; yb.sy = KICKER_Y;
                yb.tx = tx; yb.ty = ty; yb.arcH = arcH;
                yb.frame = 0; yb.success = reachesPost && inX && inY; yb.short = !reachesPost;
                powerRef.current = 0;
            }
        };
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup',   onUp);
        return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
    }, []);

    // ── Animation loop ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isGameday) return;
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [isGameday, tick]);

    useEffect(() => { if (isGameday) draw(); }, [isGameday, draw]);

    // ── Off-season placeholder ─────────────────────────────────────────────────
    if (!isGameday) {
        return (
            <div style={{ margin: '2rem auto', maxWidth: 800, textAlign: 'center', background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '2.5rem 1.5rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏈</div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#eab308', fontFamily: "'Graduate',sans-serif", letterSpacing: '0.05em' }}>HEAD-TO-HEAD FIELD GOAL CHALLENGE</div>
                <div style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.9rem' }}>Check back on gameday (Sun / Mon / Thu) to play.</div>
            </div>
        );
    }

    const modeBtn = (m: GameMode, label: string, sub: string) => (
        <button key={m}
            onClick={() => {
                setLeagueWait(false);
                if (m === 'league') { setLeagueWait(true); setTimeout(() => { setLeagueWait(false); startGame('league'); }, 3000); }
                else startGame(m);
            }}
            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                background: gameMode === m && phase !== 'IDLE' ? 'rgba(234,179,8,0.15)' : 'rgba(10,14,26,0.82)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${gameMode === m && phase !== 'IDLE' ? 'rgba(234,179,8,0.6)' : 'rgba(255,255,255,0.08)'}`,
                color: '#fff', textAlign: 'center' as const }}
        >
            <div style={{ fontWeight: 900, fontSize: '0.82rem', fontFamily: "'Graduate',sans-serif", color: gameMode === m && phase !== 'IDLE' ? '#eab308' : '#d1d5db', letterSpacing: '0.04em' }}>{label}</div>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px' }}>{sub}</div>
        </button>
    );

    return (
        <div style={{ padding: '0 2rem 2.5rem' }}>
            <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: '#eab308', fontFamily: "'Graduate',sans-serif", letterSpacing: '0.05em' }}>FIELD GOAL CHALLENGE</span>
                <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{myTeamName} · 3-axis moving post · all 4 arrows</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {modeBtn('practice', 'PRACTICE',  'Solo · no timer')}
                {modeBtn('cpu',      'VS CPU',     '2 min · harder')}
                {modeBtn('league',   'VS LEAGUE',  'Challenge a member')}
            </div>
            {leagueWait && (
                <div style={{ textAlign: 'center', color: '#eab308', fontSize: '0.82rem', marginBottom: '8px', padding: '6px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '6px' }}>
                    🔍 Finding a league opponent… (3s)
                </div>
            )}
            <div style={{ position: 'relative', width: '100%', maxWidth: W }}>
                <canvas ref={canvasRef} width={W} height={H} tabIndex={0}
                    style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                />
                {flash && (
                    <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: "'Graduate',sans-serif", fontWeight: 900, fontSize: 'clamp(2rem,5vw,3.2rem)', color: flash.good ? '#4ade80' : '#ef4444', textShadow: `0 0 24px ${flash.good ? '#4ade80' : '#ef4444'}`, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                        {flash.text}
                    </div>
                )}
            </div>
        </div>
    );
};
