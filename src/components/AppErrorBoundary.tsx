import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ClassTools PDF render error', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const vi = localStorage.getItem('classtools-locale') !== 'en';
    return (
      <main className="app-error-page">
        <span>ClassTools PDF</span>
        <h1>{vi ? 'Ứng dụng vừa gặp sự cố.' : 'The app hit a problem.'}</h1>
        <p>{vi ? 'Tệp PDF của bạn vẫn an toàn trên thiết bị. Hãy tải lại trang để tiếp tục.' : 'Your PDF files remain safe on this device. Reload the page to continue.'}</p>
        <button className="ct-button ct-button--primary" type="button" onClick={() => window.location.reload()}>{vi ? 'Tải lại trang' : 'Reload page'}</button>
      </main>
    );
  }
}
