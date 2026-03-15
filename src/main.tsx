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

// When running as a Tauri desktop app, dismiss the splashscreen
// once React has finished its first render.
if (typeof window !== 'undefined' && '__TAURI__' in window) {
  import('@tauri-apps/api/core').then(({ invoke }) => {
    invoke('close_splashscreen').catch(() => {});
  });
}
