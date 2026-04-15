/**
 * Trier Fantasy Football
 * © 2026 Doug Trier
 *
 * Licensed under the MIT License.
 * See LICENSE file for details.
 *
 * "Trier OS" and "Trier Fantasy Football" are trademarks of Doug Trier.
 */

/**
 * tauriEnv — Runtime Environment Guards
 * =======================================
 * Detects whether the app is running inside a Tauri desktop shell or a plain browser.
 *
 * WHY THIS EXISTS:
 *   The app runs in two modes — browser (dev/testing) and Tauri (production desktop).
 *   Tauri-specific APIs (invoke, file system, mDNS, NTP) crash the browser build if called
 *   without this guard. All Tauri-only code paths must check isTauri() first.
 *
 *   safeInvoke() wraps invoke() for convenience — it no-ops in browser mode
 *   and logs a warning so developers can see what would have been called.
 *
 * @module tauriEnv
 */

/**
 * Returns true if the app is running inside the Tauri desktop shell.
 * Uses the presence of `__TAURI_IPC__` on window — injected by Tauri at startup.
 */
export function isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_IPC__' in window;
}

/**
 * Safe wrapper around Tauri's invoke(). No-ops silently in browser mode.
 * @param command - The Rust command name registered in src-tauri/src/main.rs
 * @param args - Optional arguments passed to the Rust handler
 * @returns The Rust return value, or null if not running in Tauri
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeInvoke<T>(command: string, args?: any): Promise<T | null> {
    if (!isTauri()) {
        console.warn(`[Tauri] Skipping invoke('${command}') - Not running in Tauri`);
        return null;
    }
    const { invoke } = await import('@tauri-apps/api/tauri');
    return invoke(command, args);
}
