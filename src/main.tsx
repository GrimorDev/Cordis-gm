import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import StatusPage from './StatusPage.tsx';
import './index.css';

// ── Ctrl+Shift+M → open DevTools (Windows + Linux) ───────────────────────────
if ('__TAURI_INTERNALS__' in window) {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
      e.preventDefault();
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('open_devtools').catch(() => {});
      });
    }
  });
}

// ── Linux / Tauri: conditional RTCPeerConnection polyfill ────────────────────
// lib.rs applies `settings.set_property("enable-webrtc", true)` then calls
// `webview.reload()` at startup.  After that reload, WebKitGTK exposes a native
// RTCPeerConnection that supports BOTH audio AND video (camera + screen share).
//
// We only fall back to the Rust/cpal polyfill when WebKitGTK's WebRTC is absent
// (first page load before the settings reload, or very old WebKit builds).  The
// polyfill sets window.__nativeRtcPolyfill = true so App.tsx can conditionally
// disable video/screen-share buttons in that audio-only path.
{
  const isTauri = '__TAURI_INTERNALS__' in window;
  const isLinux = navigator.userAgent.toLowerCase().includes('linux');
  if (isTauri && isLinux) {
    if (typeof RTCPeerConnection !== 'function') {
      // WebKitGTK WebRTC not yet active — inject Rust/cpal polyfill (audio only).
      // This branch fires only on the very first load before lib.rs applies the
      // enable-webrtc setting and triggers a page reload.  After that reload the
      // else branch fires and the native WebKit stack handles everything.
      import('./rtc/native_linux').then(({ injectNativeRtcPolyfill }) => {
        injectNativeRtcPolyfill();
      }).catch((e) => console.error('[Cordyn] native RTC polyfill load failed:', e));
    } else {
      // WebKitGTK RTCPeerConnection is available — camera and screen share work
      // natively through WebKit's full WebRTC stack.  No polyfill needed.
      console.info('[Cordyn] WebKitGTK RTCPeerConnection active — camera + screen share enabled');
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
