import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

const SENTRY_DSN =
  import.meta.env.VITE_SENTRY_DSN ||
  'https://0f8c184b3ee9247c1dbeab3ae7d140d1@o4511913935241216.ingest.de.sentry.io/4511913949593680';

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  // Performance Tracing
  tracesSampleRate: 1.0,
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE || 'production',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error }) => (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#ba1a1a' }}>Ocorreu um erro inesperado</h2>
          <p style={{ color: '#555' }}>
            O erro foi registado e enviado para monitorização. Por favor recarregue a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#003366',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Recarregar Página
          </button>
        </div>
      )}
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
