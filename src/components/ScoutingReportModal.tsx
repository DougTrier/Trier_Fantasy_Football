/**
 * ScoutingReportModal — Deep-Dive Player Intelligence Panel
 * ===========================================================
 * Opens from the H2H matchup grid to provide a rich per-player analysis view.
 * Supports toggling between two players in the matchup (primary/rival).
 *
 * INTEL VIEW:
 *   Pulls from IntelligenceStore (curated) and falls back to generated text
 *   using ScoutVocab templates when no entry exists for the player.
 *
 * PRINT:
 *   useReactToPrint targets the printRef div, which renders a printer-friendly
 *   version of the report without the modal chrome.
 */
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Mail, FileText, X } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { motion } from 'framer-motion';
import type { H2HMatchupResult } from '../utils/H2HEngine';
// getIntelForPlayer returns curated intel; generateIntelForPlayer covers all others.
import { getIntelForPlayer, generateIntelForPlayer, deriveSentimentTrend } from '../utils/IntelligenceStore';
import { PlayerCard } from './PlayerCard';

interface ScoutingReportModalProps {
    matchup: H2HMatchupResult;
    onClose: () => void;
    isOpen: boolean;
}

/** ScoutingReportModal — full-page deep-dive overlay. Body scroll locked while open. */
export const ScoutingReportModal: React.FC<ScoutingReportModalProps> = ({ matchup, onClose }) => {
    // printRef targets the notebook-paper div for react-to-print.
    const printRef = useRef<HTMLDivElement>(null);
    const { primaryPlayer: off, rivalPlayer: def, advantageScore, metric } = matchup;

    const [activePlayerId, setActivePlayerId] = useState<string>(off.id);

    // Derived Active Player Object — falls back to off if def is null (no rival exists).
    const activePlayer = activePlayerId === off.id ? off : (def || off);
    // opponentPlayer: the "other" player — used for report narrative and comparison display.
    const opponentPlayer = activePlayerId === off.id ? def : off;

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

        // Always resolve to a full intel object — curated or auto-generated
        const subjectIntel = getIntelForPlayer(subject.lastName) ?? generateIntelForPlayer(subject);

        // Headline randomly selected from 3 templates for variety on each open.
        const headlines = [
            `The ${subject.lastName} Protocol: Analyzing the matchup against ${opponent?.lastName || 'The Field'} `,
            `Scouting Report: Can ${subject.lastName} Exploit the ${metric.toLowerCase()} Mismatch ? `,
            `Tape Breakdown: ${subject.lastName} vs ${opponent?.lastName || 'Defense'} `
        ];
        const headline = headlines[Math.floor(Math.random() * headlines.length)];

        const socialIntel = subjectIntel.socialIntelligence;
        const scoutSentiment = subjectIntel.scoutSentiment;

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
            tacticalNote: `Coach's Tip: Focus on ${subject.lastName}'s ${metric.toLowerCase()} efficiency.`,
            sentimentTrend: subjectIntel.sentimentTrend ?? deriveSentimentTrend(subject),
            reporterFeed: subjectIntel.reporterFeed ?? [],
            trendingNews: subjectIntel.trendingNews,
        };
    }, [activePlayerId, off.id, def?.id, advantageScore, metric]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(10,14,26,0.82)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9000,
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
                    @page { margin: 1.5cm; size: A4 portrait; }
                    .no-print { display: none !important; }
                    html, body {
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        box-sizing: border-box !important;
                    }
                    .notebook-paper {
                        box-shadow: none !important;
                        background: white !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 0 30px 20px 50px !important;
                        overflow: hidden !important;
                        box-sizing: border-box !important;
                        -webkit-print-color-adjust: exact;
                        border: none !important;
                    }
                    .notebook-paper * {
                        max-width: 100% !important;
                        box-sizing: border-box !important;
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                        word-break: break-word !important;
                        white-space: normal !important;
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

            {/* Top-right close button — always visible regardless of scroll position */}
            <button
                className="no-print"
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: '16px',
                    right: '20px',
                    zIndex: 9100,
                    background: 'rgba(30,30,30,0.85)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                    color: '#fff',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                    transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(185,28,28,0.9)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(30,30,30,0.85)'}
            >
                <X size={20} strokeWidth={2.5} />
            </button>

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

                <motion.div
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
                                padding: '20px 50px 20px 60px',
                                borderRadius: '4px',
                                position: 'relative',
                                background: '#fefce8',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {/* Visual spiral holes */}
                            <div className="no-print" style={{
                                position: 'absolute', left: '15px', top: '20px', display: 'flex', flexDirection: 'column', gap: '22px', zIndex: 10
                            }}>
                                {[...Array(13)].map((_, i) => (
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
                            <div style={{ position: 'relative', zIndex: 5, borderBottom: '3px solid #111827', paddingBottom: '10px', marginBottom: '14px' }}>
                                {/* Sentiment banner — color-coded BULLISH / BEARISH / NEUTRAL */}
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    background: report.sentimentTrend === 'BULLISH' ? 'rgba(16,185,129,0.12)' : report.sentimentTrend === 'BEARISH' ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.12)',
                                    border: `1px solid ${report.sentimentTrend === 'BULLISH' ? '#10b981' : report.sentimentTrend === 'BEARISH' ? '#ef4444' : '#64748b'}`,
                                    borderRadius: '20px', padding: '3px 12px', marginBottom: '12px',
                                    fontFamily: "'Architects Daughter', cursive", fontSize: '0.8rem', fontWeight: 900,
                                    color: report.sentimentTrend === 'BULLISH' ? '#065f46' : report.sentimentTrend === 'BEARISH' ? '#991b1b' : '#475569',
                                }}>
                                    <span>{report.sentimentTrend === 'BULLISH' ? '📈' : report.sentimentTrend === 'BEARISH' ? '📉' : '➡️'}</span>
                                    WAR ROOM: {report.sentimentTrend}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

                                    <div style={{ flex: 1, paddingRight: '20px' }}>
                                        <div style={{ fontFamily: "'Architects Daughter', cursive", color: '#b91c1c', fontSize: '0.9rem', fontWeight: 900, letterSpacing: '1px', marginBottom: '8px' }}>
                                            CONFIDENTIAL // INTEL REPORT // SUBJECT: {activePlayer.lastName.toUpperCase()}
                                        </div>
                                        <h1 style={{ fontFamily: "'Special Elite', cursive", fontSize: '1.8rem', lineHeight: 1.1, color: '#111827', margin: 0, textTransform: 'uppercase' }}>
                                            {report.headline}
                                        </h1>
                                    </div>

                                    {/* Mini-Cards Container (Interactive).
                                        Clicking a card switches the active player for the report.
                                        Scale + grayscale filter visually indicates the inactive card. */}
                                    <div className="no-print" style={{ display: 'flex', gap: '20px' }}>
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
                            <div style={{ position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

                                {/* Beat Reporter Feed — shown only when entries exist */}
                                {report.reporterFeed.length > 0 && (
                                    <section>
                                        <h3 style={{ fontFamily: "'Architects Daughter', cursive", fontSize: '1.2rem', color: '#b91c1c', fontWeight: 900, marginBottom: '10px', textDecoration: 'underline' }}>
                                            // BEAT REPORTER FEED
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {report.reporterFeed.map((item, i) => (
                                                <div key={i} style={{
                                                    background: 'rgba(17,24,39,0.04)',
                                                    borderLeft: `3px solid ${item.sentiment === 'bullish' ? '#10b981' : item.sentiment === 'bearish' ? '#ef4444' : '#94a3b8'}`,
                                                    padding: '8px 12px',
                                                    borderRadius: '0 4px 4px 0',
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                        <p style={{ fontFamily: "'Special Elite', cursive", fontSize: '0.95rem', color: '#1f2937', margin: 0, flex: 1 }}>
                                                            {item.headline}
                                                        </p>
                                                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'nowrap', marginTop: '2px' }}>{item.timestamp}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '4px', fontWeight: 700 }}>
                                                        {item.reporter} · {item.outlet}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

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
                                    padding: '12px 16px',
                                    marginTop: '4px'
                                }}>
                                    <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', color: '#111827', fontWeight: 900, marginBottom: '5px', letterSpacing: '1px' }}>
                                        WAR ROOM VERDICT
                                    </h3>
                                    <p style={{ fontFamily: "'Special Elite', cursive", fontSize: '1.2rem', fontWeight: 900, color: '#111827', margin: 0 }}>
                                        {report.conclusion}
                                    </p>
                                </section>

                            </div>

                            {/* Single combined action bar — Print | Email on left, Close center, Film Room right */}
                            <div className="no-print" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '2px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <button
                                        onClick={() => handlePrint && handlePrint()}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#111827', fontFamily: "'Special Elite', cursive", fontWeight: 700, fontSize: '0.9rem' }}
                                    >
                                        <FileText size={16} /> PRINT INTEL
                                    </button>
                                    <button
                                        onClick={() => {
                                            const subject = `[INTEL] ${activePlayer.lastName}: ${report.headline}`;
                                            const body = `${report.headline}\n\nVERDICT:\n${report.conclusion}`;
                                            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#111827', fontFamily: "'Special Elite', cursive", fontWeight: 700, fontSize: '0.9rem' }}
                                    >
                                        <Mail size={16} /> EMAIL PITCH
                                    </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        onClick={onClose}
                                        style={{
                                            width: '32px', height: '32px',
                                            borderRadius: '50%',
                                            background: 'radial-gradient(circle at 30% 30%, #b91c1c, #7f1d1d)',
                                            border: '2px solid #fff',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                        }}
                                    >
                                        <X size={14} color="#fff" strokeWidth={3} />
                                    </button>
                                    <span style={{ fontFamily: "'Special Elite', cursive", color: '#b91c1c', fontSize: '0.85rem', fontWeight: 900 }}>CLOSE REPORT</span>
                                </div>

                            </div>
                        </div>
                    </motion.div>
            </div>
        </motion.div>
    );
};

export default ScoutingReportModal;
