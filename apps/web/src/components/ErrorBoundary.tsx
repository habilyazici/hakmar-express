import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Without this, any render-time exception unmounts the whole React tree and
 * leaves the user staring at a blank white page with no indication that
 * anything went wrong.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="centered-page">
        <div className="panel stack" role="alert">
          <h1 className="page-title">Bir şeyler ters gitti</h1>
          <p className="muted">
            Beklenmeyen bir hata oluştu. Sayfayı yenilemeyi deneyin.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Sayfayı yenile
          </button>
        </div>
      </main>
    );
  }
}
