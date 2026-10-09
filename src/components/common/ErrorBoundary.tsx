import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('KoHot Uncaught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    if (window.location.hash) {
      window.location.hash = '';
    }
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected error occurred';
      const errorName = this.state.error?.name || 'Application Error';
      const errorStack = this.state.error?.stack || this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen bg-[#060709] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-lg w-full bg-[#0e1017] border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <div className="w-5 h-5 bg-red-500 rotate-45 transform" />
            </div>

            <div className="space-y-2 text-center">
              <h2 className="font-syne font-bold text-2xl text-white">Application Error</h2>
              <p className="text-zinc-400 text-xs font-mono-tech">
                An error occurred while running the application:
              </p>
            </div>

            {/* Error Message Box */}
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-left font-mono-tech text-xs space-y-2 text-red-200">
              <div className="font-bold text-red-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span>{errorName}</span>
              </div>
              <p className="font-medium text-white break-words leading-relaxed select-all">
                {errorMessage}
              </p>
            </div>

            {/* Expandable Technical Stack Trace */}
            {errorStack && (
              <details className="text-left font-mono-tech text-[11px] bg-black/60 p-3 rounded-xl border border-white/10 text-zinc-400 cursor-pointer">
                <summary className="text-zinc-300 font-semibold hover:text-white select-none">
                  View Technical Stack Trace
                </summary>
                <pre className="mt-2.5 max-h-48 overflow-auto text-[10px] text-zinc-400 whitespace-pre-wrap select-all leading-normal">
                  {errorStack}
                </pre>
              </details>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 py-3 px-6 rounded-full bg-white hover:bg-zinc-200 text-black font-syne font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95"
              >
                Reload Application
              </button>

              <button
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(`${errorName}: ${errorMessage}\n\n${errorStack}`);
                  } catch {
                    // ignore
                  }
                }}
                className="py-3 px-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono-tech text-xs font-semibold border border-white/15 transition-all cursor-pointer"
                title="Copy error details"
              >
                Copy Error
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
