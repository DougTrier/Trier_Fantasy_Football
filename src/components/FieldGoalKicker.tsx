/**
 * Trier Fantasy Football
 * © 2026 Doug Trier
 *
 * Licensed under the MIT License.
 * See LICENSE file for details.
 *
 * "Trier OS" and "Trier Fantasy Football" are trademarks of Doug Trier.
 */

/**
 * FieldGoalKicker — Football Mini-Game
 * =====================================
 * An interactive field goal kicker embedded at the bottom of the League page.
 * Shows a "check back on gameday" placeholder during the off-season.
 *
 * CONTROLS:
 *   ← / → Arrow keys   — aim left or right
 *   SPACE (hold)        — charge the power bar
 *   SPACE (release)     — kick
 *
 * DIFFICULTY:
 *   Each successful kick narrows the uprights by 6% (min 35% of original width).
 *   Wind direction and speed are randomised per kick.
 *
 * LEADERBOARD:
 *   Best streak stored in localStorage (trier_fg_streak).
 *   Passed to LeagueTable via onStreakChange to show next to team name.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────
const W = 800, H = 420; // canvas logical size (scaled to container)

const UPRIGHT_BASE_HALF  = 90;  // initial half-width between posts (px)
const UPRIGHT_MIN_HALF   = 32;  // narrowest the posts can get
const CROSSBAR_Y         = 110; // y-coordinate of the crossbar
const UPRIGHT_HEIGHT     = 60;  // height of the vertical posts above crossbar
const BALL_START_X       = W / 2;
const BALL_START_Y       = H - 40;
const MAX_POWER          = 100;
const POWER_RATE         = 1.2; // power units per frame
const GRAVITY            = 0.28;
const WIND_DISPLAY_Y     = 28;

// ── Types ─────────────────────────────────────────────────────────────────────
type GameState = 'IDLE' | 'AIMING' | 'CHARGING' | 'FLYING' | 'RESULT';

interface GameResult { success: boolean; message: string; }

function loadBestStreak(): number {
    try { return parseInt(localStorage.getItem('trier_fg_streak') || '0', 10) || 0; }
    catch { return 0; }
}

function saveBestStreak(n: number) {
    try { localStorage.setItem('trier_fg_streak', String(n)); }
    catch { /* non-fatal */ }
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
    isGameday: boolean;
    myTeamName: string;
    onStreakChange?: (streak: number) => void;
}

export const FieldGoalKicker: React.FC<Props> = ({ isGameday, myTeamName, onStreakChange }) => {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const stateRef   = useRef<GameState>('IDLE');
    const angleRef   = useRef(0);          // aim angle in degrees (-45 to 45)
    const powerRef   = useRef(0);
    const chargingRef = useRef(false);
    const ballRef    = useRef({ x: BALL_START_X, y: BALL_START_Y, vx: 0, vy: 0 });
    const windRef    = useRef({ speed: 0, dir: 1 }); // dir: 1=right, -1=left
    const streakRef  = useRef(0);
    const uprightHalfRef = useRef(UPRIGHT_BASE_HALF);
    const rafRef     = useRef(0);
    const keysRef    = useRef<Set<string>>(new Set());

    const [bestStreak, setBestStreak] = useState(loadBestStreak);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [result, setResult] = useState<GameResult | null>(null);
    const [hint, setHint] = useState(true);

    // ── Randomise wind for the next kick ──────────────────────────────────────
    const newKick = useCallback(() => {
        windRef.current = {
            speed: Math.random() * 12,
            dir: Math.random() > 0.5 ? 1 : -1,
        };
        angleRef.current = 0;
        powerRef.current = 0;
        ballRef.current = { x: BALL_START_X, y: BALL_START_Y, vx: 0, vy: 0 };
        stateRef.current = 'AIMING';
        setResult(null);
        setHint(false);
    }, []);

    // ── Draw one frame ────────────────────────────────────────────────────────
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const state = stateRef.current;
        const angle = angleRef.current;
        const power = powerRef.current;
        const ball  = ballRef.current;
        const wind  = windRef.current;
        const uprightHalf = uprightHalfRef.current;

        // ── Background ──
        ctx.clearRect(0, 0, W, H);

        // Field gradient
        const grd = ctx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, '#0d2b1a');
        grd.addColorStop(1, '#164d2c');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);

        // Yard lines
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        for (let y = 60; y < H; y += 60) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // Center hash marks
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        for (let x = 60; x < W; x += 60) {
            ctx.beginPath(); ctx.moveTo(x, H - 20); ctx.lineTo(x, H - 10); ctx.stroke();
        }

        // ── Uprights ──
        const cx = W / 2;
        const leftPost  = cx - uprightHalf;
        const rightPost = cx + uprightHalf;

        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 8;

        // Crossbar
        ctx.beginPath();
        ctx.moveTo(leftPost, CROSSBAR_Y);
        ctx.lineTo(rightPost, CROSSBAR_Y);
        ctx.stroke();

        // Left post
        ctx.beginPath();
        ctx.moveTo(leftPost, CROSSBAR_Y);
        ctx.lineTo(leftPost, CROSSBAR_Y - UPRIGHT_HEIGHT);
        ctx.stroke();

        // Right post
        ctx.beginPath();
        ctx.moveTo(rightPost, CROSSBAR_Y);
        ctx.lineTo(rightPost, CROSSBAR_Y - UPRIGHT_HEIGHT);
        ctx.stroke();

        // Center support
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cx, CROSSBAR_Y);
        ctx.lineTo(cx, H - 60);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // ── Wind indicator ──
        const windLabel = `WIND ${wind.dir > 0 ? '→' : '←'} ${wind.speed.toFixed(1)} mph`;
        ctx.fillStyle = wind.speed < 4 ? '#4ade80' : wind.speed < 8 ? '#facc15' : '#f87171';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(windLabel, W / 2, WIND_DISPLAY_Y);

        // ── Aim arrow (AIMING state) ──
        if (state === 'AIMING' || state === 'CHARGING') {
            const rad = (angle * Math.PI) / 180;
            const len = 70;
            const ax  = ball.x + Math.sin(rad) * len;
            const ay  = ball.y - Math.cos(rad) * len;

            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(ball.x, ball.y);
            ctx.lineTo(ax, ay);
            ctx.stroke();
            ctx.setLineDash([]);

            // Arrowhead
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.arc(ax, ay, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── Power bar ──
        if (state === 'CHARGING') {
            const barW = 20, barH = 120;
            const barX = 30, barY = H / 2 - barH / 2;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(barX, barY, barW, barH);
            const fill = (power / MAX_POWER) * barH;
            const barColor = power < 50 ? '#4ade80' : power < 80 ? '#facc15' : '#ef4444';
            ctx.fillStyle = barColor;
            ctx.fillRect(barX, barY + barH - fill, barW, fill);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);
            ctx.fillStyle = '#fff';
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PWR', barX + barW / 2, barY - 6);
        }

        // ── Ball ──
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#b45309';
        ctx.fill();
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Laces (simple line)
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ball.x - 3, ball.y - 4);
        ctx.lineTo(ball.x + 3, ball.y + 4);
        ctx.stroke();

        // ── Streak & distance labels ──
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`STREAK ${streakRef.current}  ·  BEST ${bestStreak}`, 16, WIND_DISPLAY_Y);

        const dist = Math.round(((H - BALL_START_Y) + (BALL_START_Y - CROSSBAR_Y)) / 5);
        ctx.textAlign = 'right';
        ctx.fillText(`${dist} YD FG`, W - 16, WIND_DISPLAY_Y);

        // ── Difficulty label ──
        if (streakRef.current >= 3) {
            ctx.fillStyle = '#f87171';
            ctx.textAlign = 'center';
            ctx.font = 'bold 11px monospace';
            ctx.fillText('NARROWING UPRIGHTS', W / 2, H - 10);
        }

        // ── Controls hint ──
        if (hint || state === 'IDLE') {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(W / 2 - 160, H / 2 - 36, 320, 72);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('← → to aim  ·  SPACE to kick', W / 2, H / 2 - 10);
            ctx.font = '12px monospace';
            ctx.fillStyle = '#9ca3af';
            ctx.fillText('Press SPACE to start', W / 2, H / 2 + 14);
        }

    }, [bestStreak, hint]);

    // ── Game loop ─────────────────────────────────────────────────────────────
    const tick = useCallback(() => {
        const state = stateRef.current;
        const keys  = keysRef.current;

        if (state === 'AIMING') {
            if (keys.has('ArrowLeft'))  angleRef.current = Math.max(-45, angleRef.current - 1.5);
            if (keys.has('ArrowRight')) angleRef.current = Math.min(45, angleRef.current + 1.5);
            if (keys.has(' ') || keys.has('Space')) {
                stateRef.current = 'CHARGING';
                chargingRef.current = true;
            }
        }

        if (state === 'CHARGING') {
            if (keys.has('ArrowLeft'))  angleRef.current = Math.max(-45, angleRef.current - 1.5);
            if (keys.has('ArrowRight')) angleRef.current = Math.min(45, angleRef.current + 1.5);
            if (chargingRef.current) {
                powerRef.current = Math.min(MAX_POWER, powerRef.current + POWER_RATE);
            }
        }

        if (state === 'FLYING') {
            const b = ballRef.current;
            b.x += b.vx;
            b.y += b.vy;
            b.vy += GRAVITY;
            // Wind drift
            b.vx += windRef.current.dir * windRef.current.speed * 0.002;

            // Check if ball crosses the crossbar plane
            if (b.y <= CROSSBAR_Y) {
                const cx = W / 2;
                const half = uprightHalfRef.current;
                const good = b.x >= cx - half && b.x <= cx + half;
                const streak = streakRef.current;

                if (good) {
                    const newStreak = streak + 1;
                    streakRef.current = newStreak;
                    setCurrentStreak(newStreak);
                    // Narrow uprights progressively
                    uprightHalfRef.current = Math.max(UPRIGHT_MIN_HALF, UPRIGHT_BASE_HALF - newStreak * 6);
                    const newBest = Math.max(loadBestStreak(), newStreak);
                    saveBestStreak(newBest);
                    setBestStreak(newBest);
                    onStreakChange?.(newStreak);
                    setResult({ success: true, message: newStreak >= 5 ? '🔥 ON FIRE!' : 'GOOD!' });
                } else {
                    streakRef.current = 0;
                    setCurrentStreak(0);
                    uprightHalfRef.current = UPRIGHT_BASE_HALF; // reset uprights on miss
                    setResult({ success: false, message: 'NO GOOD' });
                }
                stateRef.current = 'RESULT';
                // Auto-restart after 1.5s
                setTimeout(() => newKick(), 1500);
            }

            // Ball went below screen — miss
            if (b.y > H + 20) {
                stateRef.current = 'RESULT';
                streakRef.current = 0;
                setCurrentStreak(0);
                uprightHalfRef.current = UPRIGHT_BASE_HALF;
                setResult({ success: false, message: 'SHORT!' });
                setTimeout(() => newKick(), 1500);
            }
        }

        draw();
        rafRef.current = requestAnimationFrame(tick);
    }, [draw, newKick, onStreakChange]);

    // ── Keyboard handlers ─────────────────────────────────────────────────────
    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            keysRef.current.add(e.key);
            if (e.key === ' ') e.preventDefault();
        };
        const onUp = (e: KeyboardEvent) => {
            keysRef.current.delete(e.key);
            if (e.key === ' ' && stateRef.current === 'IDLE') {
                newKick();
                return;
            }
            // Release spacebar → launch kick
            if ((e.key === ' ') && stateRef.current === 'CHARGING') {
                const power  = powerRef.current;
                const angle  = angleRef.current;
                const rad    = (angle * Math.PI) / 180;
                const speed  = power * 0.14;
                ballRef.current.vx = Math.sin(rad) * speed;
                ballRef.current.vy = -Math.cos(rad) * speed;
                stateRef.current = 'FLYING';
                chargingRef.current = false;
            }
        };
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup',   onUp);
        return () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup',   onUp);
        };
    }, [newKick]);

    // ── Start/stop render loop ────────────────────────────────────────────────
    useEffect(() => {
        if (!isGameday) return;
        rafRef.current = requestAnimationFrame(tick);
        return () => { cancelAnimationFrame(rafRef.current); };
    }, [isGameday, tick]);

    // Initial draw of idle screen
    useEffect(() => {
        if (!isGameday) return;
        draw();
    }, [isGameday, draw]);

    // ── Off-season placeholder ────────────────────────────────────────────────
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
                    FIELD GOAL CHALLENGE
                </div>
                <div style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
                    Check back on gameday (Sun / Mon / Thu) to play.
                </div>
                {bestStreak > 0 && (
                    <div style={{ marginTop: '0.75rem', color: '#9ca3af', fontSize: '0.82rem' }}>
                        Your best streak: <strong style={{ color: '#eab308' }}>{bestStreak}</strong>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ padding: '1.5rem 2rem 2rem' }}>
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <span style={{ fontWeight: 900, fontSize: '1rem', color: '#eab308', fontFamily: "'Graduate', sans-serif", letterSpacing: '0.05em' }}>
                        FIELD GOAL CHALLENGE
                    </span>
                    <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: '#6b7280' }}>
                        {myTeamName} · Streak {currentStreak} · Best {bestStreak}
                    </span>
                </div>
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: 800 }}>
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
                {/* Result overlay */}
                {result && (
                    <div style={{
                        position: 'absolute', top: '38%', left: '50%',
                        transform: 'translate(-50%,-50%)',
                        fontFamily: "'Graduate', sans-serif", fontWeight: 900,
                        fontSize: 'clamp(1.8rem, 5vw, 3rem)',
                        color: result.success ? '#4ade80' : '#ef4444',
                        textShadow: `0 0 20px ${result.success ? '#4ade80' : '#ef4444'}`,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                    }}>
                        {result.message}
                    </div>
                )}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#4b5563', textAlign: 'center' }}>
                ← → to aim  ·  hold SPACE to charge  ·  release to kick
            </div>
        </div>
    );
};
