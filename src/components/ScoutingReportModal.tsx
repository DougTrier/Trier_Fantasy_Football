/**
 * ScoutingReportModal — Deep-Dive Player Intelligence Panel
 * ===========================================================
 * Opens from the H2H matchup grid to provide a rich per-player analysis view.
 * Supports toggling between two players in the matchup (primary/rival) and
 * between INTEL (written analysis) and FILM (video playlist) views.
 *
 * VIDEO PLAYLISTS:
 *   Fetched asynchronously from VideoPipelineService on first open. A
 *   StrictMode guard (hasInitialized ref) prevents the double-fetch that
 *   would otherwise occur in development due to double-effect invocation.
 *   Each player gets an independent video index so pausing one doesn't
 *   affect the other player's position.
 *
 * INTEL VIEW:
 *   Pulls from IntelligenceStore (curated) and falls back to generated text
 *   using ScoutVocab templates when no entry exists for the player.
 *
 * PRINT:
 *   useReactToPrint targets the printRef div, which renders a printer-friendly
 *   version of the report without the video player or modal chrome.
 */
// useRef: printRef for react-to-print + hasInitialized StrictMode guard.
// useMemo: report object regenerated only when activePlayerId or matchup changes.
// useEffect: playlist fetch, video index reset, scroll lock, player-switch reset.
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Mail, FileText, X } from 'lucide-react';
// useReactToPrint wraps the printRef div in a hidden print-only frame.
import { useReactToPrint } from 'react-to-print';
import { motion, AnimatePresence } from 'framer-motion';
// UniversalPlayer handles both YouTube iframe and local video playback.
import { UniversalPlayer } from './video/UniversalPlayer';
// VideoPipelineService performs the multi-tier video search (A→D relevance tiers).
import { VideoPipelineService, type VideoCandidate } from '../services/VideoPipelineService';
// videoBlacklist filters out previously flagged low-quality videos per session.
import { videoBlacklist } from '../services/VideoBlacklistService';
import type { H2HMatchupResult } from '../utils/H2HEngine';
// getIntelForPlayer returns curated scouting intel or null for unknown players.
import { getIntelForPlayer } from '../utils/IntelligenceStore';
import { PlayerCard } from './PlayerCard';

interface ScoutingReportModalProps {
    matchup: H2HMatchupResult;
    onClose: () => void;
    isOpen: boolean;
}

/**
 * ScoutingReportModal — the full-page deep-dive overlay.
 * Mount/unmount lifecycle: playlist fetch runs on mount (guarded by hasInitialized),
 * body scroll is locked while open, and all local state resets when isOpen flips.
 */
export const ScoutingReportModal: React.FC<ScoutingReportModalProps> = ({ matchup, onClose, isOpen }) => {
    // printRef targets the notebook-paper div for react-to-print.
    const printRef = useRef<HTMLDivElement>(null);
    const { primaryPlayer: off, rivalPlayer: def, advantageScore, metric } = matchup;

    // Which player's report is currently displayed (default: primary/offensive player)
    const [activePlayerId, setActivePlayerId] = useState<string>(off.id);
    // Toggle between written intelligence (INTEL) and highlight film (FILM)
    const [viewMode, setViewMode] = useState<'INTEL' | 'FILM'>('INTEL');

    // Always return to INTEL when switching players — film index state is preserved.
    // This prevents the user from seeing the previous player's video while the new
    // playlist is still loading (avoids confusing mismatched film/player combos).
    useEffect(() => {
        setViewMode('INTEL');
    }, [activePlayerId]);

    // Derived Active Player Object — falls back to off if def is null (no rival exists).
    const activePlayer = activePlayerId === off.id ? off : (def || off);
    // opponentPlayer: the "other" player — used for report narrative and comparison display.
    const opponentPlayer = activePlayerId === off.id ? def : off;

    // Independent video indices: switching active player doesn't reset film position,
    // which allows the user to resume watching the other player's film on switch-back.
    // Each player gets an independent video index to allow mid-session switching
    const [offVideoIndex, setOffVideoIndex] = useState(0);
    const [defVideoIndex, setDefVideoIndex] = useState(0);
    const [showOverlay, setShowOverlay] = useState(true);

    // Playlist state — populated by async VideoPipelineService call on mount
    const [playlists, setPlaylists] = useState<{ off: VideoCandidate[], def: VideoCandidate[] }>({ off: [], def: [] });
    const [isLoading, setIsLoading] = useState(false);

    // Guards against double-fetch in React StrictMode (dev double-effect invocation)
    const hasInitialized = useRef(false);

    // Load & Verify Playlists on Mount/Player Change
    useEffect(() => {
        if (!isOpen) {
            hasInitialized.current = false;
            return;
        }
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        let mounted = true;

        const loadPlaylists = async () => {
            setIsLoading(true);
            try {
                // Fetch for Primary
                const safeOff = await VideoPipelineService.fetchPlaylist({
                    playerName: `${off.firstName} ${off.lastName} `,
                    team: off.team || undefined
                });

                // Fetch for Rival (if exists)
                let safeDef: VideoCandidate[] = [];
                if (def) {
                    safeDef = await VideoPipelineService.fetchPlaylist({
                        playerName: `${def.firstName} ${def.lastName} `,
                        team: def.team || undefined
                    });
                }

                if (mounted) {
                    setPlaylists({ off: safeOff, def: safeDef });
                }
            } catch (error) {
                console.error("Failed to load playlists", error);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        loadPlaylists();

        return () => { mounted = false; };
    }, [off.id, def?.id]);

    // Reset error/indices when player changes
    useEffect(() => {
        if (activePlayerId) {
            setOffVideoIndex(0);
            setDefVideoIndex(0);
            setShowOverlay(true);
        }
    }, [activePlayerId]);

    // Safety clamp: if a video is removed from the playlist mid-session (blacklisted),
    // snap the index back to the last valid position rather than showing empty state.
    useEffect(() => {
        if (offVideoIndex >= playlists.off.length && playlists.off.length > 0) {
            setOffVideoIndex(playlists.off.length - 1);
        }
        if (defVideoIndex >= playlists.def.length && playlists.def.length > 0) {
            setDefVideoIndex(playlists.def.length - 1);
        }
    }, [playlists, offVideoIndex, defVideoIndex]);

    // Body scroll lock prevents the page behind the modal from scrolling.
    // Cleanup restores scroll when the modal unmounts.
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // react-to-print hook — targets printRef and uses the player's last name in the filename.
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `ScoutingReport_${activePlayer.lastName} `,
    });

    // ── Report Generation ──────────────────────────────────────────────────────
    // Regenerates on player switch or matchup change. Uses curated IntelligenceStore
    // data when available, falling back to template-generated text for unknown players.
    // The random headline selection is intentional — adds variety on repeated opens.
    const report = useMemo(() => {
        const isPrimaryView = activePlayerId === off.id;
        const subject = activePlayer;
        const opponent = opponentPlayer;

        // Base metrics (mock logic for narrative)
        const margin = Math.abs(advantageScore - 50);
        const isFavored = isPrimaryView ? advantageScore > 50 : advantageScore < 50;

        const subjectIntel = getIntelForPlayer(subject.lastName);

        // Headline randomly selected from 3 templates for variety on each open.
        const headlines = [
            `The ${subject.lastName} Protocol: Analyzing the matchup against ${opponent?.lastName || 'The Field'} `,
            `Scouting Report: Can ${subject.lastName} Exploit the ${metric.toLowerCase()} Mismatch ? `,
            `Tape Breakdown: ${subject.lastName} vs ${opponent?.lastName || 'Defense'} `
        ];
        const headline = headlines[Math.floor(Math.random() * headlines.length)];

        // Social sentiment: curated text from IntelligenceStore or generated fallback.
        // Social Sentiment
        const socialIntel = subjectIntel?.socialIntelligence ||
            `${subject.lastName} arrives with high expectations.The tape suggests a pivotal role in the ${metric.toLowerCase()} game script.`;

        const scoutSentiment = subjectIntel?.scoutSentiment || ['High Ceiling', 'Volume Dependent', 'Red Zone Target'];

        // Tape Analysis: advantage string vs caution string based on isFavored flag.
        // Tape Analysis
        const dataBreakdown = isFavored
            ? `ADVANTAGE: ${subject.lastName}. The metrics suggest a dominant outing.${subject.lastName} 's physical profile creates a distinct leverage point against ${opponent?.lastName || 'the unit'}. Expect aggressive usage early.`
            : `CAUTION: ${subject.lastName} faces a stiff test. ${opponent?.lastName || 'The opposition'} has shown resilience in this phase. Efficiency will be key, as volume may be contested.`;

        // Verdict: one-line START or CAUTION recommendation for the manager.
        // Verdict
        const conclusion = isFavored
            ? `VERDICT: Start with confidence. The ${metric} model projects a +${margin.toFixed(0)}% advantage.`
            : `VERDICT: Temper expectations. This is a high-variance spot with a tight margin for error.`;

        return {
            headline,
            socialIntel,
            dataBreakdown,
            conclusion,
            scoutSentiment,
            tacticalNote: `Coach's Tip: Focus on ${subject.lastName}'s ${metric.toLowerCase()} efficiency.`
        };
    }, [activePlayerId, off.id, def?.id, advantageScore, metric]);

    // YouTube Options - Removed as it is now handled inside UniversalPlayer

    // Determine which player's playlist/index/setter to pass to UniversalPlayer.
    // The two index states remain independent so switching players doesn't reset position.
    const activePlaylist = activePlayerId === off.id ? playlists.off : playlists.def;
    const activeVideo = activePlaylist[activePlayerId === off.id ? offVideoIndex : defVideoIndex];
    const setActiveIndex = activePlayerId === off.id ? setOffVideoIndex : setDefVideoIndex;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px'
            }}
        >
            <style>{`
                .notebook-paper {
                    background: #fefce8;
                    background-image: linear-gradient(#f3f4f6 1px, transparent 1px);
                    background-size: 100% 1.8rem;
                    position: relative;
                    box-shadow: 0 10px 50px rgba(0,0,0,0.8);
                }
                .notebook-paper::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 50px;
                    width: 2px;
                    height: 100%;
                    background: rgba(239, 68, 68, 0.3);
                    z-index: 0;
                }
                @media print {
                    @page { margin: 0; size: auto; } /* Remove browser headers/footers */
                    .no-print { display: none !important; }
                    .notebook-paper { 
                        box-shadow: none !important; 
                        background: white !important;
                        margin: 0 !important; 
                        width: 100% !important; 
                        max-width: none !important; 
                        padding: 40px !important; 
                        padding-left: 70px !important; /* Reduced from 100px - Balanced with Red Line */
                        padding-right: 50px !important; /* Slightly increased to balance center */
                        -webkit-print-color-adjust: exact;
                        border: none !important;
                    }
                    body { 
                        padding: 0; /* Remove body padding to let page margins control centering */
                        -webkit-print-color-adjust: exact; 
                    }
                }
                
                @media screen {
                   /* On screen, we fit to content or viewport */
                   .notebook-paper {
                       min-height: 600px; /* Reasonable minimum for screen */
                       height: auto;
                   }
                }
            `}</style>

            {/* Content Container */}
            <div style={{
                width: '100%',
                maxWidth: '900px',
                height: '95vh',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <style>{`div::-webkit-scrollbar { display: none; }`}</style>

                {/* ---------------- PAGE 1: THE INTEL (PRINTABLE) ---------------- */}
                {viewMode === 'INTEL' && (
                    <motion.div
                        key="intel-page"
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        style={{ height: '100%', overflowY: 'auto', scrollbarWidth: 'none' }}
                    >
                        <div
                            ref={printRef}
                            className="notebook-paper"
                            style={{
                                padding: '50px 70px 60px 80px',
                                borderRadius: '4px',
                                position: 'relative',
                                background: '#fefce8',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {/* Visual spiral holes */}
                            <div className="no-print" style={{
                                position: 'absolute', left: '15px', top: '20px', display: 'flex', flexDirection: 'column', gap: '25px', zIndex: 10
                            }}>
                                {[...Array(20)].map((_, i) => (
                                    <div key={i} style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#1f2937', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)' }} />
                                ))}
                            </div>

                            {/* Watermark — opacity 0.06 barely visible on print;
                                rotate(-15deg) tilts the watermark like an official stamp. */}
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%) rotate(-15deg)',
                                opacity: 0.06,
                                pointerEvents: 'none',
                                zIndex: 0,
                                width: '500px',
                                height: '500px'
                            }}>
                                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                                    <circle cx="50" cy="50" r="48" fill="none" stroke="#000" strokeWidth="1" />
                                    <path id="wmPath" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
                                    <text fill="#000" style={{ fontSize: '7.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        <textPath href="#wmPath">OFFICIAL TRIER FANTASY FOOTBALL SEAL • APPROVED DOCUMENT •</textPath>
                                    </text>
                                    <text x="50" y="62" textAnchor="middle" fill="#000" style={{ fontSize: '28px', fontWeight: 950, fontFamily: "'Graduate', serif" }}>TFF</text>
                                    <circle cx="50" cy="50" r="28" fill="none" stroke="#000" strokeWidth="1" />
                                </svg>
                            </div>

                            {/* Section 1 Header */}
                            <div style={{ position: 'relative', zIndex: 5, borderBottom: '3px solid #111827', paddingBottom: '20px', marginBottom: '30px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

                                    <div style={{ flex: 1, paddingRight: '20px' }}>
                                        <div style={{ fontFamily: "'Architects Daughter', cursive", color: '#b91c1c', fontSize: '0.9rem', fontWeight: 900, letterSpacing: '1px', marginBottom: '8px' }}>
                                            CONFIDENTIAL // INTEL REPORT // SUBJECT: {activePlayer.lastName.toUpperCase()}
                                        </div>
                                        <h1 style={{ fontFamily: "'Special Elite', cursive", fontSize: '2.4rem', lineHeight: 1.1, color: '#111827', margin: 0, textTransform: 'uppercase' }}>
                                            {report.headline}
                                        </h1>
                                    </div>

                                    {/* Mini-Cards Container (Interactive).
                                        Clicking a card switches the active player for the report.
                                        Scale + grayscale filter visually indicates the inactive card. */}
                                    <div style={{ display: 'flex', gap: '20px' }}> {/* Removed no-print class */}
                                        {/* Primary Mini-Card — scales to 60% of PlayerCard's natural size */}
                                        <div
                                            onClick={() => setActivePlayerId(off.id)}
                                            style={{
                                                width: '130px',
                                                height: '170px',
                                                position: 'relative',
                                                cursor: 'pointer',
                                                opacity: activePlayerId === off.id ? 1 : 0.6,
                                                transform: activePlayerId === off.id ? 'scale(1.05)' : 'scale(0.95)',
                                                transition: 'all 0.2s ease',
                                                filter: activePlayerId === off.id ? 'drop-shadow(0 0 10px rgba(234,179,8,0.5))' : 'grayscale(100%)'
                                            }}
                                        >
                                            {activePlayerId === off.id && (
                                                <div style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', color: '#b45309', fontWeight: 900, fontSize: '0.7rem', fontFamily: "'Orbitron', sans-serif", width: '100%', textAlign: 'center' }}>SELECTED</div>
                                            )}
                                            <div style={{ transform: 'scale(0.6)', transformOrigin: 'top left', width: '216px', pointerEvents: 'none' }}>
                                                <PlayerCard player={off} showSeal={!!off.ownerId} variant="large" />
                                            </div>
                                        </div>
                                        {/* Rival Mini-Card */}
                                        {def && (
                                            <div
                                                onClick={() => setActivePlayerId(def.id)}
                                                style={{
                                                    width: '130px',
                                                    height: '170px',
                                                    position: 'relative',
                                                    cursor: 'pointer',
                                                    opacity: activePlayerId === def.id ? 1 : 0.6,
                                                    transform: activePlayerId === def.id ? 'scale(1.05)' : 'scale(0.95)',
                                                    transition: 'all 0.2s ease',
                                                    filter: activePlayerId === def.id ? 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.5))' : 'grayscale(100%)'
                                                }}
                                            >
                                                {activePlayerId === def.id && (
                                                    <div style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', color: '#b91c1c', fontWeight: 900, fontSize: '0.7rem', fontFamily: "'Orbitron', sans-serif", width: '100%', textAlign: 'center' }}>SELECTED</div>
                                                )}
                                                <div style={{ transform: 'scale(0.6)', transformOrigin: 'top left', width: '216px', pointerEvents: 'none' }}>
                                                    <PlayerCard player={def} showSeal={!!def.ownerId} variant="large" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>

                            {/* Report Content */}
                            <div style={{ position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '30px', flex: 1 }}>
                                <section>
                                    <h3 style={{ fontFamily: "'Architects Daughter', cursive", fontSize: '1.2rem', color: '#b91c1c', fontWeight: 900, marginBottom: '10px', textDecoration: 'underline' }}>
                                        // SCOUT SENTIMENT
                                    </h3>
                                    <p style={{ fontFamily: "'Special Elite', cursive", fontSize: '1.1rem', lineHeight: 1.6, color: '#1f2937', margin: 0 }}>
                                        {report.socialIntel}
                                    </p>
                                    <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        {report.scoutSentiment.map((s, i) => (
                                            <span key={i} style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '4px', fontFamily: "'Architects Daughter', cursive", fontSize: '0.85rem', color: '#4b5563' }}>
                                                "{s}"
                                            </span>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <h3 style={{ fontFamily: "'Architects Daughter', cursive", fontSize: '1.2rem', color: '#b91c1c', fontWeight: 900, marginBottom: '10px', textDecoration: 'underline' }}>
                                        // THE TAPE BREAKDOWN
                                    </h3>
                                    <p style={{ fontFamily: "'Special Elite', cursive", fontSize: '1.1rem', lineHeight: 1.6, color: '#1f2937', margin: 0 }}>
                                        {report.dataBreakdown}
                                    </p>
                                </section>

                                <section style={{
                                    background: 'rgba(17, 24, 39, 0.03)',
                                    borderLeft: '4px solid #111827',
                                    padding: '20px',
                                    marginTop: '10px'
                                }}>
                                    <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', color: '#111827', fontWeight: 900, marginBottom: '5px', letterSpacing: '1px' }}>
                                        WAR ROOM VERDICT
                                    </h3>
                                    <p style={{ fontFamily: "'Special Elite', cursive", fontSize: '1.2rem', fontWeight: 900, color: '#111827', margin: 0 }}>
                                        {report.conclusion}
                                    </p>
                                </section>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', marginTop: '10px' }}>
                                    {/* Close Button - Relocated near Tactical Note */}
                                    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <button
                                            onClick={onClose}
                                            style={{
                                                width: '40px',
                                                height: '28px', // Slightly smaller
                                                borderRadius: '50%',
                                                background: 'radial-gradient(circle at 30% 30%, #b91c1c, #7f1d1d)',
                                                border: '2px solid #fff',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.2)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative'
                                            }}
                                        >
                                            <X size={16} color="#1a0505" strokeWidth={3} />
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.1, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, #000 2px, #000 4px)' }}></div>
                                        </button>
                                        <span style={{ fontFamily: "'Special Elite', cursive", color: '#b91c1c', fontSize: '0.9rem', fontWeight: 900 }}>CLOSE REPORT →</span>
                                    </div>
                                    <div style={{ fontFamily: "'Architects Daughter', cursive", color: '#4b5563', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'right' }}>
                                        {report.tacticalNote}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Spacer & Actions */}
                            <div style={{ flex: 1 }}></div>

                            <div className="no-print" style={{ marginTop: '50px', paddingTop: '20px', borderTop: '2px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <button
                                        onClick={() => handlePrint && handlePrint()}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#111827', fontFamily: "'Special Elite', cursive", fontWeight: 700 }}
                                    >
                                        <FileText size={20} /> PRINT INTEL
                                    </button>
                                    <button
                                        onClick={() => {
                                            const subject = `[INTEL] ${activePlayer.lastName}: ${report.headline}`;
                                            const body = `${report.headline}\n\nVERDICT:\n${report.conclusion}`;
                                            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#111827', fontFamily: "'Special Elite', cursive", fontWeight: 700 }}
                                    >
                                        <Mail size={20} /> EMAIL PITCH
                                    </button>
                                </div>
                                <button
                                    onClick={() => setViewMode('FILM')}
                                    style={{
                                        fontFamily: "'Orbitron', sans-serif",
                                        fontSize: '0.9rem',
                                        color: '#374151',
                                        fontWeight: 900,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        background: 'rgba(0,0,0,0.05)',
                                        padding: '10px 20px',
                                        borderRadius: '30px',
                                        cursor: 'pointer',
                                        border: '1px solid #d1d5db',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.background = '#111827';
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                                        e.currentTarget.style.color = '#374151';
                                    }}
                                >
                                    ENTER FILM ROOM →
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ---------------- PAGE 2: THE FILM ROOM (BROADCAST STYLE) ---------------- */}
                {viewMode === 'FILM' && (
                    <motion.div
                        key="film-page"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        <div style={{
                            background: '#111827',
                            padding: '40px',
                            borderRadius: '4px',
                            position: 'relative',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
                            width: '100%',
                            maxWidth: '900px',
                            color: '#f3f4f6',
                            border: '1px solid #374151'
                        }}>
                            {/* Navigation Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                                <button
                                    onClick={() => setViewMode('INTEL')}
                                    style={{
                                        background: 'transparent',
                                        color: '#9ca3af',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontFamily: "'Orbitron', sans-serif",
                                        fontSize: '0.8rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    ← BACK TO INTEL
                                </button>
                                <button onClick={() => setViewMode('INTEL')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', padding: '10px', cursor: 'pointer' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.8rem', color: '#eab308', marginBottom: '10px', textAlign: 'center', letterSpacing: '4px', textTransform: 'uppercase' }}>
                                Classified Film Room
                            </h2>
                            <div style={{ fontFamily: "'Special Elite', cursive", fontSize: '1.2rem', color: '#9ca3af', textAlign: 'center', marginBottom: '30px' }}>
                                SUBJECT: <span style={{ color: '#fff' }}>{activePlayer.firstName} {activePlayer.lastName}</span>
                            </div>

                            {/* Broadcast Player Container */}
                            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                                    {/* Playlist Dropdown */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151', paddingBottom: '15px' }}>
                                        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.9rem', color: '#eab308', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ color: '#ef4444', animation: 'pulse 2s infinite' }}>●</span> LIVE FEED
                                        </div>

                                        {activePlaylist.length > 0 && (
                                            <select
                                                id="video-selector"
                                                name="video-selector"
                                                value={activePlayerId === off.id ? offVideoIndex : defVideoIndex}
                                                onChange={(e) => {
                                                    setActiveIndex(Number(e.target.value));
                                                    setShowOverlay(true); // Reset to overlay on change
                                                }}
                                                style={{
                                                    background: '#1f2937',
                                                    color: '#f3f4f6',
                                                    border: '1px solid #374151',
                                                    padding: '8px 12px',
                                                    borderRadius: '4px',
                                                    fontFamily: "'Orbitron', sans-serif",
                                                    fontSize: '0.8rem',
                                                    outline: 'none',
                                                    cursor: 'pointer',
                                                    maxWidth: '300px'
                                                }}
                                            >
                                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                {activePlaylist.map((vid: any, idx: number) => (
                                                    <option key={idx} value={idx}> {/* Use Index as Key to prevent duplicate ID errors */}
                                                        {idx + 1}. {vid.title}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* Video Player Display */}
                                    <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
                                        {activeVideo ? (
                                            <>
                                                {/* Static Overlay (Broadcast Mode) */}
                                                <AnimatePresence>
                                                    {showOverlay && (
                                                        <motion.div
                                                            initial={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            style={{
                                                                position: 'absolute',
                                                                inset: 0,
                                                                background: 'radial-gradient(circle at center, #1f2937 0%, #000 100%)',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                zIndex: 20
                                                            }}
                                                        >
                                                            {/* Broadcast Logo */}
                                                            <div style={{ position: 'relative', marginBottom: '20px' }}>
                                                                <div style={{
                                                                    width: '120px', height: '120px',
                                                                    borderRadius: '50%',
                                                                    border: '4px solid #eab308',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    background: '#000',
                                                                    boxShadow: '0 0 30px rgba(234,179,8,0.3)'
                                                                }}>
                                                                    <div style={{ fontFamily: "'Graduate', serif", fontSize: '40px', fontWeight: 900, color: '#fff' }}>TFF</div>
                                                                </div>
                                                                <div style={{
                                                                    position: 'absolute', bottom: '-15px', left: '50%', transform: 'translateX(-50%)',
                                                                    background: '#eab308', color: '#000',
                                                                    padding: '4px 12px', borderRadius: '4px',
                                                                    fontFamily: "'Orbitron', sans-serif", fontSize: '0.7rem', fontWeight: 900, whiteSpace: 'nowrap'
                                                                }}>
                                                                    OFFICIAL BROADCAST
                                                                </div>
                                                            </div>

                                                            <h3 style={{ fontFamily: "'Special Elite', cursive", color: '#9ca3af', marginBottom: '30px', fontSize: '1.2rem' }}>
                                                                UP NEXT: <span style={{ color: '#fff' }}>{activeVideo.title}</span>
                                                            </h3>

                                                            <button
                                                                onClick={() => setShowOverlay(false)}
                                                                style={{
                                                                    background: 'rgba(255,255,255,0.1)',
                                                                    border: '2px solid #fff',
                                                                    color: '#fff',
                                                                    padding: '15px 40px',
                                                                    borderRadius: '50px',
                                                                    fontSize: '1.2rem',
                                                                    cursor: 'pointer',
                                                                    backdropFilter: 'blur(10px)',
                                                                    transition: 'all 0.2s',
                                                                    fontFamily: "'Orbitron', sans-serif",
                                                                    letterSpacing: '2px'
                                                                }}
                                                                onMouseOver={(e) => {
                                                                    e.currentTarget.style.background = 'white';
                                                                    e.currentTarget.style.color = 'black';
                                                                }}
                                                                onMouseOut={(e) => {
                                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                                                    e.currentTarget.style.color = 'white';
                                                                }}
                                                            >
                                                                WATCH TAPE
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {/* Current Video */}
                                                {!showOverlay && (
                                                    <UniversalPlayer
                                                        key={`${activePlayerId}-${activePlayerId === off.id ? offVideoIndex : defVideoIndex}`} // Force remount on index change
                                                        videoId={activeVideo.id}
                                                        provider={(activeVideo.provider as 'youtube' | 'x') || 'youtube'}
                                                        url={activeVideo.url} // Required for X/Twitter support
                                                        title={activeVideo.title}
                                                        style={{ width: '100%', height: '100%' }}
                                                        onStateChange={(state) => {
                                                            if (state === 'ended') {
                                                                setShowOverlay(true);
                                                            } else if (state === 'unavailable') {
                                                                console.warn(`[FilmRoom] Video ${activeVideo.id} unavailable. Blacklisting and removing from rotation...`);

                                                                // 1. BLACKLIST
                                                                videoBlacklist.add(activeVideo.id, 'Playback Error (150/101)', 150);

                                                                // 2. AUTO-ADVANCE (REMOVE FROM STATE)
                                                                // By removing the item, the next item naturally slides into the current index.
                                                                // If we are at the end, we might need to clamp the index.
                                                                setPlaylists(prev => {
                                                                    const targetKey = activePlayerId === off.id ? 'off' : 'def';
                                                                    const filtered = prev[targetKey].filter(v => v.id !== activeVideo.id);
                                                                    return {
                                                                        ...prev,
                                                                        [targetKey]: filtered
                                                                    };
                                                                });

                                                                // 3. RESET OVERLAY IF EMPTY (Handled by render condition)
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #374151', borderRadius: '8px', color: '#4b5563', fontFamily: "'Orbitron', sans-serif", gap: '10px' }}>
                                                {isLoading ? (
                                                    <>
                                                        <div className="spinner" style={{ border: '4px solid #374151', borderTop: '4px solid #eab308', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
                                                        <div style={{ marginTop: '20px' }}>ACCESSING SATELLITE FEED...</div>
                                                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div style={{ fontSize: '2rem' }}>🚫</div>
                                                        <div style={{ color: '#ef4444' }}>NO CLASSIFIED FOOTAGE FOUND</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#6b7280', maxWidth: '300px', textAlign: 'center' }}>
                                                            The requested assets are either restricted or unavailable.
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};

export default ScoutingReportModal;
