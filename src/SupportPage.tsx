import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface Article  { q: string; a: string; }
interface Category { id: string; title: string; desc: string; articles: Article[]; }

/* ─── Data ────────────────────────────────────────────────────────────────────── */
const CATEGORIES: Category[] = [
  {
    id: 'start',
    title: 'Pierwsze kroki',
    desc: 'Rejestracja, logowanie, pierwsze serwery',
    articles: [
      { q: 'Jak założyć konto?',
        a: 'Wejdź na cordyn.pl i kliknij "Zarejestruj się". Wypełnij formularz: nazwa użytkownika (widoczna dla innych), adres e-mail i hasło minimum 8 znaków. Po wysłaniu formularza zaloguj się — konto jest aktywne od razu.' },
      { q: 'Jak się zalogować?',
        a: 'Wpisz swoją nazwę użytkownika lub adres e-mail i hasło, następnie kliknij "Zaloguj się". Zaznaczenie "Zapamiętaj mnie" zapisuje login w przeglądarce — nie przechowujemy hasła w żadnej formie po Twojej stronie.' },
      { q: 'Jak dołączyć do serwera przez link zaproszenia?',
        a: 'Poproś właściciela lub administratora serwera o link zaproszenia. Po kliknięciu w link zostaniesz automatycznie dodany. Możesz też kliknąć ikonę + w lewym pasku serwerów i wybrać "Dołącz przez link zaproszenia", a następnie wkleić kod.' },
      { q: 'Jak stworzyć własny serwer?',
        a: 'Kliknij ikonę + w lewym pasku z serwerami i wybierz "Utwórz serwer". Wpisz nazwę — serwer jest gotowy w kilka sekund. Możesz od razu tworzyć kanały i zapraszać znajomych przez link zaproszenia.' },
      { q: 'Jak zmienić nazwę użytkownika?',
        a: 'Otwórz Ustawienia klikając ikonę koła zębatego przy swoim avatarze (lewy dolny róg) lub skrótem Ctrl+, . Przejdź do zakładki Konto i zmień nazwę w polu "Nazwa użytkownika". Zapisz zmiany.' },
      { q: 'Jak ustawić lub zmienić avatar?',
        a: 'Ustawienia → Konto → kliknij na okrąg z inicjałami lub aktualnym zdjęciem. Obsługiwane formaty: JPG, PNG, GIF (animowane GIF-y też działają). Maksymalny rozmiar pliku: 8 MB. Zdjęcie jest automatycznie przycinane do kwadratu.' },
    ],
  },
  {
    id: 'messages',
    title: 'Wiadomości i czat',
    desc: 'Wysyłanie, edycja, formatowanie, pliki',
    articles: [
      { q: 'Jak wysłać wiadomość?',
        a: 'Kliknij w pole tekstowe na dole ekranu i wpisz treść. Enter wysyła wiadomość. Shift+Enter tworzy nową linię bez wysyłania. Możesz też wkleić zdjęcie ze schowka (Ctrl+V) lub przeciągnąć plik bezpośrednio na okno czatu.' },
      { q: 'Jak edytować swoją wiadomość?',
        a: 'Najedź na wiadomość — po prawej pojawi się pasek narzędzi z ikoną ołówka. Kliknij ją, aby edytować. Szybszy sposób: gdy pole tekstowe jest puste, naciśnij strzałkę w górę (↑) — otworzy edycję ostatniej wiadomości. Zatwierdź Enterem lub anuluj Escape.' },
      { q: 'Jak usunąć wiadomość?',
        a: 'Najedź na swoją wiadomość → kliknij ikonę kosza w pasku narzędzi. Potwierdź usunięcie. Administratorzy i moderatorzy serwera mogą usuwać wiadomości innych użytkowników. Usuniętych wiadomości nie można odzyskać.' },
      { q: 'Jak formatować tekst (Markdown)?',
        a: 'Cordyn obsługuje Markdown: **pogrubienie** (dwie gwiazdki), _kursywa_ (podkreślnik), ~~przekreślenie~~ (dwie tyldy), `kod inline` (grawis), ```blok kodu``` (trzy grawiisy), > cytat (znak większości). Możesz też zaznaczyć tekst i użyć Ctrl+B (bold) lub Ctrl+I (italic).' },
      { q: 'Jaki jest limit znaków w wiadomości?',
        a: 'Jedna wiadomość może mieć maksymalnie 2000 znaków. Gdy zostanie Ci mniej niż 200 znaków, w prawym dolnym rogu pola tekstowego pojawi się licznik (np. "150"). Jeśli potrzebujesz wysłać dłuższy tekst, wyślij go w kilku wiadomościach.' },
      { q: 'Jak wgrać plik lub zdjęcie?',
        a: 'Kliknij ikonę spinacza obok pola tekstowego i wybierz plik, wklej ze schowka (Ctrl+V) lub przeciągnij plik na okno czatu. Maksymalny rozmiar: 50 MB na plik. Obsługiwane obrazy: JPG, PNG, GIF, WebP — wyświetlają się w podglądzie bezpośrednio w wiadomości.' },
      { q: 'Jak dodać reakcję na wiadomość?',
        a: 'Najedź na wiadomość — po prawej pojawi się ikona buźki. Kliknij ją i wybierz emoji z listy. Aby dołączyć istniejącą reakcję pod wiadomością, po prostu na nią kliknij. Kliknij ponownie tę samą reakcję, żeby ją cofnąć.' },
    ],
  },
  {
    id: 'dms',
    title: 'Wiadomości prywatne',
    desc: 'DM, znajomi, blokowanie',
    articles: [
      { q: 'Jak wysłać prywatną wiadomość (DM)?',
        a: 'Kliknij na avatar lub nick dowolnego użytkownika (w liście serwerowej, w czacie lub na liście online) i wybierz "Wyślij wiadomość". Otworzy się okno czatu prywatnego. Możesz też przejść do sekcji DM przez ikonę wiadomości w lewym pasku.' },
      { q: 'Gdzie znajdę moje prywatne rozmowy?',
        a: 'Kliknij logo Cordyn w lewym górnym rogu lub w ikonę wiadomości w pasku serwerów — przeniesie Cię do widoku wiadomości bezpośrednich. Wszystkie aktywne rozmowy są tam na liście po lewej stronie.' },
      { q: 'Jak dodać kogoś do znajomych?',
        a: 'Kliknij na profil użytkownika i wybierz "Dodaj do znajomych". Osoba otrzyma powiadomienie i musi zaakceptować zaproszenie. Możesz też otworzyć listę znajomych w sekcji DM i kliknąć "Dodaj znajomego" wpisując nazwę użytkownika.' },
      { q: 'Jak zablokować użytkownika?',
        a: 'Kliknij na profil użytkownika → Zablokuj. Zablokowane osoby nie mogą wysyłać Ci prywatnych wiadomości, nie widzą Twojego statusu online i nie mogą wysyłać Ci zaproszeń do znajomych. Możesz odblokować w Ustawieniach → Prywatność → Zablokowane.' },
      { q: 'Jak usunąć konwersację DM?',
        a: 'Najedź na rozmowę w liście DM → kliknij ikonę X lub zamknij rozmowę. Usunięcie z Twojego widoku nie usuwa wiadomości po stronie drugiej osoby. Historia wróci jeśli znowu napiszesz do tej osoby.' },
    ],
  },
  {
    id: 'voice',
    title: 'Kanały głosowe',
    desc: 'Rozmowy, screen share, mikrofon',
    articles: [
      { q: 'Jak dołączyć do kanału głosowego?',
        a: 'Kliknij na nazwę kanału z ikoną głośnika w liście kanałów serwera. Zostaniesz automatycznie połączony — nie ma żadnych dodatkowych okien ani potwierdzeń. Na dole ekranu pojawi się pasek kontrolny z przyciskami mikrofonu i głośnika.' },
      { q: 'Jak wyciszyć mikrofon lub słuchawki?',
        a: 'W pasku kontrolnym na dole ekranu kliknij ikonę mikrofonu żeby go wyciszyć (mute) — Twój głos nie będzie słyszany przez innych. Ikona słuchawek wycisza odbiór — nie będziesz słyszeć innych. Ikony zaznaczone przekreśloną linią oznaczają że funkcja jest aktywna.' },
      { q: 'Jak opuścić kanał głosowy?',
        a: 'Kliknij czerwony przycisk z ikoną telefonu w pasku kontrolnym na dole ekranu. Możesz też kliknąć na ten sam kanał głosowy ponownie — to rozłączy Cię z rozmowy.' },
      { q: 'Jak udostępnić ekran (screen share)?',
        a: 'W trakcie rozmowy głosowej kliknij ikonę monitora w pasku kontrolnym. Przeglądarka zapyta o pozwolenie i pokaże okno wyboru: cały pulpit, konkretne okno aplikacji lub karta przeglądarki. Jakość transmisji zależy od prędkości Twojego łącza internetowego.' },
      { q: 'Mikrofon nie jest słyszany przez innych — jak naprawić?',
        a: 'Sprawdź uprawnienia mikrofonu: kliknij ikonę kłódki przy adresie strony w przeglądarce → Mikrofon → Zezwól. Upewnij się że w systemie operacyjnym (Windows: Ustawienia → Prywatność → Mikrofon, macOS: Preferencje systemowe → Zabezpieczenia → Mikrofon) przeglądarka ma dostęp. Sprawdź też czy wybrany jest właściwy mikrofon w ustawieniach systemu.' },
      { q: 'Dźwięk jest przerywany lub nie ma głosu z rozmowy',
        a: 'Sprawdź czy masz wyciszone głośniki/słuchawki (ikona słuchawek w pasku — przekreślona to wyciszone). Upewnij się że właściwe urządzenie audio jest ustawione jako domyślne w systemie. Słabe połączenie internetowe może powodować przerwy — sprawdź ping lub spróbuj zmienić sieć.' },
    ],
  },
  {
    id: 'account',
    title: 'Ustawienia konta',
    desc: 'Profil, wygląd, bezpieczeństwo',
    articles: [
      { q: 'Jak otworzyć ustawienia?',
        a: 'Kliknij ikonę koła zębatego (⚙) przy swoim avatarze w lewym dolnym rogu ekranu, albo użyj skrótu klawiszowego Ctrl+, (przecinek). Ustawienia otworzą się jako modal na całym ekranie z zakładkami po lewej.' },
      { q: 'Jak zmienić hasło?',
        a: 'Ustawienia → zakładka Konto → sekcja Hasło. Wpisz aktualne hasło dla potwierdzenia, a następnie nowe hasło (minimum 8 znaków). Kliknij "Zapisz". Po zmianie hasła aktywne sesje na innych urządzeniach zostaną wylogowane.' },
      { q: 'Jak ustawić lub zmienić swój status?',
        a: 'Kliknij na swój avatar w lewym dolnym rogu. Pojawi się menu ze statusami: Dostępny (zielona kropka), Nieobecny/Away (żółta), Nie przeszkadzać (czerwona — wycisza powiadomienia), Niewidoczny (szara — jesteś online, ale wyglądasz jak offline).' },
      { q: 'Jak zmienić język interfejsu?',
        a: 'Ustawienia → zakładka Wygląd → sekcja Język. Dostępne języki: Polski, English, Čeština, Deutsch. Po wybraniu języka interfejs zmieni się natychmiast bez potrzeby odświeżania strony.' },
      { q: 'Co to jest tryb kompaktowy?',
        a: 'Ustawienia → Wygląd → Tryb kompaktowy. Po włączeniu: kanały w liście mają wysokość 24px zamiast standardowych 32px, ikony są ukryte — widać tylko nazwy. Przydatne na małych ekranach lub gdy masz dużo kanałów. Ustawienie jest zapisywane lokalnie w przeglądarce.' },
      { q: 'Gdzie znajdę swoje statystyki?',
        a: 'Ustawienia → zakładka Statystyki. Zobaczysz: łączną liczbę wysłanych wiadomości, wiadomości w ostatnich 30 dniach, wysłane DM, liczbę serwerów na których jesteś, liczbę znajomych, oddane i otrzymane reakcje oraz datę założenia konta.' },
      { q: 'Jak się wylogować?',
        a: 'Kliknij na swój avatar w lewym dolnym rogu → Wyloguj. Sesja na tym urządzeniu zostanie zakończona. Przy kolejnym wejściu będziesz musiał się zalogować ponownie. Jeśli zaznaczałeś "Zapamiętaj mnie", login (nie hasło) może być wypełniony automatycznie.' },
    ],
  },
  {
    id: 'servers',
    title: 'Zarządzanie serwerem',
    desc: 'Kanały, role, zaproszenia, moderacja',
    articles: [
      { q: 'Jak otworzyć ustawienia serwera?',
        a: 'Kliknij na nazwę serwera na górze listy kanałów — pojawi się menu kontekstowe z opcjami serwera. Właściciele i administratorzy zobaczą tam opcje zarządzania: kanały, role, zaproszenia, ustawienia.' },
      { q: 'Jak stworzyć kanał tekstowy lub głosowy?',
        a: 'Kliknij ikonę + obok nagłówka kategorii kanałów w lewym pasku. Wybierz typ kanału: Tekstowy (wiadomości pisane) lub Głosowy (rozmowy audio/wideo). Wpisz nazwę — zawiera tylko małe litery i myślniki (spacje zamieniane są automatycznie). Zapisz.' },
      { q: 'Jak tworzyć kategorie kanałów?',
        a: 'W menu serwera → Utwórz kategorię. Kategorie grupują kanały tematycznie (np. OGÓLNE, GAMING, PRACA). Kanały możesz przeciągać między kategoriami. Kategorie też można ukrywać klikając na ich nazwę — zwijają wszystkie kanały pod spodem.' },
      { q: 'Jak wygenerować link zaproszenia?',
        a: 'Kliknij prawym przyciskiem na ikonę serwera lub użyj menu serwera → Zaproś użytkowników. Skopiuj wygenerowany link i wyślij znajomemu. Domyślnie link jest bezterminowy i wielokrotnego użytku — jeśli chcesz go ograniczyć, skontaktuj się z administratorem.' },
      { q: 'Jak zarządzać rolami użytkowników?',
        a: 'Role serwerowe pozwalają nadawać użytkownikom uprawnienia (np. zarządzanie kanałami, kickowanie). Utwórz role w ustawieniach serwera → Role. Następnie kliknij na profil użytkownika na serwerze → Zarządzaj rolami → przypisz lub odbierz rolę z listy.' },
      { q: 'Jak wyrzucić (kick) lub zbanować użytkownika?',
        a: 'Kliknij prawym przyciskiem na nick użytkownika na liście członków lub w czacie. Opcja Kick usuwa go z serwera — może wrócić przez nowe zaproszenie. Opcja Zbanuj blokuje możliwość wejścia permanentnie. Obie wymagają uprawnień moderatora lub wyższych.' },
      { q: 'Jak zmienić ikonę lub nazwę serwera?',
        a: 'Menu serwera → Ustawienia serwera → zakładka Ogólne. Możesz zmienić nazwę serwera i wgrać ikonę (JPG, PNG, GIF, maks. 8 MB). Zmiany są widoczne dla wszystkich członków od razu.' },
    ],
  },
  {
    id: 'notifications',
    title: 'Powiadomienia',
    desc: 'Powiadomienia, wyciszanie, DND',
    articles: [
      { q: 'Jak włączyć powiadomienia przeglądarkowe?',
        a: 'Cordyn prosi o zgodę na powiadomienia przy pierwszym uruchomieniu. Jeśli kliknąłeś "Blokuj" — możesz to zmienić: kliknij ikonę kłódki przy adresie strony w przeglądarce → Powiadomienia → Zezwól. Na Chrome/Edge: Ustawienia → Prywatność → Powiadomienia → dodaj cordyn.pl jako wyjątek.' },
      { q: 'Jak wyciszyć cały serwer?',
        a: 'Kliknij prawym przyciskiem myszy na ikonę serwera w lewym pasku → Wycisz serwer. Wybierz czas: 15 min, 1h, 8h, 24h lub Do odwołania. Wyciszony serwer nie generuje żadnych powiadomień dźwiękowych ani wizualnych (brak czerwonej kropki/licznika).' },
      { q: 'Jak wyciszyć konkretny kanał?',
        a: 'Kliknij prawym przyciskiem na nazwę kanału w lewym pasku → Wycisz kanał. Powiadomienia z tego kanału będą zablokowane, ale nadal możesz go przeglądać. Wyciszony kanał jest oznaczony inaczej na liście — jego nazwa jest przyciemniona.' },
      { q: 'Co to jest tryb Nie przeszkadzać?',
        a: 'Kliknij swój avatar w lewym dolnym rogu → Nie przeszkadzać. Status zmienia się na czerwony. Wszystkie powiadomienia dźwiękowe i wyskakujące są wstrzymane — nie usłyszysz i nie zobaczysz powiadomień dopóki nie zmienisz statusu. Wiadomości nadal przychodzą — zobaczysz je po powrocie.' },
      { q: 'Dlaczego nie dostaję powiadomień mimo uprawnień?',
        a: 'Sprawdź: (1) czy masz włączony tryb Nie przeszkadzać — wtedy powiadomienia są wstrzymane; (2) czy serwer lub kanał nie jest wyciszony; (3) czy przeglądarka jest aktywna — wiele przeglądarek ogranicza powiadomienia gdy karta jest w tle lub minimalizowana. W systemie Windows sprawdź też Ustawienia → System → Powiadomienia i upewnij się że przeglądarka ma zezwolenie.' },
    ],
  },
  {
    id: 'technical',
    title: 'Problemy techniczne',
    desc: 'Błędy połączenia, wydajność, pliki',
    articles: [
      { q: 'Pojawia się komunikat "Brak połączenia" — co robić?',
        a: 'Aplikacja straciła połączenie z serwerem. Sprawdź czy masz dostęp do internetu (spróbuj otworzyć inną stronę). Cordyn automatycznie próbuje się ponownie połączyć co kilka sekund — poczekaj chwilę i powinno wrócić. Jeśli problem trwa ponad kilka minut, sprawdź status platformy na cordyn.pl/stats.' },
      { q: 'Strona lub aplikacja działa bardzo wolno',
        a: 'Spróbuj odświeżyć: Ctrl+R (lub F5). Wyczyść pamięć podręczną przeglądarki: Ctrl+Shift+Del → zaznacz "Pliki w pamięci podręcznej i cookies" → Wyczyść dane. Jeśli masz otwartych wiele kart Cordyn zamknij zbędne. Włącz Tryb kompaktowy w Ustawieniach → Wygląd — zmniejsza obciążenie renderowania.' },
      { q: 'Wiadomości się nie wysyłają',
        a: 'Upewnij się że nie masz komunikatu "Brak połączenia" na górze. Sprawdź czy masz uprawnienia do pisania w tym kanale — jeśli pole tekstowe jest zablokowane lub szare oznacza to brak uprawnień. Spróbuj odświeżyć stronę i wysłać ponownie.' },
      { q: 'Nie mogę wgrać pliku — pojawia się błąd',
        a: 'Sprawdź: (1) rozmiar pliku — limit to 50 MB; (2) format — obsługiwane: JPG, PNG, GIF, WebP dla obrazów; MP4, WebM dla wideo; PDF, ZIP, TXT i inne dla dokumentów; (3) połączenie internetowe — duże pliki wymagają stabilnego łącza. Jeśli pojawia się błąd uprawnień — nie masz prawa wgrywania plików na tym kanale.' },
      { q: 'Obrazy/filmy nie wyświetlają się w wiadomościach',
        a: 'Odśwież stronę (Ctrl+R). Jeśli problem dotyczy obrazów zewnętrznych (linki) sprawdź czy serwis zewnętrzny działa. Jeśli wgrane pliki z Cordyn nie ładują się, sprawdź status platformy na cordyn.pl/stats — może trwać przerwa techniczna lub maintenance.' },
      { q: 'Aplikacja desktopowa (Windows/macOS) nie uruchamia się',
        a: 'Spróbuj uruchomić jako administrator (Windows: prawy klik → Uruchom jako administrator). Jeśli to nie pomaga, odinstaluj aplikację i pobierz najnowszą wersję z cordyn.pl. Możesz też używać pełnej wersji przez przeglądarkę — działa identycznie jak aplikacja desktopowa.' },
      { q: 'Nie widzę serwera ani kanału mimo że dołączyłem',
        a: 'Odśwież stronę (F5). Jeśli serwer nadal nie jest widoczny sprawdź skrzynkę odbiorczą DM — właściciel mógł Cię usunąć. Jeśli kanał zniknął wewnątrz serwera, administrator mógł zmienić uprawnienia lub usunąć kanał. Skontaktuj się z właścicielem serwera.' },
    ],
  },
];

/* ─── Category colors ─────────────────────────────────────────────────────────── */
const CAT_COLORS: Record<string, string> = {
  start:         '#6366f1',
  messages:      '#8b5cf6',
  dms:           '#06b6d4',
  voice:         '#0ea5e9',
  account:       '#10b981',
  servers:       '#f59e0b',
  notifications: '#f97316',
  technical:     '#ef4444',
};

/* ─── Category SVG icons ──────────────────────────────────────────────────────── */
function CatIcon({ id, size = 22, color }: { id: string; size?: number; color: string }) {
  const s = { width: size, height: size, display: 'block', color } as React.CSSProperties;
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: s };
  switch (id) {
    case 'start': return (
      <svg {...props}>
        <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1M3 9V3h6M10 10 3.9 3.9"/>
      </svg>
    );
    case 'messages': return (
      <svg {...props}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    );
    case 'dms': return (
      <svg {...props}>
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
    );
    case 'voice': return (
      <svg {...props}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
      </svg>
    );
    case 'account': return (
      <svg {...props}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    );
    case 'servers': return (
      <svg {...props}>
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
        <line x1="6" y1="6" x2="6.01" y2="6"/>
        <line x1="6" y1="18" x2="6.01" y2="18"/>
      </svg>
    );
    case 'notifications': return (
      <svg {...props}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    );
    case 'technical': return (
      <svg {...props}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    );
    default: return null;
  }
}

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
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/* ─── Main component ──────────────────────────────────────────────────────────── */
export default function SupportPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeArticle,  setActiveArticle]  = useState<number | null>(null);
  const [search, setSearch]                 = useState('');
  const [hc, setHc]                         = useState(() => localStorage.getItem('cordyn_hc') === '1');
  const heroRef                             = useRef<HTMLDivElement>(null);
  const { scrollY }                         = useScroll();
  const heroOpacity                         = useTransform(scrollY, [0, 320], [1, 0]);
  const heroY                               = useTransform(scrollY, [0, 320], [0, -60]);

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

  // ── Theme ────────────────────────────────────────────────────────────────────
  const bg          = hc ? '#000'                       : '#09090f';
  const textPrimary = hc ? '#fff'                       : '#e4e4f0';
  const textMuted   = hc ? '#d1d5db'                    : '#71717a';
  const textDim     = hc ? '#9ca3af'                    : '#52525b';
  const cardBg      = hc ? 'rgba(255,255,255,0.06)'     : 'rgba(255,255,255,0.025)';
  const cardBorder  = hc ? 'rgba(255,255,255,0.18)'     : 'rgba(255,255,255,0.07)';
  const accent      = hc ? '#818cf8'                    : '#6366f1';
  const inputBg     = hc ? 'rgba(255,255,255,0.1)'      : 'rgba(255,255,255,0.05)';

  return (
    <div style={{ minHeight: '100vh', background: bg, color: textPrimary,
      fontFamily: 'Geist, system-ui, sans-serif', overflowX: 'hidden' }}>

      <GalaxyBackground hc={hc}/>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: `1px solid ${cardBorder}`,
          background: hc ? 'rgba(0,0,0,0.95)' : 'rgba(9,9,15,0.85)', backdropFilter: 'blur(20px)' }}
      >
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 28px', height: 58,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/cordyn_logo.png" alt="Cordyn" style={{ width: 28, height: 28, borderRadius: 8 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
            <span style={{ color: textPrimary, fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Cordyn</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 15, margin: '0 2px' }}>/</span>
            <span style={{ color: accent, fontWeight: 600, fontSize: 14 }}>Centrum pomocy</span>
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/blog" style={{ padding: '7px 16px', borderRadius: 10, background: cardBg,
              border: `1px solid ${cardBorder}`, color: textMuted, fontSize: 13,
              fontWeight: 500, textDecoration: 'none' }}>Blog</a>
            <a href="/" style={{ padding: '7px 16px', borderRadius: 10, background: accent,
              color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Otwórz Cordyn</a>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div ref={heroRef} style={{ position: 'relative', overflow: 'hidden', paddingBottom: 24 }}>
        <AuroraBackground />
        <motion.div style={{ opacity: heroOpacity, y: heroY, position: 'relative', zIndex: 2,
          padding: '80px 28px 56px', textAlign: 'center', maxWidth: 680, margin: '0 auto' }}>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.14em',
              textTransform: 'uppercase', marginBottom: 16 }}>
            Centrum pomocy
          </motion.p>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontSize: 48, fontWeight: 900, color: textPrimary, margin: '0 0 16px',
              letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Jak możemy{' '}
            <span style={{ background: `linear-gradient(135deg, ${accent}, #a78bfa)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              pomóc?
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.5 }}
            style={{ fontSize: 17, color: textMuted, margin: '0 0 40px', lineHeight: 1.6 }}>
            Odpowiedzi na najczęstsze pytania o Cordyn
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.34, duration: 0.5 }}
            style={{ position: 'relative', maxWidth: 560, margin: '0 auto' }}>
            <svg style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', color: textDim }} width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search}
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
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 28px 100px' }}>

        {/* Search results */}
        <AnimatePresence mode="wait">
          {filtered && (
            <motion.div key="search-results"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
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
                        setActiveCategory(a.catId);
                        setActiveArticle(CATEGORIES.find(c => c.id === a.catId)!.articles.findIndex(ar => ar.q === a.q));
                      }}
                      whileHover={{ scale: 1.005 }}
                      style={{ padding: '20px 24px', borderRadius: 18, background: cardBg,
                        border: `1px solid ${cardBorder}`, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <CatIcon id={a.catId} size={14} color={CAT_COLORS[a.catId] || accent}/>
                        <p style={{ fontSize: 11, color: CAT_COLORS[a.catId] || accent, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{a.cat}</p>
                      </div>
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
            <motion.div key="cat-grid"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
              <motion.div variants={staggerContainer} initial="hidden" animate="show"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
                {CATEGORIES.map(cat => {
                  const color = CAT_COLORS[cat.id] || accent;
                  return (
                    <motion.button key={cat.id} variants={fadeUp}
                      onClick={() => setActiveCategory(cat.id)}
                      whileHover={{ scale: 1.025, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      style={{ padding: '26px 22px', borderRadius: 20, background: cardBg,
                        border: `1px solid ${cardBorder}`, cursor: 'pointer', textAlign: 'left',
                        transition: 'border-color 0.2s, background 0.2s', position: 'relative', overflow: 'hidden' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}45`; e.currentTarget.style.background = `${color}09`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = cardBorder; e.currentTarget.style.background = cardBg; }}
                    >
                      {/* corner glow */}
                      <div style={{ position: 'absolute', top: -24, left: -24, width: 110, height: 110,
                        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`, pointerEvents: 'none' }}/>

                      {/* icon with colored bg pill */}
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: `${color}18`,
                        border: `1px solid ${color}28`, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', marginBottom: 18 }}>
                        <CatIcon id={cat.id} size={20} color={color}/>
                      </div>

                      <p style={{ fontSize: 15, fontWeight: 700, color: textPrimary, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{cat.title}</p>
                      <p style={{ fontSize: 13, color: textMuted, margin: '0 0 16px', lineHeight: 1.5 }}>{cat.desc}</p>
                      <p style={{ fontSize: 12, color: color, fontWeight: 600 }}>{cat.articles.length} artykułów →</p>
                    </motion.button>
                  );
                })}
              </motion.div>

              {/* Status strip */}
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                style={{ marginTop: 44, padding: '24px 28px', borderRadius: 20, background: cardBg,
                  border: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: textPrimary, margin: '0 0 4px' }}>Nie znalazłeś odpowiedzi?</p>
                  <p style={{ fontSize: 13, color: textMuted, margin: 0 }}>Sprawdź status platformy lub zgłoś problem przez Cordyn</p>
                </div>
                <a href="/stats" style={{ padding: '10px 20px', borderRadius: 12,
                  background: `${accent}18`, border: `1px solid ${accent}30`,
                  color: accent, fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                  Status platformy →
                </a>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category detail */}
        <AnimatePresence mode="wait">
          {!filtered && activeCat && (
            <motion.div key={`cat-${activeCat.id}`}
              initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>

              <motion.button onClick={() => { setActiveCategory(null); setActiveArticle(null); }}
                whileHover={{ x: -3 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent',
                  border: 'none', color: accent, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  marginBottom: 32, padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Wszystkie kategorie
              </motion.button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16,
                  background: `${CAT_COLORS[activeCat.id] || accent}18`,
                  border: `1px solid ${CAT_COLORS[activeCat.id] || accent}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CatIcon id={activeCat.id} size={24} color={CAT_COLORS[activeCat.id] || accent}/>
                </div>
                <div>
                  <h2 style={{ fontSize: 26, fontWeight: 800, color: textPrimary,
                    margin: '0 0 4px', letterSpacing: '-0.02em' }}>{activeCat.title}</h2>
                  <p style={{ fontSize: 14, color: textMuted, margin: 0 }}>{activeCat.desc}</p>
                </div>
              </div>

              <motion.div variants={staggerContainer} initial="hidden" animate="show"
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeCat.articles.map((art, i) => {
                  const isOpen = activeArticle === i;
                  const color  = CAT_COLORS[activeCat.id] || accent;
                  return (
                    <motion.div key={i} variants={fadeUp}
                      style={{ borderRadius: 18, border: `1px solid ${isOpen ? `${color}30` : cardBorder}`,
                        background: isOpen ? `${color}06` : cardBg, overflow: 'hidden',
                        transition: 'border-color 0.2s, background 0.2s' }}>
                      <button onClick={() => setActiveArticle(isOpen ? null : i)}
                        style={{ width: '100%', padding: '20px 24px', display: 'flex',
                          justifyContent: 'space-between', alignItems: 'center', gap: 16,
                          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4,
                          color: isOpen ? '#c7d2fe' : textPrimary }}>{art.q}</span>
                        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}
                          style={{ color: textDim, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </motion.span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                            style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '4px 24px 24px' }}>
                              <div style={{ height: 1, background: cardBorder, marginBottom: 18, opacity: 0.6 }}/>
                              <p style={{ fontSize: 15, color: textMuted, lineHeight: 1.8, margin: 0 }}>{art.a}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.45 }}
                style={{ marginTop: 40, padding: '22px 26px', borderRadius: 18, background: cardBg,
                  border: `1px solid ${cardBorder}`, display: 'flex', gap: 16,
                  alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: textPrimary, margin: '0 0 4px' }}>Potrzebujesz więcej pomocy?</p>
                  <p style={{ fontSize: 13, color: textMuted, margin: 0 }}>Wróć do wszystkich kategorii lub sprawdź status platformy</p>
                </div>
                <button onClick={() => { setActiveCategory(null); setActiveArticle(null); }}
                  style={{ padding: '9px 18px', borderRadius: 12, background: `${accent}18`,
                    border: `1px solid ${accent}30`, color: accent, fontSize: 13,
                    fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  Wszystkie kategorie
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <motion.footer initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
        viewport={{ once: true }} transition={{ duration: 0.5 }}
        style={{ borderTop: `1px solid ${cardBorder}`, padding: '28px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: textDim, margin: 0 }}>
          © 2026 Cordyn ·{' '}
          <a href="/blog" style={{ color: textDim, textDecoration: 'none' }}>Blog</a>
          {' · '}
          <a href="/stats" style={{ color: textDim, textDecoration: 'none' }}>Status</a>
        </p>
      </motion.footer>

      {/* ── High-contrast toggle ─────────────────────────────────────────────── */}
      <motion.button onClick={toggleHc}
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.45, type: 'spring', bounce: 0.3 }}
        whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.95 }}
        title={hc ? 'Wyłącz wysoki kontrast' : 'Włącz wysoki kontrast'}
        style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 100,
          padding: '10px 18px', borderRadius: 999,
          background: hc ? 'rgba(255,255,255,0.12)' : 'rgba(20,20,30,0.75)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          border: `1px solid ${hc ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
          color: hc ? '#fff' : '#a1a1aa', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7,
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)', letterSpacing: '0.02em' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
