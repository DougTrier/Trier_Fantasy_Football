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
 * main.tsx — Application Entry Point
 * =====================================
 * Mounts the React application into the #root DOM element.
 * Wraps the app in StrictMode (double-renders in dev to surface side effects)
 * and ErrorBoundary (catches render-time crashes and shows a recovery UI).
 *
 * Tauri injects its IPC bridge before this runs — isTauri() in tauriEnv.ts
 * will return true if the app is running as a desktop build.
 */
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DialogProvider } from "./components/AppDialog";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <DialogProvider>
        <App />
      </DialogProvider>
    </ErrorBoundary>
  </StrictMode>,
);
