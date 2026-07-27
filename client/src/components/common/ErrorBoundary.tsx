import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches unhandled React render errors and shows a
 * user-friendly fallback instead of a blank/crashed screen.
 * Must be a class component: React only exposes componentDidCatch on classes.
 */
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console; swap for a real error-reporting service in production
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="glass-card max-w-md w-full p-8 text-center space-y-6 border-red-500/20">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            {/* Heading */}
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-slate-100">Something went wrong</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                An unexpected error occurred. Your data is safe — try reloading the page.
              </p>
            </div>

            {/* Error detail (non-sensitive) */}
            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/40 text-left">
                <p className="text-xs text-slate-500 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Reload button */}
            <button
              id="error-boundary-reload"
              onClick={this.handleReload}
              className="btn-primary w-full justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
