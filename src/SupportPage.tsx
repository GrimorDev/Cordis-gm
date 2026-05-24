import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';

interface Article { q: string; a: string; }
interface Category { id: string; icon: string; title: string; desc: string; articles: Article[]; }

const CATEGORIES: Category[] = [
  {
    id: 'start',
    icon: '🚀',
    title: 'Pierwsze kroki',
    desc: 'Jak zacząć korzystać z Cordyn',
    articles: [
      { q: 'Jak założyć konto?', a: 'Wejdź na cordyn.pl i kliknij "Zarejestruj się". Podaj nazwę użytkownika, adres email i hasło (minimum 8 znaków). Na Twój email zostanie wysłany 6-cyfrowy kod weryfikacyjny — wpisz go i gotowe.' },
      { q: 'Jak dołączyć do serwera?', a: 'Poproś właściciela serwera o link zaproszenia. Po kliknięciu w link zostaniesz automatycznie dodany do serwera. Możesz też użyć przycisku + w lewym pasku i wpisać kod zaproszenia ręcznie.' },
      { q: 'Jak stworzyć własny serwer?', a: 'Kliknij ikonę + w lewym pasku z serwerami, wybierz "Stwórz serwer", podaj nazwę i opcjonalnie ustaw ikonę. Twój serwer jest gotowy w kilka sekund — teraz możesz zapraszać znajomych.' },
      { q: 'Jak zmienić swój pseudonim?', a: 'Otwórz Ustawienia (ikona koła zębatego przy swoim profilu lub Ctrl+,), przejdź do zakładki Konto i zmień nazwę użytkownika. Pamiętaj że nazwa może być zmieniana raz na 30 dni.' },
    ],
  },
  {
    id: 'messages',
    icon: '💬',
    title: 'Wiadomości i czat',
    desc: 'Pisanie, edytowanie, reakcje',
    articles: [
      { q: 'Jak wysłać wiadomość?', a: 'Kliknij w pole tekstowe na dole ekranu i napisz wiadomość. Enter wysyła, Shift+Enter tworzy nową linię. Możesz też przeciągnąć plik lub wkleić zdjęcie ze schowka (Ctrl+V).' },
      { q: 'Jak edytować lub usunąć wiadomość?', a: 'Najedź na swoją wiadomość i kliknij prawym przyciskiem myszy. Pojawią się opcje Edytuj i Usuń. Możesz też szybko edytować ostatnią wiadomość naciskając strzałkę w górę w pustym polu tekstowym.' },
      { q: 'Jak formatować tekst?', a: '**pogrubienie**, _kursywa_, ~~przekreślenie~~, `kod`, > cytat, # Nagłówek — wpisz te znaki wokół tekstu. Możesz też zaznaczyć tekst i użyć skrótów Ctrl+B, Ctrl+I.' },
      { q: 'Ile znaków może mieć wiadomość?', a: 'Maksymalnie 2000 znaków w jednej wiadomości. Kiedy zostanie Ci mniej niż 200 znaków, zobaczysz licznik w rogu pola tekstowego.' },
      { q: 'Jak dodać reakcję?', a: 'Najedź na wiadomość i kliknij ikonę smiley która pojawi się po prawej stronie. Możesz też kliknąć w istniejącą reakcję pod wiadomością żeby ją dołączyć.' },
    ],
  },
  {
    id: 'voice',
    icon: '🎙️',
    title: 'Kanały głosowe',
    desc: 'Rozmowy, wideo i udostępnianie ekranu',
    articles: [
      { q: 'Jak dołączyć do rozmowy głosowej?', a: 'Kliknij na nazwę dowolnego kanału głosowego (z ikoną głośnika) w liście kanałów serwera. Zostaniesz automatycznie połączony. Na dole ekranu pojawią się przyciski do wyciszenia mikrofonu, włączenia kamery i rozłączenia.' },
      { q: 'Jak udostępnić ekran?', a: 'Podczas rozmowy głosowej kliknij ikonę monitora w kontrolkach na dole. Wybierz całe okno, kartę przeglądarki lub cały pulpit. Możesz też wybrać jakość HD (720p) lub Full HD (1080p).' },
      { q: 'Mój mikrofon nie działa — co robić?', a: 'Sprawdź czy przeglądarka ma uprawnienia do mikrofonu (ikona kłódki przy adresie strony). Możesz też wejść w Ustawienia → Urządzenia i wybrać właściwy mikrofon z listy. Upewnij się że mikrofon nie jest wyciszony w systemie operacyjnym.' },
      { q: 'Czym jest redukcja szumów?', a: 'To funkcja która automatycznie wycisza dźwięki tła podczas Twojej rozmowy — kliknięcia klawiatury, szum wentylatorów, rozmowy w tle. Możesz ją włączyć/wyłączyć w ustawieniach urządzenia podczas rozmowy.' },
    ],
  },
  {
    id: 'account',
    icon: '⚙️',
    title: 'Ustawienia konta',
    desc: 'Profil, bezpieczeństwo, prywatność',
    articles: [
      { q: 'Jak zmienić hasło?', a: 'Otwórz Ustawienia → Konto → przewiń do sekcji Hasło. Podaj aktualne hasło, a potem nowe. Hasło musi mieć co najmniej 8 znaków.' },
      { q: 'Jak włączyć weryfikację dwuetapową (2FA)?', a: 'Ustawienia → Konto → Bezpieczeństwo → Weryfikacja dwuetapowa. Aplikacja wygeneruje kod QR — zeskanuj go aplikacją jak Google Authenticator lub Authy. Przy każdym logowaniu będziesz podawać dodatkowy 6-cyfrowy kod.' },
      { q: 'Jak ustawić swój status?', a: 'Kliknij na swój avatar w lewym dolnym rogu. Możesz wybrać: Dostępny, Nieobecny, Nie przeszkadzać lub Niewidoczny. Możesz też napisać własny status tekstowy.' },
      { q: 'Jak chronić swoją prywatność?', a: 'W Ustawieniach → Prywatność możesz wyłączyć pokazywanie statusu online, wskaźników pisania i potwierdzeń przeczytania. Możesz też ograniczyć kto może wysyłać Ci prośby o znajomość.' },
      { q: 'Jak usunąć konto?', a: 'Ustawienia → Konto → przewiń na sam dół → Usuń konto. Zostaniesz poproszony o potwierdzenie kodem wysłanym na email. Konto i wszystkie dane zostaną usunięte w ciągu 30 dni.' },
    ],
  },
  {
    id: 'servers',
    icon: '🏠',
    title: 'Zarządzanie serwerem',
    desc: 'Role, kanały, zaproszenia',
    articles: [
      { q: 'Jak zapraszać ludzi na serwer?', a: 'Kliknij prawym przyciskiem na nazwę serwera i wybierz Zaproś → Utwórz link zaproszenia. Skopiuj link i wyślij znajomemu. Możesz ustawić ważność linku (np. 24h, 7 dni, bezterminowy).' },
      { q: 'Jak tworzyć kanały?', a: 'Kliknij + obok nagłówka kategorii kanałów. Wybierz typ: Tekstowy (czat), Głosowy (rozmowy) lub Forum (dyskusje). Nadaj kanałowi nazwę i opcjonalnie opis.' },
      { q: 'Jak tworzyć role i uprawnienia?', a: 'Ustawienia serwera (kliknij na nazwie serwera) → Role → dodaj rolę. Możesz ustalić kolor, uprawnienia (np. zarządzanie kanałami, kickowanie członków) i przypisać rolę konkretnym użytkownikom.' },
      { q: 'Jak wyrzucić lub zablokować użytkownika?', a: 'Kliknij prawym przyciskiem na nick użytkownika. Pojawią się opcje: Kick (wyrzuca z serwera, może wrócić z zaproszeniem) lub Zbanuj (blokuje permanentnie). Obie opcje wymagają odpowiednich uprawnień.' },
    ],
  },
  {
    id: 'technical',
    icon: '🔧',
    title: 'Problemy techniczne',
    desc: 'Coś nie działa? Sprawdź tutaj',
    articles: [
      { q: '"Brak połączenia" — co to znaczy?', a: 'Aplikacja chwilowo straciła połączenie z serwerem. Sprawdź swoje połączenie internetowe. Cordyn automatycznie próbuje się ponownie połączyć — poczekaj chwilę. Jeśli problem się utrzymuje, sprawdź status platformy na cordyn.pl/stats.' },
      { q: 'Strona/aplikacja działa wolno', a: 'Spróbuj odświeżyć stronę (F5). Wyczyść pamięć podręczną przeglądarki (Ctrl+Shift+Del). Jeśli korzystasz z wielu otwartych kart z Cordyn, zamknij zbędne. Na starszych komputerach warto włączyć Tryb kompaktowy w Ustawieniach → Wygląd.' },
      { q: 'Nie dostaję powiadomień', a: 'Sprawdź czy przeglądarka ma uprawnienia do powiadomień (ikona kłódki przy adresie). Otwórz Ustawienia → Powiadomienia i sprawdź konfigurację. Upewnij się też że nie masz włączonego "Nie przeszkadzać" ani wyciszenia na konkretnym serwerze/kanale.' },
      { q: 'Nie mogę wgrać zdjęcia/pliku', a: 'Darmowe konta mają limit 50MB na plik. Sprawdź rozmiar pliku. Obsługiwane formaty obrazów to JPG, PNG, GIF, WebP. Jeśli wgrywasz wideo lub duże pliki, może to chwilę potrwać w zależności od łącza.' },
    ],
  },
];

// ── Animated aurora background ────────────────────────────────────────────────
function AuroraBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <motion.div
        animate={{ x: [0, 80, -60, 0], y: [0, -60, 80, 0], scale: [1, 1.2, 0.85, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '-15%', left: '-10%', width: 750, height: 750,
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          filter: 'blur(70px)' }}
      />
      <motion.div
        animate={{ x: [0, -70, 50, 0], y: [0, 90, -50, 0], scale: [1, 0.9, 1.25, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        style={{ position: 'absolute', top: '10%', right: '-15%', width: 650, height: 650,
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          filter: 'blur(80px)' }}
      />
      <motion.div
        animate={{ x: [0, 40, -80, 0], y: [0, -40, 60, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut', delay: 10 }}
        style={{ position: 'absolute', bottom: '5%', left: '30%', width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
          filter: 'blur(60px)' }}
      />
    </div>
  );
}

// ── Galaxy canvas background ──────────────────────────────────────────────────
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

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const STAR_COLORS = ['200,210,255', '180,200,255', '220,215,255', '255,240,200', '200,230,255'];
    const stars = Array.from({ length: 260 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.pow(Math.random(), 2.5) * 2.2 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.6 + 0.2,
      bright: Math.random() * 0.55 + 0.25,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    }));

    const blobs = [
      { cx: 0.1,  cy: 0.18, r: 0.4,  c: [99,102,241]  as [number,number,number], a: 0.13, dx: 0.04,  dy: 0.03,  phase: 0   },
      { cx: 0.82, cy: 0.12, r: 0.36, c: [139,92,246]  as [number,number,number], a: 0.11, dx: -0.03, dy: 0.035, phase: 1.2 },
      { cx: 0.52, cy: 0.7,  r: 0.30, c: [59,130,246]  as [number,number,number], a: 0.09, dx: 0.025, dy: -0.04, phase: 2.4 },
      { cx: 0.9,  cy: 0.6,  r: 0.27, c: [168,85,247]  as [number,number,number], a: 0.10, dx: -0.04, dy: 0.025, phase: 0.7 },
      { cx: 0.3,  cy: 0.88, r: 0.24, c: [79,70,229]   as [number,number,number], a: 0.08, dx: 0.035, dy: 0.02,  phase: 3.1 },
    ];

    interface Shoot { x:number; y:number; vx:number; vy:number; len:number; life:number; max:number; }
    const shoots: Shoot[] = [];
    let nextShoot = 120 + Math.random() * 180;
    const spawnShoot = () => {
      const angle = Math.PI * (0.9 + Math.random() * 0.4);
      const speed = 8 + Math.random() * 6;
      shoots.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height * 0.5,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        len: 80 + Math.random() * 60, life: 0, max: 35 + Math.random() * 20 });
    };

    const draw = () => {
      t += 0.004;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      blobs.forEach(b => {
        const bx = (b.cx + Math.sin(t * 0.25 + b.phase) * b.dx) * canvas.width;
        const by = (b.cy + Math.cos(t * 0.18 + b.phase) * b.dy) * canvas.height;
        const br = b.r * Math.min(canvas.width, canvas.height);
        const grd = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        const [r, g, bl] = b.c;
        grd.addColorStop(0,   `rgba(${r},${g},${bl},${b.a})`);
        grd.addColorStop(0.4, `rgba(${r},${g},${bl},${b.a * 0.5})`);
        grd.addColorStop(1,   `rgba(${r},${g},${bl},0)`);
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      });

      stars.forEach(s => {
        const sx = s.x * canvas.width, sy = s.y * canvas.height;
        const opc = s.bright * (0.45 + 0.55 * Math.sin(t * s.speed + s.phase));
        if (s.r > 1.4) {
          const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 3);
          grd.addColorStop(0, `rgba(${s.color},${opc})`);
          grd.addColorStop(0.5, `rgba(${s.color},${opc * 0.3})`);
          grd.addColorStop(1, `rgba(${s.color},0)`);
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(sx, sy, s.r * 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color},${opc})`; ctx.fill();
      });

      nextShoot--;
      if (nextShoot <= 0) { spawnShoot(); nextShoot = 150 + Math.random() * 200; }
      for (let i = shoots.length - 1; i >= 0; i--) {
        const sh = shoots[i];
        sh.x += sh.vx; sh.y += sh.vy; sh.life++;
        const prog = sh.life / sh.max;
        const opc  = prog < 0.5 ? prog * 2 : (1 - prog) * 2;
        const tx = sh.x - sh.vx * (sh.len / 10), ty = sh.y - sh.vy * (sh.len / 10);
        const grd = ctx.createLinearGradient(tx, ty, sh.x, sh.y);
        grd.addColorStop(0, `rgba(200,215,255,0)`);
        grd.addColorStop(1, `rgba(220,230,255,${opc * 0.8})`);
        ctx.strokeStyle = grd; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sh.x, sh.y); ctx.stroke();
        if (sh.life >= sh.max) shoots.splice(i, 1);
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [hc]);

  if (hc) return null;
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}/>;
}

// ── Stagger container variants ────────────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// ── Category icon map (SVG instead of emoji for cleaner look) ─────────────────
const CAT_COLORS: Record<string, string> = {
  start: '#6366f1',
  messages: '#8b5cf6',
  voice: '#06b6d4',
  account: '#10b981',
  servers: '#f59e0b',
  technical: '#ef4444',
};

export default function SupportPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<number | null>(null);
  const [search, setSearch]               = useState('');
  const [hc, setHc]   = useState(() => localStorage.getItem('cordyn_hc') === '1');
  const heroRef       = useRef<HTMLDivElement>(null);
  const { scrollY }                       = useScroll();
  const heroOpacity                       = useTransform(scrollY, [0, 320], [1, 0]);
  const heroY                             = useTransform(scrollY, [0, 320], [0, -60]);

  const toggleHc = () => {
    const next = !hc;
    setHc(next);
    localStorage.setItem('cordyn_hc', next ? '1' : '0');
  };

  const filtered = search.trim()
    ? CATEGORIES.flatMap(cat => cat.articles.map(a => ({ ...a, cat: cat.title, catId: cat.id }))).filter(a =>
        a.q.toLowerCase().includes(search.toLowerCase()) || a.a.toLowerCase().includes(search.toLowerCase()))
    : null;

  const activeCat = CATEGORIES.find(c => c.id === activeCategory) || null;

  // ── Colors based on high-contrast mode ──────────────────────────────────────
  const bg          = hc ? '#000'         : '#09090f';
  const textPrimary = hc ? '#fff'         : '#e4e4f0';
  const textMuted   = hc ? '#d1d5db'      : '#71717a';
  const textDim     = hc ? '#9ca3af'      : '#52525b';
  const cardBg      = hc ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)';
  const cardBorder  = hc ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
  const accent      = hc ? '#818cf8'      : '#6366f1';
  const inputBg     = hc ? 'rgba(255,255,255,0.1)'  : 'rgba(255,255,255,0.05)';

  return (
    <div style={{ minHeight: '100vh', background: bg, color: textPrimary, fontFamily: 'Geist, system-ui, sans-serif', overflowX: 'hidden' }}>
      <GalaxyBackground hc={hc}/>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: `1px solid ${cardBorder}`,
          background: hc ? 'rgba(0,0,0,0.95)' : 'rgba(9,9,15,0.85)', backdropFilter: 'blur(20px)' }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 28px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/cordyn_logo.png" alt="Cordyn" style={{ width: 28, height: 28, borderRadius: 8 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
            <span style={{ color: textPrimary, fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Cordyn</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 15, margin: '0 2px' }}>/</span>
            <span style={{ color: accent, fontWeight: 600, fontSize: 14 }}>Centrum pomocy</span>
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/blog" style={{ padding: '7px 16px', borderRadius: 10, background: cardBg, border: `1px solid ${cardBorder}`, color: textMuted, fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'color 0.15s' }}>
              Blog
            </a>
            <a href="/" style={{ padding: '7px 16px', borderRadius: 10, background: accent, color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Otwórz Cordyn
            </a>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div ref={heroRef} style={{ position: 'relative', overflow: 'hidden', paddingBottom: 24 }}>
        {/* Aurora overlay */}
        <AuroraBackground />

        {/* Hero content */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroY, position: 'relative', zIndex: 2,
            padding: '80px 28px 56px', textAlign: 'center', maxWidth: 680, margin: '0 auto' }}
        >
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}
          >
            Centrum pomocy
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontSize: 48, fontWeight: 900, color: textPrimary, margin: '0 0 16px',
              letterSpacing: '-0.03em', lineHeight: 1.1 }}
          >
            Jak możemy{' '}
            <span style={{ background: `linear-gradient(135deg, ${accent}, #a78bfa)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              pomóc?
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.5 }}
            style={{ fontSize: 17, color: textMuted, margin: '0 0 40px', lineHeight: 1.6 }}
          >
            Odpowiedzi na najczęstsze pytania dotyczące Cordyn
          </motion.p>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.34, duration: 0.5 }}
            style={{ position: 'relative', maxWidth: 560, margin: '0 auto' }}
          >
            <svg style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: textDim }}
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveCategory(null); setActiveArticle(null); }}
              placeholder="Szukaj w centrum pomocy…"
              style={{ width: '100%', padding: '16px 20px 16px 48px', borderRadius: 18,
                background: inputBg, border: `1.5px solid ${cardBorder}`, color: textPrimary,
                fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              onFocus={e => { e.currentTarget.style.borderColor = `${accent}80`; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}18`; }}
              onBlur={e => { e.currentTarget.style.borderColor = cardBorder; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </motion.div>
        </motion.div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '8px 28px 100px' }}>

        {/* Search results */}
        <AnimatePresence mode="wait">
          {filtered && (
            <motion.div
              key="search-results"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}
            >
              <p style={{ fontSize: 12, color: textDim, marginBottom: 16 }}>
                {filtered.length} {filtered.length === 1 ? 'wynik' : filtered.length < 5 ? 'wyniki' : 'wyników'} dla „{search}"
              </p>
              {filtered.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: textDim, fontSize: 15 }}>
                  Brak wyników. Spróbuj innego zapytania.
                </div>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="show"
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filtered.map((a, i) => (
                    <motion.div key={i} variants={fadeUp}
                      onClick={() => {
                        setSearch('');
                        const catId = a.catId;
                        setActiveCategory(catId);
                        setActiveArticle(CATEGORIES.find(c => c.id === catId)!.articles.findIndex(ar => ar.q === a.q));
                      }}
                      whileHover={{ scale: 1.01, borderColor: `${accent}40` }}
                      style={{ padding: '20px 24px', borderRadius: 18, background: cardBg,
                        border: `1px solid ${cardBorder}`, cursor: 'pointer' }}
                    >
                      <p style={{ fontSize: 11, color: CAT_COLORS[a.catId] || accent, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{a.cat}</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: textPrimary, margin: '0 0 6px' }}>{a.q}</p>
                      <p style={{ fontSize: 14, color: textMuted, margin: 0, lineHeight: 1.6,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.a}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category grid */}
        <AnimatePresence mode="wait">
          {!filtered && !activeCategory && (
            <motion.div
              key="cat-grid"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
            >
              <motion.div
                variants={staggerContainer} initial="hidden" animate="show"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginTop: 12 }}
              >
                {CATEGORIES.map(cat => {
                  const color = CAT_COLORS[cat.id] || accent;
                  return (
                    <motion.button
                      key={cat.id}
                      variants={fadeUp}
                      onClick={() => setActiveCategory(cat.id)}
                      whileHover={{ scale: 1.025, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      style={{ padding: '28px 26px', borderRadius: 20, background: cardBg,
                        border: `1px solid ${cardBorder}`, cursor: 'pointer', textAlign: 'left',
                        transition: 'border-color 0.2s, background 0.2s', position: 'relative', overflow: 'hidden' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = `${color}40`;
                        e.currentTarget.style.background = `${color}08`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = cardBorder;
                        e.currentTarget.style.background = cardBg;
                      }}
                    >
                      {/* Accent glow top-left */}
                      <div style={{ position: 'absolute', top: -20, left: -20, width: 120, height: 120,
                        background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`, pointerEvents: 'none' }}/>
                      <div style={{ fontSize: 30, marginBottom: 16 }}>{cat.icon}</div>
                      <p style={{ fontSize: 16, fontWeight: 700, color: textPrimary, margin: '0 0 8px' }}>{cat.title}</p>
                      <p style={{ fontSize: 14, color: textMuted, margin: '0 0 18px', lineHeight: 1.55 }}>{cat.desc}</p>
                      <p style={{ fontSize: 12, color: color, fontWeight: 600 }}>{cat.articles.length} artykułów →</p>
                    </motion.button>
                  );
                })}
              </motion.div>

              {/* Quick help strip */}
              <motion.div
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                style={{ marginTop: 48, padding: '28px 32px', borderRadius: 20, background: cardBg,
                  border: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}
              >
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: textPrimary, margin: '0 0 4px' }}>Nie znalazłeś odpowiedzi?</p>
                  <p style={{ fontSize: 13, color: textMuted, margin: 0 }}>Sprawdź status platformy lub napisz do nas przez Cordyn</p>
                </div>
                <a href="/stats" style={{ padding: '10px 20px', borderRadius: 12, background: `${accent}18`,
                  border: `1px solid ${accent}30`, color: accent, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  flexShrink: 0, transition: 'background 0.15s' }}>
                  Status platformy →
                </a>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category articles */}
        <AnimatePresence mode="wait">
          {!filtered && activeCat && (
            <motion.div
              key={`cat-${activeCat.id}`}
              initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.button
                onClick={() => { setActiveCategory(null); setActiveArticle(null); }}
                whileHover={{ x: -3 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent',
                  border: 'none', color: accent, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  marginBottom: 32, padding: 0, transition: 'color 0.15s' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Wszystkie kategorie
              </motion.button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                <span style={{ fontSize: 28 }}>{activeCat.icon}</span>
                <div>
                  <h2 style={{ fontSize: 26, fontWeight: 800, color: textPrimary, margin: '0 0 4px', letterSpacing: '-0.02em' }}>{activeCat.title}</h2>
                  <p style={{ fontSize: 14, color: textMuted, margin: 0 }}>{activeCat.desc}</p>
                </div>
              </div>

              <motion.div
                variants={staggerContainer} initial="hidden" animate="show"
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                {activeCat.articles.map((art, i) => {
                  const isOpen = activeArticle === i;
                  const color  = CAT_COLORS[activeCat.id] || accent;
                  return (
                    <motion.div key={i} variants={fadeUp}
                      style={{ borderRadius: 18, border: `1px solid ${isOpen ? `${color}30` : cardBorder}`,
                        background: isOpen ? `${color}06` : cardBg, overflow: 'hidden',
                        transition: 'border-color 0.2s, background 0.2s' }}
                    >
                      <button
                        onClick={() => setActiveArticle(isOpen ? null : i)}
                        style={{ width: '100%', padding: '20px 24px', display: 'flex',
                          justifyContent: 'space-between', alignItems: 'center', gap: 16,
                          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 600, color: isOpen ? '#c7d2fe' : textPrimary, lineHeight: 1.4 }}>{art.q}</span>
                        <motion.span
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ color: textDim, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </motion.span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ padding: '4px 24px 24px' }}>
                              <div style={{ height: 1, background: `${cardBorder}`, marginBottom: 18, opacity: 0.6 }}/>
                              <p style={{ fontSize: 15, color: textMuted, lineHeight: 1.75, margin: 0 }}>{art.a}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Still need help */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.45 }}
                style={{ marginTop: 40, padding: '24px 28px', borderRadius: 18, background: cardBg,
                  border: `1px solid ${cardBorder}`, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: textPrimary, margin: '0 0 4px' }}>Potrzebujesz więcej pomocy?</p>
                  <p style={{ fontSize: 13, color: textMuted, margin: 0 }}>Sprawdź inne kategorie lub wróć do strony głównej centrum pomocy</p>
                </div>
                <button
                  onClick={() => { setActiveCategory(null); setActiveArticle(null); }}
                  style={{ padding: '9px 18px', borderRadius: 12, background: `${accent}18`,
                    border: `1px solid ${accent}30`, color: accent, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', flexShrink: 0 }}
                >
                  Wszystkie kategorie
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <motion.footer
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
        viewport={{ once: true }} transition={{ duration: 0.5 }}
        style={{ borderTop: `1px solid ${cardBorder}`, padding: '28px 28px', textAlign: 'center' }}
      >
        <p style={{ fontSize: 12, color: textDim, margin: 0 }}>
          © 2026 Cordyn ·{' '}
          <a href="/blog" style={{ color: textDim, textDecoration: 'none' }}>Blog</a>
          {' · '}
          <a href="/stats" style={{ color: textDim, textDecoration: 'none' }}>Status</a>
        </p>
      </motion.footer>

      {/* ── High-contrast toggle ────────────────────────────────────────────── */}
      <motion.button
        onClick={toggleHc}
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.45, type: 'spring', bounce: 0.3 }}
        whileHover={{ scale: 1.06, y: -2 }}
        whileTap={{ scale: 0.95 }}
        title={hc ? 'Wyłącz wysoki kontrast' : 'Włącz wysoki kontrast'}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 100,
          padding: '10px 18px', borderRadius: 999,
          background: hc ? 'rgba(255,255,255,0.12)' : 'rgba(20,20,30,0.75)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          border: `1px solid ${hc ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
          color: hc ? '#fff' : '#a1a1aa',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7,
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          letterSpacing: '0.02em',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        {hc ? 'Standardowy' : 'Wysoki kontrast'}
      </motion.button>
    </div>
  );
}
