
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Handle unhandled rejections like "Database is closing/hidden" gracefully
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || event.reason || '';
  if (
    typeof reason === 'string' && (
      reason.includes('Database is closing') ||
      reason.includes('closing/hidden') ||
      reason.includes('IndexedDB') ||
      reason.includes('Firestore')
    )
  ) {
    event.preventDefault();
    console.warn('Prevented unhandled database closing/hidden error:', reason);
  }
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (
    typeof msg === 'string' && (
      msg.includes('Database is closing') ||
      msg.includes('closing/hidden') ||
      msg.includes('IndexedDB')
    )
  ) {
    event.preventDefault();
    console.warn('Prevented runtime database closing error:', msg);
  }
});

// Prevent browser from navigating away and reloading the app when image files are dropped anywhere on window
window.addEventListener('dragover', (e) => {
  e.preventDefault();
}, false);

window.addEventListener('drop', (e) => {
  e.preventDefault();
}, false);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

