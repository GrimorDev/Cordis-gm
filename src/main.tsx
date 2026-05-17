import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import StatusPage from './StatusPage.tsx';
import './index.css';

const DeveloperPortal = lazy(() => import('./DeveloperPortal.tsx'));
const OAuthConsent = lazy(() => import('./oauth2/OAuthConsent.tsx'));
const AppsMarketplace = lazy(() => import('./AppsMarketplace.tsx'));

const path = window.location.pathname;

let Component: React.ComponentType;
if (path === '/stats') {
  Component = StatusPage;
} else if (path.startsWith('/developer')) {
  Component = DeveloperPortal as any;
} else if (path.startsWith('/oauth2/authorize')) {
  Component = OAuthConsent as any;
} else if (path.startsWith('/apps')) {
  Component = AppsMarketplace as any;
} else {
  Component = App;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div style={{background:'#09090b',height:'100vh'}}/>}>
      <Component />
    </Suspense>
  </StrictMode>,
);
