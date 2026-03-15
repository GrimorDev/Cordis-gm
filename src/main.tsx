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

// Splashscreen dismissal is handled inside App.tsx via useEffect so it fires
// after the first React paint — NOT here, to avoid closing splash before
// the main window content is visible.
