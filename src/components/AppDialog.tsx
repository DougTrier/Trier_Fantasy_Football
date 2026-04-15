/**
 * AppDialog — Themed Modal System
 * ================================
 * Replaces all native browser prompt / alert / confirm dialogs with
 * styled modals that match the Trier Fantasy Football dark theme.
 *
 * Usage:
 *   const { showAlert, showConfirm, showPrompt } = useDialog();
 *
 *   await showAlert('Roster locked!', 'Game Day');
 *   const ok = await showConfirm('Delete team?', 'Confirm');
 *   const pass = await showPrompt('Enter password:', 'Secure');
 */
import React, { createContext, useContext, useRef, useState } from 'react';
import leatherTexture from '../assets/leather_texture.png';

// ─── Types ───────────────────────────────────────────────────────────────────

type DialogMode = 'alert' | 'confirm' | 'prompt';

interface DialogState {
    mode: DialogMode;
    title: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    resolve: (value: unknown) => void;
}

interface DialogAPI {
    showAlert: (message: string, title?: string) => Promise<void>;
    showConfirm: (message: string, title?: string, confirmLabel?: string) => Promise<boolean>;
    showPrompt: (message: string, title?: string, opts?: { placeholder?: string; defaultValue?: string }) => Promise<string | null>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogAPI>(null!);

// eslint-disable-next-line react-refresh/only-export-components
export const useDialog = (): DialogAPI => useContext(DialogContext);

// ─── Provider ────────────────────────────────────────────────────────────────

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<DialogState | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');

    /**
     * Generic dialog opener — stores resolve on state so any button can
     * complete the promise. Returns a typed promise to callers.
     */
    const open = <T,>(partial: Omit<DialogState, 'resolve'>): Promise<T> =>
        new Promise<T>(resolve => {
            setInputValue((partial as Partial<Pick<DialogState, 'defaultValue'>>).defaultValue ?? '');
            setState({ ...partial, resolve } as DialogState);
            // Focus input on next tick to ensure the DOM node exists before calling focus()
            if (partial.mode === 'prompt') {
                setTimeout(() => inputRef.current?.focus(), 50);
            }
        });

    const api: DialogAPI = {
        showAlert: (message, title = 'Notice') =>
            open({ mode: 'alert', title, message }),
        showConfirm: (message, title = 'Confirm', confirmLabel = 'CONFIRM') =>
            open({ mode: 'confirm', title, message, confirmLabel }),
        showPrompt: (message, title = 'Input', opts) =>
            open({ mode: 'prompt', title, message, placeholder: opts?.placeholder, defaultValue: opts?.defaultValue }),
    };

    /** Resolves the promise with the appropriate affirmative value for each mode. */
    const handleConfirm = () => {
        if (!state) return;
        if (state.mode === 'prompt') state.resolve(inputValue);
        else if (state.mode === 'confirm') state.resolve(true);
        else state.resolve(undefined);
        setState(null);
    };

    /** Resolves the promise with a "cancelled/no" value and closes the dialog. */
    const handleCancel = () => {
        if (!state) return;
        if (state.mode === 'confirm') state.resolve(false);
        else if (state.mode === 'prompt') state.resolve(null);
        else state.resolve(undefined);
        setState(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') handleCancel();
    };

    return (
        <DialogContext.Provider value={api}>
            {children}
            {state && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px',
                    }}
                    onKeyDown={handleKeyDown}
                >
                    <div style={{
                        background: 'linear-gradient(135deg, #0a0f1e 0%, #111827 100%)',
                        border: '1px solid rgba(234,179,8,0.4)',
                        borderRadius: '20px',
                        padding: '32px',
                        maxWidth: '420px',
                        width: '100%',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(234,179,8,0.1)',
                        animation: 'dialogIn 0.15s ease-out',
                    }}>
                        {/* Title */}
                        <div style={{ marginBottom: '16px' }}>
                            <h2 style={{
                                margin: 0, fontSize: '1.1rem', fontWeight: 900,
                                textTransform: 'uppercase', letterSpacing: '2px',
                                color: 'transparent',
                                backgroundImage: `url(${leatherTexture})`,
                                backgroundSize: '150px',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                WebkitTextStroke: '0.5px rgba(255,255,255,0.9)',
                                fontFamily: "'Graduate', 'Impact', sans-serif",
                            }}>
                                {state.title}
                            </h2>
                            <div style={{ height: '1px', background: 'linear-gradient(to right, rgba(234,179,8,0.4), transparent)', marginTop: '10px' }} />
                        </div>

                        {/* Message */}
                        <p style={{
                            margin: '0 0 20px', color: '#d1d5db', fontSize: '0.95rem',
                            lineHeight: 1.7, fontWeight: 500,
                        }}>
                            {state.message}
                        </p>

                        {/* Input (prompt mode) */}
                        {state.mode === 'prompt' && (
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                placeholder={state.placeholder ?? ''}
                                autoFocus
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(234,179,8,0.35)',
                                    borderRadius: '10px', padding: '11px 14px',
                                    color: '#fff', fontSize: '0.95rem', outline: 'none',
                                    marginBottom: '20px',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.currentTarget.style.borderColor = 'rgba(234,179,8,0.7)'}
                                onBlur={e => e.currentTarget.style.borderColor = 'rgba(234,179,8,0.35)'}
                            />
                        )}

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            {state.mode !== 'alert' && (
                                <button
                                    onClick={handleCancel}
                                    style={{
                                        padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                                        background: 'rgba(255,255,255,0.06)', color: '#9ca3af',
                                        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                        transition: 'all 0.15s', letterSpacing: '0.5px',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#9ca3af'; }}
                                >
                                    {state.cancelLabel ?? 'CANCEL'}
                                </button>
                            )}
                            <button
                                onClick={handleConfirm}
                                style={{
                                    padding: '10px 24px', borderRadius: '10px', border: 'none',
                                    background: state.mode === 'alert'
                                        ? 'linear-gradient(135deg, #eab308, #ca8a04)'
                                        : 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#000',
                                    fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer',
                                    transition: 'all 0.15s', letterSpacing: '0.5px',
                                    boxShadow: state.mode === 'alert' ? '0 4px 15px rgba(234,179,8,0.3)' : '0 4px 15px rgba(16,185,129,0.3)',
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                {state.mode === 'alert' ? 'OK' : (state.confirmLabel ?? 'CONFIRM')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
};
