/**
 * FieldView — Interactive Tactical Field Diagram
 * ================================================
 * Renders a top-down football field with draggable player token positions.
 * Managers can toggle between OFFENSE, DEFENSE, SPECIAL TEAMS, and COACH
 * (all-22) views. In edit mode, tokens can be dragged to custom coordinates
 * which are persisted in local component state (reset on remount).
 *
 * COORDINATE SYSTEM:
 *   Positions are stored as percentage values (top/left as % of container)
 *   so the layout scales correctly at any window size. The container uses
 *   position:relative and tokens use position:absolute.
 *
 * EDIT MODE:
 *   Uses window-level mousemove/mouseup listeners (attached via useEffect)
 *   rather than element-level events so dragging doesn't break if the cursor
 *   briefly leaves the token boundary during fast movement.
 *
 * NOTE: FieldView is decorative / tactical planning — it does not drive
 * actual roster slots. Roster changes are made via the Roster component.
 */
// useState: mode, isEditMode, coords (token positions), selectedId, isDragging.
// useEffect: attaches/detaches window mousemove/mouseup listeners for drag.
// useRef: containerRef used to convert absolute pixel coords to percentages.
import React, { useState, useEffect, useRef } from 'react';
import type { FantasyTeam, Player } from '../types';
import { Save, Edit3, PlusCircle } from 'lucide-react';

interface FieldViewProps {
    team: FantasyTeam;
    onSelectPlayer: (id: string, type: 'EMPTY' | 'PLAYER') => void;
    onRemovePlayer: (player: Player) => void;
}

// Default token positions — tuned to a realistic top-down formation layout.
// Values are percentages of the container dimensions for resolution independence.
const INITIAL_COORDS: Record<string, { top: number, left: number, width: number, height: number, shape: 'round' | 'square' }> = {
    "s1": { "top": 29.21, "left": 51.56, "width": 105, "height": 105, "shape": "square" },
    "mlb": { "top": 47.32, "left": 39.83, "width": 88, "height": 88, "shape": "square" },
    "s2": { "top": 47.24, "left": 61.76, "width": 88, "height": 88, "shape": "square" },
    "cb1": { "top": 58.34, "left": 20.01, "width": 80, "height": 80, "shape": "square" },
    "de1": { "top": 58.26, "left": 29.55, "width": 80, "height": 80, "shape": "square" },
    "dt": { "top": 58.18, "left": 39.09, "width": 80, "height": 80, "shape": "square" },
    "lb1": { "top": 58.11, "left": 44.95, "width": 80, "height": 80, "shape": "square" },
    "lb2": { "top": 58.18, "left": 56.52, "width": 80, "height": 80, "shape": "square" },
    "dt2": { "top": 58.18, "left": 65.36, "width": 80, "height": 80, "shape": "square" },
    "de2": { "top": 58.18, "left": 71.97, "width": 80, "height": 80, "shape": "square" },
    "cb2": { "top": 58.26, "left": 81.42, "width": 80, "height": 80, "shape": "square" },
    "te": { "top": 69.52, "left": 35.53, "width": 75, "height": 75, "shape": "round" },
    "lt": { "top": 69.52, "left": 40.26, "width": 75, "height": 75, "shape": "round" },
    "lg": { "top": 69.44, "left": 45.07, "width": 75, "height": 75, "shape": "round" },
    "c": { "top": 68.81, "left": 50.50, "width": 75, "height": 75, "shape": "round" },
    "rg": { "top": 69.60, "left": 55.47, "width": 75, "height": 75, "shape": "round" },
    "rt": { "top": 69.52, "left": 60.28, "width": 75, "height": 75, "shape": "round" },
    "flex": { "top": 69.52, "left": 65.16, "width": 75, "height": 75, "shape": "round" },
    "qb": { "top": 78.89, "left": 50.78, "width": 80, "height": 80, "shape": "round" },
    "rb1": { "top": 93.38, "left": 50.86, "width": 85, "height": 85, "shape": "round" },
    "wr1": { "top": 74.96, "left": 30.25, "width": 78, "height": 78, "shape": "round" },
    "wr2": { "top": 78.42, "left": 69.54, "width": 78, "height": 78, "shape": "round" },

    // Special Teams Defaults
    "k": { "top": 40, "left": 85, "width": 65, "height": 65, "shape": "round" },
    "p": { "top": 60, "left": 85, "width": 65, "height": 65, "shape": "round" },
    "ls": { "top": 50, "left": 65, "width": 65, "height": 65, "shape": "round" },
    "st1": { "top": 10, "left": 55, "width": 65, "height": 65, "shape": "round" },
    "st2": { "top": 90, "left": 55, "width": 65, "height": 65, "shape": "round" },
    "kr": { "top": 50, "left": 10, "width": 65, "height": 65, "shape": "round" },
    "pr": { "top": 50, "left": 20, "width": 65, "height": 65, "shape": "round" }
};

// Slot key groups for display mode filtering — specials/kickers not included in offense/defense sets
const OFFENSE_KEYS = ['qb', 'rb1', 'wr1', 'wr2', 'te', 'lt', 'lg', 'c', 'rg', 'rt', 'flex'];
const DEFENSE_KEYS = ['s1', 'mlb', 's2', 'cb1', 'de1', 'dt', 'lb1', 'lb2', 'dt2', 'de2', 'cb2'];

/**
 * FieldView — tactical field diagram.
 * The component owns its own coords state (reset on remount) so position
 * changes are non-destructive — they don't persist to the League record.
 */
export const FieldView: React.FC<FieldViewProps> = ({ team, onSelectPlayer }) => {
    // mode: filters which token groups are visible — offense-only, specials, or all-22.
    const [mode, setMode] = useState<'ALL' | 'SPECIAL' | 'COACH'>('ALL');

    // EDIT MODE STATE
    const [isEditMode, setIsEditMode] = useState(false);
    const [coords, setCoords] = useState(INITIAL_COORDS);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Refs for drag math
    const containerRef = useRef<HTMLDivElement>(null);

    // Window Event Listeners for Dragging
    useEffect(() => {
        const handleWindowMouseMove = (e: MouseEvent) => {
            if (!isDragging || !selectedId || !containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Convert to percentage
            const leftPercent = (x / rect.width) * 100;
            const topPercent = (y / rect.height) * 100;

            setCoords(prev => ({
                ...prev,
                [selectedId]: {
                    ...prev[selectedId],
                    top: topPercent,
                    left: leftPercent
                }
            }));
        };

        const handleWindowMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [isDragging, selectedId]);

    // handleMouseDown: initiates a drag on the selected token.
    // preventDefault stops text selection on the page during drag.
    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        if (!isEditMode) return;
        e.preventDefault();
        e.stopPropagation();
        setSelectedId(id);
        setIsDragging(true);
    };

    // handleAddMarker: adds a custom coach-label token at the center of the field.
    // The prompt-based ID input keeps the UI minimal (no inline form needed).
    const handleAddMarker = () => {
        const id = prompt("Enter ID for new marker (e.g., st_gunner_l):");
        if (!id) return;
        if (coords[id]) {
            alert("ID already exists!");
            return;
        }
        setCoords(prev => ({
            ...prev,
            [id]: { top: 50, left: 50, width: 65, height: 65, shape: 'round' }
        }));
        setSelectedId(id);
    };

    const handleRenameMarker = () => {
        if (!selectedId) return;
        const newId = prompt("Enter new ID:", selectedId);
        if (!newId || newId === selectedId) return;
        if (coords[newId]) {
            alert("ID already exists!");
            return;
        }

        setCoords(prev => {
            const newCoords = { ...prev };
            newCoords[newId] = newCoords[selectedId];
            delete newCoords[selectedId];
            return newCoords;
        });
        setSelectedId(newId);
    };

    const handleDeleteMarker = () => {
        if (!selectedId) return;
        if (!confirm(`Delete marker '${selectedId}'?`)) return;

        setCoords(prev => {
            const newCoords = { ...prev };
            delete newCoords[selectedId];
            return newCoords;
        });
        setSelectedId(null);
    };

    const handleExport = () => {
        const exportString = JSON.stringify(coords, null, 2);
        console.log(exportString);
        navigator.clipboard.writeText(exportString).then(() => {
            alert("COPIED TO CLIPBOARD!");
        }).catch(err => {
            console.error(err);
            alert("Failed to copy. Check console (F12).");
        });
    };

    const renderOverlay = (slotId: string) => {
        const pos = coords[slotId];
        if (!pos) return null;

        const player = team.roster[slotId as keyof typeof team.roster];

        const isSquare = pos.shape === 'square';
        const borderRadius = isSquare ? '4px' : '50%';
        const isSelected = selectedId === slotId;

        return (
            <div
                key={slotId}
                onMouseDown={(e) => handleMouseDown(e, slotId)}
                style={{
                    position: 'absolute',
                    top: `${pos.top}%`,
                    left: `${pos.left}%`,
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: isEditMode ? 'move' : 'pointer',
                    zIndex: (isSelected && isEditMode) ? 100 : 20,
                    transition: isDragging && isSelected ? 'none' : 'all 0.1s',
                    pointerEvents: 'auto' // CRITICAL FIX: Ensure events capture even if parent is none
                }}
                onClick={(e) => {
                    if (isEditMode) return;
                    e.stopPropagation();
                    onSelectPlayer(slotId === 'headCoach' ? 'headCoach' : slotId, player ? 'PLAYER' : 'EMPTY');
                }}
            >
                <div style={{
                    width: `${(pos.width / 1920) * 100}%`,
                    aspectRatio: '1/1',
                    borderRadius: borderRadius,
                    background: player ? 'white' : 'transparent',
                    // Border handled by CSS class for hover/special mode mostly, but dynamic for edit/player presence
                    border: isEditMode
                        ? (isSelected ? '4px solid #ffff00' : '2px solid rgba(255,255,255,0.5)')
                        : (player ? `3px solid ${isSquare ? '#dc2626' : '#4b9b4b'}` : '3px solid transparent'),
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    overflow: 'hidden',
                    boxShadow: (player || isEditMode) ? '0 4px 10px rgba(0,0,0,0.6)' : 'none',
                }}
                    className={`bubble-hover ${mode === 'SPECIAL' && !player ? 'force-target' : ''}`}
                >
                    {player ? (
                        <img src={player.photoUrl} alt={player.lastName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%' }}></div>
                    )}
                </div>

                {(player || isEditMode) && (
                    <div style={{
                        marginTop: '0.4vh',
                        background: 'rgba(0,0,0,0.85)',
                        color: 'white',
                        padding: '0.2vh 0.6vw',
                        borderRadius: '0.4vh',
                        fontSize: 'clamp(8px, 0.8vh, 12px)',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        pointerEvents: 'none'
                    }}>
                        {player ? `${player.firstName.charAt(0)}.${player.lastName}` : slotId}
                    </div>
                )}

                {/* CROSSHAIRS */}
                {isEditMode && isSelected && (
                    <>
                        <div style={{ position: 'absolute', top: '50%', left: '-50vw', right: '-50vw', height: '1px', background: 'rgba(255, 255, 0, 0.6)', zIndex: 21, pointerEvents: 'none' }}></div>
                        <div style={{ position: 'absolute', left: '50%', top: '-50vh', bottom: '-50vh', width: '1px', background: 'rgba(255, 255, 0, 0.6)', zIndex: 21, pointerEvents: 'none' }}></div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: 'calc(100vh - 64px)', // Adjust for potential padding/header
            background: '#0a0a0a', // Dark backdrop for letterboxing
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
            overflow: 'hidden'
        }}>
            {/* FIELD CONTAINER - TARGET LOCKED */}
            <div
                ref={containerRef}
                style={{
                    position: 'relative',
                    width: 'min(100vw, 177.78vh)', // 16:9 Aspect Ratio Lock
                    height: 'min(100vh, 56.25vw)',
                    aspectRatio: '16/9',
                    backgroundImage: "url('/src/assets/madden_field.png')",
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'center',
                    boxShadow: '0 0 50px rgba(0,0,0,0.5)'
                }}
            >
                {/* TOOLBAR */}
                <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', zIndex: 50, display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {['ALL', 'SPECIAL', 'COACH'].map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m as 'ALL' | 'SPECIAL' | 'COACH')}
                            style={{
                                padding: '8px 20px',
                                background: mode === m ? '#eab308' : 'rgba(0,0,0,0.6)',
                                color: 'white',
                                border: '1px solid white', borderRadius: '20px',
                                fontWeight: 'bold', cursor: 'pointer', backdropFilter: 'blur(4px)'
                            }}
                        >
                            {m === 'ALL' ? 'OFFENSE & DEFENSE' : m}
                        </button>
                    ))}

                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        style={{
                            padding: '8px 20px',
                            background: isEditMode ? '#dc2626' : 'rgba(0,0,0,0.8)',
                            color: 'white', border: '2px solid red', borderRadius: '20px',
                            fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                    >
                        <Edit3 size={16} /> {isEditMode ? 'DONE' : 'EDIT'}
                    </button>

                    {isEditMode && (
                        <>
                            <button onClick={handleAddMarker} style={{ padding: '8px 15px', background: '#3b82f6', color: 'white', border: '1px solid white', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
                                <PlusCircle size={16} /> ADD
                            </button>

                            {selectedId && (
                                <>
                                    <button onClick={handleRenameMarker} style={{ padding: '8px 15px', background: '#f59e0b', color: 'white', border: '1px solid white', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        RENAME
                                    </button>
                                    <button onClick={handleDeleteMarker} style={{ padding: '8px 15px', background: '#ef4444', color: 'white', border: '1px solid white', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        DELETE
                                    </button>
                                </>
                            )}

                            <button onClick={handleExport} style={{ padding: '8px 15px', background: '#16a34a', color: 'white', border: '1px solid white', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
                                <Save size={16} /> SAVE
                            </button>
                        </>
                    )}
                </div>

                {mode === 'ALL' && (
                    <>
                        {OFFENSE_KEYS.map(k => renderOverlay(k))}
                        {DEFENSE_KEYS.map(k => renderOverlay(k))}
                    </>
                )}

                {mode === 'SPECIAL' && (
                    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'rgba(0,0,0,0.7)', pointerEvents: isEditMode ? 'none' : 'auto' }}>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', fontSize: '3rem', fontWeight: 'bold' }}>SPECIAL TEAMS</div>
                        {/* Special teams also draggable if we wanted, but let's stick to adding them loosely */}
                        {Object.keys(coords).filter(k => !OFFENSE_KEYS.includes(k) && !DEFENSE_KEYS.includes(k)).map(k => renderOverlay(k))}
                    </div>
                )}



            </div>

            {/* Bench Overlay - Viewport Fixed */}
            <div style={{
                position: 'fixed', bottom: '0', left: '0', right: '0',
                background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', padding: '20px 10px 10px 10px',
                display: 'flex', alignItems: 'center', gap: '15px', overflowX: 'auto',
                zIndex: 30
            }}>
                <div style={{ color: '#ec4899', fontWeight: 'bold', fontSize: '0.9rem', padding: '0 10px', borderRight: '1px solid #555' }}>BENCH</div>
                {team.bench.map(p => (
                    <div key={p.id} onClick={() => onSelectPlayer(p.id, 'PLAYER')} style={{ minWidth: '60px', cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ position: 'relative', width: '45px', height: '45px', margin: '0 auto' }}>
                            <img src={p.photoUrl} style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid #ccc' }} />
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#ddd', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.lastName}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
