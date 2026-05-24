import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, easeOut } from 'motion/react';

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

/* ─── Galaxy canvas background ───────────────────────────────────────────── */
function GalaxyBackground({ hc }: { hc: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (hc) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Stars ──────────────────────────────────────────────────────────────
    const STAR_COUNT = 260;
    interface Star { x: number; y: number; r: number; phase: number; speed: number; bright: number; color: string; }
    const STAR_COLORS = ['200,210,255', '180,200,255', '220,215,255', '255,240,200', '200,230,255'];
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x:      Math.random(),
      y:      Math.random(),
      r:      Math.pow(Math.random(), 2.5) * 2.2 + 0.2,
      phase:  Math.random() * Math.PI * 2,
      speed:  Math.random() * 0.6 + 0.2,
      bright: Math.random() * 0.55 + 0.25,
      color:  STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    }));

    // ── Nebula blobs ───────────────────────────────────────────────────────
    const blobs = [
      { cx: 0.12, cy: 0.22, r: 0.42, c: [99,102,241]  as [number,number,number], a: 0.13, dx: 0.04, dy: 0.03, phase: 0    },
      { cx: 0.78, cy: 0.15, r: 0.38, c: [139,92,246]  as [number,number,number], a: 0.11, dx: -0.03, dy: 0.035, phase: 1.2 },
      { cx: 0.55, cy: 0.72, r: 0.32, c: [59,130,246]  as [number,number,number], a: 0.09, dx: 0.025, dy: -0.04, phase: 2.4 },
      { cx: 0.88, cy: 0.65, r: 0.28, c: [168,85,247]  as [number,number,number], a: 0.10, dx: -0.04, dy: 0.025, phase: 0.7 },
      { cx: 0.35, cy: 0.85, r: 0.25, c: [79,70,229]   as [number,number,number], a: 0.08, dx: 0.035, dy: 0.02,  phase: 3.1 },
    ];

    // ── Shooting stars ─────────────────────────────────────────────────────
    interface Shoot { x: number; y: number; vx: number; vy: number; len: number; life: number; max: number; }
    const shoots: Shoot[] = [];
    let nextShoot = 120 + Math.random() * 180;

    const spawnShoot = () => {
      const angle = Math.PI * (0.9 + Math.random() * 0.4);
      const speed = 8 + Math.random() * 6;
      shoots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: 80 + Math.random() * 60,
        life: 0,
        max:  35 + Math.random() * 20,
      });
    };

    const draw = () => {
      t += 0.004;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Nebula
      blobs.forEach((b, i) => {
        const bx = (b.cx + Math.sin(t * 0.25 + b.phase) * b.dx) * canvas.width;
        const by = (b.cy + Math.cos(t * 0.18 + b.phase) * b.dy) * canvas.height;
        const br  = b.r * Math.min(canvas.width, canvas.height);
        const grd = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        const [r, g, bl] = b.c;
        grd.addColorStop(0,   `rgba(${r},${g},${bl},${b.a})`);
        grd.addColorStop(0.4, `rgba(${r},${g},${bl},${b.a * 0.5})`);
        grd.addColorStop(1,   `rgba(${r},${g},${bl},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      });

      // Stars
      stars.forEach(s => {
        const sx  = s.x * canvas.width;
        const sy  = s.y * canvas.height;
        const opc = s.bright * (0.45 + 0.55 * Math.sin(t * s.speed + s.phase));
        if (s.r > 1.4) {
          // Larger stars get a subtle glow
          const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 3);
          grd.addColorStop(0,   `rgba(${s.color},${opc})`);
          grd.addColorStop(0.5, `rgba(${s.color},${opc * 0.3})`);
          grd.addColorStop(1,   `rgba(${s.color},0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(sx, sy, s.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color},${opc})`;
        ctx.fill();
      });

      // Shooting stars
      nextShoot--;
      if (nextShoot <= 0) { spawnShoot(); nextShoot = 150 + Math.random() * 200; }
      for (let i = shoots.length - 1; i >= 0; i--) {
        const sh = shoots[i];
        sh.x += sh.vx; sh.y += sh.vy; sh.life++;
        const progress = sh.life / sh.max;
        const opacity  = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
        const tailX = sh.x - sh.vx * (sh.len / 10);
        const tailY = sh.y - sh.vy * (sh.len / 10);
        const grd = ctx.createLinearGradient(tailX, tailY, sh.x, sh.y);
        grd.addColorStop(0, `rgba(200,215,255,0)`);
        grd.addColorStop(1, `rgba(220,230,255,${opacity * 0.8})`);
        ctx.strokeStyle = grd;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(sh.x, sh.y);
        ctx.stroke();
        if (sh.life >= sh.max) shoots.splice(i, 1);
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [hc]);

  if (hc) return null;
  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', inset: 0, width: '100%', height: '100%',
      zIndex: 0, pointerEvents: 'none',
    }}/>
  );
}

/* ─── Stagger container ───────────────────────────────────────────────────── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } } };

/* ─── Main component ──────────────────────────────────────────────────────── */
export default function BlogPage() {
  const [expanded, setExpanded] = useState<string>(ENTRIES[0].version);
  const [hc, setHc] = useState(() => localStorage.getItem('cordyn_hc') === '1');
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
      <GalaxyBackground hc={hc}/>
      <AuroraBackground hc={hc}/>

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
