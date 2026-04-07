import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

/**
 * Error Boundary para capturar erros de renderização
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary capturou erro:', error);
    console.error('ErrorInfo:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: '#1a1a1a', minHeight: '100vh' }}>
          <h1>Erro na Aplicação</h1>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Entry Point da Aplicação React
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento root não encontrado no DOM');
}

// Log inicial
console.log('[Main] Iniciando aplicação React...');

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
  console.log('[Main] Aplicação React renderizada com sucesso');
} catch (error) {
  console.error('[Main] Erro ao renderizar aplicação:', error);
}
