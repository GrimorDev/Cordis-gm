import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import StatusPage from './StatusPage.tsx';
import './index.css';

const isStatusPage = window.location.pathname === '/stats';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStatusPage ? <StatusPage /> : <App />}
  </StrictMode>,
);
