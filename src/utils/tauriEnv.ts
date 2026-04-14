
export function isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_IPC__' in window;
}

export async function safeInvoke<T>(command: string, args?: any): Promise<T | null> {
    if (!isTauri()) {
        console.warn(`[Tauri] Skipping invoke('${command}') - Not running in Tauri`);
        return null;
    }
    // Dynamic import to avoid bundling issues if possible, though safe via polyfills now
    // But better to use the module we likely already imported or Import it top level?
    // Let's assume top level import is fine if we don't call it. 
    // Actually, if we import from @tauri-apps/api, it might try to access window.__TAURI_IPC__ at module level?
    // Usually it doesn't until called.

    // We'll use the one passed from arguments or import dynamically?
    // For simplicity, let's assume the calling service handles the import or we import here.
    const { invoke } = await import('@tauri-apps/api/tauri');
    return invoke(command, args);
}
