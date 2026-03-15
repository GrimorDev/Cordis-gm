// ─────────────────────────────────────────────────────────────────────────────
// Cordyn i18n — Internationalization & Time Format
// Add a new locale: add its code to Locale, add it to LOCALES array,
// and add translations for every key in the T object.
// ─────────────────────────────────────────────────────────────────────────────

export type Locale     = 'pl' | 'en' | 'cs' | 'de';
export type TimeFormat = 'auto' | '12h' | '24h';

export interface LocaleInfo { code: Locale; label: string; flag: string; bcp47: string; }

/** All supported locales. Extend this array to add more languages. */
export const LOCALES: LocaleInfo[] = [
  { code: 'pl', label: 'Polski',   flag: '🇵🇱', bcp47: 'pl-PL' },
  { code: 'en', label: 'English',  flag: '🇬🇧', bcp47: 'en-GB' },
  { code: 'cs', label: 'Čeština', flag: '🇨🇿', bcp47: 'cs-CZ' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪', bcp47: 'de-DE' },
];

/** Detect locale from browser/system language. Falls back to 'pl'. */
export function detectLocale(): Locale {
  const lang = (typeof navigator !== 'undefined' ? navigator.language : 'pl').toLowerCase();
  if (lang.startsWith('pl')) return 'pl';
  if (lang.startsWith('cs')) return 'cs';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('en')) return 'en';
  return 'pl';
}

/** Load saved locale preference from localStorage. Returns null if not set (= use auto-detect). */
export function loadLocale(): { locale: Locale | 'auto'; timeFormat: TimeFormat } {
  try {
    return {
      locale:     (localStorage.getItem('cordyn_locale')      as Locale | 'auto') || 'auto',
      timeFormat: (localStorage.getItem('cordyn_timefmt')     as TimeFormat)       || 'auto',
    };
  } catch { return { locale: 'auto', timeFormat: 'auto' }; }
}

/** Resolve the effective locale (auto → detect). */
export function resolveLocale(pref: Locale | 'auto'): Locale {
  return pref === 'auto' ? detectLocale() : pref;
}

/** BCP-47 tag for Intl APIs. */
export function bcp47(locale: Locale): string {
  return LOCALES.find(l => l.code === locale)?.bcp47 ?? 'pl-PL';
}

// ─── Translation dictionary ───────────────────────────────────────────────────
// Keys are camelCase namespaced strings. Each key maps to a record of Locale→string.
// Add new keys freely; missing keys fall back to 'pl'.

const T: Record<string, Record<Locale, string>> = {
  // ── Navigation ───────────────────────────────────────────────────────────
  'nav.friends':        { pl: 'Znajomi',           en: 'Friends',          cs: 'Přátelé',      de: 'Freunde'          },
  'nav.dms':            { pl: 'Wiadomości',         en: 'Messages',         cs: 'Zprávy',        de: 'Nachrichten'     },
  'nav.dmsTitle':       { pl: 'Wiadomości prywatne',en: 'Direct Messages',  cs: 'Přímé zprávy',  de: 'Direktnachrichten'},
  'nav.dmsEmpty':       { pl: 'Brak wiadomości',    en: 'No messages',      cs: 'Žádné zprávy',  de: 'Keine Nachrichten'},

  // ── Status labels ─────────────────────────────────────────────────────────
  'status.online':      { pl: 'Dostępny',           en: 'Online',           cs: 'Online',        de: 'Online'          },
  'status.idle':        { pl: 'Zaraz wracam',        en: 'Away',             cs: 'Nepřítomen',    de: 'Abwesend'        },
  'status.dnd':         { pl: 'Nie przeszkadzać',    en: 'Do not disturb',   cs: 'Nerušit',       de: 'Nicht stören'    },
  'status.offline':     { pl: 'Offline',             en: 'Offline',          cs: 'Offline',       de: 'Offline'         },
  'status.streaming':   { pl: 'Streamuje',           en: 'Streaming',        cs: 'Streamuje',     de: 'Streamt'         },

  // ── Settings tabs ─────────────────────────────────────────────────────────
  'settings.account':    { pl: 'Konto',              en: 'Account',          cs: 'Účet',          de: 'Konto'           },
  'settings.appearance': { pl: 'Wygląd',             en: 'Appearance',       cs: 'Vzhled',        de: 'Darstellung'     },
  'settings.devices':    { pl: 'Urządzenia',         en: 'Devices',          cs: 'Zařízení',      de: 'Geräte'          },
  'settings.privacy':    { pl: 'Prywatność',         en: 'Privacy',          cs: 'Soukromí',      de: 'Datenschutz'     },
  'settings.locale':     { pl: 'Język i czas',       en: 'Language & Time',  cs: 'Jazyk a čas',   de: 'Sprache & Zeit'  },

  // ── Language & Time section ───────────────────────────────────────────────
  'locale.title':           { pl: 'Język i czas',               en: 'Language & Time',               cs: 'Jazyk a čas',              de: 'Sprache & Zeit'              },
  'locale.language':        { pl: 'Język interfejsu',           en: 'Interface language',             cs: 'Jazyk rozhraní',           de: 'Oberflächensprache'          },
  'locale.language.desc':   { pl: 'Zmień język wyświetlania. "Automatyczny" wykrywa język przeglądarki lub systemu.', en: 'Change the display language. "Automatic" detects your browser or system language.', cs: 'Změňte jazyk zobrazení. "Automaticky" zjistí jazyk prohlížeče nebo systému.', de: 'Wähle die Anzeigesprache. "Automatisch" erkennt die Browser- oder Systemsprache.' },
  'locale.auto':            { pl: '🌐 Automatyczny',            en: '🌐 Automatic',                  cs: '🌐 Automaticky',            de: '🌐 Automatisch'              },
  'locale.auto.detected':   { pl: 'Wykryto:',                   en: 'Detected:',                     cs: 'Zjištěno:',                de: 'Erkannt:'                    },
  'locale.timeformat':      { pl: 'Format czasu',               en: 'Time format',                   cs: 'Formát času',              de: 'Zeitformat'                  },
  'locale.timeformat.desc': { pl: 'Dotyczy wszystkich znaczników czasu w aplikacji.', en: 'Applies to all timestamps in the app.', cs: 'Platí pro všechna časová razítka v aplikaci.', de: 'Gilt für alle Zeitstempel in der App.' },
  'locale.timeformat.auto': { pl: 'Automatyczny (z systemu)',   en: 'Automatic (from system)',        cs: 'Automaticky (ze systému)', de: 'Automatisch (vom System)'    },
  'locale.timeformat.12h':  { pl: '12-godzinny',               en: '12-hour',                       cs: '12hodinový',               de: '12-Stunden'                  },
  'locale.timeformat.24h':  { pl: '24-godzinny',               en: '24-hour',                       cs: '24hodinový',               de: '24-Stunden'                  },
  'locale.preview':         { pl: 'Podgląd',                    en: 'Preview',                       cs: 'Náhled',                   de: 'Vorschau'                    },
  'locale.saved':           { pl: 'Preferencje zapisane',       en: 'Preferences saved',             cs: 'Předvolby uloženy',        de: 'Einstellungen gespeichert'   },

  // ── Common actions ────────────────────────────────────────────────────────
  'action.save':      { pl: 'Zapisz',        en: 'Save',         cs: 'Uložit',      de: 'Speichern'    },
  'action.cancel':    { pl: 'Anuluj',        en: 'Cancel',       cs: 'Zrušit',      de: 'Abbrechen'    },
  'action.delete':    { pl: 'Usuń',          en: 'Delete',       cs: 'Smazat',      de: 'Löschen'      },
  'action.edit':      { pl: 'Edytuj',        en: 'Edit',         cs: 'Upravit',     de: 'Bearbeiten'   },
  'action.add':       { pl: 'Dodaj',         en: 'Add',          cs: 'Přidat',      de: 'Hinzufügen'   },
  'action.send':      { pl: 'Wyślij',        en: 'Send',         cs: 'Odeslat',     de: 'Senden'       },
  'action.logout':    { pl: 'Wyloguj',       en: 'Log out',      cs: 'Odhlásit',    de: 'Abmelden'     },
  'action.confirm':   { pl: 'Potwierdź',     en: 'Confirm',      cs: 'Potvrdit',    de: 'Bestätigen'   },
  'action.search':    { pl: 'Szukaj',        en: 'Search',       cs: 'Hledat',      de: 'Suchen'       },
  'action.back':      { pl: 'Wróć',          en: 'Go back',      cs: 'Zpět',        de: 'Zurück'       },
  'action.show':      { pl: 'Pokaż',         en: 'Show',         cs: 'Zobrazit',    de: 'Anzeigen'     },
  'action.viewAll':   { pl: 'Zobacz wszystkich →', en: 'View all →', cs: 'Zobrazit vše →', de: 'Alle anzeigen →' },

  // ── Friends ───────────────────────────────────────────────────────────────
  'friends.title':          { pl: 'Znajomi',                     en: 'Friends',                  cs: 'Přátelé',                   de: 'Freunde'                     },
  'friends.add':            { pl: 'Dodaj znajomego',             en: 'Add friend',               cs: 'Přidat přítele',            de: 'Freund hinzufügen'           },
  'friends.add.placeholder':{ pl: 'Wpisz dokładną nazwę użytkownika...', en: 'Enter exact username...', cs: 'Zadejte přesné uživatelské jméno...', de: 'Genauen Benutzernamen eingeben...' },
  'friends.all':            { pl: 'Wszyscy znajomi',             en: 'All friends',              cs: 'Všichni přátelé',           de: 'Alle Freunde'                },
  'friends.available':      { pl: 'Dostępni',                    en: 'Available',                cs: 'Dostupní',                  de: 'Verfügbar'                   },
  'friends.incoming':       { pl: 'Przychodzące zaproszenia',    en: 'Incoming requests',        cs: 'Příchozí žádosti',          de: 'Eingehende Anfragen'         },
  'friends.outgoing':       { pl: 'Wysłane zaproszenia',         en: 'Sent requests',            cs: 'Odeslané žádosti',          de: 'Gesendete Anfragen'          },
  'friends.none':           { pl: 'Brak znajomych. Dodaj kogoś powyżej!', en: 'No friends yet. Add someone above!', cs: 'Žádní přátelé. Přidejte někoho výše!', de: 'Noch keine Freunde. Füge jemanden oben hinzu!' },
  'friends.noneAvailable':  { pl: 'Aktualnie żaden z twoich znajomych nie jest dostępny', en: 'None of your friends are currently available', cs: 'Momentálně není žádný z vašich přátel k dispozici', de: 'Derzeit ist keiner deiner Freunde verfügbar' },

  // ── Members ───────────────────────────────────────────────────────────────
  'members.online':  { pl: 'Online',   en: 'Online',   cs: 'Online',   de: 'Online'  },
  'members.offline': { pl: 'Offline',  en: 'Offline',  cs: 'Offline',  de: 'Offline' },

  // ── Date separators ───────────────────────────────────────────────────────
  'date.today':     { pl: 'Dzisiaj',  en: 'Today',     cs: 'Dnes',    de: 'Heute'    },
  'date.yesterday': { pl: 'Wczoraj',  en: 'Yesterday', cs: 'Včera',   de: 'Gestern'  },

  // ── Activity ──────────────────────────────────────────────────────────────
  'activity.title':      { pl: 'Aktywność serwera', en: 'Server activity', cs: 'Aktivita serveru', de: 'Server-Aktivität' },
  'activity.viewMore':   { pl: 'Zobacz więcej',      en: 'View more',       cs: 'Zobrazit více',    de: 'Mehr anzeigen'    },
  'activity.events':     { pl: 'zdarzeń',            en: 'events',          cs: 'událostí',         de: 'Ereignisse'       },
  'activity.streaming':  { pl: 'Streamuje:',         en: 'Streaming:',      cs: 'Streamuje:',       de: 'Streamt:'         },
  'activity.playing':    { pl: 'Gra w',              en: 'Playing',         cs: 'Hraje',            de: 'Spielt'           },

  // ── Stream mode ───────────────────────────────────────────────────────────
  'stream.activated':  { pl: 'Tryb streamu aktywowany — nicki i serwery są ukryte 🎥', en: 'Stream mode activated — nicknames & servers are hidden 🎥', cs: 'Režim streamu aktivován — přezdívky a servery jsou skryty 🎥', de: 'Stream-Modus aktiviert — Nicknames & Server ausgeblendet 🎥' },
  'stream.title':      { pl: 'Jesteś w trybie streamu', en: 'You are in stream mode', cs: 'Jste v režimu streamu', de: 'Du bist im Stream-Modus' },
  'stream.question':   { pl: 'Czy chcesz pokazać publicznie wiadomości z tej rozmowy?', en: 'Do you want to show this conversation publicly?', cs: 'Chcete veřejně zobrazit zprávy z tohoto rozhovoru?', de: 'Möchtest du diese Unterhaltung öffentlich zeigen?' },
  'stream.reveal':     { pl: 'Tak, pokaż', en: 'Yes, show', cs: 'Ano, ukázat', de: 'Ja, anzeigen' },

  // ── Search ────────────────────────────────────────────────────────────────
  'search.placeholder': { pl: 'Szukaj w wiadomościach...', en: 'Search messages...', cs: 'Hledat zprávy...', de: 'Nachrichten durchsuchen...' },

  // ── Notifications ─────────────────────────────────────────────────────────
  'notif.title':       { pl: 'Powiadomienia',                      en: 'Notifications',            cs: 'Oznámení',                    de: 'Benachrichtigungen'           },
  'notif.markAllRead': { pl: 'Oznacz wszystkie jako przeczytane',  en: 'Mark all as read',         cs: 'Označit vše jako přečtené',   de: 'Alle als gelesen markieren'   },
  'notif.empty':       { pl: 'Brak powiadomień',                   en: 'No notifications',         cs: 'Žádná oznámení',              de: 'Keine Benachrichtigungen'     },

  // ── Channels ──────────────────────────────────────────────────────────────
  'channel.text':         { pl: 'kanał tekstowy',       en: 'text channel',       cs: 'textový kanál',        de: 'Textkanal'             },
  'channel.voice':        { pl: 'kanał głosowy',        en: 'voice channel',      cs: 'hlasový kanál',        de: 'Sprachkanal'           },
  'channel.forum':        { pl: 'kanał forum',          en: 'forum channel',      cs: 'fórum kanál',          de: 'Forum-Kanal'           },
  'channel.announcement': { pl: 'kanał ogłoszeniowy',  en: 'announcement channel',cs: 'oznamovací kanál',     de: 'Ankündigungskanal'     },
};

/** Translate a key to the given locale. Falls back to Polish, then the key itself. */
export function translate(key: string, locale: Locale): string {
  return T[key]?.[locale] ?? T[key]?.['pl'] ?? key;
}
