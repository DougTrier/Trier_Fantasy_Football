/**
 * FieldGoalKicker — Head-to-Head Field Goal Mini-Game
 * =====================================================
 * Stadium side-view perspective (like a broadcast camera at the 50-yard line).
 * Two goal posts visible: LEFT = your end zone (AI kicks here),
 * RIGHT = opponent's end zone (you kick here).
 *
 * Both posts drift left/right continuously — you must track the right post
 * with your aim before kicking.
 *
 * CONTROLS:
 *   ← / →        — adjust aim left/right to track the drifting right post
 *   SPACE (hold)  — charge the power bar
 *   SPACE (release) — kick
 *
 * RULES:
 *   2-minute game clock. Most field goals wins.
 *   CPU auto-kicks at random intervals with ~70% accuracy.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';

// ── Canvas ─────────────────────────────────────────────────────────────────────
const W = 920, H = 480;

// ── Layout ─────────────────────────────────────────────────────────────────────
const CROWD_H   = 178;   // height of the stadium/crowd area at top
const FIELD_Y   = CROWD_H; // y where the field begins

// ── Goal post geometry (front-view from the 50-yard line) ──────────────────────
const L_POST_CX  = 92;          // left post default center x
const R_POST_CX  = 828;         // right post default center x
const POST_HALF  = 50;          // half-width between the two uprights
const CB_Y       = FIELD_Y + 30; // crossbar y position
const UP_TOP_Y   = CB_Y - 54;   // top of the uprights
const POST_FOOT  = FIELD_Y + 68; // where the support post meets the field

// ── Post drift ─────────────────────────────────────────────────────────────────
const DRIFT_AMP   = 42;   // max lateral drift in pixels
const DRIFT_SPEED = 0.013; // radians per frame

// ── Ball parameters ────────────────────────────────────────────────────────────
const YOUR_SX = 245, YOUR_SY = FIELD_Y + 55;  // your kicker position
const OPP_SX  = 675, OPP_SY  = FIELD_Y + 55;  // CPU kicker position
const FLIGHT_F = 54;   // frames for a ball to travel to the goal post

// ── Game parameters ────────────────────────────────────────────────────────────
const GAME_SECS  = 120; // 2 minutes
const AIM_SPEED  = 2.8; // aim movement px per frame
const MAX_POWER  = 100;
const POWER_RATE = 1.25;

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = 'IDLE' | 'PLAYING' | 'GAME_OVER';

interface Ball {
    active: boolean;
    sx: number; sy: number;
    tx: number; ty: number; // target locked at kick time
    frame: number;
    success: boolean; // determined at launch
}

function freshBall(sx: number, sy: number): Ball {
    return { active: false, sx, sy, tx: 0, ty: 0, frame: 0, success: false };
}

function loadBest(): number {
    try { return parseInt(localStorage.getItem('trier_fg_h2h_best') || '0', 10) || 0; }
    catch { return 0; }
}

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
    isGameday: boolean;
    myTeamName: string;
    onStreakChange?: (n: number) => void;
}

export const FieldGoalKicker: React.FC<Props> = ({ isGameday, myTeamName }) => {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const phaseRef     = useRef<Phase>('IDLE');
    const keysRef      = useRef<Set<string>>(new Set());

    // Aim tracker — x position your ball will target on the right goal-post plane
    const aimXRef      = useRef(R_POST_CX);
    const powerRef     = useRef(0);
    const chargingRef  = useRef(false);

    // Post drift state (sinusoidal phase angle per post)
    const lPhaseRef    = useRef(0);
    const rPhaseRef    = useRef(Math.PI * 0.65); // out of phase so they don't sync
    const lPostXRef    = useRef(L_POST_CX);
    const rPostXRef    = useRef(R_POST_CX);

    // Balls
    const yourBallRef  = useRef<Ball>(freshBall(YOUR_SX, YOUR_SY));
    const oppBallRef   = useRef<Ball>(freshBall(OPP_SX, OPP_SY));

    // Score / timer (refs for game logic, state for React renders)
    const yourScoreRef = useRef(0);
    const oppScoreRef  = useRef(0);
    const timeLeftRef  = useRef(GAME_SECS);
    const timerAccRef  = useRef(0);  // ms accumulator for 1-second ticks
    const aiTimerRef   = useRef(7000 + Math.random() * 4000); // ms until CPU next kick
    const aiAccRef     = useRef(0);
    const prevTsRef    = useRef(0);

    const rafRef = useRef(0);
    const flashRef = useRef<ReturnType<typeof setTimeout>>();

    const [yourScore, setYourScore] = useState(0);
    const [oppScore,  setOppScore]  = useState(0);
    const [timeLeft,  setTimeLeft]  = useState(GAME_SECS);
    const [phase,     setPhase]     = useState<Phase>('IDLE');
    const [flash,     setFlash]     = useState<{ text: string; good: boolean } | null>(null);
    const [bestScore, setBestScore] = useState(loadBest);

    // ── Flash message helper ────────────────────────────────────────────────────
    const showFlash = useCallback((text: string, good: boolean) => {
        setFlash({ text, good });
        clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => setFlash(null), 1300);
    }, []);

    // ── Reset / start game ──────────────────────────────────────────────────────
    const startGame = useCallback(() => {
        yourScoreRef.current = 0; oppScoreRef.current = 0;
        setYourScore(0); setOppScore(0);
        timeLeftRef.current = GAME_SECS; setTimeLeft(GAME_SECS);
        timerAccRef.current = 0; aiAccRef.current = 0;
        aiTimerRef.current = 6000 + Math.random() * 5000;
        aimXRef.current = R_POST_CX;
        powerRef.current = 0; chargingRef.current = false;
        yourBallRef.current = freshBall(YOUR_SX, YOUR_SY);
        oppBallRef.current  = freshBall(OPP_SX, OPP_SY);
        prevTsRef.current = 0;
        phaseRef.current = 'PLAYING'; setPhase('PLAYING');
    }, []);

    // ── Draw one frame ──────────────────────────────────────────────────────────
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
        const yb    = yourBallRef.current;
        const ob    = oppBallRef.current;

        ctx.clearRect(0, 0, W, H);

        // ── Stadium / crowd background ────────────────────────────────────────
        const stadGrd = ctx.createLinearGradient(0, 0, 0, CROWD_H);
        stadGrd.addColorStop(0,   '#03070e');
        stadGrd.addColorStop(0.5, '#091526');
        stadGrd.addColorStop(1,   '#0d1e35');
        ctx.fillStyle = stadGrd;
        ctx.fillRect(0, 0, W, CROWD_H);

        // Crowd silhouettes — staggered rectangles
        ctx.fillStyle = 'rgba(15,25,42,0.95)';
        for (let i = 0; i < 36; i++) {
            const cx = (i / 36) * W;
            const cy = 42 + Math.sin(i * 1.7) * 18 + (i % 4) * 10;
            const cw = 20 + (i % 3) * 6;
            const ch = 38 + (i % 4) * 10;
            ctx.fillRect(cx, cy, cw, ch);
        }
        // Second row of crowd
        ctx.fillStyle = 'rgba(10,18,32,0.9)';
        for (let i = 0; i < 28; i++) {
            const cx = (i / 28) * W + 10;
            const cy = 80 + Math.cos(i * 2.1) * 12 + (i % 3) * 8;
            ctx.fillRect(cx, cy, 28, 30 + (i % 3) * 6);
        }

        // Stadium lights — 5 bright cones from the top
        const lightXs = [W * 0.08, W * 0.26, W * 0.5, W * 0.74, W * 0.92];
        lightXs.forEach(lightX => {
            const lg = ctx.createRadialGradient(lightX, -5, 1, lightX, 30, 90);
            lg.addColorStop(0,    'rgba(255,255,220,1)');
            lg.addColorStop(0.12, 'rgba(210,230,255,0.55)');
            lg.addColorStop(0.45, 'rgba(120,160,255,0.18)');
            lg.addColorStop(1,    'rgba(0,0,0,0)');
            ctx.fillStyle = lg;
            ctx.fillRect(lightX - 90, 0, 180, CROWD_H);
        });

        // ── Football field ────────────────────────────────────────────────────
        const fieldGrd = ctx.createLinearGradient(0, FIELD_Y, 0, H);
        fieldGrd.addColorStop(0,   '#0e3d1f');
        fieldGrd.addColorStop(0.4, '#165c2d');
        fieldGrd.addColorStop(1,   '#1a6b35');
        ctx.fillStyle = fieldGrd;
        ctx.fillRect(0, FIELD_Y, W, H - FIELD_Y);

        // Alternating dark/light stripes (yard sections)
        const stripeW = W / 10;
        for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.09)';
                ctx.fillRect(i * stripeW, FIELD_Y, stripeW, H - FIELD_Y);
            }
        }

        // Field edge line
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, FIELD_Y);
        ctx.lineTo(W, FIELD_Y);
        ctx.stroke();

        // Yard lines + yardage numbers
        const yardLines = [W * 0.2, W * 0.35, W * 0.5, W * 0.65, W * 0.8];
        const yardNums  = ['30', '40', '50', '40', '30'];
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        yardLines.forEach((x, i) => {
            ctx.beginPath(); ctx.moveTo(x, FIELD_Y); ctx.lineTo(x, H); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.38)';
            ctx.font = 'bold 15px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(yardNums[i], x, FIELD_Y + 22);
        });

        // Hash marks on each yard line
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        yardLines.forEach(x => {
            [FIELD_Y + 70, FIELD_Y + 140].forEach(hy => {
                ctx.beginPath(); ctx.moveTo(x - 6, hy); ctx.lineTo(x + 6, hy); ctx.stroke();
            });
        });

        // End zone tint (left and right)
        ctx.fillStyle = 'rgba(234,179,8,0.04)';
        ctx.fillRect(0, FIELD_Y, 160, H - FIELD_Y);
        ctx.fillRect(W - 160, FIELD_Y, 160, H - FIELD_Y);

        // ── Draw goal post helper ─────────────────────────────────────────────
        const drawPost = (cx: number) => {
            ctx.shadowColor = '#eab308';
            ctx.shadowBlur = 12;
            ctx.strokeStyle = '#eab308';

            // Left upright
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(cx - POST_HALF, CB_Y);
            ctx.lineTo(cx - POST_HALF, UP_TOP_Y);
            ctx.stroke();

            // Right upright
            ctx.beginPath();
            ctx.moveTo(cx + POST_HALF, CB_Y);
            ctx.lineTo(cx + POST_HALF, UP_TOP_Y);
            ctx.stroke();

            // Crossbar
            ctx.beginPath();
            ctx.moveTo(cx - POST_HALF, CB_Y);
            ctx.lineTo(cx + POST_HALF, CB_Y);
            ctx.stroke();

            // Support post (thicker)
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(cx, CB_Y);
            ctx.lineTo(cx, POST_FOOT);
            ctx.stroke();

            ctx.shadowBlur = 0;
        };

        drawPost(lx); // your end zone (left)
        drawPost(rx); // opponent's end zone (right)

        // End-zone labels
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(234,179,8,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText('YOUR END ZONE', lx, FIELD_Y - 9);
        ctx.fillText('OPP END ZONE', rx, FIELD_Y - 9);

        // ── Kicker position markers ───────────────────────────────────────────
        if (ph === 'PLAYING') {
            // Your kicker dot
            ctx.beginPath();
            ctx.arc(YOUR_SX, YOUR_SY + 10, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#60a5fa';
            ctx.fill();
            // CPU kicker dot
            ctx.beginPath();
            ctx.arc(OPP_SX, OPP_SY + 10, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#f87171';
            ctx.fill();
        }

        // ── Aim indicator ─────────────────────────────────────────────────────
        if (ph === 'PLAYING' && !yb.active) {
            const inside = aim >= rx - POST_HALF && aim <= rx + POST_HALF;
            const aimCol = inside ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.85)';

            // Dotted trajectory arc from your kicker to aim point
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 7]);
            ctx.beginPath();
            ctx.moveTo(YOUR_SX, YOUR_SY);
            ctx.quadraticCurveTo((YOUR_SX + aim) / 2, CB_Y - 65, aim, CB_Y - 4);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Vertical aim line at target x
            ctx.strokeStyle = aimCol;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(aim, UP_TOP_Y - 10);
            ctx.lineTo(aim, POST_FOOT);
            ctx.stroke();
            ctx.setLineDash([]);

            // Dot at crossbar height
            ctx.beginPath();
            ctx.arc(aim, CB_Y, 5, 0, Math.PI * 2);
            ctx.fillStyle = aimCol;
            ctx.fill();
        }

        // ── Power bar ─────────────────────────────────────────────────────────
        if (chargingRef.current && ph === 'PLAYING') {
            const bw = 16, bh = 95, bx = 170, by = FIELD_Y + 65;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(bx, by, bw, bh);
            const fill = (power / MAX_POWER) * bh;
            ctx.fillStyle = power < 50 ? '#4ade80' : power < 80 ? '#facc15' : '#ef4444';
            ctx.fillRect(bx, by + bh - fill, bw, fill);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, bw, bh);
            ctx.fillStyle = '#fff';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PWR', bx + bw / 2, by - 5);
        }

        // ── Balls in flight ───────────────────────────────────────────────────
        const drawBall = (ball: Ball) => {
            if (!ball.active) return;
            const t = ball.frame / FLIGHT_F;
            const x = ball.sx + (ball.tx - ball.sx) * t;
            const y = ball.sy + (ball.ty - ball.sy) * t - Math.sin(t * Math.PI) * 72;

            // Ball shadow on ground
            ctx.beginPath();
            ctx.ellipse(x, POST_FOOT - 2, 7 * (1 - t * 0.5), 2.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fill();

            // Ball body
            ctx.beginPath();
            ctx.arc(x, y, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = '#92400e';
            ctx.fill();
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Laces
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x - 2, y - 3);
            ctx.lineTo(x + 2, y + 3);
            ctx.stroke();
        };
        drawBall(yb);
        drawBall(ob);

        // ── Score / timer panel ───────────────────────────────────────────────
        const mm = Math.floor(timeLeftRef.current / 60);
        const ss = timeLeftRef.current % 60;
        const timerStr = `${mm}:${String(ss).padStart(2, '0')}`;
        const panelW = 330, panelH = 44;
        const px = W / 2 - panelW / 2, py = 8;

        ctx.fillStyle = 'rgba(8,12,24,0.88)';
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
            .roundRect(px, py, panelW, panelH, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(234,179,8,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Your name + score
        const teamLabel = myTeamName.toUpperCase().slice(0, 11);
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(teamLabel, px + 10, py + 17);
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#4ade80';
        ctx.fillText(String(yourScoreRef.current), px + 10, py + 38);

        // CPU score
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('CPU', px + panelW - 10, py + 17);
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#f87171';
        ctx.fillText(String(oppScoreRef.current), px + panelW - 10, py + 38);

        // Timer in center
        ctx.font = 'bold 17px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = timeLeftRef.current <= 10 ? '#ef4444' : '#eab308';
        ctx.fillText(timerStr, W / 2, py + 30);

        // FG label below timer
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText('FG', W / 2, py + 42);

        // ── Controls hint (bottom) ────────────────────────────────────────────
        if (ph === 'PLAYING') {
            ctx.font = '10px monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.textAlign = 'center';
            ctx.fillText('← → aim  ·  hold SPACE to charge  ·  release to kick', W / 2, H - 6);
        }

        // ── IDLE overlay ──────────────────────────────────────────────────────
        if (ph === 'IDLE') {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.beginPath();
            (ctx as CanvasRenderingContext2D & { roundRect: (...a: number[]) => void })
                .roundRect(W / 2 - 210, H / 2 - 55, 420, 110, 12);
            ctx.fill();
            ctx.fillStyle = '#eab308';
            ctx.font = "bold 18px 'Graduate', monospace";
            ctx.textAlign = 'center';
            ctx.fillText('HEAD-TO-HEAD FIELD GOAL', W / 2, H / 2 - 22);
            ctx.fillStyle = '#d1d5db';
            ctx.font = '12px monospace';
            ctx.fillText('← → to aim at the moving post  ·  SPACE = charge + kick', W / 2, H / 2 + 3);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '11px monospace';
            ctx.fillText('Press SPACE to start the 2-minute game', W / 2, H / 2 + 26);
            if (bestScore > 0) {
                ctx.fillStyle = '#eab308';
                ctx.font = '10px monospace';
                ctx.fillText(`Personal best: ${bestScore} FG`, W / 2, H / 2 + 47);
            }
        }

        // ── GAME OVER overlay ─────────────────────────────────────────────────
        if (ph === 'GAME_OVER') {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.beginPath();
            (ctx as CanvasRenderingContext2D & { roundRect: (...a: number[]) => void })
                .roundRect(W / 2 - 200, H / 2 - 70, 400, 140, 12);
            ctx.fill();
            const won  = yourScoreRef.current > oppScoreRef.current;
            const tied = yourScoreRef.current === oppScoreRef.current;
            ctx.fillStyle = won ? '#4ade80' : tied ? '#eab308' : '#f87171';
            ctx.font = "bold 26px 'Graduate', monospace";
            ctx.textAlign = 'center';
            ctx.fillText(won ? 'YOU WIN!' : tied ? "TIE GAME" : 'CPU WINS', W / 2, H / 2 - 30);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px monospace';
            ctx.fillText(`${yourScoreRef.current} FG  —  ${oppScoreRef.current} FG`, W / 2, H / 2);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '11px monospace';
            ctx.fillText('Press SPACE to play again', W / 2, H / 2 + 28);
            if (bestScore > 0) {
                ctx.fillStyle = '#eab308';
                ctx.font = '10px monospace';
                ctx.fillText(`Best score: ${bestScore} FG`, W / 2, H / 2 + 50);
            }
        }
    }, [myTeamName, bestScore]);

    // ── Game loop tick ──────────────────────────────────────────────────────────
    const tick = useCallback((ts: number) => {
        const dt = prevTsRef.current ? Math.min(ts - prevTsRef.current, 50) : 16;
        prevTsRef.current = ts;

        const keys = keysRef.current;
        const ph   = phaseRef.current;

        // Posts always drift (even on idle/game-over for visual effect)
        lPhaseRef.current += DRIFT_SPEED;
        rPhaseRef.current += DRIFT_SPEED;
        lPostXRef.current = L_POST_CX + Math.sin(lPhaseRef.current) * DRIFT_AMP;
        rPostXRef.current = R_POST_CX + Math.sin(rPhaseRef.current) * DRIFT_AMP;

        if (ph === 'PLAYING') {
            // ── Countdown timer ───────────────────────────────────────────────
            timerAccRef.current += dt;
            if (timerAccRef.current >= 1000) {
                timerAccRef.current -= 1000;
                const nt = Math.max(0, timeLeftRef.current - 1);
                timeLeftRef.current = nt;
                setTimeLeft(nt);
                if (nt === 0) {
                    // Game over — save best score if improved
                    const score = yourScoreRef.current;
                    phaseRef.current = 'GAME_OVER';
                    setPhase('GAME_OVER');
                    if (score > loadBest()) {
                        try { localStorage.setItem('trier_fg_h2h_best', String(score)); } catch { /* non-fatal */ }
                        setBestScore(score);
                    }
                    draw();
                    return; // stop ticking — rafRef stays 0
                }
            }

            // ── Aim movement (only when your ball is not flying) ──────────────
            if (!yourBallRef.current.active) {
                const minAim = R_POST_CX - DRIFT_AMP - POST_HALF - 15;
                const maxAim = R_POST_CX + DRIFT_AMP + POST_HALF + 15;
                if (keys.has('ArrowLeft'))  aimXRef.current = Math.max(minAim, aimXRef.current - AIM_SPEED);
                if (keys.has('ArrowRight')) aimXRef.current = Math.min(maxAim, aimXRef.current + AIM_SPEED);
            }

            // ── Power charge ──────────────────────────────────────────────────
            if (chargingRef.current && !yourBallRef.current.active) {
                powerRef.current = Math.min(MAX_POWER, powerRef.current + POWER_RATE);
            }

            // ── Advance your ball ─────────────────────────────────────────────
            const yb = yourBallRef.current;
            if (yb.active) {
                yb.frame++;
                if (yb.frame >= FLIGHT_F) {
                    yb.active = false;
                    // success was already determined at kick time
                    if (yb.success) {
                        yourScoreRef.current++;
                        setYourScore(s => s + 1);
                        showFlash('GOOD! ✓', true);
                    } else {
                        showFlash('NO GOOD', false);
                    }
                }
            }

            // ── Advance CPU ball ──────────────────────────────────────────────
            const ob = oppBallRef.current;
            if (ob.active) {
                ob.frame++;
                if (ob.frame >= FLIGHT_F) {
                    ob.active = false;
                    if (ob.success) {
                        oppScoreRef.current++;
                        setOppScore(s => s + 1);
                    }
                }
            }

            // ── CPU auto-kick ─────────────────────────────────────────────────
            if (!ob.active) {
                aiAccRef.current += dt;
                if (aiAccRef.current >= aiTimerRef.current) {
                    aiAccRef.current = 0;
                    aiTimerRef.current = 5500 + Math.random() * 5500;
                    const lx = lPostXRef.current;
                    // CPU has ~72% accuracy — aim near post center with some variance
                    const makes = Math.random() < 0.72;
                    // Aim inside uprights for a make, outside for a miss
                    const aiAim = makes
                        ? lx + (Math.random() - 0.5) * (POST_HALF * 1.4) // inside
                        : lx + (POST_HALF + 5 + Math.random() * 30) * (Math.random() > 0.5 ? 1 : -1); // outside
                    ob.active = true;
                    ob.sx = OPP_SX; ob.sy = OPP_SY;
                    ob.tx = aiAim;  ob.ty = CB_Y - 4;
                    ob.frame = 0;   ob.success = makes;
                }
            }
        }

        draw();
        rafRef.current = requestAnimationFrame(tick);
    }, [draw, showFlash]);

    // ── Keyboard handlers ───────────────────────────────────────────────────────
    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.key);
            if (e.key === ' ') {
                e.preventDefault();
                const ph = phaseRef.current;
                if (ph === 'IDLE' || ph === 'GAME_OVER') {
                    startGame();
                } else if (ph === 'PLAYING' && !yourBallRef.current.active && !chargingRef.current) {
                    chargingRef.current = true;
                    powerRef.current = 0;
                }
            }
        };
        const onUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.key);
            // Release SPACE → launch kick
            if (e.key === ' ' && phaseRef.current === 'PLAYING' && chargingRef.current) {
                chargingRef.current = false;
                const rx = rPostXRef.current;
                const aim = aimXRef.current;
                const success = aim >= rx - POST_HALF && aim <= rx + POST_HALF;
                const yb = yourBallRef.current;
                yb.active  = true;
                yb.sx = YOUR_SX; yb.sy = YOUR_SY;
                yb.tx = aim;     yb.ty = CB_Y - 4;
                yb.frame   = 0;
                yb.success = success;
                powerRef.current = 0;
            }
        };
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup',   onUp);
        return () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup',   onUp);
        };
    }, [startGame]);

    // ── Start/stop animation loop ───────────────────────────────────────────────
    useEffect(() => {
        if (!isGameday) return;
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [isGameday, tick]);

    // Draw idle frame on mount (so posts are visible before SPACE is pressed)
    useEffect(() => {
        if (isGameday) draw();
    }, [isGameday, draw]);

    // ── Off-season placeholder ──────────────────────────────────────────────────
    if (!isGameday) {
        return (
            <div style={{
                margin: '2rem auto', maxWidth: 800, textAlign: 'center',
                background: 'rgba(10,14,26,0.82)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                padding: '2.5rem 1.5rem',
            }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏈</div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#eab308', fontFamily: "'Graduate', sans-serif", letterSpacing: '0.05em' }}>
                    HEAD-TO-HEAD FIELD GOAL CHALLENGE
                </div>
                <div style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
                    Check back on gameday (Sun / Mon / Thu) to play.
                </div>
                {bestScore > 0 && (
                    <div style={{ marginTop: '0.75rem', color: '#9ca3af', fontSize: '0.82rem' }}>
                        Your best score: <strong style={{ color: '#eab308' }}>{bestScore} FG</strong>
                    </div>
                )}
            </div>
        );
    }

    // ── Game canvas ─────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: '0 2rem 2.5rem' }}>
            {/* Title row */}
            <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: '#eab308', fontFamily: "'Graduate', sans-serif", letterSpacing: '0.05em' }}>
                    FIELD GOAL CHALLENGE
                </span>
                <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                    {myTeamName} vs CPU · 2 min · Moving Posts
                </span>
            </div>

            {/* Canvas wrapper */}
            <div style={{ position: 'relative', width: '100%', maxWidth: W }}>
                <canvas
                    ref={canvasRef}
                    width={W}
                    height={H}
                    tabIndex={0}
                    style={{
                        width: '100%', height: 'auto', display: 'block',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        outline: 'none',
                        cursor: 'default',
                    }}
                />
                {/* Flash result overlay */}
                {flash && (
                    <div style={{
                        position: 'absolute', top: '42%', left: '50%',
                        transform: 'translate(-50%,-50%)',
                        fontFamily: "'Graduate', sans-serif", fontWeight: 900,
                        fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                        color: flash.good ? '#4ade80' : '#ef4444',
                        textShadow: `0 0 24px ${flash.good ? '#4ade80' : '#ef4444'}`,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.05em',
                    }}>
                        {flash.text}
                    </div>
                )}
            </div>
        </div>
    );
};
