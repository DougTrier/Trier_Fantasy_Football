/**
 * LeagueTable — Standings Table + Inline League Chat
 * ====================================================
 * Renders the full league standings, trophy panel, and a real-time chat
 * panel for all connected managers.
 *
 * STANDINGS DATA:
 *   Team totals come from ScoringEngine.calculateTeamTotal (live stat data).
 *   Falls back to team.points.total when the engine returns 0, preserving
 *   manually entered historical scores from before live data was available.
 *
 * CHAT:
 *   Messages are broadcast via SyncService's BroadcastChannel (same-machine
 *   multi-window) and P2P WebRTC (cross-machine). Own messages are added
 *   optimistically because BroadcastChannel does not echo to the sender tab.
 *   The chat list is capped at 100 messages to prevent unbounded growth.
 *
 * BLOCKING STATE:
 *   When ScoringEngine reports NO_DATA_AVAILABLE (pre-season or missing file),
 *   an error panel blocks the standings to prevent displaying all-zero tables
 *   that could be mistaken for real scores.
 */
// React hooks used: useMemo for sorted standings, useState for chat input/list,
// useEffect for subscription lifecycle, useRef for auto-scroll anchor.
import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { League } from '../types';
import { Trophy, Send } from 'lucide-react';
// ScoringEngine called once at component top to cache orchestration status.
import { ScoringEngine } from '../utils/ScoringEngine';
import leatherTexture from '../assets/leather_texture.png';
// SyncService provides both the listener API and the sendChat helper.
import { SyncService, type SidebandMessage, type ChatPayload } from '../utils/SyncService';
import { AnimatePresence, motion } from 'framer-motion';

// ─── Types ─────────────────────────────────────────────────────────────────────
// ChatMessage is local-only — it's never stored in League state or synced.
// isMe drives bubble alignment (right for own messages, left for others).
interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    ts: number;
    isMe: boolean; // True when the message was sent by this browser instance
}

interface LeagueTableProps {
    league: League;
    myTeamName?: string;
}

/**
 * LeagueTable — League Standings + Chat panel.
 * Reads from ScoringEngine (no mutations) and subscribes to SyncService for
 * incoming chat messages. All state is ephemeral: refresh resets chat.
 */
export const LeagueTable: React.FC<LeagueTableProps> = ({ league, myTeamName }) => {
    // status is read once per render; no polling needed because re-renders are
    // triggered by parent (App.tsx) on data file reload or league prop change.
    const status = ScoringEngine.getOrchestrationStatus();

    // ── League Chat ───────────────────────────────────────────────────────────
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const myInstanceId = SyncService.getInstanceId();

    useEffect(() => {
        const handleMsg = (msg: SidebandMessage) => {
            if (msg.type !== 'CHAT') return;
            const p = msg.payload as ChatPayload;
            if (!p?.text?.trim()) return;
            setChatMessages(prev => {
                const next = [...prev, {
                    id: `${msg.senderId}-${msg.timestamp}`,
                    sender: p.sender || 'Unknown Coach',
                    text: p.text,
                    ts: msg.timestamp,
                    isMe: msg.senderId === myInstanceId
                }];
                return next.slice(-100); // cap at 100 messages
            });
        };
        SyncService.addListener(handleMsg);
        return () => SyncService.removeListener(handleMsg);
    }, [myInstanceId]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const sendChat = () => {
        const text = chatInput.trim();
        if (!text) return;
        // Broadcast to all peers via P2P/BroadcastChannel
        SyncService.sendChat(myTeamName || 'Anonymous', text);
        // Add own message optimistically (won't arrive back via BroadcastChannel on same instance)
        setChatMessages(prev => [...prev, {
            id: `me-${Date.now()}`,
            sender: myTeamName || 'You',
            text,
            ts: Date.now(),
            isMe: true
        }].slice(-100));
        setChatInput('');
    };

    // Enter = send, Shift+Enter = newline (standard chat UX convention).
    const handleChatKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChat();
        }
    };

    // ── Standings Computation ──────────────────────────────────────────────────
    // Spread-then-map so the original league.teams array is never mutated.
    // Sort is descending so index 0 = league leader for getRankStyle gold styling.
    const sortedTeams = useMemo(() => {
        return [...league.teams].map(team => {
            const audit = ScoringEngine.calculateTeamTotal(team);
            let total = audit.total;

            // Preserve manually entered totals when live engine returns zero (pre-live-data era)
            if (team.points?.total !== undefined && total === 0) total = team.points.total;

            return { ...team, totalPoints: total, audit };
        }).sort((a, b) => b.totalPoints - a.totalPoints);
    }, [league]);

    if (status.data_status === "NO_DATA_AVAILABLE") {
        return (
            <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '2px solid #ef4444', borderRadius: '12px' }}>
                <h3 style={{ color: '#ef4444', fontWeight: 900, fontFamily: "'Graduate', sans-serif" }}>BLOCKING WARNING: NO OFFICIAL DATA EXISTS</h3>
                <p style={{ color: '#fff' }}>{status.reason}</p>
                <code style={{ display: 'block', margin: '20px auto', background: '#000', padding: '15px', maxWidth: '400px', textAlign: 'left', borderRadius: '8px' }}>
                    <pre style={{ margin: 0, fontSize: '0.8rem' }}>
                        {`{
  "season": ${status.season},
  "season_state": "${status.season_state}",
  "data_status": "${status.data_status}",
  "reason": "NFL regular season has not started"
}`}
                    </pre>
                </code>
            </div>
        );
    }

    /**
     * Returns rank-specific styling for gold/silver/bronze podium positions.
     * Teams ranked 4th and below get a neutral dark background.
     */
    const getRankStyle = (index: number) => {
        if (index === 0) return { bg: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.05) 100%)', border: '#eab308', glow: '0 0 30px rgba(234, 179, 8, 0.3)', icon: '/trophy-gold.png', label: 'LEAGUE LEADER' };
        if (index === 1) return { bg: 'linear-gradient(135deg, rgba(229, 231, 235, 0.2) 0%, rgba(156, 163, 175, 0.05) 100%)', border: '#9ca3af', glow: '0 0 20px rgba(156, 163, 175, 0.2)', icon: '/trophy-silver.png', label: '2ND PLACE' };
        if (index === 2) return { bg: 'linear-gradient(135deg, rgba(180, 83, 9, 0.2) 0%, rgba(120, 53, 15, 0.05) 100%)', border: '#b45309', glow: '0 0 20px rgba(180, 83, 9, 0.2)', icon: '/trophy-bronze.png', label: '3RD PLACE' };
        return { bg: 'rgba(17, 24, 39, 0.6)', border: 'rgba(255,255,255,0.1)', glow: 'none', icon: null, label: null };
    };

    return (
        <div className="responsive-container" style={{
            background: 'transparent',
            display: 'grid',
            gridTemplateColumns: '1fr min-content 4px min-content 1fr', // Symmetrically centered with tight 4px gap
            columnGap: '0',
            width: '100%',
            height: '100%',
            flex: 1,
            overflowX: 'hidden',
            padding: '20px 40px',
            alignItems: 'start'
        }}>
            {/* --- COLUMN 1: LEFT OUTER SPACER --- */}
            <div style={{ pointerEvents: 'none' }} />

            {/* --- COLUMN 2: TROPHY PANEL (Left Centered) --- */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                position: 'relative',
                height: '85%'   // matches the standings panel height exactly
            }}>
                <div style={{
                    position: 'relative',
                    width: 'clamp(320px, 22vw, 450px)',
                    aspectRatio: '1/1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <img
                        src="/final_plaque.png"
                        alt="Trier Fantasy Football Leaders"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            zIndex: 10
                        }}
                    />
                </div>

                {/* ── League Chat ─────────────────────────────────────────── */}
                <div style={{
                    width: 'clamp(320px, 22vw, 450px)',
                    marginTop: '12px',
                    flex: 1,        // fill all remaining height below the trophy
                    minHeight: 0,   // required for flex children to shrink/scroll correctly
                    background: 'rgba(0,0,0,0.72)',
                    border: '1px solid rgba(234,179,8,0.25)',
                    borderRadius: '16px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(10px)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '8px 14px',
                        borderBottom: '1px solid rgba(234,179,8,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span style={{ fontSize: '0.95rem' }}>💬</span>
                        <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 900,
                            fontFamily: "'Graduate', sans-serif",
                            color: '#eab308',
                            letterSpacing: '2px',
                            textTransform: 'uppercase'
                        }}>League Chat</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.55rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Trash Talk Zone</span>
                    </div>

                    {/* Message list — flex: 1 so it fills all space and scrolls when full */}
                    <div style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#eab308 rgba(0,0,0,0.2)'
                    }}>
                        {chatMessages.length === 0 ? (
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#4b5563',
                                fontSize: '0.7rem',
                                fontStyle: 'italic',
                                textAlign: 'center',
                                lineHeight: 1.6
                            }}>
                                No messages yet.<br />Start the trash talk.
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                            {chatMessages.map(msg => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: msg.isMe ? 'flex-end' : 'flex-start'
                                    }}
                                >
                                    <div style={{
                                        fontSize: '0.55rem',
                                        color: '#6b7280',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        marginBottom: '2px',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {msg.isMe ? 'You' : msg.sender}
                                    </div>
                                    <div style={{
                                        maxWidth: '85%',
                                        padding: '6px 10px',
                                        borderRadius: msg.isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                        background: msg.isMe
                                            ? 'linear-gradient(135deg, rgba(234,179,8,0.25), rgba(234,179,8,0.12))'
                                            : 'rgba(255,255,255,0.07)',
                                        border: msg.isMe
                                            ? '1px solid rgba(234,179,8,0.35)'
                                            : '1px solid rgba(255,255,255,0.1)',
                                        color: msg.isMe ? '#fde68a' : '#e5e7eb',
                                        fontSize: '0.78rem',
                                        lineHeight: 1.4,
                                        wordBreak: 'break-word'
                                    }}>
                                        {msg.text}
                                    </div>
                                </motion.div>
                            ))}
                            </AnimatePresence>
                        )}
                        <div ref={chatBottomRef} />
                    </div>

                    {/* Input row */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        padding: '8px 10px',
                        borderTop: '1px solid rgba(255,255,255,0.07)',
                        background: 'rgba(0,0,0,0.3)'
                    }}>
                        <input
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={handleChatKey}
                            placeholder="Talk your smack..."
                            maxLength={200}
                            style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(234,179,8,0.2)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '0.78rem',
                                padding: '7px 10px',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                        <button
                            onClick={sendChat}
                            disabled={!chatInput.trim()}
                            style={{
                                background: chatInput.trim()
                                    ? 'linear-gradient(135deg, #eab308, #ca8a04)'
                                    : 'rgba(255,255,255,0.08)',
                                border: 'none',
                                borderRadius: '8px',
                                color: chatInput.trim() ? '#000' : '#4b5563',
                                cursor: chatInput.trim() ? 'pointer' : 'default',
                                padding: '7px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* --- COLUMN 3: EXACT 4PX CENTRAL GAP --- */}
            <div style={{ pointerEvents: 'none', width: '4px' }} />

            {/* --- COLUMN 4: FIELD PANEL (Right Centered) --- */}
            <div style={{
                justifySelf: 'start',
                width: 'clamp(360px, 24vw, 550px)',
                background: 'url(/field-background.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: '24px',
                boxShadow: '0 30px 60px rgba(0,0,0,0.8), 0 0 0 4px rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                height: '85%',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 0 }} />

                <div style={{
                    position: 'relative',
                    zIndex: 2,
                    width: '94%',
                    minHeight: '400px',
                    height: '95%',
                    background: `url(/leather_stitched.png)`,
                    backgroundSize: '100% 100%', // Lock stitching to edges
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    borderRadius: '20px',
                    border: '4px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                    padding: 'clamp(25px, 3vw, 40px)', // Increased padding to avoid overlapping stitches
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#eab308 rgba(0,0,0,0.2)'
                }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <h2 style={{
                            fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                            fontWeight: 900,
                            fontFamily: "'Graduate', sans-serif",
                            margin: 0,
                            color: 'transparent',
                            backgroundImage: `url(${leatherTexture})`,
                            backgroundSize: '150px',
                            backgroundPosition: 'center',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            WebkitTextStroke: '1px rgba(255,255,255,0.95)',
                            textShadow: '0 5px 15px rgba(0,0,0,0.9)',
                            textTransform: 'uppercase',
                            letterSpacing: '2px'
                        }}>
                            League Standings
                        </h2>
                        <div style={{ height: '4px', width: '80px', background: '#eab308', margin: '10px auto', borderRadius: '2px', boxShadow: '0 0 15px rgba(234, 179, 8, 0.6)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sortedTeams.map((team, index) => {
                            const style = getRankStyle(index);
                            return (
                                <div key={team.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 'clamp(5px, 1vw, 10px) 16px',
                                    background: style.bg,
                                    border: `1px solid ${style.border}`,
                                    borderLeft: `6px solid ${style.border}`,
                                    borderRadius: '12px',
                                    backdropFilter: 'blur(12px)',
                                    boxShadow: `${style.glow}, 0 4px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`,
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ position: 'absolute', inset: 0, height: '50%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)', pointerEvents: 'none' }} />
                                    <div style={{
                                        width: '40px',
                                        fontSize: 'clamp(1rem, 1.5vw, 1.5rem)',
                                        fontWeight: 900,
                                        fontFamily: "'Graduate', sans-serif",
                                        color: index < 3 ? style.border : '#d1d5db',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                        display: 'flex', justifyContent: 'center'
                                    }}>#{index + 1}</div>
                                    <div style={{ width: '50px', display: 'flex', justifyContent: 'center' }}>
                                        {style.icon ? <img src={style.icon} alt="Trophy" style={{ width: '30px', height: '30px', objectFit: 'contain' }} /> : <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trophy size={14} color="#9ca3af" /></div>}
                                    </div>
                                    <div style={{ flex: 1, paddingLeft: '10px' }}>
                                        <div style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.1rem)', fontWeight: 800, color: '#fff', fontFamily: "'Graduate', sans-serif" }}>{team.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#d1d5db' }}>Owner: {team.ownerName} {style.label && <span style={{ marginLeft: '6px', fontSize: '0.55rem', fontWeight: 900, color: '#000', padding: '1px 4px', borderRadius: '3px', background: style.border, textTransform: 'uppercase' }}>{style.label}</span>}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                            {team.audit?.status === 'ORCHESTRATED' && (
                                                <span style={{
                                                    fontSize: '0.55rem',
                                                    fontWeight: 900,
                                                    color: status.season_state === 'COMPLETED_OFFICIAL' ? '#eab308' : '#10b981',
                                                    background: status.season_state === 'COMPLETED_OFFICIAL' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                    padding: '2px 5px',
                                                    borderRadius: '4px',
                                                    border: `1px solid ${status.season_state === 'COMPLETED_OFFICIAL' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                                                }}>
                                                    {status.season_state === 'COMPLETED_OFFICIAL' ? 'FINAL' : 'PROVISIONAL'}
                                                </span>
                                            )}
                                            <div style={{ fontSize: 'clamp(1rem, 1.4vw, 1.4rem)', fontWeight: 900, color: style.border, fontFamily: "'Graduate', sans-serif" }} title={`Season: ${status.season} | Pipeline: ${status.season_state}`}>
                                                {(team.totalPoints || 0).toFixed(2)}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.6rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>PTS</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
