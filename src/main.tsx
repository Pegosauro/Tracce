import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import './dock.css';
import './sheetPolish.css';
import './sheetGestures.css';
import './recovery.css';
import './dockBehavior';
import './sheetGestures';
import { App } from './App';

const clearLegacyRuntime = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter((name) => name.startsWith('tracce-')).map((name) => caches.delete(name)));
    }
  } catch {
    // Cache recovery must never prevent the application from starting.
  }
};

const recoveryVersion = 'runtime-recovery-v1';
if (window.localStorage.getItem('tracce-runtime-recovery') !== recoveryVersion) {
  window.localStorage.setItem('tracce-runtime-recovery', recoveryVersion);
  void clearLegacyRuntime();
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Errore non gestito in Tracce:', error);
  }

  private resetApplication = async () => {
    await clearLegacyRuntime();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error" role="alert">
          <h1>Tracce non è riuscita ad avviarsi</h1>
          <p>La versione pubblicata potrebbe essere incompleta oppure la cache del browser non è aggiornata.</p>
          <button type="button" onClick={this.resetApplication}>Ripristina e ricarica</button>
        </main>
      );
    }

    return this.props.children;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Elemento root non disponibile.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
