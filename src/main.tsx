import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

/**
 * Entry Point da Aplicação React
 * 
 * Renderiza o componente App no elemento root.
 * Utiliza StrictMode para deteção de problemas em desenvolvimento.
 */

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento root não encontrado no DOM');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
