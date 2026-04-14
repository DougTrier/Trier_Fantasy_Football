# Trier Fantasy League (P2P)

## PC-A Master → PC-B Mirror via R:\DESKTOP-ERMHEB7

This project uses a one-way mirror sync to keep PC-B (Target) identical to PC-A (Source).
**Drive Mapping Requirement:** Ensure `R:` is mapped to `\\DESKTOP-ERMHEB7\<Share>` on PC-A.

### 🚀 Sync Commands

| Command | Description |
| :--- | :--- |
| `npm run sync:pcb` | **One-Shot Sync:** Mirrors `src`, `src-tauri`, `scripts` to PC-B. Deletes extra files on Target. Excludes build artifacts. |
| `npm run sync:watch` | **Watch Mode:** Monitors file changes and auto-syncs to PC-B with a 2-second debounce. |
| `npm run sync:verify` | **Verification:** Compares file hashes of key files (package.json, source code) to ensure environments are identical. |

### ⚠️ Exclusions
The following are **NOT** synced (local-only):
- `node_modules\`
- `src-tauri\target\`
- `dist\`
- `.git\`
- `output\`
- `*.log`

### Troubleshooting
- **Target Not Found:** Ensure PC-B is turned on and `R:` drive is accessible (try opening it in Explorer).
- **File Locked:** If sync fails on a locked file, wait a moment and retry (Script retries 2 times automatically).
- **Safety Check Failed:** The script will abort if the target folder exists but doesn't look like a TrierFantasy repo (prevents overwriting wrong drive).

---
