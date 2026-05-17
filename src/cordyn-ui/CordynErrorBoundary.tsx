import React from 'react';

interface State { error: Error | null }

export class CordynErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(e: Error): State {
    return { error: e };
  }

  componentDidCatch(e: Error, info: React.ErrorInfo) {
    console.error('[CordynShell crash]', e.message, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#0f0f18',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#f5f5f7', fontFamily: 'monospace', gap: 12, padding: 32,
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#ef4d63' }}>
            CordynShell — błąd renderowania
          </div>
          <div style={{ fontSize: 13, color: 'rgba(245,245,247,0.6)', maxWidth: 540, textAlign: 'center' }}>
            {error.message}
          </div>
          <button
            style={{ marginTop: 8, padding: '8px 20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f5f5f7', cursor: 'pointer' }}
            onClick={() => this.setState({ error: null })}
          >
            Odśwież
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
