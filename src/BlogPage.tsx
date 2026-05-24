import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, easeOut } from 'motion/react';

// Spline lazy-loaded — doesn't block render
const Spline = lazy(() => import('@splinetool/react-spline'));

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface EntryItem { type: 'new' | 'improved' | 'fixed' | 'removed'; text: string; }
interface Entry { version: string; date: string; title: string; summary: string; items: EntryItem[]; }

/* ─── Data ───────────────────────────────────────────────────────────────── */
const ENTRIES: Entry[] = [
  {
    version: '1.5.0', date: '24 maja 2026',
    title: 'Statystyki, blog i porządki',
    summary: 'Chcieliśmy żebyś widział ile czasu i energii wkładasz w Cordyn — teraz masz to w jednym miejscu. Dodaliśmy też tę stronę, żebyś zawsze wiedział co się dzieje na platformie.',
    items: [
      { type: 'new',      text: 'Statystyki konta — wiadomości, reakcje, znajomi, czas na platformie. Ustawienia → Statystyki.' },
      { type: 'new',      text: 'Blog z aktualizacjami (ta strona) — każda zmiana opisana po ludzku, bez żargonu.' },
      { type: 'new',      text: 'Centrum pomocy pod cordyn.pl/support z wyszukiwarką i kategoriami.' },
      { type: 'improved', text: 'Długie wiadomości bez spacji poprawnie zawijają się zamiast wychodzić poza ekran.' },
      { type: 'improved', text: 'Pole wiadomości — limit 2000 znaków z licznikiem, scrollowalne do 200px wysokości.' },
      { type: 'removed',  text: 'Czat tekstowy w kanałach głosowych — nikt nie korzystał, zwalnia przestrzeń ekranu.' },
    ],
  },
  {
    version: '1.4.0', date: '10 maja 2026',
    title: 'Soundboard na poważnie',
    summary: 'Soundboard dostał solidny lifting — możesz przycinać dźwięki, korzystać z prawdziwych plików audio i zarządzać dźwiękami osobno dla każdego serwera.',
    items: [
      { type: 'new',      text: 'Edytor przycinania z wizualizacją fali — wybierz dokładnie który fragment zabrzmieć (maks. 10s).' },
      { type: 'new',      text: 'Wbudowane dźwięki to teraz prawdziwe nagrania: Oklaski, Flet, Cmok i inne.' },
      { type: 'new',      text: 'Panel soundboardu z ikonami serwerów po lewej — dźwięki każdego serwera osobno.' },
      { type: 'fixed',    text: 'Dźwięki przerywają się od razu po wyjściu z kanału głosowego.' },
      { type: 'fixed',    text: 'Nadawca nie słyszał dwa razy tego samego dźwięku.' },
    ],
  },
  {
    version: '1.3.0', date: '20 kwietnia 2026',
    title: 'Screen share i API dla deweloperów',
    summary: 'Screen share działa przez profesjonalny serwer mediów (LiveKit) — możesz streamować do setek osób bez spadku jakości. Deweloperzy mogą budować boty i integracje.',
    items: [
      { type: 'new',      text: 'Screen share HD i Full HD z wyborem jakości — działa nawet przy słabszym łączu.' },
      { type: 'new',      text: 'API dla deweloperów — boty, komendy, webhooks. Dokumentacja na cordyn.pl/developers.' },
      { type: 'new',      text: 'Logowanie przez Cordyn — zewnętrzne aplikacje mogą używać Twojego konta (OAuth2).' },
      { type: 'improved', text: 'Bezpieczeństwo kont wzmocnione — wyższy poziom ochrony haseł.' },
    ],
  },
  {
    version: '1.2.0', date: '1 kwietnia 2026',
    title: 'Fora, połączenia i role',
    summary: 'Serwery stały się bardziej rozbudowane — fora z wątkami, podłączenie Spotify, Twitcha czy Steama do profilu, porządny system ról.',
    items: [
      { type: 'new',      text: 'Kanały forum — wątki tematyczne z tagami i śledzeniem dyskusji.' },
      { type: 'new',      text: 'Połączenia z Spotify, Twitch, Steam i YouTube — znajomi widzą co teraz robisz.' },
      { type: 'new',      text: 'Role serwerowe z kolorami i uprawnieniami — precyzyjna kontrola dostępu.' },
      { type: 'improved', text: 'Powiadomienia push działają w przeglądarce i aplikacji desktopowej.' },
    ],
  },
];

const TYPE_CFG = {
  new:      { label: 'Nowość',     color: '#818cf8', bg: 'rgba(99,102,241,0.10)',  border: 'rgba(99,102,241,0.20)'  },
  improved: { label: 'Ulepszenie', color: '#34d399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.20)'  },
  fixed:    { label: 'Poprawka',   color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',   border: 'rgba(251,191,36,0.20)'  },
  removed:  { label: 'Usunięto',   color: '#71717a', bg: 'rgba(113,113,122,0.10)', border: 'rgba(113,113,122,0.20)' },
};

/* ─── Animated background orbs (CSS) ─────────────────────────────────────── */
function AuroraBackground({ hc }: { hc: boolean }) {
  if (hc) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <motion.div animate={{ x: [0, 60, -40, 0], y: [0, -80, 40, 0], scale: [1, 1.15, 0.9, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', top: '-20%', left: '-15%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', filter: 'blur(60px)' }}/>
      <motion.div animate={{ x: [0, -50, 70, 0], y: [0, 60, -30, 0], scale: [1, 0.85, 1.1, 1] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', bottom: '-10%', right: '-10%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)', filter: 'blur(80px)' }}/>
      <motion.div animate={{ x: [0, 40, -60, 0], y: [0, -40, 80, 0], scale: [1, 1.2, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
        style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', top: '40%', left: '45%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)', filter: 'blur(50px)' }}/>
    </div>
  );
}

/* ─── Stagger container ───────────────────────────────────────────────────── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } } };

/* ─── Main component ──────────────────────────────────────────────────────── */
export default function BlogPage() {
  const [expanded, setExpanded] = useState<string>(ENTRIES[0].version);
  const [hc, setHc] = useState(() => localStorage.getItem('cordyn_hc') === '1');
  const [splineLoaded, setSplineLoaded] = useState(false);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const heroY = useTransform(scrollY, [0, 300], [0, -60]);

  useEffect(() => { localStorage.setItem('cordyn_hc', hc ? '1' : '0'); }, [hc]);

  const bg    = hc ? '#000' : '#09090f';
  const text  = hc ? '#fff' : '#e4e4f0';
  const muted = hc ? '#aaa' : '#71717a';
  const dim   = hc ? '#888' : '#52525b';
  const card  = hc ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.025)';
  const border= hc ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)';

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'Geist, system-ui, sans-serif', position: 'relative' }}>
      <AuroraBackground hc={hc}/>

      {/* ── Spline 3D background (hero only) ── */}
      {!hc && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '60vh', zIndex: 0, pointerEvents: 'none', opacity: splineLoaded ? 0.35 : 0, transition: 'opacity 1s ease' }}>
          <Suspense fallback={null}>
            <Spline scene="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode"
              onLoad={() => setSplineLoaded(true)}
              style={{ width: '100%', height: '100%' }}/>
          </Suspense>
        </div>
      )}

      {/* ── Header ── */}
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ position: 'relative', zIndex: 10, borderBottom: `1px solid ${border}`, background: hc ? 'rgba(0,0,0,0.9)' : 'rgba(9,9,15,0.7)', backdropFilter: 'blur(16px)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/cordyn_logo.png" alt="" style={{ width: 28, height: 28, borderRadius: 8 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
            <span style={{ color: text, fontWeight: 700, fontSize: 15 }}>Cordyn</span>
            <span style={{ color: dim, margin: '0 2px' }}>/</span>
            <span style={{ color: '#818cf8', fontWeight: 600, fontSize: 14 }}>Blog</span>
          </a>
          <nav style={{ display: 'flex', gap: 8 }}>
            <a href="/support" style={{ padding: '7px 16px', borderRadius: 10, background: card, border: `1px solid ${border}`, color: muted, fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'color 0.15s' }}>
              Centrum pomocy
            </a>
            <a href="/" style={{ padding: '7px 16px', borderRadius: 10, background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Otwórz Cordyn
            </a>
          </nav>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <motion.div style={{ opacity: heroOpacity, y: heroY, position: 'relative', zIndex: 5 }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
            style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
            Aktualizacje platformy
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.55 }}
            style={{ fontSize: 52, fontWeight: 900, color: hc ? '#fff' : '#fff', margin: '0 0 20px', letterSpacing: '-0.03em', lineHeight: 1.1,
              textShadow: hc ? 'none' : '0 0 80px rgba(99,102,241,0.4)' }}>
            Co nowego<br/>
            <span style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: hc ? '#fff' : 'transparent' }}>
              w Cordyn
            </span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
            style={{ fontSize: 17, color: muted, lineHeight: 1.7, margin: '0 auto', maxWidth: 480 }}>
            Wszystko co dodajemy, poprawiamy i zmieniamy — opisane po ludzku, bez technicznego żargonu.
          </motion.p>
        </div>
      </motion.div>

      {/* ── Entries ── */}
      <div style={{ position: 'relative', zIndex: 5 }}>
        <motion.div variants={stagger} initial="hidden" animate="visible"
          style={{ maxWidth: 820, margin: '0 auto', padding: '0 24px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ENTRIES.map((entry, idx) => {
            const open = expanded === entry.version;
            return (
              <motion.div key={entry.version} variants={fadeUp} layout
                style={{ borderRadius: 20, border: `1px solid ${open ? (hc ? 'rgba(129,140,248,0.6)' : 'rgba(99,102,241,0.3)') : border}`,
                  background: open ? (hc ? 'rgba(255,255,255,0.07)' : 'rgba(99,102,241,0.05)') : card,
                  overflow: 'hidden', transition: 'border-color 0.25s, background 0.25s',
                  boxShadow: open && !hc ? '0 0 40px rgba(99,102,241,0.08)' : 'none' }}>
                {/* Header row */}
                <button onClick={() => setExpanded(open ? '' : entry.version)}
                  style={{ width: '100%', padding: '24px 28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: hc ? 'rgba(129,140,248,0.2)' : 'rgba(99,102,241,0.15)', border: `1px solid ${hc ? 'rgba(129,140,248,0.4)' : 'rgba(99,102,241,0.3)'}`, padding: '3px 10px', borderRadius: 8, letterSpacing: '0.06em' }}>
                        v{entry.version}
                      </span>
                      <span style={{ fontSize: 13, color: dim }}>{entry.date}</span>
                      {idx === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', padding: '2px 8px', borderRadius: 6, letterSpacing: '0.06em' }}>NAJNOWSZA</span>}
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: hc ? '#fff' : '#f4f4f8', margin: 0, letterSpacing: '-0.02em' }}>{entry.title}</h2>
                    {!open && <p style={{ fontSize: 14, color: muted, margin: 0, lineHeight: 1.6, maxWidth: 560 }}>{entry.summary}</p>}
                  </div>
                  <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}
                    style={{ fontSize: 20, color: dim, flexShrink: 0, marginTop: 4, display: 'block' }}>▾</motion.span>
                </button>

                {/* Expanded content */}
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div key="content" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease: easeOut }} style={{ overflow: 'hidden' }}>
                      <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={{ fontSize: 15, color: muted, lineHeight: 1.7, margin: '0 0 8px', maxWidth: 580 }}>{entry.summary}</p>
                        <motion.div variants={stagger} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {entry.items.map((item, i) => {
                            const cfg = TYPE_CFG[item.type];
                            return (
                              <motion.div key={i} variants={fadeUp}
                                style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px', borderRadius: 14, background: hc ? 'rgba(255,255,255,0.05)' : cfg.bg, border: `1px solid ${hc ? 'rgba(255,255,255,0.12)' : cfg.border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, minWidth: 90, paddingTop: 2 }}>
                                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: hc ? '#fff' : cfg.color, flexShrink: 0 }}/>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: hc ? '#ccc' : cfg.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cfg.label}</span>
                                </div>
                                <p style={{ fontSize: 14, color: hc ? '#fff' : '#d4d4d8', lineHeight: 1.65, margin: 0 }}>{item.text}</p>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* ── Footer ── */}
      <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        style={{ position: 'relative', zIndex: 5, borderTop: `1px solid ${border}`, padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: dim, margin: 0 }}>
          © 2026 Cordyn ·{' '}
          <a href="/support" style={{ color: muted, textDecoration: 'none' }}>Centrum pomocy</a>
        </p>
      </motion.footer>

      {/* ── High contrast toggle ── */}
      <motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 1, duration: 0.4, ease: easeOut }}
        style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 100 }}>
        <button onClick={() => setHc(v => !v)} title={hc ? 'Wyłącz wysoki kontrast' : 'Włącz wysoki kontrast'}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999,
            background: hc ? '#fff' : 'rgba(20,20,35,0.85)', border: `1px solid ${hc ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)'}`,
            backdropFilter: 'blur(12px)', cursor: 'pointer', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            color: hc ? '#000' : '#a1a1aa', fontSize: 12, fontWeight: 600, transition: 'all 0.25s',
            WebkitAppRegion: 'no-drag' as any }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20V2z" fill="currentColor"/>
          </svg>
          {hc ? 'Standardowy' : 'Wysoki kontrast'}
        </button>
      </motion.div>
    </div>
  );
}
