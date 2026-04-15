import React, { useState } from 'react';
import { useDialog } from './AppDialog';
import type { Player, Transaction, FantasyTeam } from '../types';
import { ScoringEngine } from '../utils/ScoringEngine';
import { getTeamTheme } from '../utils/teamThemes';
import { toPng } from 'html-to-image';
import { CardFrontFace } from './player/CardFrontFace';
import { CardBackFace } from './player/CardBackFace';
import { CardActionButtons } from './player/CardActionButtons';

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

const CURRENT_SEASON = ScoringEngine.getOrchestrationStatus().season;

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
                        `Total Points: ${((player.historicalStats?.filter(s => s.year !== CURRENT_SEASON).reduce((sum, s) => sum + (s.fantasyPoints || 0), 0) || 0) + (ScoringEngine.calculatePoints(player).total || 0)).toFixed(1)}\n\n` +
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
            gap: 'min(20px, 3vh)',
            perspective: '1200px',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            position: 'relative',
            width: '100%',
            height: '100%',
            maxHeight: '85vh',
            margin: '0 auto',
            boxSizing: 'border-box',
            overflowY: 'auto',
            padding: '10px'
        }}>
            <div
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleCardFlip}
                style={{
                    height: 'min(536px, 65vh)',
                    minHeight: '440px',
                    aspectRatio: '340 / 536',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
                    transform: isFlipped
                        ? `rotateY(180deg)`
                        : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    fontSize: 'clamp(0.6rem, 1.8vh, 0.9rem)',
                    flexShrink: 0
                }}
            >
                <CardFrontFace
                    player={player}
                    isFlipped={isFlipped}
                    frontRef={frontRef}
                />

                <CardBackFace
                    player={player}
                    owningTeam={owningTeam}
                    teamTransactions={teamTransactions}
                    isFlipped={isFlipped}
                    isExporting={isExporting}
                    backPage={backPage}
                    setBackPage={setBackPage}
                    downloadCareerStats={downloadCareerStats}
                    backRef={backRef}
                />
            </div>

            <CardActionButtons
                onDraft={onDraft}
                onClose={onClose}
                isDrafted={isDrafted}
                onSwapSlot={onSwapSlot}
                actionLabel={actionLabel}
                actionColor={actionColor}
                onMakeOffer={onMakeOffer}
                isFlipped={isFlipped}
                setIsFlipped={setIsFlipped}
                isExporting={isExporting}
                showExportMenu={showExportMenu}
                setShowExportMenu={setShowExportMenu}
                handleExport={handleExport}
            />
        </div>
    );
};

export default PlayerTradingCard;
