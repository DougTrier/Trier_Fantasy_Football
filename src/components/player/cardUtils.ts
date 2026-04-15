import React from 'react';
import { Twitter, Facebook, Instagram, Ghost, Youtube, Video, Music2 } from 'lucide-react';
import { ScoringEngine } from '../../utils/ScoringEngine';

export const CURRENT_SEASON = ScoringEngine.getOrchestrationStatus().season;

export const exportItemStyle: React.CSSProperties = {
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

export const getSocialLink = (platform: string, handle: string) => {
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

export const getTopSocials = (socials: any) => {
    if (!socials) return [];
    const priority = ['twitter', 'facebook', 'instagram', 'snapchat', 'youtube', 'rumble', 'tiktok'];
    const active = priority
        .filter(p => socials[p])
        .map(p => getSocialLink(p, socials[p]))
        .filter(Boolean);
    return active.slice(0, 2);
};

export const formatHeight = (inchesStr: string | undefined) => {
    if (!inchesStr) return "N/A";
    if (inchesStr.includes("'")) return inchesStr;
    const totalInches = parseInt(inchesStr);
    if (isNaN(totalInches)) return inchesStr;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}' ${inches}"`;
};
