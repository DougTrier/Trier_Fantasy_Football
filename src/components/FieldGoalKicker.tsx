/**
 * FieldGoalKicker — Head-to-Head Football Mini-Game
 * =====================================================
 * Stadium broadcast-angle view. Two goal posts drift laterally.
 * LEFT = your end zone (CPU/opponent kicks here).
 * RIGHT = opponent's end zone (you kick here).
 *
 * POWER MECHANIC: The ball must be charged to ≥50% to reach the posts.
 * A quick tap sends the ball SHORT. Hold SPACE until the bar clears the
 * MIN marker, then release. Full charge = flat, fast kick.
 *
 * MODES:
 *   Practice  — no opponent, no timer. Learn the controls.
 *   VS CPU    — 2-min game vs CPU. Faster posts, CPU wins ~30% of the time.
 *   VS League — Challenge a league member (P2P stub; falls back to CPU).
 *
 * CONTROLS:
 *   ← / →        — track the drifting right goal post
 *   SPACE (hold)  — charge power (watch the MIN line on the bar)
 *   SPACE (release) — kick
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';

// ── Canvas ─────────────────────────────────────────────────────────────────────
const W = 920, H = 480;
const CROWD_H = 178;
const FIELD_Y = CROWD_H;

// ── Goal post geometry ─────────────────────────────────────────────────────────
const L_POST_CX = 92;
const R_POST_CX = 828;
const POST_HALF = 50;          // half-width between uprights
const CB_Y      = FIELD_Y + 30; // crossbar y
const UP_TOP_Y  = CB_Y - 54;   // upright tops
const POST_FOOT = FIELD_Y + 68; // support base on field

// ── Post drift ─────────────────────────────────────────────────────────────────
const DRIFT_AMP = 42; // lateral drift amplitude (px)
// Speed set per mode — practice: 0.013, CPU: 0.022, league: 0.018

// ── Ball parameters ────────────────────────────────────────────────────────────
const YOUR_SX = 245, YOUR_SY = FIELD_Y + 54;
const OPP_SX  = 675, OPP_SY  = FIELD_Y + 54;
const FLIGHT_F = 52; // frames for ball to reach goal post

// ── Power mechanic ─────────────────────────────────────────────────────────────
const MIN_REACH_POWER = 50; // must charge to ≥50 out of 100 or ball falls SHORT
const MAX_POWER       = 100;
const POWER_RATE      = 1.0; // units per frame — slower = more precision required

// ── Game ───────────────────────────────────────────────────────────────────────
const GAME_SECS = 120;
const AIM_SPEED = 2.8;

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase    = 'IDLE' | 'PLAYING' | 'GAME_OVER';
type GameMode = 'practice' | 'cpu' | 'league';

interface Ball {
    active: boolean;
    sx: number; sy: number; // start
    tx: number; ty: number; // target (locked at kick)
    arcH: number;           // arc height (higher = lofted, lower = laser)
    frame: number;
    success: boolean;       // field goal made?
    short: boolean;         // underpowered — fell short?
}

function freshBall(sx: number, sy: number): Ball {
    return { active: false, sx, sy, tx: 0, ty: 0, arcH: 60, frame: 0, success: false, short: false };
}

function loadBest(mode: GameMode): number {
    try { return parseInt(localStorage.getItem(`trier_fg_best_${mode}`) || '0', 10) || 0; }
    catch { return 0; }
}

function saveBest(mode: GameMode, n: number): void {
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

    const aimXRef      = useRef(R_POST_CX);
    const powerRef     = useRef(0);
    const chargingRef  = useRef(false);

    // Post drift (phase angle per post, out-of-sync for variety)
    const lPhaseRef    = useRef(0);
    const rPhaseRef    = useRef(Math.PI * 0.65);
    const lPostXRef    = useRef(L_POST_CX);
    const rPostXRef    = useRef(R_POST_CX);
    const driftSpeedRef = useRef(0.013);

    const yourBallRef  = useRef<Ball>(freshBall(YOUR_SX, YOUR_SY));
    const oppBallRef   = useRef<Ball>(freshBall(OPP_SX, OPP_SY));

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
    const [leagueWait, setLeagueWait] = useState(false); // "finding opponent" splash

    // ── Flash helper ────────────────────────────────────────────────────────────
    const showFlash = useCallback((text: string, good: boolean) => {
        setFlash({ text, good });
        clearTimeout(flashTimeRef.current);
        flashTimeRef.current = setTimeout(() => setFlash(null), 1300);
    }, []);

    // ── Start game ──────────────────────────────────────────────────────────────
    const startGame = useCallback((mode: GameMode) => {
        modeRef.current = mode;
        setGameMode(mode);
        setBestScore(loadBest(mode));
        driftSpeedRef.current = mode === 'cpu' ? 0.022 : mode === 'league' ? 0.018 : 0.013;

        yourScoreRef.current = 0; oppScoreRef.current = 0;
        setYourScore(0); setOppScore(0);
        // Practice has no timer (set to a huge number so display shows "--")
        const secs = mode === 'practice' ? -1 : GAME_SECS;
        timeLeftRef.current = secs; setTimeLeft(secs);
        timerAccRef.current = 0; aiAccRef.current = 0;
        // CPU kicks slightly faster in CPU/league mode
        aiTimerRef.current = (mode === 'practice' ? 99999 : mode === 'cpu' ? 4500 : 5000)
            + Math.random() * 4000;
        aimXRef.current = R_POST_CX;
        powerRef.current = 0; chargingRef.current = false;
        yourBallRef.current = freshBall(YOUR_SX, YOUR_SY);
        oppBallRef.current  = freshBall(OPP_SX, OPP_SY);
        prevTsRef.current = 0;
        phaseRef.current = 'PLAYING'; setPhase('PLAYING');
    }, []);

    // ── Draw ────────────────────────────────────────────────────────────────────
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const lx    = lPostXRef.current;
        const rx    = rPostXRef.current;
        const aim   = aimXRef.current;
        const power = powerRef.current;
        const ph    = phaseRef.current;
        const mode  = modeRef.current;
        const yb    = yourBallRef.current;
        const ob    = oppBallRef.current;

        ctx.clearRect(0, 0, W, H);

        // ── Stadium background ────────────────────────────────────────────────
        const stadGrd = ctx.createLinearGradient(0, 0, 0, CROWD_H);
        stadGrd.addColorStop(0,   '#03070e');
        stadGrd.addColorStop(0.5, '#091526');
        stadGrd.addColorStop(1,   '#0d1e35');
        ctx.fillStyle = stadGrd;
        ctx.fillRect(0, 0, W, CROWD_H);

        // Crowd silhouettes
        ctx.fillStyle = 'rgba(14,22,38,0.96)';
        for (let i = 0; i < 36; i++) {
            const cx = (i / 36) * W;
            const cy = 38 + Math.sin(i * 1.7) * 16 + (i % 4) * 9;
            ctx.fillRect(cx, cy, 19 + (i % 3) * 5, 36 + (i % 4) * 10);
        }
        ctx.fillStyle = 'rgba(9,16,28,0.9)';
        for (let i = 0; i < 28; i++) {
            ctx.fillRect((i / 28) * W + 10, 80 + Math.cos(i * 2.1) * 11 + (i % 3) * 7, 26, 28 + (i % 3) * 5);
        }

        // Stadium lights
        [W * 0.08, W * 0.26, W * 0.5, W * 0.74, W * 0.92].forEach(lightX => {
            const lg = ctx.createRadialGradient(lightX, -5, 1, lightX, 30, 90);
            lg.addColorStop(0,    'rgba(255,255,215,1)');
            lg.addColorStop(0.13, 'rgba(210,230,255,0.55)');
            lg.addColorStop(0.45, 'rgba(120,160,255,0.18)');
            lg.addColorStop(1,    'rgba(0,0,0,0)');
            ctx.fillStyle = lg;
            ctx.fillRect(lightX - 90, 0, 180, CROWD_H);
        });

        // ── Football field ────────────────────────────────────────────────────
        const fg = ctx.createLinearGradient(0, FIELD_Y, 0, H);
        fg.addColorStop(0, '#0e3d1f'); fg.addColorStop(0.4, '#165c2d'); fg.addColorStop(1, '#1a6b35');
        ctx.fillStyle = fg;
        ctx.fillRect(0, FIELD_Y, W, H - FIELD_Y);

        // Alternating stripes
        for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.09)'; ctx.fillRect(i * (W / 10), FIELD_Y, W / 10, H - FIELD_Y); }
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, FIELD_Y); ctx.lineTo(W, FIELD_Y); ctx.stroke();

        // Yard lines + numbers
        const yardLines = [W * 0.2, W * 0.35, W * 0.5, W * 0.65, W * 0.8];
        const yardNums  = ['30', '40', '50', '40', '30'];
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
        yardLines.forEach((x, i) => {
            ctx.beginPath(); ctx.moveTo(x, FIELD_Y); ctx.lineTo(x, H); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
            ctx.fillText(yardNums[i], x, FIELD_Y + 20);
        });

        // End zone tints
        ctx.fillStyle = 'rgba(234,179,8,0.05)';
        ctx.fillRect(0, FIELD_Y, 160, H - FIELD_Y);
        ctx.fillRect(W - 160, FIELD_Y, 160, H - FIELD_Y);

        // ── Goal posts ────────────────────────────────────────────────────────
        const drawPost = (cx: number) => {
            ctx.shadowColor = '#eab308'; ctx.shadowBlur = 12;
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.moveTo(cx - POST_HALF, CB_Y); ctx.lineTo(cx - POST_HALF, UP_TOP_Y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + POST_HALF, CB_Y); ctx.lineTo(cx + POST_HALF, UP_TOP_Y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx - POST_HALF, CB_Y); ctx.lineTo(cx + POST_HALF, CB_Y); ctx.stroke();
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(cx, CB_Y); ctx.lineTo(cx, POST_FOOT); ctx.stroke();
            ctx.shadowBlur = 0;
        };
        drawPost(lx); drawPost(rx);

        ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(234,179,8,0.5)'; ctx.textAlign = 'center';
        ctx.fillText('YOUR END ZONE', lx, FIELD_Y - 9);
        ctx.fillText('OPP END ZONE', rx, FIELD_Y - 9);

        // ── Kicker markers ────────────────────────────────────────────────────
        if (ph === 'PLAYING') {
            ctx.beginPath(); ctx.arc(YOUR_SX, YOUR_SY + 12, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#60a5fa'; ctx.fill();
            if (mode !== 'practice') {
                ctx.beginPath(); ctx.arc(OPP_SX, OPP_SY + 12, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#f87171'; ctx.fill();
            }
        }

        // ── Aim indicator ─────────────────────────────────────────────────────
        if (ph === 'PLAYING' && !yb.active) {
            const inside = aim >= rx - POST_HALF && aim <= rx + POST_HALF;
            // When charging, show whether power will reach
            const willReach = !chargingRef.current || power >= MIN_REACH_POWER;
            const aimCol = !inside ? 'rgba(248,113,113,0.9)'
                : willReach ? 'rgba(74,222,128,0.9)'
                : 'rgba(251,191,36,0.9)'; // yellow = in range but underpowered

            // Dotted trajectory preview arc
            ctx.save();
            ctx.strokeStyle = `${aimCol.replace('0.9', '0.22')}`;
            ctx.lineWidth = 1; ctx.setLineDash([5, 7]);
            ctx.beginPath(); ctx.moveTo(YOUR_SX, YOUR_SY);
            ctx.quadraticCurveTo((YOUR_SX + aim) / 2, CB_Y - 60, aim, CB_Y - 4);
            ctx.stroke(); ctx.setLineDash([]); ctx.restore();

            // Aim vertical line
            ctx.strokeStyle = aimCol; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(aim, UP_TOP_Y - 8); ctx.lineTo(aim, POST_FOOT); ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(aim, CB_Y, 5, 0, Math.PI * 2);
            ctx.fillStyle = aimCol; ctx.fill();

            // Charging hint text
            if (chargingRef.current) {
                ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
                ctx.fillStyle = willReach ? '#4ade80' : '#fbbf24';
                ctx.fillText(willReach ? 'RELEASE TO KICK' : 'HOLD LONGER...', aim, UP_TOP_Y - 18);
            }
        }

        // ── Power bar ─────────────────────────────────────────────────────────
        if (chargingRef.current && ph === 'PLAYING') {
            const bw = 16, bh = 100, bx = 168, by = FIELD_Y + 62;
            ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx, by, bw, bh);
            const fill = (power / MAX_POWER) * bh;
            ctx.fillStyle = power < MIN_REACH_POWER ? '#ef4444' : power < 75 ? '#4ade80' : '#facc15';
            ctx.fillRect(bx, by + bh - fill, bw, fill);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);

            // MIN threshold line — must pass this to reach the post
            const threshY = by + bh - (MIN_REACH_POWER / MAX_POWER) * bh;
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(bx - 2, threshY); ctx.lineTo(bx + bw + 2, threshY); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
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

            ctx.beginPath(); ctx.ellipse(bx, POST_FOOT - 3, 7 * (1 - t * 0.5), 2, 0, 0, Math.PI * 2);
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

        const label = myTeamName.toUpperCase().slice(0, 11);
        const oppLabel = mode === 'practice' ? '' : mode === 'league' ? 'LEAGUE' : 'CPU';
        ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#94a3b8';
        ctx.fillText(label, px + 10, py + 16);
        ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#4ade80';
        ctx.fillText(String(yourScoreRef.current), px + 10, py + 37);
        if (oppLabel) {
            ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#94a3b8';
            ctx.fillText(oppLabel, px + panelW - 10, py + 16);
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
            ctx.fillText('← → aim  ·  hold SPACE past MIN line  ·  release to kick', W / 2, H - 6);
        }

        // ── IDLE screen ───────────────────────────────────────────────────────
        if (ph === 'IDLE') {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(W / 2 - 200, H / 2 - 30, 400, 70);
            ctx.fillStyle = '#eab308'; ctx.font = "bold 16px 'Graduate',monospace"; ctx.textAlign = 'center';
            ctx.fillText('HEAD-TO-HEAD FIELD GOAL', W / 2, H / 2 + 2);
            ctx.fillStyle = '#9ca3af'; ctx.font = '11px monospace';
            ctx.fillText('Select a mode below to begin', W / 2, H / 2 + 22);
        }

        // ── GAME OVER screen ──────────────────────────────────────────────────
        if (ph === 'GAME_OVER') {
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
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
            ctx.fillText('Choose a mode below to play again', W / 2, H / 2 + 26);
            if (bestScore > 0) {
                ctx.fillStyle = '#eab308'; ctx.font = '10px monospace';
                ctx.fillText(`Best: ${bestScore} FG`, W / 2, H / 2 + 48);
            }
        }
    }, [myTeamName, bestScore]);

    // ── Game loop ───────────────────────────────────────────────────────────────
    const tick = useCallback((ts: number) => {
        const dt  = prevTsRef.current ? Math.min(ts - prevTsRef.current, 50) : 16;
        prevTsRef.current = ts;
        const ph   = phaseRef.current;
        const mode = modeRef.current;
        const keys = keysRef.current;

        // Posts always drift (even idle — looks nice)
        lPhaseRef.current += driftSpeedRef.current;
        rPhaseRef.current += driftSpeedRef.current;
        lPostXRef.current = L_POST_CX + Math.sin(lPhaseRef.current) * DRIFT_AMP;
        rPostXRef.current = R_POST_CX + Math.sin(rPhaseRef.current) * DRIFT_AMP;

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

            // ── Aim ───────────────────────────────────────────────────────────
            if (!yourBallRef.current.active) {
                const lo = R_POST_CX - DRIFT_AMP - POST_HALF - 18;
                const hi = R_POST_CX + DRIFT_AMP + POST_HALF + 18;
                if (keys.has('ArrowLeft'))  aimXRef.current = Math.max(lo, aimXRef.current - AIM_SPEED);
                if (keys.has('ArrowRight')) aimXRef.current = Math.min(hi, aimXRef.current + AIM_SPEED);
            }

            // ── Power charge ──────────────────────────────────────────────────
            if (chargingRef.current && !yourBallRef.current.active)
                powerRef.current = Math.min(MAX_POWER, powerRef.current + POWER_RATE);

            // ── Advance your ball ─────────────────────────────────────────────
            const yb = yourBallRef.current;
            if (yb.active) {
                yb.frame++;
                if (yb.frame >= FLIGHT_F) {
                    yb.active = false;
                    if (yb.short)         showFlash('SHORT!', false);
                    else if (yb.success)  { yourScoreRef.current++; setYourScore(s => s + 1); showFlash('GOOD!', true); }
                    else                   showFlash('NO GOOD', false);
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

            // ── CPU auto-kick (not in practice) ───────────────────────────────
            if (mode !== 'practice' && !ob.active) {
                aiAccRef.current += dt;
                if (aiAccRef.current >= aiTimerRef.current) {
                    aiAccRef.current = 0;
                    aiTimerRef.current = (mode === 'cpu' ? 4500 : 5000) + Math.random() * 4500;
                    // CPU accuracy: ~55% in CPU mode, ~60% in league mode (player wins ~70%)
                    const accuracy = mode === 'cpu' ? 0.55 : 0.60;
                    const makes    = Math.random() < accuracy;
                    const lx       = lPostXRef.current;
                    const aiAim    = makes
                        ? lx + (Math.random() - 0.5) * (POST_HALF * 1.3)
                        : lx + (POST_HALF + 8 + Math.random() * 28) * (Math.random() > 0.5 ? 1 : -1);
                    ob.active = true; ob.sx = OPP_SX; ob.sy = OPP_SY;
                    ob.tx = aiAim; ob.ty = CB_Y - 4; ob.arcH = 45 + Math.random() * 20;
                    ob.frame = 0; ob.success = makes; ob.short = false;
                }
            }
        }

        draw();
        rafRef.current = requestAnimationFrame(tick);
    }, [draw, showFlash]);

    // ── Keyboard ────────────────────────────────────────────────────────────────
    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.key);
            if (e.key === ' ') {
                e.preventDefault();
                if (phaseRef.current === 'PLAYING' && !yourBallRef.current.active && !chargingRef.current) {
                    chargingRef.current = true;
                    powerRef.current = 0;
                }
            }
        };
        const onUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.key);
            if (e.key === ' ' && phaseRef.current === 'PLAYING' && chargingRef.current) {
                chargingRef.current = false;
                const power = powerRef.current;
                const rx    = rPostXRef.current;
                const aim   = aimXRef.current;
                const reachesPost = power >= MIN_REACH_POWER;
                const horizontal  = aim >= rx - POST_HALF && aim <= rx + POST_HALF;

                // Ball lands at aim if it reaches, or falls short proportionally
                const tx = reachesPost ? aim : YOUR_SX + (power / MIN_REACH_POWER) * (aim - YOUR_SX) * 0.9;
                const ty = reachesPost ? CB_Y - 4 : POST_FOOT;
                // Flatter arc = more power; higher arc = less power
                const arcH = reachesPost ? Math.max(32, 85 - power * 0.54) : 24 + power * 0.28;

                const yb = yourBallRef.current;
                yb.active = true; yb.sx = YOUR_SX; yb.sy = YOUR_SY;
                yb.tx = tx; yb.ty = ty; yb.arcH = arcH;
                yb.frame = 0;
                yb.success = reachesPost && horizontal;
                yb.short   = !reachesPost;
                powerRef.current = 0;
            }
        };
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup',   onUp);
        return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
    }, []);

    // ── Animation loop ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isGameday) return;
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [isGameday, tick]);

    useEffect(() => { if (isGameday) draw(); }, [isGameday, draw]);

    // ── Off-season placeholder ──────────────────────────────────────────────────
    if (!isGameday) {
        return (
            <div style={{ margin: '2rem auto', maxWidth: 800, textAlign: 'center', background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '2.5rem 1.5rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏈</div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#eab308', fontFamily: "'Graduate',sans-serif", letterSpacing: '0.05em' }}>HEAD-TO-HEAD FIELD GOAL CHALLENGE</div>
                <div style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.9rem' }}>Check back on gameday (Sun / Mon / Thu) to play.</div>
            </div>
        );
    }

    // ── Mode button styles ──────────────────────────────────────────────────────
    const modeBtn = (mode: GameMode, label: string, sub: string, active: boolean) => (
        <button
            key={mode}
            onClick={() => { setLeagueWait(false); if (mode === 'league') { setLeagueWait(true); setTimeout(() => { setLeagueWait(false); startGame('league'); }, 3000); } else { startGame(mode); } }}
            style={{
                flex: 1, padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                background: active ? 'rgba(234,179,8,0.18)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${active ? 'rgba(234,179,8,0.6)' : 'rgba(255,255,255,0.12)'}`,
                color: '#fff', textAlign: 'center' as const,
            }}
        >
            <div style={{ fontWeight: 900, fontSize: '0.82rem', fontFamily: "'Graduate',sans-serif", color: active ? '#eab308' : '#d1d5db', letterSpacing: '0.04em' }}>{label}</div>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px' }}>{sub}</div>
        </button>
    );

    return (
        <div style={{ padding: '0 2rem 2.5rem' }}>
            <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: '#eab308', fontFamily: "'Graduate',sans-serif", letterSpacing: '0.05em' }}>FIELD GOAL CHALLENGE</span>
                <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{myTeamName} · Moving Posts · 2 min</span>
            </div>

            {/* Mode selector — shown below title, always visible */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {modeBtn('practice', 'PRACTICE',   'Solo · no timer',    gameMode === 'practice' && phase !== 'IDLE')}
                {modeBtn('cpu',      'VS CPU',      '2 min · harder',     gameMode === 'cpu'      && phase !== 'IDLE')}
                {modeBtn('league',   'VS LEAGUE',   'Challenge a member', gameMode === 'league'   && phase !== 'IDLE')}
            </div>

            {/* League matchmaking splash */}
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
