import React, { useState } from 'react';

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

export default function SupportPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? CATEGORIES.flatMap(cat => cat.articles.map(a => ({ ...a, cat: cat.title }))).filter(a =>
        a.q.toLowerCase().includes(search.toLowerCase()) || a.a.toLowerCase().includes(search.toLowerCase()))
    : null;

  const activeCat = CATEGORIES.find(c => c.id === activeCategory) || null;

  return (
    <div style={{ minHeight: '100vh', background: '#09090f', color: '#e4e4f0', fontFamily: 'Geist, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/cordyn_logo.png" alt="Cordyn" style={{ width: 28, height: 28, borderRadius: 8 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Cordyn</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 15, margin: '0 2px' }}>/</span>
            <span style={{ color: '#6366f1', fontWeight: 600, fontSize: 14 }}>Centrum pomocy</span>
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/blog" style={{ padding: '6px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#a1a1aa', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
              Blog
            </a>
            <a href="/" style={{ padding: '6px 14px', borderRadius: 10, background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Otwórz Cordyn
            </a>
          </div>
        </div>
      </div>

      {/* Hero + search */}
      <div style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.08) 0%, transparent 100%)', padding: '56px 24px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Centrum pomocy</p>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.02em' }}>Jak możemy pomóc?</h1>
        <p style={{ fontSize: 15, color: '#71717a', margin: '0 0 32px' }}>Odpowiedzi na najczęstsze pytania dotyczące Cordyn</p>
        <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#52525b', fontSize: 16, pointerEvents: 'none' }}>⌕</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setActiveCategory(null); setActiveArticle(null); }}
            placeholder="Szukaj w centrum pomocy..."
            style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* Search results */}
        {filtered && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 40 }}>
            <p style={{ fontSize: 12, color: '#52525b', marginBottom: 8 }}>{filtered.length} wyników dla „{search}"</p>
            {filtered.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#52525b', fontSize: 14 }}>Brak wyników. Spróbuj innego zapytania.</div>
            )}
            {filtered.map((a, i) => (
              <div key={i} style={{ padding: '16px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}
                onClick={() => { setSearch(''); const catId = CATEGORIES.find(c => c.title === a.cat)?.id; if (catId) { setActiveCategory(catId); setActiveArticle(CATEGORIES.find(c => c.id === catId)!.articles.findIndex(ar => ar.q === a.q)); } }}>
                <p style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{a.cat}</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>{a.q}</p>
                <p style={{ fontSize: 13, color: '#71717a', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.a}</p>
              </div>
            ))}
          </div>
        )}

        {/* Category grid */}
        {!filtered && !activeCategory && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                style={{ padding: '20px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{cat.icon}</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>{cat.title}</p>
                <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 14px', lineHeight: 1.5 }}>{cat.desc}</p>
                <p style={{ fontSize: 12, color: '#52525b' }}>{cat.articles.length} artykułów →</p>
              </button>
            ))}
          </div>
        )}

        {/* Category articles */}
        {!filtered && activeCat && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => { setActiveCategory(null); setActiveArticle(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 24, padding: 0 }}>
              ← Wszystkie kategorie
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <span style={{ fontSize: 24 }}>{activeCat.icon}</span>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{activeCat.title}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeCat.articles.map((art, i) => (
                <div key={i} style={{ borderRadius: 14, border: `1px solid ${activeArticle === i ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)'}`, background: activeArticle === i ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                  <button onClick={() => setActiveArticle(activeArticle === i ? null : i)}
                    style={{ width: '100%', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: activeArticle === i ? '#c7d2fe' : '#e4e4f0' }}>{art.q}</span>
                    <span style={{ color: '#3f3f46', flexShrink: 0, transform: activeArticle === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                  </button>
                  {activeArticle === i && (
                    <div style={{ padding: '0 20px 18px' }}>
                      <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.7, margin: 0 }}>{art.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#3f3f46', margin: 0 }}>© 2026 Cordyn · <a href="/blog" style={{ color: '#52525b', textDecoration: 'none' }}>Blog</a></p>
      </div>
    </div>
  );
}
