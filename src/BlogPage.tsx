import React, { useState } from 'react';

interface Entry {
  version: string;
  date: string;
  title: string;
  summary: string;
  items: { type: 'new' | 'improved' | 'fixed' | 'removed'; text: string }[];
}

const ENTRIES: Entry[] = [
  {
    version: '1.5.0',
    date: '24 maja 2026',
    title: 'Statystyki, changelog i porządki',
    summary: 'Chcieliśmy żebyś wiedział ile czasu i energii wkładasz w Cordyn — teraz masz to w jednym miejscu. Dodaliśmy też tę stronę, żebyś zawsze wiedział co się dzieje na platformie.',
    items: [
      { type: 'new',      text: 'Statystyki konta — sprawdź ile wiadomości wysłałeś, ile czasu spędziłeś na serwerach i jak rośnie Twoja sieć znajomych. Znajdziesz to w Ustawieniach → Statystyki.' },
      { type: 'new',      text: 'Blog z aktualizacjami (ta strona!) — od teraz każda zmiana będzie opisana po ludzku, bez technicznego żargonu.' },
      { type: 'new',      text: 'Centrum pomocy pod adresem cordyn.pl/support — odpowiedzi na najczęstsze pytania.' },
      { type: 'improved', text: 'Długie wiadomości bez spacji (np. linki, losowe ciągi) teraz poprawnie zawijają się w oknie czatu zamiast wychodzić poza ekran.' },
      { type: 'improved', text: 'Pole wpisywania wiadomości ma teraz limit 2000 znaków. Kiedy zbliżasz się do końca, zobaczysz licznik ile znaków pozostało.' },
      { type: 'removed',  text: 'Usunęliśmy czat tekstowy z kanałów głosowych — nikt z niego nie korzystał, a zwalnia to miejsce na ekranie podczas rozmów.' },
    ],
  },
  {
    version: '1.4.0',
    date: '10 maja 2026',
    title: 'Soundboard na poważnie',
    summary: 'Soundboard dostał solidny lifting — możesz teraz przycinać dźwięki, korzystać z prawdziwych plików audio i zarządzać dźwiękami osobno dla każdego serwera.',
    items: [
      { type: 'new',      text: 'Edytor przycinania — zanim wyślesz dźwięk, możesz wybrać dokładnie który fragment ma zabrzmieć. Limit to 10 sekund, żeby nie przesadzać.' },
      { type: 'new',      text: 'Wbudowane dźwięki — Oklaski, Flet, Cmok i inne są teraz prawdziwymi nagraniami zamiast elektronicznych efektów.' },
      { type: 'new',      text: 'Panel soundboardu pokazuje teraz dźwięki z każdego serwera z osobna — ikony serwerów po lewej stronie.' },
      { type: 'fixed',    text: 'Dźwięki przerywają się od razu po wyjściu z kanału głosowego — wcześniej grały dalej w tle.' },
      { type: 'fixed',    text: 'Nadawca nie słyszał już dwa razy tego samego dźwięku.' },
    ],
  },
  {
    version: '1.3.0',
    date: '20 kwietnia 2026',
    title: 'Udostępnianie ekranu i API dla deweloperów',
    summary: 'Duże wydanie — screen share działa teraz przez profesjonalny serwer mediów (LiveKit), co oznacza że możesz streamować do setek osób bez spadku jakości. Deweloperzy mogą też budować boty i integracje.',
    items: [
      { type: 'new',      text: 'Udostępnianie ekranu HD i Full HD — wybierasz jakość, platforma robi resztę. Działa nawet przy słabszym łączu.' },
      { type: 'new',      text: 'API dla deweloperów — możesz tworzyć boty, komendy i integracje dla swoich serwerów. Dokumentacja na cordyn.pl/developers.' },
      { type: 'new',      text: 'Logowanie przez Cordyn — zewnętrzne aplikacje mogą teraz korzystać z Twojego konta Cordyn (tak jak "Zaloguj przez Google").' },
      { type: 'improved', text: 'Bezpieczeństwo kont zostało wzmocnione — hasła są teraz przechowywane z wyższym stopniem ochrony.' },
    ],
  },
  {
    version: '1.2.0',
    date: '1 kwietnia 2026',
    title: 'Fora, połączenia z platformami i role',
    summary: 'Serwery stały się bardziej rozbudowane — masz teraz fora z wątkami, możesz podpiąć Spotify, Twitcha czy Steama do profilu, a właściciele serwerów dostali porządny system ról.',
    items: [
      { type: 'new',      text: 'Kanały forum — zakładaj wątki tematyczne zamiast wszystko wrzucać do jednego czatu. Wygodne tagowanie i śledzenie dyskusji.' },
      { type: 'new',      text: 'Połączenia z platformami — Spotify, Twitch, Steam i YouTube możesz podpiąć do profilu. Znajomi zobaczą co teraz słuchasz lub na czym grasz.' },
      { type: 'new',      text: 'Role serwerowe z kolorami i uprawnieniami — właściciele serwerów mogą teraz precyzyjnie zarządzać tym kto co może robić.' },
      { type: 'improved', text: 'Powiadomienia push działają teraz też w przeglądarce i aplikacji desktopowej.' },
    ],
  },
];

const TYPE_CFG = {
  new:      { label: 'Nowość',      dot: '#818cf8', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.15)'  },
  improved: { label: 'Ulepszenie', dot: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.15)'  },
  fixed:    { label: 'Poprawka',   dot: '#fbbf24', bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.15)'  },
  removed:  { label: 'Usunięto',   dot: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.15)' },
};

export default function BlogPage() {
  const [expanded, setExpanded] = useState<string>(ENTRIES[0].version);

  return (
    <div style={{ minHeight: '100vh', background: '#09090f', color: '#e4e4f0', fontFamily: 'Geist, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/cordyn_logo.png" alt="Cordyn" style={{ width: 28, height: 28, borderRadius: 8 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Cordyn</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 15, margin: '0 2px' }}>/</span>
            <span style={{ color: '#6366f1', fontWeight: 600, fontSize: 14 }}>Blog</span>
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/support" style={{ padding: '6px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#a1a1aa', fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}>
              Centrum pomocy
            </a>
            <a href="/" style={{ padding: '6px 14px', borderRadius: 10, background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Otwórz Cordyn
            </a>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 40px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Aktualizacje platformy</p>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 14px', letterSpacing: '-0.02em', lineHeight: 1.15 }}>Co nowego w Cordyn</h1>
        <p style={{ fontSize: 16, color: '#71717a', lineHeight: 1.65, margin: 0, maxWidth: 520 }}>
          Tutaj opisujemy wszystko co dodajemy, poprawiamy i zmieniamy — bez technicznego żargonu.
        </p>
      </div>

      {/* Entries */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 80px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ENTRIES.map((entry) => {
          const open = expanded === entry.version;
          return (
            <div key={entry.version}
              style={{ borderRadius: 16, border: `1px solid ${open ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}`, background: open ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)', overflow: 'hidden', transition: 'border-color 0.2s, background 0.2s', marginBottom: 8 }}>
              {/* Entry header */}
              <button onClick={() => setExpanded(open ? '' : entry.version)}
                style={{ width: '100%', padding: '20px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', padding: '2px 8px', borderRadius: 6, letterSpacing: '0.04em' }}>
                      v{entry.version}
                    </span>
                    <span style={{ fontSize: 12, color: '#52525b' }}>{entry.date}</span>
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>{entry.title}</h2>
                  {!open && <p style={{ fontSize: 13, color: '#71717a', margin: 0, lineHeight: 1.5 }}>{entry.summary}</p>}
                </div>
                <span style={{ fontSize: 18, color: '#3f3f46', flexShrink: 0, marginTop: 2, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
              </button>

              {/* Expanded content */}
              {open && (
                <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.65, margin: '0 0 8px' }}>{entry.summary}</p>
                  {entry.items.map((item, i) => {
                    const cfg = TYPE_CFG[item.type];
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 80, paddingTop: 1 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }}/>
                          <span style={{ fontSize: 10, fontWeight: 700, color: cfg.dot, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cfg.label}</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.6, margin: 0 }}>{item.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#3f3f46', margin: 0 }}>© 2026 Cordyn · <a href="/support" style={{ color: '#52525b', textDecoration: 'none' }}>Centrum pomocy</a></p>
      </div>
    </div>
  );
}
