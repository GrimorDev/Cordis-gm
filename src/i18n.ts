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
  'nav.friends':        { pl: 'Znajomi',            en: 'Friends',           cs: 'Přátelé',       de: 'Freunde'           },
  'nav.dms':            { pl: 'Wiadomości',          en: 'Messages',          cs: 'Zprávy',         de: 'Nachrichten'      },
  'nav.dmsTitle':       { pl: 'Wiadomości prywatne', en: 'Direct Messages',   cs: 'Přímé zprávy',   de: 'Direktnachrichten' },
  'nav.dmsEmpty':       { pl: 'Brak wiadomości',     en: 'No messages',       cs: 'Žádné zprávy',   de: 'Keine Nachrichten' },

  // ── Sidebar ───────────────────────────────────────────────────────────────
  'sidebar.voiceRooms': { pl: 'Pokoje głosowe',      en: 'Voice channels',    cs: 'Hlasové kanály', de: 'Sprachkanäle'     },

  // ── Status labels ─────────────────────────────────────────────────────────
  'status.online':      { pl: 'Dostępny',            en: 'Online',            cs: 'Online',         de: 'Online'           },
  'status.online.f':    { pl: 'Dostępna',            en: 'Online',            cs: 'Online',         de: 'Online'           },
  'status.idle':        { pl: 'Zaraz wracam',         en: 'Away',              cs: 'Nepřítomen',     de: 'Abwesend'         },
  'status.dnd':         { pl: 'Nie przeszkadzać',     en: 'Do not disturb',    cs: 'Nerušit',        de: 'Nicht stören'     },
  'status.offline':     { pl: 'Offline',              en: 'Offline',           cs: 'Offline',        de: 'Offline'          },
  'status.streaming':   { pl: 'Streamuje',            en: 'Streaming',         cs: 'Streamuje',      de: 'Streamt'          },
  'status.visible.desc':{ pl: 'Widoczny dla wszystkich', en: 'Visible to everyone', cs: 'Viditelný pro všechny', de: 'Sichtbar für alle' },
  'status.idle.desc':   { pl: 'Chwilowo nieobecny',   en: 'Temporarily away',  cs: 'Dočasně nepřítomen', de: 'Vorübergehend abwesend' },
  'status.dnd.desc':     { pl: 'Wyciszam powiadomienia',       en: 'Silencing notifications',     cs: 'Ztlumit oznámení',              de: 'Benachrichtigungen stummschalten' },
  'status.offline.desc': { pl: 'Wyświetl się jako offline',    en: 'Appear offline',               cs: 'Zobrazit se jako offline',      de: 'Als offline anzeigen'             },
  'status.online.desc':  { pl: 'Widoczny dla wszystkich',      en: 'Visible to everyone',           cs: 'Viditelný pro všechny',         de: 'Sichtbar für alle'                },

  // ── Settings tabs ─────────────────────────────────────────────────────────
  'settings.title':      { pl: 'Ustawienia',          en: 'Settings',          cs: 'Nastavení',      de: 'Einstellungen'    },
  'settings.account':    { pl: 'Konto',               en: 'Account',           cs: 'Účet',           de: 'Konto'            },
  'settings.appearance': { pl: 'Wygląd',              en: 'Appearance',        cs: 'Vzhled',         de: 'Darstellung'      },
  'settings.devices':    { pl: 'Urządzenia',          en: 'Devices',           cs: 'Zařízení',       de: 'Geräte'           },
  'settings.privacy':    { pl: 'Prywatność',          en: 'Privacy',           cs: 'Soukromí',       de: 'Datenschutz'      },
  'settings.locale':     { pl: 'Język i czas',        en: 'Language & Time',   cs: 'Jazyk a čas',    de: 'Sprache & Zeit'   },

  // ── Settings — Account tab ────────────────────────────────────────────────
  'account.title':          { pl: 'Informacje o koncie',     en: 'Account info',          cs: 'Informace o účtu',       de: 'Kontoinformationen'    },
  'account.username':       { pl: 'Nazwa użytkownika',       en: 'Username',              cs: 'Uživatelské jméno',      de: 'Benutzername'          },
  'account.customStatus':   { pl: 'Status niestandardowy',   en: 'Custom status',         cs: 'Vlastní stav',           de: 'Benutzerstatus'        },
  'account.customStatus.ph':{ pl: 'Np. Pracuję, Na przerwie...', en: 'E.g. Working, On break...', cs: 'Např. Pracuji, Na přestávce...', de: 'Z.B. Am arbeiten, Pause...' },
  'account.customStatus.hint':{ pl: 'Ten tekst pojawi się pod Twoją nazwą w pasku bocznym', en: 'This text will appear below your name in the sidebar', cs: 'Tento text se zobrazí pod vaším jménem v postranním panelu', de: 'Dieser Text erscheint unter deinem Namen in der Seitenleiste' },
  'account.bio':            { pl: 'Bio',                      en: 'Bio',                   cs: 'Bio',                    de: 'Bio'                   },
  'account.bio.ph':         { pl: 'Napisz coś o sobie...',   en: 'Write something about yourself...', cs: 'Napište něco o sobě...', de: 'Schreibe etwas über dich...' },
  'account.avatar':         { pl: 'Avatar',                  en: 'Avatar',                cs: 'Avatar',                 de: 'Avatar'                },
  'account.changeAvatar':   { pl: 'Zmień avatar',            en: 'Change avatar',         cs: 'Změnit avatar',          de: 'Avatar ändern'         },
  'account.banner':         { pl: 'Banner profilu',          en: 'Profile banner',        cs: 'Banner profilu',         de: 'Profilbanner'          },
  'account.changeBanner':   { pl: 'Zmień banner',            en: 'Change banner',         cs: 'Změnit banner',          de: 'Banner ändern'         },
  'account.bannerChanged':  { pl: 'Zmieniono (niezapisane)', en: 'Changed (unsaved)',     cs: 'Změněno (neuloženo)',    de: 'Geändert (ungespeichert)' },
  'account.saveChanges':    { pl: 'Zapisz zmiany',           en: 'Save changes',          cs: 'Uložit změny',           de: 'Änderungen speichern' },

  // ── Settings — Appearance tab ─────────────────────────────────────────────
  'appearance.title':           { pl: 'Personalizacja wyglądu',         en: 'Appearance customization',       cs: 'Přizpůsobení vzhledu',           de: 'Darstellung anpassen'          },
  'appearance.accentColor':     { pl: 'Kolor akcentu',                   en: 'Accent color',                   cs: 'Barva zvýraznění',               de: 'Akzentfarbe'                   },
  'appearance.msgDensity':      { pl: 'Gęstość wiadomości',              en: 'Message density',                cs: 'Hustota zpráv',                  de: 'Nachrichtendichte'             },
  'appearance.cozy.label':      { pl: 'Komfortowy',                      en: 'Cozy',                           cs: 'Pohodlný',                       de: 'Komfortabel'                   },
  'appearance.cozy.desc':       { pl: 'Większe odstępy, łatwiejsze czytanie', en: 'More spacing, easier reading', cs: 'Větší mezery, snazší čtení',  de: 'Mehr Abstand, leichteres Lesen' },
  'appearance.compact.label':   { pl: 'Kompaktowy',                      en: 'Compact',                        cs: 'Kompaktní',                      de: 'Kompakt'                       },
  'appearance.compact.desc':    { pl: 'Mniejsze odstępy, więcej wiadomości', en: 'Less spacing, more messages', cs: 'Menší mezery, více zpráv',      de: 'Weniger Abstand, mehr Nachrichten' },
  'appearance.fontSize':        { pl: 'Rozmiar czcionki',                 en: 'Font size',                      cs: 'Velikost písma',                 de: 'Schriftgröße'                  },
  'appearance.fontSize.small':  { pl: 'Mała',                             en: 'Small',                          cs: 'Malé',                           de: 'Klein'                         },
  'appearance.fontSize.normal': { pl: 'Normalna',                         en: 'Normal',                         cs: 'Normální',                       de: 'Normal'                        },
  'appearance.fontSize.large':  { pl: 'Duża',                             en: 'Large',                          cs: 'Velké',                          de: 'Groß'                          },
  'appearance.displayOptions':  { pl: 'Opcje wyświetlania',               en: 'Display options',                cs: 'Možnosti zobrazení',             de: 'Anzeigeoptionen'               },
  'appearance.timestamps.label':{ pl: 'Zawsze pokazuj sygnatury czasowe', en: 'Always show timestamps',         cs: 'Vždy zobrazovat časová razítka', de: 'Zeitstempel immer anzeigen'    },
  'appearance.timestamps.desc': { pl: 'Godzina przy każdej wiadomości widoczna bez najechania', en: 'Time shown next to every message without hovering', cs: 'Čas u každé zprávy viditelný bez najetí myší', de: 'Zeit neben jeder Nachricht ohne Hover sichtbar' },
  'appearance.avatars.label':   { pl: 'Pokaż awatary w czacie',          en: 'Show avatars in chat',           cs: 'Zobrazit avatary v chatu',       de: 'Avatare im Chat anzeigen'      },
  'appearance.avatars.desc':    { pl: 'Zdjęcia profilowe obok wiadomości na kanałach', en: 'Profile pictures next to channel messages', cs: 'Profilové obrázky vedle zpráv na kanálech', de: 'Profilbilder neben Kanalnachrichten' },
  'appearance.animations.label':{ pl: 'Animacje wiadomości',             en: 'Message animations',             cs: 'Animace zpráv',                  de: 'Nachrichtenanimationen'        },
  'appearance.animations.desc': { pl: 'Płynne pojawianie się nowych wiadomości', en: 'Smooth appearance of new messages', cs: 'Plynné zobrazování nových zpráv', de: 'Sanftes Erscheinen neuer Nachrichten' },
  'appearance.linkPreview.label':{ pl: 'Podgląd linków',                 en: 'Link preview',                   cs: 'Náhled odkazů',                  de: 'Link-Vorschau'                 },
  'appearance.linkPreview.desc':{ pl: 'Pokazuj miniatury i opisy dla wklejonych adresów URL', en: 'Show thumbnails and descriptions for pasted URLs', cs: 'Zobrazovat miniatury a popisy pro vložené URL', de: 'Miniaturansichten und Beschreibungen für eingefügte URLs anzeigen' },
  'appearance.streamerMode':    { pl: 'Tryb Streamera',                   en: 'Streamer mode',                  cs: 'Režim streameru',                de: 'Streamer-Modus'                },
  'appearance.streamerMode.desc':{ pl: 'Ukrywa Twoje dane — nickname, avatar i linki zaproszeń są maskowane podczas streamów', en: 'Hides your data — nickname, avatar and invite links are masked during streams', cs: 'Skryje vaše údaje — přezdívka, avatar a pozvánky jsou maskovány při streamování', de: 'Versteckt deine Daten — Nickname, Avatar und Einladungslinks werden beim Streamen maskiert' },
  'appearance.avatarEffects':   { pl: 'Efekty avatara',                   en: 'Avatar effects',                 cs: 'Efekty avatara',                 de: 'Avatar-Effekte'                },
  'appearance.noEffect':        { pl: 'Brak efektu',                      en: 'No effect',                      cs: 'Žádný efekt',                    de: 'Kein Effekt'                   },

  // ── Settings — Devices tab ────────────────────────────────────────────────
  'devices.title':       { pl: 'Urządzenia audio/wideo', en: 'Audio/video devices', cs: 'Zvuková/video zařízení', de: 'Audio-/Videogeräte'   },
  'devices.mic':         { pl: 'Mikrofon',               en: 'Microphone',          cs: 'Mikrofon',               de: 'Mikrofon'             },
  'devices.speakers':    { pl: 'Głośniki',               en: 'Speakers',            cs: 'Reproduktory',           de: 'Lautsprecher'         },
  'devices.camera':      { pl: 'Kamera',                 en: 'Camera',              cs: 'Kamera',                 de: 'Kamera'               },
  'devices.noAccess':    { pl: 'Brak dostępu do urządzeń', en: 'No device access',  cs: 'Žádný přístup k zařízením', de: 'Kein Gerätezugang' },
  'devices.noAccess.desc':{ pl: 'Zezwól przeglądarce na dostęp do mikrofonu, aby zobaczyć urządzenia', en: 'Allow the browser access to your microphone to see devices', cs: 'Povolte prohlížeči přístup k mikrofonu pro zobrazení zařízení', de: 'Erlaube dem Browser Zugriff auf das Mikrofon, um Geräte anzuzeigen' },
  'devices.check':       { pl: 'Sprawdź urządzenia',     en: 'Check devices',       cs: 'Zkontrolovat zařízení',  de: 'Geräte prüfen'       },

  // ── Settings — Privacy tab ────────────────────────────────────────────────
  'privacy.title':                  { pl: 'Prywatność i bezpieczeństwo',        en: 'Privacy & security',                  cs: 'Soukromí a bezpečnost',              de: 'Datenschutz & Sicherheit'           },
  'privacy.statusVisible.label':    { pl: 'Status widoczny dla innych',         en: 'Status visible to others',            cs: 'Stav viditelný pro ostatní',         de: 'Status für andere sichtbar'         },
  'privacy.statusVisible.desc':     { pl: 'Inni widzą czy jesteś online/offline/zaraz wracam', en: 'Others see if you\'re online/offline/away', cs: 'Ostatní vidí, zda jste online/offline/nepřítomen', de: 'Andere sehen ob du online/offline/abwesend bist' },
  'privacy.typing.label':           { pl: 'Podgląd "pisze..."',                 en: 'Typing indicator',                    cs: 'Indikátor psaní',                    de: 'Tipp-Anzeige'                       },
  'privacy.typing.desc':            { pl: 'Inni widzą animację gdy piszesz wiadomość', en: 'Others see animation when you\'re typing', cs: 'Ostatní vidí animaci, když píšete zprávu', de: 'Andere sehen Animation wenn du schreibst' },
  'privacy.readReceipts.label':     { pl: 'Potwierdzenia odczytu',              en: 'Read receipts',                       cs: 'Potvrzení přečtení',                 de: 'Lesebestätigungen'                  },
  'privacy.readReceipts.desc':      { pl: 'Nadawca widzi że przeczytałeś wiadomość prywatną', en: 'Sender sees that you read their DM', cs: 'Odesílatel vidí, že jste přečetli jeho zprávu', de: 'Absender sieht, dass du seine DM gelesen hast' },
  'privacy.friendRequests.label':   { pl: 'Zaproszenia od nieznajomych',        en: 'Friend requests from strangers',      cs: 'Žádosti o přátelství od cizích',     de: 'Freundschaftsanfragen von Fremden'  },
  'privacy.friendRequests.desc':    { pl: 'Osoby spoza twoich serwerów mogą cię zaprosić', en: 'People outside your servers can add you', cs: 'Lidé mimo vaše servery vás mohou přidat', de: 'Personen außerhalb deiner Server können dich hinzufügen' },
  'privacy.dmFromStrangers.label':  { pl: 'Wiadomości prywatne od obcych',      en: 'DMs from strangers',                  cs: 'Zprávy od cizích lidí',              de: 'Direktnachrichten von Fremden'      },
  'privacy.dmFromStrangers.desc':   { pl: 'Osoby niebędące Twoimi znajomymi mogą pisać do Ciebie w DM', en: 'People not in your friends list can DM you', cs: 'Lidé, kteří nejsou vaši přátelé, vám mohou psát do DM', de: 'Personen, die nicht deine Freunde sind, können dir DMs senden' },
  'privacy.2fa.title':              { pl: 'Weryfikacja dwuetapowa (2FA)',        en: 'Two-factor authentication (2FA)',     cs: 'Dvoufaktorové ověření (2FA)',        de: 'Zwei-Faktor-Authentifizierung (2FA)' },
  'privacy.2fa.enabled':            { pl: 'WŁĄCZONE',                           en: 'ENABLED',                             cs: 'ZAPNUTO',                            de: 'AKTIVIERT'                          },
  'privacy.2fa.desc':               { pl: '2FA jest aktywne. Przy logowaniu wymagany będzie kod z aplikacji authenticator (Google Authenticator, Authy).', en: '2FA is active. A code from your authenticator app (Google Authenticator, Authy) will be required when logging in.', cs: '2FA je aktivní. Při přihlášení bude vyžadován kód z aplikace authenticator.', de: '2FA ist aktiv. Beim Anmelden wird ein Code aus deiner Authenticator-App benötigt.' },
  'privacy.2fa.codes':              { pl: 'Masz {n} kodów zapasowych.',         en: 'You have {n} backup codes.',          cs: 'Máte {n} záložních kódů.',           de: 'Du hast {n} Backup-Codes.'          },
  'privacy.2fa.regen':              { pl: 'Regeneruj kody zapasowe',            en: 'Regenerate backup codes',             cs: 'Regenerovat záložní kódy',           de: 'Backup-Codes neu generieren'        },
  'privacy.2fa.disable':            { pl: 'Wyłącz 2FA',                         en: 'Disable 2FA',                         cs: 'Vypnout 2FA',                        de: '2FA deaktivieren'                   },
  'privacy.2fa.enable':             { pl: 'Włącz 2FA',                          en: 'Enable 2FA',                          cs: 'Zapnout 2FA',                        de: '2FA aktivieren'                     },
  'privacy.push.title':             { pl: 'Powiadomienia Push',                 en: 'Push notifications',                  cs: 'Push oznámení',                      de: 'Push-Benachrichtigungen'            },
  'privacy.push.desc':              { pl: 'Otrzymuj powiadomienia push o nowych wiadomościach nawet gdy aplikacja jest w tle lub zamknięta.', en: 'Receive push notifications for new messages even when the app is in the background or closed.', cs: 'Dostávejte push oznámení o nových zprávách i když je aplikace na pozadí nebo zavřená.', de: 'Push-Benachrichtigungen für neue Nachrichten erhalten, auch wenn die App im Hintergrund oder geschlossen ist.' },
  'privacy.push.enable':            { pl: 'Włącz powiadomienia push',           en: 'Enable push notifications',          cs: 'Zapnout push oznámení',              de: 'Push-Benachrichtigungen aktivieren' },
  'privacy.push.enabled':           { pl: 'Push aktywny',                       en: 'Push active',                         cs: 'Push aktivní',                       de: 'Push aktiv'                         },
  'privacy.dangerZone':             { pl: 'Strefa zagrożenia',                  en: 'Danger zone',                         cs: 'Nebezpečná zóna',                    de: 'Gefahrenzone'                       },
  'privacy.dangerZone.desc':        { pl: 'Trwałe akcje których nie można cofnąć', en: 'Permanent actions that cannot be undone', cs: 'Trvalé akce, které nelze vrátit', de: 'Dauerhafte Aktionen, die nicht rückgängig gemacht werden können' },
  'privacy.deleteAccount':          { pl: 'Usuń konto',                         en: 'Delete account',                      cs: 'Smazat účet',                        de: 'Konto löschen'                      },

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
  'action.save':        { pl: 'Zapisz',              en: 'Save',              cs: 'Uložit',            de: 'Speichern'           },
  'action.saveChanges': { pl: 'Zapisz zmiany',       en: 'Save changes',      cs: 'Uložit změny',      de: 'Änderungen speichern'},
  'action.cancel':      { pl: 'Anuluj',              en: 'Cancel',            cs: 'Zrušit',            de: 'Abbrechen'           },
  'action.delete':      { pl: 'Usuń',                en: 'Delete',            cs: 'Smazat',            de: 'Löschen'             },
  'action.edit':        { pl: 'Edytuj',              en: 'Edit',              cs: 'Upravit',           de: 'Bearbeiten'          },
  'action.add':         { pl: 'Dodaj',               en: 'Add',               cs: 'Přidat',            de: 'Hinzufügen'          },
  'action.send':        { pl: 'Wyślij',              en: 'Send',              cs: 'Odeslat',           de: 'Senden'              },
  'action.logout':      { pl: 'Wyloguj',             en: 'Log out',           cs: 'Odhlásit',          de: 'Abmelden'            },
  'action.confirm':     { pl: 'Potwierdź',           en: 'Confirm',           cs: 'Potvrdit',          de: 'Bestätigen'          },
  'action.search':      { pl: 'Szukaj',              en: 'Search',            cs: 'Hledat',            de: 'Suchen'              },
  'action.back':        { pl: 'Wróć',                en: 'Go back',           cs: 'Zpět',              de: 'Zurück'              },
  'action.show':        { pl: 'Pokaż',               en: 'Show',              cs: 'Zobrazit',          de: 'Anzeigen'            },
  'action.viewAll':     { pl: 'Zobacz wszystkich →', en: 'View all →',        cs: 'Zobrazit vše →',    de: 'Alle anzeigen →'     },
  'action.copy':        { pl: 'Skopiuj',             en: 'Copy',              cs: 'Kopírovat',         de: 'Kopieren'            },
  'action.create':      { pl: 'Utwórz',              en: 'Create',            cs: 'Vytvořit',          de: 'Erstellen'           },
  'action.kick':        { pl: 'Wyrzuć',              en: 'Kick',              cs: 'Vyhodit',           de: 'Kicken'              },
  'action.ban':         { pl: 'Zbanuj',              en: 'Ban',               cs: 'Zabanovat',         de: 'Bannen'              },
  'action.unban':       { pl: 'Odbanuj',             en: 'Unban',             cs: 'Odbanovat',         de: 'Entbannen'           },
  'action.accept':      { pl: 'Akceptuj',            en: 'Accept',            cs: 'Přijmout',          de: 'Akzeptieren'         },
  'action.decline':     { pl: 'Odrzuć',              en: 'Decline',           cs: 'Odmítnout',         de: 'Ablehnen'            },

  // ── Friends ───────────────────────────────────────────────────────────────
  'friends.title':           { pl: 'Znajomi',                            en: 'Friends',                          cs: 'Přátelé',                           de: 'Freunde'                            },
  'friends.addSection':      { pl: 'Dodaj znajomego',                   en: 'Add friend',                       cs: 'Přidat přítele',                    de: 'Freund hinzufügen'                  },
  'friends.add':             { pl: 'Dodaj znajomego',                   en: 'Add friend',                       cs: 'Přidat přítele',                    de: 'Freund hinzufügen'                  },
  'friends.add.placeholder': { pl: 'Wpisz dokładną nazwę użytkownika...', en: 'Enter exact username...',        cs: 'Zadejte přesné uživatelské jméno...', de: 'Genauen Benutzernamen eingeben...' },
  'friends.all':             { pl: 'Wszyscy',                            en: 'All',                              cs: 'Všichni',                           de: 'Alle'                               },
  'friends.available':       { pl: 'Dostępni',                           en: 'Available',                        cs: 'Dostupní',                          de: 'Verfügbar'                          },
  'friends.incoming':        { pl: 'Przychodzące zaproszenia',           en: 'Incoming requests',                cs: 'Příchozí žádosti',                  de: 'Eingehende Anfragen'                },
  'friends.outgoing':        { pl: 'Wysłane zaproszenia',                en: 'Sent requests',                    cs: 'Odeslané žádosti',                  de: 'Gesendete Anfragen'                 },
  'friends.none':            { pl: 'Brak znajomych. Dodaj kogoś powyżej!', en: 'No friends yet. Add someone above!', cs: 'Žádní přátelé. Přidejte někoho výše!', de: 'Noch keine Freunde. Füge jemanden oben hinzu!' },
  'friends.noneAvailable':   { pl: 'Aktualnie żaden z twoich znajomych nie jest dostępny', en: 'None of your friends are currently available', cs: 'Momentálně není žádný z vašich přátel k dispozici', de: 'Derzeit ist keiner deiner Freunde verfügbar' },
  'friends.onlineCount':     { pl: 'Znajomi',                            en: 'Friends',                          cs: 'Přátelé',                           de: 'Freunde'                            },
  'friends.dmSection':       { pl: 'Znajomi',                            en: 'Friends',                          cs: 'Přátelé',                           de: 'Freunde'                            },

  // ── Members ───────────────────────────────────────────────────────────────
  'members.online':   { pl: 'Online',   en: 'Online',   cs: 'Online',   de: 'Online'  },
  'members.offline':  { pl: 'Offline',  en: 'Offline',  cs: 'Offline',  de: 'Offline' },

  // ── DM home ───────────────────────────────────────────────────────────────
  'dm.home.subtitle':  { pl: 'Wybierz znajomego, do którego chcesz napisać, lub zaproś nowych znajomych do Cordyna.', en: 'Choose a friend to message, or invite new friends to Cordyn.', cs: 'Vyberte přítele, kterému chcete napsat, nebo pozvěte nové přátele do Cordyn.', de: 'Wähle einen Freund zum Schreiben oder lade neue Freunde zu Cordyn ein.' },

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
  'notif.empty.desc':  { pl: 'Powiadomienia o wzmiankowaniach pojawią się tutaj', en: 'Mention notifications will appear here', cs: 'Oznámení o zmínkách se zobrazí zde', de: 'Erwähnungs-Benachrichtigungen erscheinen hier' },

  // ── Channels / Server ─────────────────────────────────────────────────────
  'channel.text':         { pl: 'kanał tekstowy',       en: 'text channel',        cs: 'textový kanál',       de: 'Textkanal'             },
  'channel.voice':        { pl: 'kanał głosowy',        en: 'voice channel',       cs: 'hlasový kanál',       de: 'Sprachkanal'           },
  'channel.forum':        { pl: 'kanał forum',          en: 'forum channel',       cs: 'fórum kanál',         de: 'Forum-Kanal'           },
  'channel.announcement': { pl: 'kanał ogłoszeniowy',  en: 'announcement channel',cs: 'oznamovací kanál',    de: 'Ankündigungskanal'     },

  // ── Server settings tabs ──────────────────────────────────────────────────
  'serverSettings.title':       { pl: 'Ustawienia serwera', en: 'Server settings',  cs: 'Nastavení serveru',  de: 'Servereinstellungen'   },
  'serverSettings.overview':    { pl: 'Ogólne',             en: 'Overview',         cs: 'Přehled',            de: 'Übersicht'             },
  'serverSettings.roles':       { pl: 'Role',               en: 'Roles',            cs: 'Role',               de: 'Rollen'                },
  'serverSettings.members':     { pl: 'Członkowie',         en: 'Members',          cs: 'Členové',            de: 'Mitglieder'            },
  'serverSettings.bans':        { pl: 'Bany',               en: 'Bans',             cs: 'Zákazy',             de: 'Bans'                  },
  'serverSettings.invites':     { pl: 'Zaproszenia',        en: 'Invites',          cs: 'Pozvánky',           de: 'Einladungen'           },
  'serverSettings.emoji':       { pl: 'Emoji',              en: 'Emoji',            cs: 'Emoji',              de: 'Emoji'                 },
  'serverSettings.automations': { pl: 'Automatyzacje',      en: 'Automations',      cs: 'Automatizace',       de: 'Automatisierungen'     },

  // ── Server actions ────────────────────────────────────────────────────────
  'server.create':           { pl: 'Utwórz serwer',           en: 'Create server',          cs: 'Vytvořit server',          de: 'Server erstellen'         },
  'server.join':             { pl: 'Dołącz do serwera',       en: 'Join server',            cs: 'Připojit se k serveru',    de: 'Server beitreten'         },
  'server.createOrJoin':     { pl: 'Utwórz lub dołącz',       en: 'Create or join',         cs: 'Vytvořit nebo připojit',   de: 'Erstellen oder beitreten' },
  'server.settings':         { pl: 'Ustawienia serwera',      en: 'Server settings',        cs: 'Nastavení serveru',        de: 'Servereinstellungen'      },
  'server.newRule':          { pl: 'Nowa reguła',             en: 'New rule',               cs: 'Nové pravidlo',            de: 'Neue Regel'               },
  'server.newChannel':       { pl: 'Nowy kanał',              en: 'New channel',            cs: 'Nový kanál',               de: 'Neuer Kanal'              },
  'server.newCategory':      { pl: 'Nowa kategoria',          en: 'New category',           cs: 'Nová kategorie',          de: 'Neue Kategorie'           },
  'server.invite':           { pl: 'Zaproś',                  en: 'Invite',                 cs: 'Pozvat',                   de: 'Einladen'                 },
  'server.leave':            { pl: 'Opuść serwer',            en: 'Leave server',           cs: 'Opustit server',          de: 'Server verlassen'         },
  'server.private':          { pl: 'Prywatny',                en: 'Private',                cs: 'Soukromý',                 de: 'Privat'                   },
  'server.private.desc':     { pl: 'Dostępny dla wybranych ról', en: 'Available for selected roles', cs: 'Dostupné pro vybrané role', de: 'Für ausgewählte Rollen verfügbar' },
};

/** Translate a key to the given locale. Falls back to Polish, then the key itself. */
export function translate(key: string, locale: Locale): string {
  return T[key]?.[locale] ?? T[key]?.['pl'] ?? key;
}
