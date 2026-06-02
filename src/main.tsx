import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import StatusPage from './StatusPage.tsx';
import './index.css';

// ── Linux / Tauri: inject native RTCPeerConnection polyfill ──────────────────
// On Linux, WebKitGTK may not expose RTCPeerConnection (disabled by default,
// property doesn't exist on WebKit < 2.38, or compiled without WebRTC).
// Instead of fighting WebKit settings, we inject a polyfill backed by
// webrtc-rs (Rust) + cpal (audio I/O).  The existing engine.ts works unchanged.
{
  const isTauri = '__TAURI_INTERNALS__' in window;
  const isLinux = navigator.userAgent.toLowerCase().includes('linux');
  if (isTauri && isLinux && typeof RTCPeerConnection !== 'function') {
    // Async import so main bundle isn't polluted on Windows/macOS
    import('./rtc/native_linux').then(({ injectNativeRtcPolyfill }) => {
      injectNativeRtcPolyfill();
    }).catch((e) => console.error('[Cordyn] native RTC polyfill load failed:', e));
  }
}

const DeveloperPortal = lazy(() => import('./DeveloperPortal.tsx'));
const OAuthConsent    = lazy(() => import('./oauth2/OAuthConsent.tsx'));
const AppsMarketplace = lazy(() => import('./AppsMarketplace.tsx'));
const BlogPage        = lazy(() => import('./BlogPage.tsx'));
const SupportPage     = lazy(() => import('./SupportPage.tsx'));

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
} else if (path.startsWith('/blog')) {
  Component = BlogPage as any;
} else if (path.startsWith('/support')) {
  Component = SupportPage as any;
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
