import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let displayMessage = 'Something went wrong.';
      try {
        const parsed = JSON.parse(this.state.error?.message || '');
        if (parsed.error && parsed.error.includes('insufficient permissions')) {
          displayMessage = 'Access Denied: You do not have permission to perform this action.';
        }
      } catch {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-[#020408] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#060d16] border border-[#00c8ff]/20 p-8 rounded-lg shadow-2xl">
            <h2 className="text-[#ff3355] font-orbitron text-xl mb-4 tracking-widest uppercase">System Error</h2>
            <p className="text-[#c8e8ff]/70 mb-6 font-rajdhani">{displayMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 border border-[#00c8ff] text-[#00c8ff] font-orbitron text-xs tracking-widest hover:bg-[#00c8ff] hover:text-[#020408] transition-all"
            >
              REBOOT SYSTEM
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
