import React from 'react';
import { Plus, Share2, History, Camera, Printer, Mail, Wallet, FileText } from 'lucide-react';
import { exportItemStyle } from './cardUtils';

interface CardActionButtonsProps {
    onDraft?: () => void;
    onClose: () => void;
    isDrafted?: boolean;
    onSwapSlot?: () => void;
    actionLabel?: string;
    actionColor?: string;
    onMakeOffer?: () => void;
    isFlipped: boolean;
    setIsFlipped: (flipped: boolean) => void;
    isExporting: boolean;
    showExportMenu: boolean;
    setShowExportMenu: (show: boolean) => void;
    handleExport: (type: 'save' | 'print' | 'email') => void;
    onScoutingReport?: () => void;
}

export const CardActionButtons: React.FC<CardActionButtonsProps> = ({
    onDraft,
    onClose,
    isDrafted,
    onSwapSlot,
    actionLabel,
    actionColor,
    onMakeOffer,
    isFlipped,
    setIsFlipped,
    isExporting,
    showExportMenu,
    setShowExportMenu,
    handleExport,
    onScoutingReport
}) => {
    return (
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

            {/* SHARE & EXPORT  |  SCOUTING REPORT — split row */}
            <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>

                {/* Left: Share & Export */}
                <div style={{ position: 'relative', flex: 1 }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
                        disabled={isExporting}
                        style={{
                            width: '100%',
                            padding: '14px 8px',
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 900,
                            cursor: isExporting ? 'wait' : 'pointer',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(10px)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        {isExporting ? 'Capturing...' : <><Share2 size={16} /> Share & Export</>}
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

                {/* Right: Scouting Report */}
                <button
                    onClick={(e) => { e.stopPropagation(); onScoutingReport?.(); }}
                    style={{
                        flex: 1,
                        padding: '14px 8px',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                    <FileText size={16} /> Scout Report
                </button>
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
    );
};
