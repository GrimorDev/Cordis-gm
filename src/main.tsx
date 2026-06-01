import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import StatusPage from './StatusPage.tsx';
import './index.css';

// ── Linux / Tauri: ensure WebRTC is available before the app mounts ──────────
// On Linux, Tauri's with_webview runs as a GLib idle callback (priority 200)
// AFTER the page first loads (WebKit page-load events at priority 100).
// The JS context is therefore created without enable-webrtc=true, so
// RTCPeerConnection is undefined.  We detect this here (before React renders)
// and schedule a single reload to let the idle callback apply the setting first.
//
// Flow:
//   1st load : RTCPeerConnection missing → set sessionStorage flag → reload after 1.5 s
//              (the 1.5 s gives the Rust with_webview idle callback time to fire and
//               apply enable-webrtc=true + call webview.reload() itself; one of the two
//               triggers the 2nd load)
//   2nd load : RTCPeerConnection available → clear flag → app runs normally
//              RTCPeerConnection still missing → flag already set → no more reloads
//              (WebKit < 2.38: enable-webrtc property doesn't exist, nothing we can do)
{
  const isTauri = '__TAURI_INTERNALS__' in window;
  const isLinux = navigator.userAgent.toLowerCase().includes('linux');
  if (isTauri && isLinux) {
    if (typeof RTCPeerConnection !== 'function') {
      if (!sessionStorage.getItem('_cordyn_rtc_reload')) {
        sessionStorage.setItem('_cordyn_rtc_reload', '1');
        // Delay so the Rust idle callback can fire before we reload.
        setTimeout(() => { location.reload(); }, 1500);
      }
      // Flag already set = we already tried once — don't loop.
    } else {
      // WebRTC is available — clear the flag so next cold start retries if needed.
      sessionStorage.removeItem('_cordyn_rtc_reload');
    }
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
