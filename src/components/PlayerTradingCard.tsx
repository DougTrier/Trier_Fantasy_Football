import React, { useState } from 'react';
import { useDialog } from './AppDialog';
import type { Player, Transaction, FantasyTeam } from '../types';
import { ScoringEngine } from '../utils/ScoringEngine';
import { getTeamTheme } from '../utils/teamThemes';
import { TrendingUp, Shield, History, Download, Plus, Share2, Printer, Mail, Camera, Twitter, Facebook, Instagram, Ghost, Video, Music2, Youtube, Wallet } from 'lucide-react';
import { toPng } from 'html-to-image';
import tffLogo from '../assets/tff_logo_v6_clean.png'; // Re-using our brand logo

interface PlayerTradingCardProps {
    player: Player;
    owningTeam?: FantasyTeam;
    onDraft?: () => void;
    onClose: () => void;
    isDrafted?: boolean;
    onSwapSlot?: () => void;
    actionLabel?: string;
    actionColor?: string;
    teamTransactions?: Transaction[];
    onMakeOffer?: () => void;
}

export const PlayerTradingCard: React.FC<PlayerTradingCardProps> = ({
    player,
    owningTeam,
    onDraft,
    onClose,
    isDrafted,
    onSwapSlot,
    actionLabel,
    actionColor,
    teamTransactions = [],
    onMakeOffer
}) => {
    const { showAlert } = useDialog();
    const theme = getTeamTheme(player.team);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [isFlipped, setIsFlipped] = useState(false);
    const [backPage, setBackPage] = useState<'career' | 'fantasy' | 'combine'>('career');
    const [isExporting, setIsExporting] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const frontRef = React.useRef<HTMLDivElement>(null);
    const backRef = React.useRef<HTMLDivElement>(null);

    const handleExport = async (type: 'save' | 'print' | 'email') => {
        setIsExporting(true);
        setShowExportMenu(false);

        try {
            // 1. Capture Back first because it dictates the height (it expands for stats)
            // skipFonts: true — Google Fonts are cross-origin and cannot be inlined (CORS).
            // The fonts are already applied to the DOM so the captured image is unaffected.
            const backData = await toPng(backRef.current!, {
                pixelRatio: 2,
                quality: 1,
                skipFonts: true,
                backgroundColor: theme.primary,
                style: {
                    transform: 'none',
                    backfaceVisibility: 'visible',
                    height: 'auto',
                    minHeight: '520px'
                }
            });

            // 2. Measure the actual expanded height of the back face
            const tempImg = new Image();
            await new Promise(resolve => {
                tempImg.onload = resolve;
                tempImg.src = backData;
            });
            const backHeightPx = tempImg.height / 2; // Divide by pixelRatio to get CSS pixels

            // 3. Capture Front and force its height to match the back's expanded height
            const frontData = await toPng(frontRef.current!, {
                pixelRatio: 2,
                quality: 1,
                skipFonts: true,
                backgroundColor: theme.primary,
                style: {
                    transform: 'none',
                    backfaceVisibility: 'visible',
                    height: `${backHeightPx}px`
                }
            });

            if (type === 'print') {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(`
                        <html>
                        <head><title>Print Trading Card - ${player.firstName} ${player.lastName}</title></head>
                        <body style="margin:0; display:flex; flex-direction:column; align-items:center; gap:20px; padding:40px; background:#f0f0f0; font-family:sans-serif;">
                            <h1 style="color:#333;">Trier Fantasy Trading Card</h1>
                            <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center;">
                                <img src="${frontData}" style="width:340px; border-radius:16px; box-shadow:0 10px 20px rgba(0,0,0,0.2); border:4px solid #fff;" />
                                <img src="${backData}" style="width:340px; border-radius:16px; box-shadow:0 10px 20px rgba(0,0,0,0.2); border:4px solid #fff;" />
                            </div>
                            <script>window.onload = () => { window.print(); }</script>
                        </body>
                        </html>
                    `);
                    printWindow.document.close();
                }
            } else {
                // Combine into a single download or email
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const imgFront = new Image();
                const imgBack = new Image();

                await Promise.all([
                    new Promise(resolve => { imgFront.onload = resolve; imgFront.src = frontData; }),
                    new Promise(resolve => { imgBack.onload = resolve; imgBack.src = backData; })
                ]);

                canvas.width = imgFront.width + imgBack.width + 40;
                canvas.height = Math.max(imgFront.height, imgBack.height) + 40;
                if (ctx) {
                    ctx.fillStyle = '#111';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(imgFront, 20, 20);
                    ctx.drawImage(imgBack, imgFront.width + 20, 20);
                }

                const finalImg = canvas.toDataURL('image/png');

                if (type === 'save') {
                    const link = document.createElement('a');
                    link.download = `${player.lastName}_Trading_Card.png`;
                    link.href = finalImg;
                    link.click();
                } else if (type === 'email') {
                    const subject = encodeURIComponent(`Scout Report: ${player.firstName} ${player.lastName}`);
                    const body = encodeURIComponent(
                        `Check out this high-fidelity trading card for ${player.firstName} ${player.lastName}!\n\n` +
                        `Position: ${player.position}\n` +
                        `Total Points: ${((player.historicalStats?.filter(s => s.year !== 2025).reduce((sum, s) => sum + (s.fantasyPoints || 0), 0) || 0) + (ScoringEngine.calculatePoints(player).total || 0)).toFixed(1)}\n\n` +
                        `View the full report attached.`
                    );
                    window.location.href = `mailto:?subject=${subject}&body=${body}`;

                    // Also trigger the download immediately so they have the file ready
                    const link = document.createElement('a');
                    link.download = `${player.lastName}_Scout_Report.png`;
                    link.href = finalImg;
                    link.click();
                }
            }
        } catch (err) {
            console.error("Export failed", err);
            showAlert("Export failed. Please try again.", "Export Error");
        } finally {
            // Re-render occurs here, snapping back to normal
            setIsExporting(false);
        }
    };

    // Sort priority: Twitter > Facebook > Instagram > Snapchat > Youtube > Rumble > TikTok
    const getSocialLink = (platform: string, handle: string) => {
        switch (platform) {
            case 'twitter': return { url: `https://twitter.com/${handle}`, icon: Twitter, color: '#1DA1F2', title: 'X (Twitter)' };
            case 'facebook': return { url: `https://facebook.com/${handle}`, icon: Facebook, color: '#1877F2', title: 'Facebook' };
            case 'instagram': return { url: `https://instagram.com/${handle}`, icon: Instagram, color: '#E1306C', title: 'Instagram' };
            case 'snapchat': return { url: `https://snapchat.com/add/${handle}`, icon: Ghost, color: '#FFFC00', title: 'Snapchat' };
            case 'youtube': return { url: `https://youtube.com/${handle}`, icon: Youtube, color: '#FF0000', title: 'YouTube' };
            case 'rumble': return { url: `https://rumble.com/c/${handle}`, icon: Video, color: '#85C742', title: 'Rumble' };
            case 'tiktok': return { url: `https://tiktok.com/@${handle}`, icon: Music2, color: '#000000', title: 'TikTok' };
            default: return null;
        }
    };

    const getTopSocials = (socials: any) => {
        if (!socials) return [];
        const priority = ['twitter', 'facebook', 'instagram', 'snapchat', 'youtube', 'rumble', 'tiktok'];
        const active = priority
            .filter(p => socials[p])
            .map(p => getSocialLink(p, socials[p]))
            .filter(Boolean);
        return active.slice(0, 2); // Take top 2
    };

    const activeSocials = getTopSocials(player.socials);
    const leftSocial = activeSocials[0];
    const rightSocial = activeSocials[1];

    const formatHeight = (inchesStr: string | undefined) => {
        if (!inchesStr) return "N/A";
        if (inchesStr.includes("'")) return inchesStr;
        const totalInches = parseInt(inchesStr);
        if (isNaN(totalInches)) return inchesStr;
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        return `${feet}' ${inches}"`;
    };

    const downloadCareerStats = () => {
        if (!player.historicalStats || player.historicalStats.length === 0) return;

        setIsExporting(true);
        try {
            const headers = ['Year', 'Team', 'GP', 'Pass Yds', 'Pass TD', 'Int', 'Rush Yds', 'Rush TD', 'Rec', 'Rec Yds', 'Rec TD', 'Fantasy Pts'];
            const rows = player.historicalStats.map(s => [
                s.year,
                s.team,
                s.gamesPlayed,
                s.passingYards || 0,
                s.passingTDs || 0,
                s.interceptions || 0,
                s.rushingYards || 0,
                s.rushingTDs || 0,
                s.receptions || 0,
                s.receivingYards || 0,
                s.receivingTDs || 0,
                s.fantasyPoints
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `${player.firstName}_${player.lastName}_Career_Stats.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Export failed', error);
        } finally {
            setTimeout(() => setIsExporting(false), 500);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isFlipped) return;
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;

        setTilt({ x: rotateX, y: rotateY });
    };

    const handleMouseLeave = () => {
        setTilt({ x: 0, y: 0 });
    };

    const handleCardFlip = () => {
        if (!isDrafted) {
            setIsFlipped(!isFlipped);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'min(20px, 3vh)', // Space between card and buttons
            perspective: '1200px',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            position: 'relative',
            width: '100%',
            height: '100%',
            maxHeight: '85vh',
            margin: '0 auto',
            boxSizing: 'border-box',
            overflowY: 'auto', // Allow buttons to scroll if very short window
            padding: '10px'
        }}>
            <div
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleCardFlip}
                style={{
                    height: 'min(536px, 65vh)', // Limit card height specifically
                    minHeight: '440px',          // SAFETY FLOOR TO PREVENT "PANCAKING"
                    aspectRatio: '340 / 536',   // STRICT TARGET LOCKING FOR THE CARD ONLY
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
                    transform: isFlipped
                        ? `rotateY(180deg)`
                        : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    fontSize: 'clamp(0.6rem, 1.8vh, 0.9rem)', // Internal font scaling
                    flexShrink: 0
                }}
            >
                {/* === FRONT FACE === */}
                <div
                    ref={frontRef}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        background: '#fff',
                        borderRadius: '16px',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        border: `8px solid ${theme.primary}`,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        pointerEvents: isFlipped ? 'none' : 'auto',
                        boxSizing: 'border-box'
                    }}>
                    {/* TOP HEADER */}
                    <div style={{
                        height: '12%', // Percentage based
                        minHeight: '40px',
                        background: theme.secondary,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 5%',
                        clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)', zIndex: 2
                    }}>
                        <div style={{ color: theme.primary, fontFamily: "'Graduate', sans-serif", fontSize: 'clamp(1rem, 5vw, 2rem)', fontWeight: 900 }}>{player.position}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <div style={{ color: '#fff', fontFamily: "'Graduate', sans-serif", fontSize: 'clamp(0.6rem, 2.5vw, 1.2rem)', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{theme.fullName.toUpperCase()}</div>
                        </div>
                    </div>

                    {/* IMAGE */}
                    <div style={{
                        flex: 1, position: 'relative', background: `linear-gradient(to bottom, #d1d5db 0%, ${theme.primary} 100%)`,
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(${theme.secondary} 1px, transparent 1px)`, backgroundSize: '20px 20px', opacity: 0.2 }} />
                        <img src={theme.logoUrl} style={{ position: 'absolute', top: '5%', right: '5%', width: '20%', opacity: 0.8, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
                        <div style={{ width: '100%', height: '100%', zIndex: 5, marginBottom: '-5%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                            {player.photoUrl ? (
                                <img src={player.photoUrl} alt={player.lastName} style={{ width: 'auto', maxWidth: '140%', height: '110%', objectFit: 'contain', objectPosition: 'bottom center', maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)', filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5)) contrast(1.1)' }} />
                            ) : (
                                <Shield size={100} color="#fff" />
                            )}
                        </div>
                    </div>

                    {/* NAME STRIP */}
                    <div style={{ background: theme.primary, padding: '8px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `4px solid ${theme.secondary}`, borderBottom: `4px solid ${theme.secondary}`, zIndex: 10 }}>
                        <div style={{ width: '40px', display: 'flex', justifyContent: 'flex-start' }}>
                            {leftSocial && (
                                <a
                                    href={leftSocial.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }}
                                    title={leftSocial.title}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <leftSocial.icon size={20} fill={leftSocial.icon === Twitter ? "white" : "none"} strokeWidth={leftSocial.icon === Twitter ? 0 : 2} />
                                </a>
                            )}
                        </div>

                        <h2 style={{
                            margin: 0,
                            color: '#fff',
                            fontFamily: "'Graduate', sans-serif",
                            fontSize: 'clamp(1rem, 4vw, 1.8rem)',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                            letterSpacing: '1px',
                            textAlign: 'center', // CENTER TEXT
                            lineHeight: '0.9', // Tighter line height for wrapped names
                            width: '100%', // Ensure full width for centering
                            wordBreak: 'break-word',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {player.firstName} {player.lastName}
                        </h2>

                        <div style={{ width: '40px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            {rightSocial && (
                                <a
                                    href={rightSocial.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }}
                                    title={rightSocial.title}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <rightSocial.icon size={20} fill={rightSocial.icon === Facebook ? "white" : "none"} strokeWidth={rightSocial.icon === Facebook ? 0 : 2} />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* STATS */}
                    <div style={{ background: '#f3f4f6', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', background: '#fff', padding: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666' }}>PROJECTED</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: theme.primary }}>{player.projectedPoints}</div>
                            </div>
                            <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '4px', background: '#fff', padding: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666' }}>AVG DRAFT POS</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#333' }}>#{player.adp ? player.adp.toFixed(0) : 'N/A'}</div>
                            </div>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto 1fr',
                            alignItems: 'center',
                            marginTop: '5px'
                        }}>
                            {/* Left: Score */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <div style={{
                                    fontWeight: 900,
                                    color: theme.primary,
                                    fontSize: '1.2rem',
                                    fontStyle: 'italic',
                                    fontFamily: 'Impact, sans-serif',
                                    lineHeight: 1
                                }}>
                                    {(ScoringEngine.calculatePoints(player).total ?? 0).toFixed(1)}
                                </div>
                                <div style={{
                                    fontSize: '0.45rem',
                                    fontWeight: 900,
                                    color: ScoringEngine.getOrchestrationStatus().season_state === 'COMPLETED_OFFICIAL' ? '#eab308' : '#10b981',
                                    textTransform: 'uppercase'
                                }}>
                                    {ScoringEngine.getOrchestrationStatus().season_state === 'COMPLETED_OFFICIAL' ? 'SEASON FINAL' : 'PROVISIONAL'}
                                </div>
                            </div>

                            {/* Center: Sporty Text */}
                            <div style={{
                                fontFamily: "'Graduate', sans-serif",
                                fontSize: '0.9rem',
                                fontWeight: 900,
                                fontStyle: 'italic',
                                color: '#d1d5db',
                                letterSpacing: '1px',
                                textShadow: '0 1px 1px rgba(0,0,0,0.1)',
                                transform: 'skewX(-10deg)',
                                textTransform: 'uppercase',
                                justifySelf: 'center',
                                whiteSpace: 'nowrap'
                            }}>
                                TRIER FANTASY FOOTBALL
                            </div>

                            {/* Right: Panini + Logo */}
                            <div style={{
                                display: 'flex',
                                gap: '5px',
                                alignItems: 'center',
                                justifySelf: 'end'
                            }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>PANINI</span>
                                <img src={tffLogo} style={{ height: '24px' }} alt="League Logo" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* === BACK FACE === */}
                <div
                    ref={backRef}
                    style={{
                        position: 'absolute',
                        width: '100%',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        background: '#fff',
                        borderRadius: '16px',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        border: `8px solid ${theme.primary}`,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        pointerEvents: isFlipped ? 'auto' : 'none',
                        boxSizing: 'border-box',
                        height: isExporting ? 'auto' : '100%' // ALLOW TOTAL EXPANSION
                    }}>
                    <div
                        style={{
                            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                            padding: 'clamp(8px, 1.5vh, 12px) 4%', // Tighter padding for tabs
                            color: 'white',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1vh', // Tighter gap
                            overflow: isExporting ? 'visible' : 'hidden', // PREVENT MASKING
                            minHeight: 0,
                            boxSizing: 'border-box',
                            flex: isExporting ? 'none' : 1, // ALLOW GROWTH
                            height: isExporting ? 'auto' : undefined
                        }}>
                        {/* INTEGRATED PREMIUM TABS */}
                        <div style={{
                            width: '100%',
                            display: 'flex',
                            background: 'rgba(255,255,255,0.15)',
                            borderRadius: '10px',
                            padding: '2px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            marginBottom: '5px',
                            flexShrink: 0,
                            zIndex: 100
                        }}>
                            {(['career', 'combine', 'fantasy'] as const).map(page => (
                                <button
                                    key={page}
                                    onClick={(e) => { e.stopPropagation(); setBackPage(page); }}
                                    title={`Switch to ${page === 'career' ? 'Career Stats' : page === 'combine' ? 'Combine Metrics' : 'Trade Ledger'} view`}
                                    style={{
                                        flex: 1,
                                        padding: '8px 2px',
                                        border: 'none',
                                        background: backPage === page ? '#fff' : 'transparent',
                                        color: backPage === page ? theme.primary : '#fff',
                                        borderRadius: '8px',
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textTransform: 'uppercase',
                                        fontFamily: "'Graduate', sans-serif"
                                    }}
                                >
                                    {page === 'career' ? 'Stats' : page === 'combine' ? 'Combine' : 'Ledger'}
                                </button>
                            ))}
                        </div>
                        {/* BACK HEADER WITH NAME AND MASCOT */}
                        <div style={{
                            width: '100%', // Full width of padded container
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255,255,255,0.2)',
                            paddingBottom: '8px',
                            marginBottom: '4px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontFamily: "'Graduate', sans-serif", fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                    {player.firstName} {player.lastName}
                                </div>
                                <img src={theme.logoUrl} style={{ height: '24px', width: 'auto', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} alt="Team Mascot" />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {player.nflProfileUrl && (
                                    <a
                                        href={player.nflProfileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            fontSize: '0.55rem',
                                            background: 'rgba(255,255,255,0.2)',
                                            color: '#fff',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            textDecoration: 'none',
                                            fontWeight: 800,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            cursor: 'pointer',
                                            border: '1px solid rgba(255,255,255,0.4)',
                                            whiteSpace: 'nowrap'
                                        }}
                                        title="View Official NFL Bio"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        BIO <TrendingUp size={10} />
                                    </a>
                                )}
                                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                                    {player.position}
                                </div>
                            </div>
                        </div>

                        {backPage === 'career' ? (
                            <>


                                {/* SCROLLABLE CAREER STATS */}
                                <div style={{
                                    background: '#fff',
                                    padding: '2%',
                                    borderRadius: '8px',
                                    color: '#111',
                                    fontSize: 'clamp(0.4rem, 1.2vh, 0.65rem)', // Fluid font scaling for stats
                                    overflowY: isExporting ? 'visible' : 'auto',
                                    flex: isExporting ? 'none' : 1, // GROW TO FILL REMAINING SPACE
                                    height: isExporting ? 'auto' : undefined,
                                    minHeight: '60px', // PROTECT FROM BEING CRUSHED
                                    border: '1px solid #ddd',
                                    width: '100%', // Ensure full width
                                    boxSizing: 'border-box'
                                }}>
                                    {/* 2025 PROJECTION SECTION */}
                                    {player.projectedStats && (
                                        <div style={{ marginBottom: '10px', background: '#ecfdf5', borderRadius: '6px', padding: '6px', border: '1px solid #10b981' }}>
                                            <div style={{ fontWeight: 900, color: '#047857', borderBottom: '1px solid #34d399', paddingBottom: '2px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>2025 SEASON OUTLOOK (PROJ)</span>
                                                <span>{player.projectedStats.fantasyPoints.toFixed(1)} PTS</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>GP</div>
                                                    <div style={{ fontWeight: 800 }}>{player.projectedStats.gamesPlayed}</div>
                                                </div>
                                                {player.position === 'QB' ? (
                                                    <>
                                                        <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>YDS</div><div style={{ fontWeight: 800 }}>{player.projectedStats.passingYards}</div></div>
                                                        <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>TD</div><div style={{ fontWeight: 800 }}>{player.projectedStats.passingTDs}</div></div>
                                                        <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>INT</div><div style={{ fontWeight: 800 }}>{player.projectedStats.interceptions}</div></div>
                                                    </>
                                                ) : player.position === 'RB' ? (
                                                    <>
                                                        <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>RUSH</div><div style={{ fontWeight: 800 }}>{player.projectedStats.rushingYards}</div></div>
                                                        <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>REC</div><div style={{ fontWeight: 800 }}>{player.projectedStats.receivingYards}</div></div>
                                                        <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>TD</div><div style={{ fontWeight: 800 }}>{(player.projectedStats.rushingTDs || 0) + (player.projectedStats.receivingTDs || 0)}</div></div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>REC</div><div style={{ fontWeight: 800 }}>{player.projectedStats.receivingYards}</div></div>
                                                        <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>TD</div><div style={{ fontWeight: 800 }}>{player.projectedStats.receivingTDs}</div></div>
                                                        <div><div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#666' }}>Y/G</div><div style={{ fontWeight: 800 }}>{((player.projectedStats.receivingYards || 0) / player.projectedStats.gamesPlayed).toFixed(0)}</div></div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ fontWeight: 900, marginBottom: '6px', borderBottom: '1px solid #ddd', paddingBottom: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span>HISTORICAL CAREER PERF</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); downloadCareerStats(); }}
                                                disabled={isExporting}
                                                title="Download CSV"
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: isExporting ? 'wait' : 'pointer',
                                                    padding: '2px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    color: theme.primary,
                                                    opacity: isExporting ? 0.5 : 1
                                                }}
                                            >
                                                <Download size={14} />
                                            </button>
                                        </div>
                                        <span style={{ color: theme.primary }}>{player.position}</span>
                                    </div>

                                    {(!player.historicalStats || player.historicalStats.length === 0) ? (
                                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontStyle: 'italic', fontSize: '0.65rem' }}>
                                            No official NFL career stats available.<br />(Rookie / No prior experience)
                                        </div>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                            <thead>
                                                <tr style={{ background: '#f3f4f6', fontWeight: 800 }}>
                                                    <th style={{ padding: '2px' }}>YR</th>
                                                    <th style={{ padding: '2px' }}>TM</th>
                                                    <th style={{ padding: '2px' }}>GP</th>
                                                    {(player.position === 'QB') && (
                                                        <>
                                                            <th style={{ padding: '2px' }}>PASS YDS</th>
                                                            <th style={{ padding: '2px' }}>TD</th>
                                                        </>
                                                    )}
                                                    {(player.position === 'WR' || player.position === 'TE') && (
                                                        <>
                                                            <th style={{ padding: '2px' }}>REC YDS</th>
                                                            <th style={{ padding: '2px' }}>TD</th>
                                                        </>
                                                    )}
                                                    {(player.position === 'RB') && (
                                                        <>
                                                            <th style={{ padding: '2px' }}>RUSH YDS</th>
                                                            <th style={{ padding: '2px' }}>TD</th>
                                                        </>
                                                    )}
                                                    <th style={{ padding: '2px' }}>PTS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {player.historicalStats?.map(s => (
                                                    <tr key={s.year} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ fontWeight: 800 }}>{s.year}</td>
                                                        <td style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700 }}>{s.team}</td>
                                                        <td>{s.gamesPlayed}</td>
                                                        {player.position === 'QB' && (
                                                            <>
                                                                <td>{s.passingYards || 0}</td>
                                                                <td style={{ color: '#059669', fontWeight: 700 }}>{s.passingTDs || 0}</td>
                                                            </>
                                                        )}
                                                        {(player.position === 'WR' || player.position === 'TE') && (
                                                            <>
                                                                <td>{s.receivingYards || 0}</td>
                                                                <td style={{ color: '#059669', fontWeight: 700 }}>{s.receivingTDs || 0}</td>
                                                            </>
                                                        )}
                                                        {player.position === 'RB' && (
                                                            <>
                                                                <td>{s.rushingYards || 0}</td>
                                                                <td style={{ color: '#059669', fontWeight: 700 }}>{s.rushingTDs || 0}</td>
                                                            </>
                                                        )}
                                                        <td style={{ background: '#fefce8', fontWeight: 800 }}>
                                                            {s.year === 2025
                                                                ? (ScoringEngine.calculatePoints(player).total ?? 0).toFixed(1)
                                                                : (((s.fantasyPoints || 0) % 1 === 0) ? (s.fantasyPoints || 0) : (s.fantasyPoints || 0).toFixed(1))
                                                            }
                                                        </td>
                                                    </tr>
                                                ))}
                                                {/* TOTALS ROW */}
                                                <tr style={{ background: '#000', color: '#fff', fontWeight: 900, borderTop: '2px solid #333' }}>
                                                    <td style={{ padding: '4px' }}>CAREER</td>
                                                    <td style={{ padding: '4px' }}>TOT</td>
                                                    <td style={{ padding: '4px' }}>{player.historicalStats?.reduce((acc, s) => acc + s.gamesPlayed, 0)}</td>
                                                    {player.position === 'QB' && (
                                                        <>
                                                            <td style={{ padding: '4px' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.passingYards || 0), 0)}</td>
                                                            <td style={{ padding: '4px', color: '#34d399' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.passingTDs || 0), 0)}</td>
                                                        </>
                                                    )}
                                                    {(player.position === 'WR' || player.position === 'TE') && (
                                                        <>
                                                            <td style={{ padding: '4px' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.receivingYards || 0), 0)}</td>
                                                            <td style={{ padding: '4px', color: '#34d399' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.receivingTDs || 0), 0)}</td>
                                                        </>
                                                    )}
                                                    {(player.position === 'RB') && (
                                                        <>
                                                            <td style={{ padding: '4px' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.rushingYards || 0), 0)}</td>
                                                            <td style={{ padding: '4px', color: '#34d399' }}>{player.historicalStats?.reduce((acc, s) => acc + (s.rushingTDs || 0), 0)}</td>
                                                        </>
                                                    )}
                                                    <td style={{ padding: '4px', color: '#facc15' }}>
                                                        {player.historicalStats?.reduce((acc, s) => {
                                                            const pts = s.year === 2025
                                                                ? (ScoringEngine.calculatePoints(player).total ?? 0)
                                                                : (s.fantasyPoints || 0);
                                                            return acc + pts;
                                                        }, 0).toFixed(1)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </>
                        ) : backPage === 'combine' ? (
                            <div style={{
                                background: '#fff',
                                padding: 'clamp(8px, 2vh, 12px)',
                                borderRadius: '12px',
                                color: '#111',
                                flex: isExporting ? 'none' : 1,
                                height: isExporting ? 'auto' : undefined,
                                display: 'flex',
                                flexDirection: 'column',
                                overflowY: isExporting ? 'visible' : 'auto',
                                minHeight: 0,
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                                width: '100%',
                                boxSizing: 'border-box',
                                fontSize: 'clamp(0.4rem, 1.2vh, 0.75rem)'
                            }}>
                                <div style={{ fontWeight: 900, fontSize: '0.9rem', borderBottom: '2px solid #333', paddingBottom: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>NFL COMBINE METRICS</span>
                                    <div style={{ fontSize: '0.6rem', background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>OFFICIAL</div>
                                </div>

                                {player.combineStats ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {/* Physicals Grid */}
                                        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Physical Measurements</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>HEIGHT</div>
                                                    <div style={{ fontSize: '1rem', fontWeight: 900 }}>{player.combineStats.measurements.height_in ? `${Math.floor(player.combineStats.measurements.height_in / 12)}' ${player.combineStats.measurements.height_in % 12}"` : 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>WEIGHT</div>
                                                    <div style={{ fontSize: '1rem', fontWeight: 900 }}>{player.combineStats.measurements.weight_lb} <span style={{ fontSize: '0.6rem' }}>LBS</span></div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>ARM LENGTH</div>
                                                    <div style={{ fontSize: '1rem', fontWeight: 900 }}>{player.combineStats.measurements.arm_length_in || 'N/A'}"</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>HAND SIZE</div>
                                                    <div style={{ fontSize: '1rem', fontWeight: 900 }}>{player.combineStats.measurements.hand_size_in || 'N/A'}"</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Athletic Testing Table */}
                                        <div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Athletic Testing</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                                                {[
                                                    { label: '40-Yard Dash', value: player.combineStats.forty_yard, unit: 's' },
                                                    { label: 'Vertical Jump', value: player.combineStats.vertical_in, unit: '"' },
                                                    { label: 'Broad Jump', value: player.combineStats.broad_jump_in, unit: '"' },
                                                    { label: 'Bench Press', value: player.combineStats.bench_press_reps, unit: ' reps' },
                                                    { label: '3-Cone Drill', value: player.combineStats.three_cone, unit: 's' },
                                                    { label: '20-Yd Shuttle', value: player.combineStats.shuttle, unit: 's' }
                                                ].map(stat => (
                                                    <div key={stat.label} style={{ background: '#f1f5f9', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{stat.label}</div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 900, color: stat.value ? theme.primary : '#cbd5e1' }}>
                                                            {stat.value ? `${stat.value}${stat.unit}` : '-'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {player.combineStats.source_url && (
                                            <div style={{ textAlign: 'center', marginTop: '5px' }}>
                                                <a href={player.combineStats.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.6rem', color: '#3b82f6', textDecoration: 'none' }}>
                                                    View Verified Source &rarr;
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', textAlign: 'center', gap: '10px' }}>
                                        <TrendingUp size={32} />
                                        <div style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                                            No NFL Combine data available for this player.
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* FANTASY LEDGER VIEW */}
                                <div style={{
                                    background: '#fff',
                                    padding: 'clamp(8px, 2vh, 12px)',
                                    borderRadius: '12px',
                                    color: '#111',
                                    flex: isExporting ? 'none' : 1,
                                    height: isExporting ? 'auto' : undefined,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: isExporting ? 'visible' : 'hidden',
                                    minHeight: 0,
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    fontSize: 'clamp(0.4rem, 1.2vh, 0.75rem)'
                                }}>
                                    <div style={{ fontWeight: 900, fontSize: '0.8rem', borderBottom: '2px solid #333', paddingBottom: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>LIFETIME FANTASY LEDGER</span>
                                        <div style={{ color: theme.primary, fontSize: '0.6rem' }}>CHAMPION TRACKER</div>
                                    </div>

                                    {/* SCROLLABLE LEDGER CONTENT */}
                                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minHeight: 0 }}>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 900, color: '#666', marginBottom: '8px', textTransform: 'uppercase', marginTop: '5px' }}>
                                            <Wallet size={12} />
                                            Team Economy (Franchise Ledger)
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '15px' }}>
                                            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                                                <div style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 800 }}>TOTAL PRODUCTION</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>{(owningTeam?.total_production_pts || 0).toLocaleString()}</div>
                                            </div>
                                            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                                                <div style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 800 }}>POINTS USED</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#eab308' }}>{((owningTeam?.points_spent || 0) + (owningTeam?.points_escrowed || 0)).toLocaleString()}</div>
                                            </div>
                                            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #10b981' }}>
                                                <div style={{ fontSize: '0.5rem', color: '#10b981', fontWeight: 800 }}>LEAGUE BALANCE</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#10b981' }}>{((owningTeam?.total_production_pts || 0) - (owningTeam?.points_spent || 0)).toLocaleString()}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 900, color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                                            <Shield size={12} />
                                            Historical Performance
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', fontSize: '0.6rem', color: '#666', fontWeight: 800, borderBottom: '1px solid #eee' }}>
                                                    <th style={{ padding: '8px 4px' }}>SEASON</th>
                                                    <th style={{ padding: '8px 4px' }}>TEAM / EVENT</th>
                                                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>PTS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* 2025 Active Orchestrated Season */}
                                                <tr style={{ background: 'rgba(234, 179, 8, 0.05)', fontSize: '0.7rem' }}>
                                                    <td style={{ padding: '10px 4px', fontWeight: 900 }}>2025</td>
                                                    <td style={{ padding: '10px 4px' }}>
                                                        {ScoringEngine.getOrchestrationStatus().season_state === 'COMPLETED_OFFICIAL' ? 'Official Season Record' : 'Current Active Season'}
                                                    </td>
                                                    <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 900, color: theme.primary }}>
                                                        {(ScoringEngine.calculatePoints(player).total ?? 0).toFixed(1)}
                                                    </td>
                                                </tr>

                                                {/* Historical Records (Post-2025 filtered out) */}
                                                {player.historicalStats?.filter(s => s.year !== 2025).sort((a, b) => b.year - a.year).map(s => (
                                                    <tr key={s.year} style={{ fontSize: '0.7rem', borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '10px 4px', fontWeight: 800 }}>{s.year}</td>
                                                        <td style={{ padding: '10px 4px' }}>{s.team} Yearly Total</td>
                                                        <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700 }}>{(s.fantasyPoints || 0).toFixed(1)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* TRANSACTION HISTORY SECTION */}
                                        <div style={{ marginBottom: '15px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', fontWeight: 900, color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                <History size={12} />
                                                Recent Transactions
                                            </div>
                                            {teamTransactions.length > 0 ? (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.65rem' }}>
                                                    <tbody>
                                                        {teamTransactions.slice(0, 5).map(tx => (
                                                            <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                <td style={{ padding: '6px 0', fontWeight: 800, color: tx.type === 'ADD' ? '#059669' : tx.type === 'DROP' ? '#dc2626' : '#eab308' }}>
                                                                    {tx.type}
                                                                </td>
                                                                <td style={{ padding: '6px 0', color: '#444' }}>{tx.description}</td>
                                                                <td style={{ padding: '6px 0', textAlign: 'right', color: '#94a3b8', fontSize: '0.55rem' }}>
                                                                    {new Date(tx.timestamp).toLocaleDateString()}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>No local transaction history.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{
                                        marginTop: '10px',
                                        paddingTop: '10px',
                                        borderTop: '2px solid #eee',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'baseline'
                                    }}>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#666' }}>LIFETIME POINTS DOMINANCE</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: theme.primary }}>
                                            {((player.historicalStats?.filter(s => s.year !== 2025).reduce((sum, s) => sum + (s.fantasyPoints || 0), 0) || 0) +
                                                (ScoringEngine.calculatePoints(player).total || 0)).toFixed(1)}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Player Bio Stats */}
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px', width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '0.65rem' }}>
                                <div><span style={{ color: '#eee', fontWeight: 600 }}>Height:</span> {formatHeight(player.height)}</div>
                                <div><span style={{ color: '#eee', fontWeight: 600 }}>Weight:</span> {player.weight || "220"}</div>
                                <div><span style={{ color: '#eee', fontWeight: 600 }}>Age:</span> {player.age || "27"}</div>
                                <div><span style={{ color: '#eee', fontWeight: 600 }}>College:</span> {player.college || "N/A"}</div>
                            </div>
                        </div>

                        {/* Scouting Report */}
                        <div style={{ background: 'rgba(255,255,255,0.9)', padding: '8px 10px', borderRadius: '8px', color: '#111', borderLeft: `4px solid ${theme.secondary}`, width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.6rem', fontStyle: 'italic', lineHeight: '1.2' }}>
                                {player.lastName === 'Allen'
                                    ? '"Safety Jordan Whitehead of the Bills might have a knack for it. Of Allen, he said: Throws a lot of touchdowns, a lot of passing yards. His superpower is the deep ball."'
                                    : '"A dynamic threat through the air and on the ground. Defensive coordinators lose sleep trying to contain his versatility and speed. A perennial MVP contender."'}
                            </div>
                        </div>
                    </div>

                    {/* Back Footer */}
                    <div style={{ background: '#fff', padding: '6px', textAlign: 'center', flexShrink: 0, borderTop: '1px solid #eee' }}>
                        <div style={{ fontSize: '0.5rem', color: '#777', fontWeight: 800, letterSpacing: '1px' }}>2025 TRIER FANTASY FOOTBALL</div>
                    </div>
                </div>

            </div>



            {/* CONSOLIDATED ACTION BUTTON AREA */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                width: '100%',
                maxWidth: '340px',
                zIndex: 20
            }}>
                {onDraft && (
                    <button
                        onClick={onDraft}
                        disabled={isDrafted}
                        style={{
                            padding: '14px',
                            background: isDrafted ? '#9ca3af' : (actionColor || '#2563eb'),
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            cursor: isDrafted ? 'not-allowed' : 'pointer',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                        }}
                    >
                        {isDrafted ? (actionLabel || 'LOCKED') : (actionLabel || 'Draft Player')}
                    </button>
                )}

                {!onDraft && !onSwapSlot && onMakeOffer && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMakeOffer(); }}
                        style={{
                            padding: '14px',
                            background: '#eab308',
                            color: '#000',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                        }}
                    >
                        Make Trade Offer <Wallet size={20} />
                    </button>
                )}

                <button
                    onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
                    style={{
                        padding: '14px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                    }}
                >
                    Flip Card <History size={20} />
                </button>


                {onSwapSlot && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onSwapSlot(); }}
                        style={{
                            padding: '14px',
                            background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                            color: 'black',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                        }}
                    >
                        Swap Slot <Plus size={20} strokeWidth={3} />
                    </button>
                )}

                {/* SHARE & EXPORT BUTTON */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
                        disabled={isExporting}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '10px',
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            cursor: isExporting ? 'wait' : 'pointer',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(10px)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        {isExporting ? 'Capturing...' : (
                            <>Share & Export <Share2 size={20} /></>
                        )}
                    </button>

                    {showExportMenu && (
                        <div style={{
                            position: 'absolute',
                            bottom: '105%',
                            left: 0,
                            right: 0,
                            background: '#1f2937',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                            padding: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            zIndex: 100
                        }}>
                            <button onClick={(e) => { e.stopPropagation(); handleExport('save'); }} style={exportItemStyle}><Camera size={16} /> Save to Photos</button>
                            <button onClick={(e) => { e.stopPropagation(); handleExport('print'); }} style={exportItemStyle}><Printer size={16} /> Print Card</button>
                            <button onClick={(e) => { e.stopPropagation(); handleExport('email'); }} style={exportItemStyle}><Mail size={16} /> Email Scout Report</button>
                        </div>
                    )}
                </div>

                <div
                    onClick={onClose}
                    style={{
                        textAlign: 'center',
                        color: '#ddd',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontWeight: 600,
                        marginTop: '4px'
                    }}
                >
                    Close
                </div>
            </div>
        </div>
    );
};

const exportItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: '8px',
    width: '100%',
    textAlign: 'left',
    transition: 'background 0.2s',
    fontFamily: "'Inter', sans-serif"
};
