/**
 * ErrorBoundary — React Class-based Crash Shield
 * ================================================
 * Wraps the entire application tree to catch unhandled render-phase errors.
 * When a child component throws, React unwinds to this boundary and renders
 * a full-screen error panel instead of a blank white screen.
 *
 * Class component is required — hooks cannot implement componentDidCatch.
 * The component stack in the error panel is capped to 3 lines to stay readable.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    /** Synchronously updates state so the next render shows the fallback UI. */
    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    /** Logs the full error + component stack for debugging in the console. */
    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    width: '100vw',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#111827',
                    color: '#f3f4f6',
                    fontFamily: 'system-ui, sans-serif'
                }}>
                    <div style={{
                        maxWidth: '600px',
                        padding: '2rem',
                        backgroundColor: '#1f2937',
                        borderRadius: '1rem',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid #dc2626'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', color: '#ef4444' }}>
                            <AlertTriangle size={48} style={{ marginRight: '1rem' }} />
                            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>Application Crashed</h1>
                        </div>

                        <p style={{ marginBottom: '1.5rem', color: '#d1d5db' }}>
                            Something went wrong. The application has encountered a critical error and cannot continue.
                        </p>

                        <div style={{
                            backgroundColor: '#000',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            overflowX: 'auto',
                            marginBottom: '1.5rem',
                            border: '1px solid #374151',
                            fontSize: '0.875rem',
                            fontFamily: 'monospace'
                        }}>
                            <div style={{ color: '#ef4444', marginBottom: '0.5rem' }}>{this.state.error?.toString()}</div>
                            <div style={{ color: '#6b7280' }}>
                                {this.state.errorInfo?.componentStack?.split('\n').slice(0, 3).map((line, i) => (
                                    <div key={i}>{line.trim()}</div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 600,
                                transition: 'background-color 0.2s'
                            }}
                        >
                            <RefreshCcw size={20} style={{ marginRight: '0.5rem' }} />
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
