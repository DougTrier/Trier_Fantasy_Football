/**
 * CreatePlayerForm — Manual / Smart-Import Custom Player Creator
 * ===============================================================
 * Allows managers to create custom players not in the official database.
 * Two creation paths:
 *
 *   Manual: fill in fields directly (name, team, position, projected points,
 *           optional photo URL).
 *
 *   Smart Import: paste an nfl.com player profile URL to auto-populate
 *                 name fields from the URL slug and attempt to scrape the
 *                 player photo via the allorigins CORS proxy.
 *                 Falls back silently if scraping fails — the user can still
 *                 enter the photo URL manually.
 *
 * Generated player IDs use the "custom-{timestamp}" convention to avoid
 * collisions with official pipeline IDs which are numeric strings.
 */
import React, { useState } from 'react';
import type { Player, Position } from '../types';
import { UserPlus, X } from 'lucide-react';
import { NFL_TEAMS, POSITIONS } from '../utils/constants';


interface CreatePlayerFormProps {
    onClose: () => void;
    onCreate: (player: Player) => void;
    initialPosition?: string; // Pre-selects position based on the target slot
}


export const CreatePlayerForm: React.FC<CreatePlayerFormProps> = ({ onClose, onCreate, initialPosition }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [team, setTeam] = useState(NFL_TEAMS[0]);
    const [position, setPosition] = useState<Position>((initialPosition as Position) || 'QB');
    const [projPoints, setProjPoints] = useState('0');
    const [photoUrl, setPhotoUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newPlayer: Player = {
            id: `custom-${Date.now()}`,
            firstName: firstName || 'New',
            lastName: lastName || 'Player',
            position,
            team,
            projectedPoints: parseFloat(projPoints) || 0,
            photoUrl: photoUrl || undefined
        };

        onCreate(newPlayer);
    };

    const handleSmartImport = async (url: string) => {
        if (!url.includes('nfl.com/players/')) return;
        setIsLoading(true);

        try {
            // NO CHANGE HERE - Focusing logic in App.tsx as requested "Once player is added"
            const parts = url.split('/players/');
            if (parts[1]) {
                const slug = parts[1].split('/')[0];
                const nameParts = slug.split('-');
                if (nameParts.length >= 2) {
                    const fName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
                    const lName = nameParts.slice(1).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
                    setFirstName(fName);
                    setLastName(lName);
                }
            }

            // 2. Photo — attempt ESPN CDN directly using the slug we just parsed.
            // ESPN headshots follow a predictable URL pattern; no third-party proxy needed.
            // The user can always paste a custom URL if the CDN attempt returns a broken image.
            const slugForEspn = parts[1]?.split('/')[0] || '';
            if (slugForEspn) {
                // ESPN headshot URL requires the numeric player ID, which we don't have from the
                // NFL.com URL slug alone. Leave blank so the user can paste their own photo URL.
                // Future: use Tauri HTTP (@tauri-apps/api/http) to fetch NFL.com og:image directly,
                // bypassing CORS without a third-party proxy.
                setPhotoUrl('');
            }
        } catch (err) {
            console.error("Smart import failed", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            background: '#1f2937', padding: '20px', borderRadius: '8px',
            border: '2px solid #4b5563', color: 'white', maxWidth: '400px', width: '100%',
            position: 'relative', maxHeight: '90vh', overflowY: 'auto'
        }}>
            <button onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                <X size={20} />
            </button>

            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#eab308' }}>
                <UserPlus size={20} /> Create Custom Player
            </h3>

            {/* SMART IMPORT SECTION */}
            <div style={{ background: '#111827', padding: '10px', borderRadius: '6px', marginBottom: '15px', border: '1px dashed #4b5563' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#60a5fa', marginBottom: '4px', fontWeight: 'bold' }}>
                    ⚡ SMART IMPORT (Paste NFL.com Link)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="https://www.nfl.com/players/patrick-mahomes/"
                        onPaste={(e) => {
                            const text = e.clipboardData.getData('text');
                            handleSmartImport(text);
                        }}
                        style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #374151', background: '#374151', color: 'white', fontSize: '0.8rem' }}
                    />
                    <a
                        href="https://www.nfl.com/players/active/all"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: '6px 10px', background: '#2563eb', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}
                    >
                        Browse
                    </a>
                </div>
                {isLoading && <div style={{ fontSize: '0.7rem', color: '#fbbf24', marginTop: '4px' }}>Fetching details...</div>}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* PHOTO PREVIEW */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#374151', overflow: 'hidden', border: '2px solid #9ca3af', flexShrink: 0 }}>
                        {photoUrl ? (
                            <img src={photoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '0.7rem' }}>No Pic</div>
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '4px' }}>Photo URL</label>
                        <input
                            type="text"
                            value={photoUrl}
                            onChange={e => setPhotoUrl(e.target.value)}
                            placeholder="https://example.com/image.png"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #374151', background: '#111827', color: 'white', fontSize: '0.8rem' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '4px' }}>First Name</label>
                        <input
                            required
                            type="text"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            placeholder="e.g. Bo"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #374151', background: '#111827', color: 'white' }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '4px' }}>Last Name</label>
                        <input
                            required
                            type="text"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            placeholder="e.g. Nix"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #374151', background: '#111827', color: 'white' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '4px' }}>Team</label>
                        <select
                            value={team}
                            onChange={e => setTeam(e.target.value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #374151', background: '#111827', color: 'white' }}
                        >
                            {NFL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '4px' }}>Position</label>
                        <select
                            value={position}
                            onChange={e => setPosition(e.target.value as Position)}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #374151', background: '#111827', color: 'white' }}
                        >
                            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '4px' }}>Projected Points</label>
                    <input
                        type="number"
                        value={projPoints}
                        onChange={e => setProjPoints(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #374151', background: '#111827', color: 'white' }}
                    />
                </div>

                <button
                    type="submit"
                    className="btn"
                    style={{ background: '#16a34a', color: 'white', marginTop: '10px', justifyContent: 'center' }}
                >
                    Create & Draft
                </button>
            </form>
        </div>
    );
};
