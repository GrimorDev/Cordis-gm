import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dismiss Tauri splashscreen as soon as React is scheduled.
// We call this SYNCHRONOUSLY after root.render() (not in a useEffect) because
// Chromium/WebView2 throttles paint/effect callbacks in invisible windows —
// useEffect would never fire. The white-flash risk is eliminated by the
// "backgroundColor": "#09090b" set on the window in tauri.conf.json.
// Tauri v2 uses __TAURI_INTERNALS__ (NOT __TAURI__ from v1).
if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
  import('@tauri-apps/api/core').then(({ invoke }) => {
    invoke('close_splashscreen').catch(() => {});
  });
}
