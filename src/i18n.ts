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

  // ── Settings sidebar groups ───────────────────────────────────────────────
  'settings.group.account':  { pl: 'KONTO UŻYTKOWNIKA',        en: 'USER ACCOUNT',            cs: 'UŽIVATELSKÝ ÚČET',          de: 'BENUTZERKONTO'             },
  'settings.group.app':      { pl: 'APLIKACJA',                en: 'APP',                     cs: 'APLIKACE',                  de: 'APP'                       },
  'settings.section.profile':{ pl: 'Profil',                   en: 'Profile',                 cs: 'Profil',                    de: 'Profil'                    },
  'settings.section.info':   { pl: 'Informacje',               en: 'Information',             cs: 'Informace',                 de: 'Informationen'             },
  'settings.section.password':{ pl: 'Hasło & bezpieczeństwo',  en: 'Password & security',     cs: 'Heslo & bezpečnost',        de: 'Passwort & Sicherheit'     },
  'settings.section.sessions':{ pl: 'Aktywne sesje',           en: 'Active sessions',         cs: 'Aktivní relace',            de: 'Aktive Sitzungen'          },
  'settings.section.chat':   { pl: 'Czat',                     en: 'Chat',                    cs: 'Chat',                      de: 'Chat'                      },
  'settings.section.profileEffects':{ pl: 'Profil i efekty',  en: 'Profile & effects',       cs: 'Profil a efekty',           de: 'Profil & Effekte'          },
  'settings.section.cardEffect':{ pl: 'Efekt karty',           en: 'Card effect',             cs: 'Efekt karty',               de: 'Karteneffekt'              },
  'settings.section.input':  { pl: 'Wejście',                  en: 'Input',                   cs: 'Vstup',                     de: 'Eingabe'                   },
  'settings.section.output': { pl: 'Wyjście',                  en: 'Output',                  cs: 'Výstup',                    de: 'Ausgabe'                   },
  'settings.section.status': { pl: 'Status',                   en: 'Status',                  cs: 'Stav',                      de: 'Status'                    },
  'settings.section.messages':{ pl: 'Wiadomości',              en: 'Messages',                cs: 'Zprávy',                    de: 'Nachrichten'               },
  'settings.section.blocked':{ pl: 'Zablokowane konta',        en: 'Blocked accounts',        cs: 'Blokované účty',            de: 'Gesperrte Konten'          },
  'settings.theme':          { pl: 'Motyw',                    en: 'Theme',                   cs: 'Téma',                      de: 'Thema'                     },
  'settings.connections':    { pl: 'Połączone konta',          en: 'Connected accounts',      cs: 'Propojené účty',            de: 'Verknüpfte Konten'         },
  'settings.desktop':        { pl: 'Aplikacja',                en: 'Application',             cs: 'Aplikace',                  de: 'Anwendung'                 },
  'settings.updates':        { pl: 'Aktualizacje',             en: 'Updates',                 cs: 'Aktualizace',               de: 'Aktualisierungen'          },
  'settings.about':          { pl: 'O aplikacji',              en: 'About',                   cs: 'O aplikaci',                de: 'Über die App'              },
  'settings.chatAndAppearance':{ pl: 'Czat i wygląd',          en: 'Chat & appearance',       cs: 'Chat a vzhled',             de: 'Chat & Aussehen'           },

  // ── Password section ──────────────────────────────────────────────────────
  'password.current':        { pl: 'Obecne hasło',             en: 'Current password',        cs: 'Aktuální heslo',            de: 'Aktuelles Passwort'        },
  'password.new':            { pl: 'Nowe hasło',               en: 'New password',            cs: 'Nové heslo',                de: 'Neues Passwort'            },
  'password.confirm':        { pl: 'Potwierdź nowe hasło',     en: 'Confirm new password',    cs: 'Potvrďte nové heslo',       de: 'Neues Passwort bestätigen' },
  'password.change':         { pl: 'Zmień hasło',              en: 'Change password',         cs: 'Změnit heslo',              de: 'Passwort ändern'           },
  'password.mismatch':       { pl: 'Hasła nie pasują do siebie', en: 'Passwords do not match', cs: 'Hesla se neshodují',       de: 'Passwörter stimmen nicht überein' },
  'password.tooShort':       { pl: 'Nowe hasło musi mieć min. 8 znaków', en: 'New password must be at least 8 characters', cs: 'Nové heslo musí mít alespoň 8 znaků', de: 'Neues Passwort muss mindestens 8 Zeichen haben' },
  'password.changed':        { pl: 'Hasło zmienione pomyślnie', en: 'Password changed successfully', cs: 'Heslo úspěšně změněno', de: 'Passwort erfolgreich geändert' },
  'password.error':          { pl: 'Błąd zmiany hasła',        en: 'Error changing password', cs: 'Chyba při změně hesla',     de: 'Fehler beim Ändern des Passworts' },

  // ── Sessions section ──────────────────────────────────────────────────────
  'sessions.desc':           { pl: 'Oto wszystkie urządzenia, które są obecnie zalogowane na Twoje konto. Możesz wylogować każde z tych urządzeń pojedynczo lub wszystkie na raz.', en: 'These are all devices currently logged into your account. You can log out each device individually or all at once.', cs: 'Toto jsou všechna zařízení aktuálně přihlášená k vašemu účtu. Každé zařízení můžete odhlásit jednotlivě nebo všechna najednou.', de: 'Dies sind alle Geräte, die derzeit in deinem Konto angemeldet sind. Du kannst jedes Gerät einzeln oder alle auf einmal abmelden.' },
  'sessions.unknown':        { pl: 'Jeśli widzisz wpis, którego nie rozpoznajesz, natychmiast wyloguj się z urządzenia i zmień hasło.', en: 'If you see an entry you don\'t recognize, immediately log out of that device and change your password.', cs: 'Pokud vidíte záznam, který neznáte, okamžitě se z tohoto zařízení odhlaste a změňte heslo.', de: 'Wenn du einen Eintrag siehst, den du nicht erkennst, melde dich sofort von diesem Gerät ab und ändere dein Passwort.' },
  'sessions.loading':        { pl: 'Ładowanie sesji…',          en: 'Loading sessions…',       cs: 'Načítání relací…',           de: 'Sitzungen werden geladen…' },
  'sessions.none':           { pl: 'Brak aktywnych sesji.',     en: 'No active sessions.',     cs: 'Žádné aktivní relace.',      de: 'Keine aktiven Sitzungen.'  },
  'sessions.currentDevice':  { pl: 'Bieżące urządzenie',        en: 'Current device',          cs: 'Aktuální zařízení',          de: 'Aktuelles Gerät'           },
  'sessions.otherDevices':   { pl: 'Inne urządzenia',           en: 'Other devices',           cs: 'Jiná zařízení',              de: 'Andere Geräte'             },
  'sessions.activeNow':      { pl: 'Aktywna teraz',             en: 'Active now',              cs: 'Aktivní nyní',               de: 'Jetzt aktiv'               },
  'sessions.lessThanHour':   { pl: 'mniej niż godzinę temu',    en: 'less than an hour ago',   cs: 'méně než hodinu',            de: 'vor weniger als einer Stunde' },
  'sessions.hoursAgo':       { pl: 'godz. temu',                en: 'h. ago',                  cs: 'hod. zpět',                  de: 'Std. zuvor'                },
  'sessions.daysAgo':        { pl: 'dni temu',                  en: 'days ago',                cs: 'dní zpět',                   de: 'Tage zuvor'                },
  'sessions.unknownOs':      { pl: 'Nieznany system',           en: 'Unknown OS',              cs: 'Neznámý systém',             de: 'Unbekanntes OS'            },
  'sessions.unknownBrowser': { pl: 'Przeglądarka',              en: 'Browser',                 cs: 'Prohlížeč',                  de: 'Browser'                   },
  'sessions.unknownIp':      { pl: 'Nieznany IP',               en: 'Unknown IP',              cs: 'Neznámá IP',                 de: 'Unbekannte IP'             },
  'sessions.revokeAll.title':{ pl: 'Wyloguj się na wszystkich znanych urządzeniach', en: 'Log out of all known devices', cs: 'Odhlásit ze všech známých zařízení', de: 'Von allen bekannten Geräten abmelden' },
  'sessions.revokeAll.desc': { pl: 'Będzie trzeba ponownie zalogować się na wszystkich wylogowanych urządzeniach.', en: 'You will need to log in again on all logged-out devices.', cs: 'Na všech odhlášených zařízeních se budete muset znovu přihlásit.', de: 'Du musst dich auf allen abgemeldeten Geräten erneut anmelden.' },
  'sessions.revokeAll.btn':  { pl: 'Wyloguj wszystkie znane urządzenia', en: 'Log out all known devices', cs: 'Odhlásit všechna známá zařízení', de: 'Alle bekannten Geräte abmelden' },
  'sessions.revoked':        { pl: 'Sesja wylogowana',           en: 'Session logged out',      cs: 'Relace odhlášena',           de: 'Sitzung abgemeldet'        },
  'sessions.revokeError':    { pl: 'Błąd wylogowania sesji',     en: 'Error logging out session', cs: 'Chyba odhlášení relace',  de: 'Fehler beim Abmelden der Sitzung' },
  'sessions.revokedAll':     { pl: 'Wylogowano ze wszystkich innych urządzeń', en: 'Logged out of all other devices', cs: 'Odhlášeno ze všech ostatních zařízení', de: 'Von allen anderen Geräten abgemeldet' },
  'sessions.revokeAllError': { pl: 'Błąd wylogowania',          en: 'Logout error',            cs: 'Chyba odhlášení',            de: 'Abmeldefehler'             },

  // ── User dropdown menu ────────────────────────────────────────────────────
  'menu.settings':           { pl: 'Ustawienia',               en: 'Settings',                cs: 'Nastavení',                  de: 'Einstellungen'             },
  'menu.bookmarks':          { pl: 'Zapisane',                 en: 'Bookmarks',               cs: 'Záložky',                    de: 'Lesezeichen'               },
  'menu.focusMode':          { pl: 'Focus Mode',               en: 'Focus Mode',              cs: 'Režim soustředění',          de: 'Fokusmodus'                },
  'menu.streamMode':         { pl: 'Tryb streamu',             en: 'Stream mode',             cs: 'Režim streamu',              de: 'Stream-Modus'              },
  'menu.adminPanel':         { pl: 'Panel admina',             en: 'Admin panel',             cs: 'Administrátorský panel',     de: 'Admin-Panel'               },
  'menu.downloadWindows':    { pl: 'Pobierz na Windows',       en: 'Download for Windows',    cs: 'Stáhnout pro Windows',       de: 'Für Windows herunterladen' },
  'menu.downloadMacos':      { pl: 'Pobierz na macOS',         en: 'Download for macOS',      cs: 'Stáhnout pro macOS',         de: 'Für macOS herunterladen'   },
  'menu.downloadDesktop':    { pl: 'Pobierz aplikację',        en: 'Download app',            cs: 'Stáhnout aplikaci',          de: 'App herunterladen'         },

  // ── HoverCard / Profile panel ─────────────────────────────────────────────
  'profile.aboutMe':         { pl: 'O mnie',                   en: 'About me',                cs: 'O mně',                      de: 'Über mich'                 },
  'profile.joinedAt':        { pl: 'Dołączył/a',               en: 'Joined',                  cs: 'Připojil/a se',              de: 'Beigetreten'               },
  'profile.mutualServers':   { pl: 'Wspólne serwery',          en: 'Mutual servers',          cs: 'Společné servery',           de: 'Gemeinsame Server'         },
  'profile.mutualFriends':   { pl: 'Wspólni znajomi',          en: 'Mutual friends',          cs: 'Společní přátelé',           de: 'Gemeinsame Freunde'        },
  'profile.privateNote':     { pl: 'Prywatna notatka',         en: 'Private note',            cs: 'Soukromá poznámka',          de: 'Private Notiz'             },
  'profile.addNote':         { pl: 'Dodaj notatkę o tej osobie...', en: 'Add a note about this person...', cs: 'Přidejte poznámku o této osobě...', de: 'Notiz zu dieser Person hinzufügen...' },
  'profile.viewFull':        { pl: 'Wyświetl pełny profil',    en: 'View full profile',       cs: 'Zobrazit celý profil',       de: 'Vollständiges Profil anzeigen' },
  'profile.goToProfile':     { pl: 'Przejdź do profilu →',     en: 'Go to profile →',         cs: 'Přejít na profil →',         de: 'Zum Profil →'              },
  'profile.message':         { pl: 'Wiadomość',                en: 'Message',                 cs: 'Zpráva',                     de: 'Nachricht'                 },
  'profile.voiceCall':       { pl: 'Połączenie głosowe',       en: 'Voice call',              cs: 'Hlasový hovor',              de: 'Sprachanruf'               },
  'profile.listeningSpotify':{ pl: 'Słucha Spotify',           en: 'Listening to Spotify',    cs: 'Poslouchá Spotify',          de: 'Hört Spotify'              },
  'profile.watchingTwitch':  { pl: 'NA ŻYWO',                  en: 'LIVE',                    cs: 'ŽIVĚ',                       de: 'LIVE'                      },
  'profile.viewers':         { pl: 'widzów',                   en: 'viewers',                 cs: 'diváků',                     de: 'Zuschauer'                 },
  'profile.playingNow':      { pl: 'Gra teraz',                en: 'Playing now',             cs: 'Hraje nyní',                 de: 'Spielt gerade'             },
  'profile.playingSince':    { pl: 'Grasz od',                 en: 'Playing for',             cs: 'Hraje od',                   de: 'Spielt seit'               },
  'profile.favoriteGames':   { pl: 'Ulubione gry',             en: 'Favorite games',          cs: 'Oblíbené hry',               de: 'Lieblingsspiele'           },
  'profile.myFavoriteGames': { pl: 'Moje ulubione gry',        en: 'My favorite games',       cs: 'Moje oblíbené hry',          de: 'Meine Lieblingsspiele'     },

  // ── Friends page ──────────────────────────────────────────────────────────
  'friends.availableCount':  { pl: 'Dostępni —',               en: 'Available —',             cs: 'Dostupní —',                 de: 'Verfügbar —'               },

  // ── Auth screen ───────────────────────────────────────────────────────────
  'auth.platform':           { pl: 'Platforma dla twórców i społeczności', en: 'Platform for creators and communities', cs: 'Platforma pro tvůrce a komunity', de: 'Plattform für Ersteller und Gemeinschaften' },
  'auth.login':              { pl: 'Logowanie',                en: 'Login',                   cs: 'Přihlášení',                 de: 'Anmeldung'                 },
  'auth.register':           { pl: 'Rejestracja',              en: 'Registration',            cs: 'Registrace',                 de: 'Registrierung'             },
  'auth.rememberMe':         { pl: 'Zapamiętaj mnie',          en: 'Remember me',             cs: 'Zapamatovat mě',             de: 'Angemeldet bleiben'        },
  'auth.loginBtn':           { pl: 'Zaloguj się →',            en: 'Log in →',                cs: 'Přihlásit se →',             de: 'Anmelden →'                },
  'auth.loggingIn':          { pl: 'Logowanie...',             en: 'Logging in...',           cs: 'Přihlašování...',            de: 'Anmeldung läuft...'        },
  'auth.sendCode':           { pl: 'Wyślij kod weryfikacyjny →', en: 'Send verification code →', cs: 'Odeslat ověřovací kód →', de: 'Bestätigungscode senden →' },
  'auth.sendingCode':        { pl: 'Wysyłanie kodu...',        en: 'Sending code...',         cs: 'Odesílání kódu...',          de: 'Code wird gesendet...'     },
  'auth.codeSentTo':         { pl: 'Kod wysłany na:',          en: 'Code sent to:',           cs: 'Kód odeslán na:',            de: 'Code gesendet an:'         },
  'auth.checkEmail':         { pl: 'Sprawdź skrzynkę mailową · Ważny przez 15 minut', en: 'Check your inbox · Valid for 15 minutes', cs: 'Zkontrolujte doručenou poštu · Platí 15 minut', de: 'Posteingang prüfen · Gültig für 15 Minuten' },
  'auth.registerBtn':        { pl: 'Zarejestruj się →',        en: 'Register →',              cs: 'Registrovat se →',           de: 'Registrieren →'            },
  'auth.creatingAccount':    { pl: 'Tworzenie konta...',       en: 'Creating account...',     cs: 'Vytváření účtu...',          de: 'Konto wird erstellt...'    },
  'auth.switchToRegister':   { pl: 'Zarejestruj się',          en: 'Register',                cs: 'Registrovat se',             de: 'Registrieren'              },
  'auth.switchToLogin':      { pl: 'Zaloguj się',              en: 'Log in',                  cs: 'Přihlásit se',               de: 'Anmelden'                  },
  'auth.loginToJoin':        { pl: 'Zaloguj się, aby dołączyć do serwera', en: 'Log in to join the server', cs: 'Přihlaste se pro připojení k serveru', de: 'Anmelden, um dem Server beizutreten' },
  'auth.loginToAccount':     { pl: 'Zaloguj się na swoje konto', en: 'Log in to your account', cs: 'Přihlaste se k účtu',      de: 'Bei deinem Konto anmelden' },
  'auth.username':           { pl: 'Nazwa użytkownika',        en: 'Username',                cs: 'Uživatelské jméno',          de: 'Benutzername'              },
  'auth.password':           { pl: 'Hasło',                    en: 'Password',                cs: 'Heslo',                      de: 'Passwort'                  },
  'auth.confirmPassword':    { pl: 'Potwierdź hasło',          en: 'Confirm password',        cs: 'Potvrďte heslo',             de: 'Passwort bestätigen'       },
  'auth.verify':             { pl: 'Zatwierdź',                en: 'Verify',                  cs: 'Potvrdit',                   de: 'Bestätigen'                },
  'auth.verifying':          { pl: 'Weryfikacja...',           en: 'Verifying...',            cs: 'Ověřování...',               de: 'Wird überprüft...'         },
  'auth.back':               { pl: '← Wróć',                  en: '← Back',                  cs: '← Zpět',                     de: '← Zurück'                  },
  'auth.communication':      { pl: 'Komunikacja dla każdego',  en: 'Communication for everyone', cs: 'Komunikace pro každého', de: 'Kommunikation für alle'    },
  'auth.downloadApp':        { pl: 'Pobierz aplikację Cordyn', en: 'Download Cordyn app',     cs: 'Stáhnout aplikaci Cordyn',   de: 'Cordyn-App herunterladen'  },
  'auth.freeRegister':       { pl: 'Zarejestruj się za darmo', en: 'Register for free',       cs: 'Registrovat se zdarma',      de: 'Kostenlos registrieren'    },
  'auth.copyright':          { pl: '© 2025 Cordyn. Wszelkie prawa zastrzeżone.', en: '© 2025 Cordyn. All rights reserved.', cs: '© 2025 Cordyn. Všechna práva vyhrazena.', de: '© 2025 Cordyn. Alle Rechte vorbehalten.' },
  'auth.security':           { pl: 'Bezpieczeństwo',           en: 'Security',                cs: 'Bezpečnost',                 de: 'Sicherheit'                },
  'auth.features':           { pl: 'Funkcje',                  en: 'Features',                cs: 'Funkce',                     de: 'Funktionen'                },
  'auth.integrations':       { pl: 'Integracje',               en: 'Integrations',            cs: 'Integrace',                  de: 'Integrationen'             },
  'auth.securityDesc':       { pl: 'Bezpieczeństwo to u nas priorytet. Każde konto jest chronione wieloma warstwami zabezpieczeń — możesz korzystać z Cordyna bez obaw.', en: 'Security is our priority. Every account is protected by multiple layers of security — you can use Cordyn without worry.', cs: 'Bezpečnost je naší prioritou. Každý účet je chráněn více vrstvami zabezpečení — Cordyn můžete používat bez obav.', de: 'Sicherheit hat bei uns Priorität. Jedes Konto ist durch mehrere Sicherheitsebenen geschützt — du kannst Cordyn sorglos nutzen.' },
  'auth.authenticatorApps':  { pl: 'Obsługiwane aplikacje authenticator', en: 'Supported authenticator apps', cs: 'Podporované ověřovací aplikace', de: 'Unterstützte Authenticator-Apps' },
  'auth.accountReady':       { pl: 'Twoje konto jest gotowe. Oto kilka wskazówek na start:', en: 'Your account is ready. Here are a few tips to get started:', cs: 'Váš účet je připraven. Zde je několik tipů pro začátek:', de: 'Dein Konto ist bereit. Hier sind einige Tipps für den Einstieg:' },
  'auth.2faLabel':           { pl: 'Bezpieczeństwo',           en: 'Security',                cs: 'Bezpečnost',                 de: 'Sicherheit'                },

  // ── Onboarding features list ──────────────────────────────────────────────
  'onboard.messages':        { pl: 'Wiadomości & kanały głosowe', en: 'Messages & voice channels', cs: 'Zprávy a hlasové kanály', de: 'Nachrichten & Sprachkanäle' },
  'onboard.messages.desc':   { pl: 'Dołącz do serwera lub napisz do znajomego — tekst, głos i wideo w jednym miejscu.', en: 'Join a server or message a friend — text, voice and video all in one place.', cs: 'Připojte se k serveru nebo napište příteli — text, hlas a video na jednom místě.', de: 'Tritt einem Server bei oder schreibe einem Freund — Text, Sprache und Video an einem Ort.' },
  'onboard.friends':         { pl: 'Znajomi & zaproszenia',    en: 'Friends & invites',       cs: 'Přátelé a pozvánky',         de: 'Freunde & Einladungen'     },
  'onboard.friends.desc':    { pl: 'Wyszukaj znajomych po nazwie użytkownika i zaproś ich — ikona 👤 w pasku bocznym.', en: 'Search for friends by username and invite them — 👤 icon in the sidebar.', cs: 'Vyhledejte přátele podle uživatelského jména a pozvěte je — ikona 👤 v postranním panelu.', de: 'Suche Freunde nach Benutzernamen und lade sie ein — 👤 Symbol in der Seitenleiste.' },
  'onboard.server':          { pl: 'Stwórz własny serwer',     en: 'Create your own server',  cs: 'Vytvořte vlastní server',    de: 'Eigenen Server erstellen'  },
  'onboard.server.desc':     { pl: 'Kliknij „+" w pasku serwerów, nadaj nazwę i zaproś ludzi kodem zaproszenia.', en: 'Click "+" in the server bar, give it a name and invite people with an invite code.', cs: 'Klikněte na „+" v liště serverů, pojmenujte jej a pozvěte lidi pozvacím kódem.', de: 'Klicke auf „+" in der Server-Leiste, gib ihm einen Namen und lade Leute mit einem Einladungscode ein.' },
  'onboard.profile':         { pl: 'Dostosuj profil',          en: 'Customize profile',       cs: 'Přizpůsobit profil',         de: 'Profil anpassen'           },
  'onboard.profile.desc':    { pl: 'Zmień avatar, baner, bio i status — ikonka ⚙️ przy swoim niku na dole.', en: 'Change avatar, banner, bio and status — ⚙️ icon next to your name at the bottom.', cs: 'Změňte avatar, banner, bio a stav — ikona ⚙️ u vašeho nicku ve spodní části.', de: 'Ändere Avatar, Banner, Bio und Status — ⚙️ Symbol neben deinem Namen unten.' },

  // ── DM panel tabs & media ─────────────────────────────────────────────────
  'dm.noMedia':              { pl: 'Brak zdjęć ani filmów',    en: 'No photos or videos',     cs: 'Žádné fotky ani videa',      de: 'Keine Fotos oder Videos'   },
  'dm.noLinks':              { pl: 'Brak udostępnionych linków', en: 'No shared links',       cs: 'Žádné sdílené odkazy',       de: 'Keine geteilten Links'     },

  // ── General UI strings ────────────────────────────────────────────────────
  'ui.loading':              { pl: 'Ładowanie...',              en: 'Loading...',              cs: 'Načítání...',                de: 'Laden...'                  },
  'ui.loadingDots':          { pl: 'Ładowanie…',               en: 'Loading…',                cs: 'Načítání…',                  de: 'Laden…'                    },
  'ui.collectingData':       { pl: 'Zbieranie danych…',        en: 'Collecting data…',        cs: 'Sběr dat…',                  de: 'Daten werden gesammelt…'   },
  'ui.noResults':            { pl: 'Brak wyników',             en: 'No results',              cs: 'Žádné výsledky',             de: 'Keine Ergebnisse'          },
  'ui.noResultsFor':         { pl: 'Brak wyników dla',         en: 'No results for',          cs: 'Žádné výsledky pro',         de: 'Keine Ergebnisse für'      },
  'ui.searchGifs':           { pl: 'Szukaj GIF-ów…',           en: 'Search GIFs…',            cs: 'Hledat GIFy…',               de: 'GIFs suchen…'              },
  'ui.preview':              { pl: 'Podgląd',                  en: 'Preview',                 cs: 'Náhled',                     de: 'Vorschau'                  },
  'ui.collapse':             { pl: 'Zwiń',                     en: 'Collapse',                cs: 'Sbalit',                     de: 'Einklappen'                },
  'ui.downloading':          { pl: 'Pobieranie…',              en: 'Downloading…',            cs: 'Stahování…',                 de: 'Herunterladen…'            },
  'ui.clickToDownload':      { pl: 'Kliknij aby pobrać',       en: 'Click to download',       cs: 'Klikněte pro stažení',       de: 'Zum Herunterladen klicken' },
  'ui.openOrDownload':       { pl: 'Otwórz lub pobierz',       en: 'Open or download',        cs: 'Otevřít nebo stáhnout',      de: 'Öffnen oder herunterladen' },
  'ui.fileTooLarge':         { pl: 'plik jest za długi, pobierz aby zobaczyć całość', en: 'file is too large, download to see all', cs: 'soubor je příliš velký, stáhněte pro zobrazení celku', de: 'Datei zu groß, herunterladen um alles zu sehen' },
  'ui.downloading2':         { pl: 'Pobieranie:', en: 'Downloading:', cs: 'Stahování:', de: 'Herunterladen:' },

  // ── Channel sidebar (server browser overlay) ──────────────────────────────
  'channel.textChannels':    { pl: 'Kanały tekstowe',           en: 'Text channels',           cs: 'Textové kanály',             de: 'Textkanäle'                },
  'channel.voiceChannels':   { pl: 'Głosowe',                   en: 'Voice',                   cs: 'Hlasové',                    de: 'Sprache'                   },
  'channel.writeMessage':    { pl: 'Napisz wiadomość...',       en: 'Write a message...',      cs: 'Napište zprávu...',           de: 'Nachricht schreiben...'    },
  'channel.announcementOnly':{ pl: 'To jest kanał ogłoszeń. Tylko administratorzy mogą tutaj pisać.', en: 'This is an announcement channel. Only administrators can post here.', cs: 'Toto je oznamovací kanál. Pouze administrátoři zde mohou psát.', de: 'Dies ist ein Ankündigungskanal. Nur Administratoren können hier schreiben.' },
  'channel.noPermission':    { pl: 'Nie masz uprawnień do wysyłania wiadomości na tym kanale.', en: 'You do not have permission to send messages in this channel.', cs: 'Nemáte oprávnění posílat zprávy v tomto kanálu.', de: 'Du hast keine Berechtigung, Nachrichten in diesem Kanal zu senden.' },
  'channel.userBlocked':     { pl: 'Zablokowałeś(-aś) tego użytkownika. Odblokuj, aby wysyłać wiadomości.', en: 'You have blocked this user. Unblock to send messages.', cs: 'Zablokovali jste tohoto uživatele. Odblokujte pro posílání zpráv.', de: 'Du hast diesen Nutzer blockiert. Entsperre ihn, um Nachrichten zu senden.' },

  // ── Toast messages ────────────────────────────────────────────────────────
  'toast.profileUpdated':    { pl: 'Profil zaktualizowany',     en: 'Profile updated',         cs: 'Profil aktualizován',        de: 'Profil aktualisiert'       },
  'toast.privacySaved':      { pl: 'Ustawienia prywatności zapisane', en: 'Privacy settings saved', cs: 'Nastavení soukromí uloženo', de: 'Datenschutzeinstellungen gespeichert' },
  'toast.settingsSaved':     { pl: 'Ustawienia serwera zapisane', en: 'Server settings saved', cs: 'Nastavení serveru uloženo',   de: 'Servereinstellungen gespeichert' },
  'toast.leftServer':        { pl: 'Opuściłeś serwer',          en: 'You left the server',     cs: 'Opustili jste server',       de: 'Du hast den Server verlassen' },
  'toast.serverDeleted':     { pl: 'Serwer został usunięty',    en: 'Server was deleted',      cs: 'Server byl smazán',          de: 'Server wurde gelöscht'     },
  'toast.friendRemoved':     { pl: 'Usunięto ze znajomych',     en: 'Removed from friends',    cs: 'Odebráno z přátel',          de: 'Aus Freunden entfernt'     },
  'toast.saveError':         { pl: 'Błąd zapisu',               en: 'Save error',              cs: 'Chyba uložení',              de: 'Speicherfehler'            },
  'toast.invalidInvite':     { pl: 'Nieprawidłowe zaproszenie', en: 'Invalid invite',          cs: 'Neplatná pozvánka',          de: 'Ungültige Einladung'       },
  'toast.streamModeOn':      { pl: '🌙 Focus Mode włączony — dźwięki wyciszone', en: '🌙 Focus Mode on — sounds muted', cs: '🌙 Režim soustředění zapnut — zvuky ztlumeny', de: '🌙 Fokusmodus an — Töne stummgeschaltet' },
  'toast.streamModeOff':     { pl: '🔔 Focus Mode wyłączony',   en: '🔔 Focus Mode off',       cs: '🔔 Režim soustředění vypnut', de: '🔔 Fokusmodus aus'          },
  'toast.cannotShareAudio':  { pl: 'Udostępnianie dźwięku systemu niedostępne na tej platformie', en: 'System audio sharing not available on this platform', cs: 'Sdílení zvuku systému není na této platformě dostupné', de: 'System-Audio-Freigabe ist auf dieser Plattform nicht verfügbar' },
  'toast.cannotShareScreen': { pl: 'Nie można udostępnić ekranu', en: 'Cannot share screen',  cs: 'Nelze sdílet obrazovku',     de: 'Bildschirm kann nicht geteilt werden' },
  'toast.connectionError':   { pl: 'Problem z połączeniem głosowym — sprawdź konsolę przeglądarki (F12)', en: 'Voice connection issue — check browser console (F12)', cs: 'Problém s hlasovým připojením — zkontrolujte konzolu prohlížeče (F12)', de: 'Probleme mit Sprachverbindung — Browserkonsole prüfen (F12)' },
  'toast.layoutChanged':     { pl: 'Układ wiadomości zmieniony', en: 'Message layout changed', cs: 'Rozvržení zpráv změněno',    de: 'Nachrichtenlayout geändert' },

  // ── Connections section ───────────────────────────────────────────────────
  'connections.title':       { pl: 'Połączone konta',           en: 'Connected accounts',      cs: 'Propojené účty',             de: 'Verknüpfte Konten'         },
  'connections.authorizeInBrowser':{ pl: 'Autoryzuj w przeglądarce — aplikacja automatycznie wykryje połączenie', en: 'Authorize in browser — app will automatically detect connection', cs: 'Autorizujte v prohlížeči — aplikace automaticky detekuje připojení', de: 'Im Browser autorisieren — App erkennt Verbindung automatisch' },
  'connections.spotifyOk':   { pl: 'Spotify połączono pomyślnie! 🎵', en: 'Spotify connected successfully! 🎵', cs: 'Spotify úspěšně připojeno! 🎵', de: 'Spotify erfolgreich verbunden! 🎵' },
  'connections.spotifyErr':  { pl: 'Błąd połączenia Spotify — sprawdź czy konto jest aktywne', en: 'Spotify connection error — check if account is active', cs: 'Chyba připojení Spotify — zkontrolujte aktivitu účtu', de: 'Spotify-Verbindungsfehler — prüfe ob Konto aktiv ist' },
  'connections.twitchOk':    { pl: 'Twitch połączono pomyślnie! 🎮', en: 'Twitch connected successfully! 🎮', cs: 'Twitch úspěšně připojeno! 🎮', de: 'Twitch erfolgreich verbunden! 🎮' },
  'connections.twitchErr':   { pl: 'Błąd połączenia Twitch',    en: 'Twitch connection error',  cs: 'Chyba připojení Twitch',     de: 'Twitch-Verbindungsfehler'  },
  'connections.steamOk':     { pl: 'Steam połączono pomyślnie! 🎮', en: 'Steam connected successfully! 🎮', cs: 'Steam úspěšně připojeno! 🎮', de: 'Steam erfolgreich verbunden! 🎮' },
  'connections.steamErr':    { pl: 'Błąd połączenia Steam',     en: 'Steam connection error',   cs: 'Chyba připojení Steam',      de: 'Steam-Verbindungsfehler'   },
  'connections.youtubeOk':   { pl: 'YouTube połączono pomyślnie! 📺', en: 'YouTube connected successfully! 📺', cs: 'YouTube úspěšně připojeno! 📺', de: 'YouTube erfolgreich verbunden! 📺' },
  'connections.youtubeErr':  { pl: 'Błąd połączenia YouTube',   en: 'YouTube connection error', cs: 'Chyba připojení YouTube',    de: 'YouTube-Verbindungsfehler' },
  'connections.kickOk':      { pl: 'Kick połączono pomyślnie! 🟢', en: 'Kick connected successfully! 🟢', cs: 'Kick úspěšně připojeno! 🟢', de: 'Kick erfolgreich verbunden! 🟢' },
  'connections.kickErr':     { pl: 'Błąd połączenia Kick',      en: 'Kick connection error',    cs: 'Chyba připojení Kick',       de: 'Kick-Verbindungsfehler'    },
  'connections.spotifyOk2':  { pl: 'Spotify połączono! 🎵',     en: 'Spotify connected! 🎵',    cs: 'Spotify připojeno! 🎵',      de: 'Spotify verbunden! 🎵'     },
  'connections.twitchOk2':   { pl: 'Twitch połączono! 🎮',      en: 'Twitch connected! 🎮',     cs: 'Twitch připojeno! 🎮',       de: 'Twitch verbunden! 🎮'      },
  'connections.youtubeOk2':  { pl: 'YouTube połączono! 📺',     en: 'YouTube connected! 📺',    cs: 'YouTube připojeno! 📺',      de: 'YouTube verbunden! 📺'     },
  'connections.kickOk2':     { pl: 'Kick połączono! 🟢',        en: 'Kick connected! 🟢',       cs: 'Kick připojeno! 🟢',         de: 'Kick verbunden! 🟢'        },
  'connections.steamOk2':    { pl: 'Steam połączono! 🎮',       en: 'Steam connected! 🎮',      cs: 'Steam připojeno! 🎮',        de: 'Steam verbunden! 🎮'       },

  // ── Landing page ──────────────────────────────────────────────────────────
  'landing.communication':   { pl: 'Komunikacja dla każdego',   en: 'Communication for everyone', cs: 'Komunikace pro každého', de: 'Kommunikation für alle'    },
  'landing.headline1':       { pl: 'Rozmawiaj. Graj.',          en: 'Talk. Play.',             cs: 'Povídejte. Hrajte.',         de: 'Reden. Spielen.'           },
  'landing.headline2':       { pl: 'Buduj społeczność.',        en: 'Build a community.',      cs: 'Budujte komunitu.',          de: 'Baut eine Community auf.'  },
  'landing.subtext':         { pl: 'Cordyn to miejsce, gdzie możesz pisać ze znajomymi, rozmawiać głosowo, zakładać serwery i dzielić się tym, co robisz — bezpłatnie i bez reklam.', en: 'Cordyn is the place where you can chat with friends, talk with voice, create servers and share what you do — for free and without ads.', cs: 'Cordyn je místo, kde můžete psát s přáteli, mluvit hlasově, zakládat servery a sdílet, co děláte — zdarma a bez reklam.', de: 'Cordyn ist der Ort, wo du mit Freunden chatten, Sprachgespräche führen, Server gründen und teilen kannst, was du tust — kostenlos und ohne Werbung.' },
  'landing.startFree':       { pl: 'Zacznij za darmo →',        en: 'Start for free →',        cs: 'Začít zdarma →',             de: 'Kostenlos starten →'       },
  'landing.loginBtn':        { pl: 'Zaloguj się',               en: 'Log in',                  cs: 'Přihlásit se',               de: 'Anmelden'                  },
  'landing.registerBtn':     { pl: 'Zarejestruj się',           en: 'Register',                cs: 'Registrovat se',             de: 'Registrieren'              },
  'landing.welcomeBack':     { pl: 'Witaj z powrotem!',         en: 'Welcome back!',           cs: 'Vítej zpět!',                de: 'Willkommen zurück!'        },
  'landing.joinCordyn':      { pl: 'Dołącz do Cordyn',         en: 'Join Cordyn',             cs: 'Připojte se ke Cordyn',      de: 'Tritt Cordyn bei'          },
  'landing.createAccount':   { pl: 'Utwórz konto i zacznij budować społeczność', en: 'Create an account and start building a community', cs: 'Vytvořte účet a začněte budovat komunitu', de: 'Erstelle ein Konto und fange an, eine Community aufzubauen' },
  'landing.createAccountJoin':{ pl: 'Utwórz konto, aby dołączyć do serwera', en: 'Create an account to join the server', cs: 'Vytvořte účet pro připojení k serveru', de: 'Erstelle ein Konto, um dem Server beizutreten' },
  'landing.features':        { pl: 'Funkcje',                   en: 'Features',                cs: 'Funkce',                     de: 'Funktionen'                },
  'landing.integrations':    { pl: 'Integracje',                en: 'Integrations',            cs: 'Integrace',                  de: 'Integrationen'             },
  'landing.security':        { pl: 'Bezpieczeństwo',            en: 'Security',                cs: 'Bezpečnost',                 de: 'Sicherheit'                },
  'landing.securityDesc':    { pl: 'Bezpieczeństwo to u nas priorytet. Każde konto jest chronione wieloma warstwami zabezpieczeń — możesz korzystać z Cordyna bez obaw.', en: 'Security is our priority. Every account is protected by multiple layers — use Cordyn without worry.', cs: 'Bezpečnost je naší prioritou. Každý účet je chráněn více vrstvami — Cordyn používejte bez obav.', de: 'Sicherheit hat bei uns Priorität. Jedes Konto ist durch mehrere Ebenen geschützt — nutze Cordyn sorglos.' },
  'landing.securityTitle':   { pl: 'Twoje dane są bezpieczne', en: 'Your data is safe',       cs: 'Vaše data jsou v bezpečí',   de: 'Deine Daten sind sicher'   },
  'landing.downloadApp':     { pl: 'Pobierz aplikację Cordyn', en: 'Download Cordyn app',     cs: 'Stáhnout aplikaci Cordyn',   de: 'Cordyn-App herunterladen'  },
  'landing.loading':         { pl: 'Ładowanie…',               en: 'Loading…',                cs: 'Načítání…',                  de: 'Laden…'                    },
  'landing.copyright':       { pl: '© 2025 Cordyn. Wszelkie prawa zastrzeżone.', en: '© 2025 Cordyn. All rights reserved.', cs: '© 2025 Cordyn. Všechna práva vyhrazena.', de: '© 2025 Cordyn. Alle Rechte vorbehalten.' },
  'landing.changeData':      { pl: '← Zmień dane / wyślij kod ponownie', en: '← Change data / resend code', cs: '← Změnit údaje / odeslat kód znovu', de: '← Daten ändern / Code erneut senden' },
  'landing.noAccount':       { pl: 'Nie masz konta? ',          en: 'No account? ',            cs: 'Nemáte účet? ',              de: 'Kein Konto? '              },
  'landing.haveAccount':     { pl: 'Masz już konto? ',          en: 'Have an account? ',       cs: 'Máte již účet? ',            de: 'Hast du ein Konto? '       },
  'landing.verify2fa':       { pl: 'Weryfikacja dwuetapowa',    en: 'Two-step verification',   cs: 'Dvoufázové ověření',         de: 'Zweistufige Verifizierung' },
  'landing.totp.hint':       { pl: 'Podaj 6-cyfrowy kod z aplikacji authenticator', en: 'Enter 6-digit code from authenticator app', cs: 'Zadejte 6místný kód z ověřovací aplikace', de: '6-stelligen Code aus Authenticator-App eingeben' },
  'landing.backup.hint':     { pl: 'Podaj kod zapasowy (XXXXX-XXXXX)', en: 'Enter backup code (XXXXX-XXXXX)', cs: 'Zadejte záložní kód (XXXXX-XXXXX)', de: 'Backup-Code eingeben (XXXXX-XXXXX)' },
  'landing.useBackup':       { pl: 'Użyj kodu zapasowego',      en: 'Use backup code',         cs: 'Použít záložní kód',         de: 'Backup-Code verwenden'     },
  'landing.useAuthApp':      { pl: 'Użyj aplikacji authenticator', en: 'Use authenticator app', cs: 'Použít ověřovací aplikaci', de: 'Authenticator-App verwenden' },
  'landing.loginOrEmail':    { pl: 'Login lub email',           en: 'Username or email',       cs: 'Přihlašovací jméno nebo e-mail', de: 'Benutzername oder E-Mail' },
  'landing.emailAddress':    { pl: 'Adres email',               en: 'Email address',           cs: 'E-mailová adresa',           de: 'E-Mail-Adresse'            },

  // ── Stream mode (stream activated toast is already handled) ───────────────
  'stream.streamActivated':  { pl: 'Tryb streamu aktywowany — nicki i serwery są ukryte 🎥', en: 'Stream mode activated — nicknames & servers are hidden 🎥', cs: 'Režim streamu aktivován — přezdívky a servery jsou skryty 🎥', de: 'Stream-Modus aktiviert — Nicknames & Server ausgeblendet 🎥' },

  // ── VoiceRtt ──────────────────────────────────────────────────────────────
  'voice.collectingData':    { pl: 'Zbieranie danych…',         en: 'Collecting data…',        cs: 'Sběr dat…',                  de: 'Daten werden gesammelt…'   },

  // ── Misc channel/message area ─────────────────────────────────────────────
  'message.loadingPoll':     { pl: 'Ładowanie ankiety...',      en: 'Loading poll...',         cs: 'Načítání ankety...',         de: 'Umfrage wird geladen...'   },
  'message.pollError':       { pl: 'Nie można załadować ankiety', en: 'Cannot load poll',      cs: 'Anketu nelze načíst',        de: 'Umfrage kann nicht geladen werden' },
  'message.clickToOpen':     { pl: 'Kliknij aby otworzyć rozmowę', en: 'Click to open conversation', cs: 'Klikněte pro otevření konverzace', de: 'Klicken zum Öffnen der Unterhaltung' },
  'message.uploading':       { pl: 'Pobieranie:',               en: 'Downloading:',            cs: 'Stahování:',                 de: 'Herunterladen:'            },

  // ── Landing page extended ─────────────────────────────────────────────────
  'landing.features.title':  { pl: 'Wszystko, czego potrzebujesz', en: 'Everything you need', cs: 'Vše, co potřebujete',        de: 'Alles, was du brauchst'    },
  'landing.features.desc':   { pl: 'Jeden zestaw narzędzi do komunikacji, zarządzania społecznością i rozrywki.', en: 'One set of tools for communication, community management and entertainment.', cs: 'Jedna sada nástrojů pro komunikaci, správu komunity a zábavu.', de: 'Ein Werkzeugset für Kommunikation, Community-Management und Unterhaltung.' },
  'landing.integrations.title':{ pl: 'Połącz swoje platformy', en: 'Connect your platforms', cs: 'Propojte své platformy',     de: 'Verbinde deine Plattformen' },
  'landing.integrations.desc':{ pl: 'Cordyn integruje się z Twoimi ulubionymi serwisami, żebyś wszystko miał w jednym miejscu.', en: 'Cordyn integrates with your favorite services so you have everything in one place.', cs: 'Cordyn se integruje s vašimi oblíbenými službami, abyste měli vše na jednom místě.', de: 'Cordyn integriert sich mit deinen Lieblingsdiensten, sodass du alles an einem Ort hast.' },
  'landing.security.title':  { pl: 'Twoje konto jest bezpieczne', en: 'Your account is secure', cs: 'Váš účet je v bezpečí',    de: 'Dein Konto ist sicher'     },
  'landing.security.desc':   { pl: 'Bezpieczeństwo to u nas priorytet. Każde konto jest chronione wieloma warstwami zabezpieczeń — możesz korzystać z Cordyna bez obaw.', en: 'Security is our priority. Every account is protected by multiple layers — use Cordyn without worry.', cs: 'Bezpečnost je naší prioritou. Každý účet je chráněn více vrstvami — Cordyn používejte bez obav.', de: 'Sicherheit hat bei uns Priorität. Jedes Konto ist durch mehrere Ebenen geschützt — nutze Cordyn sorglos.' },
  'landing.cta.join':        { pl: 'Dołącz do Cordyn — już dziś', en: 'Join Cordyn — today', cs: 'Připojte se ke Cordyn — dnes', de: 'Tritt Cordyn bei — noch heute' },
  'landing.cta.desc':        { pl: 'Tysiące społeczności już rozmawia, gra i tworzy razem na Cordynie. Dołącz i Ty — za darmo, bez reklam.', en: 'Thousands of communities are already talking, gaming and creating together on Cordyn. Join them — free, no ads.', cs: 'Tisíce komunit již mluví, hraje a tvoří společně na Cordyn. Připojte se — zdarma, bez reklam.', de: 'Tausende Communities reden, spielen und erschaffen bereits zusammen auf Cordyn. Mach mit — kostenlos, ohne Werbung.' },
  'landing.authenticatorApps':{ pl: 'Obsługiwane aplikacje authenticator', en: 'Supported authenticator apps', cs: 'Podporované ověřovací aplikace', de: 'Unterstützte Authenticator-Apps' },
  'landing.accountReady':    { pl: 'Twoje konto jest gotowe. Oto kilka wskazówek na start:', en: 'Your account is ready. Here are a few tips to get started:', cs: 'Váš účet je připraven. Zde je několik tipů pro začátek:', de: 'Dein Konto ist bereit. Hier sind einige Tipps für den Einstieg:' },
  'landing.stats.voice':     { pl: 'Głos',                       en: 'Voice',                   cs: 'Hlas',                       de: 'Sprache'                   },
  'landing.stats.videoHd':   { pl: 'i wideo HD',                 en: 'and HD video',            cs: 'a HD video',                 de: 'und HD-Video'              },
  'landing.stats.security':  { pl: 'Bezpieczeństwo',             en: 'Security',                cs: 'Bezpečnost',                 de: 'Sicherheit'                },
  'landing.stats.messages':  { pl: 'Wiadomości',                 en: 'Messages',                cs: 'Zprávy',                     de: 'Nachrichten'               },
  'landing.stats.bots':      { pl: 'Boty',                       en: 'Bots',                    cs: 'Boti',                       de: 'Bots'                      },
  'landing.stats.automations':{ pl: 'i automatyzacje',           en: 'and automations',         cs: 'a automatizace',             de: 'und Automatisierungen'     },
  'landing.loginEmail':      { pl: 'Login lub email',            en: 'Login or email',          cs: 'Přihlašovací jméno nebo e-mail', de: 'Login oder E-Mail'      },

  // ── Misc UI ──────────────────────────────────────────────────────────────
  'menu.notifSettings':      { pl: 'Ustawienia powiadomień',     en: 'Notification settings',   cs: 'Nastavení oznámení',         de: 'Benachrichtigungseinstellungen' },
  'group.settings':          { pl: 'Ustawienia grupy',           en: 'Group settings',          cs: 'Nastavení skupiny',          de: 'Gruppeneinstellungen'      },
  'group.settings.saved':    { pl: 'Ustawienia grupy zapisane',  en: 'Group settings saved',    cs: 'Nastavení skupiny uloženo',  de: 'Gruppeneinstellungen gespeichert' },
  'group.settings.error':    { pl: 'Błąd zapisu',                en: 'Save error',              cs: 'Chyba uložení',              de: 'Fehler beim Speichern'     },
  'bots.settings':           { pl: 'Ustawienia botów',           en: 'Bot settings',            cs: 'Nastavení botů',             de: 'Bot-Einstellungen'         },
  'bots.settings.desc':      { pl: 'Ogranicz komendy botów do jednego wybranego kanału tekstowego.', en: 'Restrict bot commands to a single selected text channel.', cs: 'Omezte příkazy botů na jeden vybraný textový kanál.', de: 'Bot-Befehle auf einen ausgewählten Textkanal beschränken.' },
  'app.settings':            { pl: 'Ustawienia aplikacji',       en: 'App settings',            cs: 'Nastavení aplikace',         de: 'App-Einstellungen'         },

  // ── Admin / storage panel ─────────────────────────────────────────────
  'admin.error.stats':       { pl: 'Błąd ładowania statystyk',   en: 'Error loading stats',     cs: 'Chyba načítání statistik',   de: 'Fehler beim Laden der Statistiken' },
  'admin.error.users':       { pl: 'Błąd ładowania użytkowników', en: 'Error loading users',    cs: 'Chyba načítání uživatelů',   de: 'Fehler beim Laden der Benutzer' },
  'admin.file.deleted':      { pl: 'Plik usunięty',              en: 'File deleted',            cs: 'Soubor smazán',              de: 'Datei gelöscht'            },
  'admin.error.delete':      { pl: 'Błąd usuwania',              en: 'Delete error',            cs: 'Chyba mazání',               de: 'Fehler beim Löschen'       },
  'admin.storage.recalced':  { pl: 'Przeliczono storage wszystkich użytkowników', en: 'Storage recalculated for all users', cs: 'Úložiště přepočítáno pro všechny uživatele', de: 'Speicher für alle Benutzer neu berechnet' },
  'admin.error.recalc':      { pl: 'Błąd przeliczania',          en: 'Recalculation error',     cs: 'Chyba přepočítání',          de: 'Fehler beim Neuberechnen'  },
  'admin.power.granted':     { pl: 'Nadano Cordyn Power',        en: 'Cordyn Power granted',    cs: 'Cordyn Power uděleno',       de: 'Cordyn Power vergeben'     },
  'admin.power.revoked':     { pl: 'Odebrano Cordyn Power',      en: 'Cordyn Power revoked',    cs: 'Cordyn Power odebráno',      de: 'Cordyn Power entzogen'     },
  'admin.error.generic':     { pl: 'Błąd',                       en: 'Error',                   cs: 'Chyba',                      de: 'Fehler'                    },
  'admin.bots.channelSet':   { pl: 'Kanał botów ustawiony',      en: 'Bot channel set',         cs: 'Kanál pro boty nastaven',    de: 'Bot-Kanal gesetzt'         },
  'admin.bots.channelClear': { pl: 'Ograniczenie kanału usunięte', en: 'Channel restriction removed', cs: 'Omezení kanálu odebráno', de: 'Kanalbeschränkung entfernt' },
  'admin.error.save':        { pl: 'Błąd zapisu ustawień',       en: 'Settings save error',     cs: 'Chyba ukládání nastavení',   de: 'Fehler beim Speichern der Einstellungen' },
  'admin.error.serverSave':  { pl: 'Błąd zapisu ustawień serwera', en: 'Server settings save error', cs: 'Chyba ukládání nastavení serveru', de: 'Fehler beim Speichern der Servereinstellungen' },

  // ── Profile page / game actions ───────────────────────────────────────
  'profile.game.removed':    { pl: 'Usunięto',                   en: 'Removed',                 cs: 'Odstraněno',                 de: 'Entfernt'                  },
  'profile.game.error':      { pl: 'Błąd usuwania gry',          en: 'Error removing game',     cs: 'Chyba odstranění hry',       de: 'Fehler beim Entfernen des Spiels' },
  'profile.error.save':      { pl: 'Błąd zapisu profilu',        en: 'Profile save error',      cs: 'Chyba ukládání profilu',     de: 'Fehler beim Speichern des Profils' },

  // ── Appearance ────────────────────────────────────────────────────────
  'appearance.accentChanged':{ pl: 'Kolor akcentu zmieniony',    en: 'Accent color changed',    cs: 'Barva zvýraznění změněna',   de: 'Akzentfarbe geändert'      },
  'appearance.avatarEffect': { pl: 'Efekt avatara zmieniony',    en: 'Avatar effect changed',   cs: 'Efekt avatara změněn',       de: 'Avatar-Effekt geändert'    },
  'appearance.cardEffect':   { pl: 'Efekt karty zmieniony',      en: 'Card effect changed',     cs: 'Efekt karty změněn',         de: 'Karten-Effekt geändert'    },
  'appearance.cardColor':    { pl: 'Kolor karty zmieniony',      en: 'Card color changed',      cs: 'Barva karty změněna',        de: 'Kartenfarbe geändert'      },
  'appearance.cardFont':     { pl: 'Czcionka karty zmieniona',   en: 'Card font changed',       cs: 'Písmo karty změněno',        de: 'Kartenschrift geändert'    },
  'appearance.tabLimit':     { pl: 'Limit zakładek:',            en: 'Tab limit:',              cs: 'Limit záložek:',             de: 'Tab-Limit:'                },
  'appearance.error.tabLimit':{ pl: 'Błąd zapisu limitu zakładek', en: 'Error saving tab limit', cs: 'Chyba ukládání limitu záložek', de: 'Fehler beim Speichern des Tab-Limits' },
  'appearance.error.save':   { pl: 'Błąd zapisu',                en: 'Save error',              cs: 'Chyba uložení',              de: 'Fehler beim Speichern'     },

  // ── Permissions / camera ─────────────────────────────────────────────
  'perm.noCamera':           { pl: 'Brak dostępu do kamery',     en: 'No camera access',        cs: 'Bez přístupu ke kameře',     de: 'Kein Kamerazugriff'        },
  'perm.noReadFile':         { pl: 'Nie można odczytać pliku',   en: 'Cannot read file',        cs: 'Nelze přečíst soubor',       de: 'Datei kann nicht gelesen werden' },

  // ── Drag-and-drop / reorder ───────────────────────────────────────────
  'reorder.catError':        { pl: 'Nie udało się zapisać kolejności kategorii', en: 'Failed to save category order', cs: 'Nepodařilo se uložit pořadí kategorií', de: 'Reihenfolge der Kategorien konnte nicht gespeichert werden' },
  'reorder.chError':         { pl: 'Nie udało się zapisać kolejności kanałów', en: 'Failed to save channel order', cs: 'Nepodařilo se uložit pořadí kanálů', de: 'Reihenfolge der Kanäle konnte nicht gespeichert werden' },

  // ── Spotify JAM / DJ ──────────────────────────────────────────────────
  'spotify.djStopped':       { pl: 'DJ zatrzymany',              en: 'DJ stopped',              cs: 'DJ zastaven',                de: 'DJ gestoppt'               },
  'spotify.djStarted':       { pl: 'Jesteś teraz DJ-em! Wszyscy mogą słuchać Twojego Spotify.', en: 'You are now the DJ! Everyone can listen to your Spotify.', cs: 'Jsi nyní DJ! Všichni mohou poslouchat tvůj Spotify.', de: 'Du bist jetzt DJ! Alle können deinen Spotify hören.' },
  'spotify.djListen':        { pl: 'Słuchaj Spotify DJ',         en: 'Listen to Spotify DJ',    cs: 'Poslouchej Spotify DJ',      de: 'Spotify DJ hören'          },
  'spotify.jamStarted':      { pl: 'JAM uruchomiony! Znajomi mogą dołączyć z Twojego profilu', en: 'JAM started! Friends can join from your profile', cs: 'JAM spuštěn! Přátelé se mohou připojit z tvého profilu', de: 'JAM gestartet! Freunde können von deinem Profil beitreten' },
  'spotify.jamEnded':        { pl: 'JAM zakończony',             en: 'JAM ended',               cs: 'JAM ukončen',                de: 'JAM beendet'               },
  'spotify.jamEndedByHost':  { pl: 'JAM zakończony przez hosta', en: 'JAM ended by host',       cs: 'JAM ukončen hostitelem',     de: 'JAM vom Host beendet'      },
  'spotify.jamJoined':       { pl: 'Dołączono do JAM! Synchronizacja Spotify...', en: 'Joined JAM! Syncing Spotify...', cs: 'Připojeno k JAM! Synchronizace Spotify...', de: 'JAM beigetreten! Spotify wird synchronisiert...' },
  'spotify.jamLeft':         { pl: 'Opuszczono JAM',             en: 'Left JAM',                cs: 'Opuštěno JAM',               de: 'JAM verlassen'             },

  // ── Service disconnect ────────────────────────────────────────────────
  'disconnect.spotify':      { pl: 'Spotify odłączono',          en: 'Spotify disconnected',    cs: 'Spotify odpojeno',           de: 'Spotify getrennt'          },
  'disconnect.twitch':       { pl: 'Twitch odłączono',           en: 'Twitch disconnected',     cs: 'Twitch odpojen',             de: 'Twitch getrennt'           },
  'disconnect.steam':        { pl: 'Steam odłączono',            en: 'Steam disconnected',      cs: 'Steam odpojen',              de: 'Steam getrennt'            },
  'disconnect.youtube':      { pl: 'YouTube odłączono',          en: 'YouTube disconnected',    cs: 'YouTube odpojen',            de: 'YouTube getrennt'          },
  'disconnect.kick':         { pl: 'Kick odłączono',             en: 'Kick disconnected',       cs: 'Kick odpojen',               de: 'Kick getrennt'             },
  'disconnect.epic':         { pl: 'Epic Games odłączono',       en: 'Epic Games disconnected', cs: 'Epic Games odpojen',         de: 'Epic Games getrennt'       },
  'connect.epic':            { pl: 'Epic Games połączono',       en: 'Epic Games connected',    cs: 'Epic Games připojeno',       de: 'Epic Games verbunden'      },
  'error.disconnect.spotify':{ pl: 'Błąd odłączania Spotify',   en: 'Spotify disconnect error', cs: 'Chyba odpojení Spotify',    de: 'Fehler beim Trennen von Spotify' },
  'error.disconnect.twitch': { pl: 'Błąd odłączania Twitch',    en: 'Twitch disconnect error', cs: 'Chyba odpojení Twitch',      de: 'Fehler beim Trennen von Twitch' },
  'error.disconnect.steam':  { pl: 'Błąd odłączania Steam',     en: 'Steam disconnect error',  cs: 'Chyba odpojení Steam',       de: 'Fehler beim Trennen von Steam' },
  'error.connect.spotify':   { pl: 'Błąd Spotify',              en: 'Spotify error',           cs: 'Chyba Spotify',              de: 'Spotify-Fehler'            },
  'error.connect.twitch':    { pl: 'Błąd Twitch',               en: 'Twitch error',            cs: 'Chyba Twitch',               de: 'Twitch-Fehler'             },
  'error.connect.steam':     { pl: 'Błąd Steam',                en: 'Steam error',             cs: 'Chyba Steam',                de: 'Steam-Fehler'              },
  'error.connect.youtube':   { pl: 'Błąd YouTube',              en: 'YouTube error',           cs: 'Chyba YouTube',              de: 'YouTube-Fehler'            },
  'error.connect.kick':      { pl: 'Błąd Kick',                 en: 'Kick error',              cs: 'Chyba Kick',                 de: 'Kick-Fehler'               },
  'error.connect.epic':      { pl: 'Błąd Epic',                 en: 'Epic error',              cs: 'Chyba Epic',                 de: 'Epic-Fehler'               },

  // ── Server tags ───────────────────────────────────────────────────────
  'tag.saved':               { pl: 'Tag serwera zapisany!',      en: 'Server tag saved!',       cs: 'Tag serveru uložen!',        de: 'Server-Tag gespeichert!'   },
  'tag.error.save':          { pl: 'Błąd zapisu tagu',           en: 'Tag save error',          cs: 'Chyba uložení tagu',         de: 'Fehler beim Speichern des Tags' },
  'tag.deleted':             { pl: 'Tag usunięty',               en: 'Tag deleted',             cs: 'Tag smazán',                 de: 'Tag gelöscht'              },
  'tag.error.delete':        { pl: 'Błąd usuwania tagu',         en: 'Tag delete error',        cs: 'Chyba mazání tagu',          de: 'Fehler beim Löschen des Tags' },
  'tag.activated':           { pl: 'Tag aktywowany!',            en: 'Tag activated!',          cs: 'Tag aktivován!',             de: 'Tag aktiviert!'            },
  'tag.removed':             { pl: 'Tag zdjęty',                 en: 'Tag removed',             cs: 'Tag odstraněn',              de: 'Tag entfernt'              },
  'tag.error.change':        { pl: 'Błąd zmiany tagu',           en: 'Tag change error',        cs: 'Chyba změny tagu',           de: 'Fehler beim Ändern des Tags' },

  // ── Copy actions ──────────────────────────────────────────────────────
  'copy.text':               { pl: 'Skopiowano tekst',           en: 'Text copied',             cs: 'Text zkopírován',            de: 'Text kopiert'              },
  'copy.link':               { pl: 'Skopiowano link',            en: 'Link copied',             cs: 'Odkaz zkopírován',           de: 'Link kopiert'              },
  'copy.msgLink':            { pl: 'Skopiowano link do wiadomości', en: 'Message link copied',  cs: 'Odkaz na zprávu zkopírován', de: 'Nachrichtenlink kopiert'   },
  'copy.id':                 { pl: 'Skopiowano ID',              en: 'ID copied',               cs: 'ID zkopírováno',             de: 'ID kopiert'                },
  'copy.channelId':          { pl: 'Skopiowano ID kanału',       en: 'Channel ID copied',       cs: 'ID kanálu zkopírováno',      de: 'Kanal-ID kopiert'          },
  'copy.inviteLink':         { pl: 'Link zaproszenia skopiowany', en: 'Invite link copied',     cs: 'Odkaz na pozvánku zkopírován', de: 'Einladungslink kopiert'  },
  'copy.error.invite':       { pl: 'Błąd tworzenia zaproszenia', en: 'Error creating invite',   cs: 'Chyba vytváření pozvánky',   de: 'Fehler beim Erstellen der Einladung' },
  'copy.linkShort':          { pl: 'Link skopiowany',            en: 'Link copied',             cs: 'Odkaz zkopírován',           de: 'Link kopiert'              },
  'copy.linkExclaim':        { pl: 'Link skopiowany!',           en: 'Link copied!',            cs: 'Odkaz zkopírován!',          de: 'Link kopiert!'             },

  // ── Channel context menu ──────────────────────────────────────────────
  'channel.muted':           { pl: 'Kanał wyciszony',            en: 'Channel muted',           cs: 'Kanál ztlumený',             de: 'Kanal stummgeschaltet'     },
  'channel.unmuted':         { pl: 'Kanał odwyciszony',          en: 'Channel unmuted',         cs: 'Kanál bez ztlumení',         de: 'Kanal wieder laut'         },
  'channel.soundSet':        { pl: 'ustawiony ✓',                en: 'set ✓',                   cs: 'nastaven ✓',                 de: 'gesetzt ✓'                 },
  'channel.soundBig':        { pl: 'Plik musi być mniejszy niż 512 KB', en: 'File must be smaller than 512 KB', cs: 'Soubor musí být menší než 512 KB', de: 'Datei muss kleiner als 512 KB sein' },
  'channel.soundDeleted':    { pl: 'Dźwięk usunięty',            en: 'Sound deleted',           cs: 'Zvuk smazán',                de: 'Sound gelöscht'            },
  'channel.duplicated':      { pl: 'Powielono kanał:',           en: 'Channel duplicated:',     cs: 'Kanál duplikován:',          de: 'Kanal dupliziert:'         },
  'channel.error.duplicate': { pl: 'Błąd powielania kanału',     en: 'Channel duplicate error', cs: 'Chyba duplikování kanálu',   de: 'Fehler beim Duplizieren des Kanals' },

  // ── Group DM ──────────────────────────────────────────────────────────
  'group.deleted':           { pl: 'Grupa usunięta',             en: 'Group deleted',           cs: 'Skupina smazána',            de: 'Gruppe gelöscht'           },
  'group.left':              { pl: 'Opuszczono grupę',           en: 'Left group',              cs: 'Skupina opuštěna',           de: 'Gruppe verlassen'          },
  'group.created':           { pl: 'Grupa utworzona!',           en: 'Group created!',          cs: 'Skupina vytvořena!',         de: 'Gruppe erstellt!'          },

  // ── Bookmarks ─────────────────────────────────────────────────────────
  'bookmark.removed':        { pl: 'Usunięto z zapisanych',      en: 'Removed from saved',      cs: 'Odebráno z uložených',       de: 'Aus Gespeicherten entfernt' },
  'bookmark.saved':          { pl: 'Zapisano wiadomość',         en: 'Message saved',           cs: 'Zpráva uložena',             de: 'Nachricht gespeichert'     },

  // ── Server settings ───────────────────────────────────────────────────
  'server.public':           { pl: 'publiczny',                  en: 'public',                  cs: 'veřejný',                    de: 'öffentlich'                },
  'server.private':          { pl: 'prywatny',                   en: 'private',                 cs: 'soukromý',                   de: 'privat'                    },
  'server.nowPublic':        { pl: 'Serwer jest teraz publiczny!', en: 'Server is now public!',  cs: 'Server je nyní veřejný!',    de: 'Server ist jetzt öffentlich!' },
  'server.nowPrivate':       { pl: 'Serwer jest teraz prywatny!', en: 'Server is now private!', cs: 'Server je nyní soukromý!',   de: 'Server ist jetzt privat!'  },
  'server.descSaved':        { pl: 'Opis zapisany!',             en: 'Description saved!',      cs: 'Popis uložen!',              de: 'Beschreibung gespeichert!' },
  'server.onboardingSaved':  { pl: 'Onboarding zapisany!',       en: 'Onboarding saved!',       cs: 'Onboarding uložen!',         de: 'Onboarding gespeichert!'   },
  'server.eventCreated':     { pl: 'Event utworzony!',           en: 'Event created!',          cs: 'Akce vytvořena!',            de: 'Ereignis erstellt!'        },
  'server.eventDeleted':     { pl: 'Usunięto event',             en: 'Event deleted',           cs: 'Akce smazána',               de: 'Ereignis gelöscht'         },
  'server.noEvents':         { pl: 'Brak eventów',               en: 'No events',               cs: 'Žádné akce',                 de: 'Keine Ereignisse'          },
  'server.imgError':         { pl: 'Błąd wgrywania zdjęcia',     en: 'Image upload error',      cs: 'Chyba nahrávání obrázku',    de: 'Fehler beim Hochladen des Bildes' },
  'server.rulesAccepted':    { pl: 'Reguły zaakceptowane!',      en: 'Rules accepted!',         cs: 'Pravidla přijata!',          de: 'Regeln akzeptiert!'        },
  'server.fillRequired':     { pl: 'Wypełnij tytuł i datę',      en: 'Fill in title and date',  cs: 'Vyplňte název a datum',      de: 'Titel und Datum ausfüllen' },

  // ── Push notifications ────────────────────────────────────────────────
  'push.disabled':           { pl: 'Powiadomienia push wyłączone', en: 'Push notifications disabled', cs: 'Push oznámení vypnuta',   de: 'Push-Benachrichtigungen deaktiviert' },
  'push.notSupported':       { pl: 'Twoja przeglądarka nie obsługuje powiadomień push', en: 'Your browser does not support push notifications', cs: 'Váš prohlížeč nepodporuje push oznámení', de: 'Ihr Browser unterstützt keine Push-Benachrichtigungen' },
  'push.noPermission':       { pl: 'Brak zgody na powiadomienia', en: 'Push notification permission denied', cs: 'Souhlas s oznámeními odepřen', de: 'Berechtigung für Benachrichtigungen verweigert' },
  'push.enabled':            { pl: 'Powiadomienia push włączone!', en: 'Push notifications enabled!', cs: 'Push oznámení povolena!',   de: 'Push-Benachrichtigungen aktiviert!' },
  'push.alreadyEnabled':     { pl: 'Powiadomienia już są włączone!', en: 'Notifications are already enabled!', cs: 'Oznámení jsou již povolena!', de: 'Benachrichtigungen sind bereits aktiviert!' },
  'push.tauri.enabled':      { pl: 'Powiadomienia włączone!',     en: 'Notifications enabled!',  cs: 'Oznámení povolena!',         de: 'Benachrichtigungen aktiviert!' },
  'push.tauri.denied':       { pl: 'Powiadomienia odrzucone przez system', en: 'Notifications denied by system', cs: 'Oznámení odmítnuta systémem', de: 'Benachrichtigungen vom System abgelehnt' },
  'push.tauri.error':        { pl: 'Błąd przy żądaniu uprawnień', en: 'Error requesting permissions', cs: 'Chyba při žádosti o oprávnění', de: 'Fehler beim Anfordern von Berechtigungen' },

  // ── Account deletion ──────────────────────────────────────────────────
  'account.deleted':         { pl: 'Konto zostało usunięte',     en: 'Account has been deleted', cs: 'Účet byl smazán',            de: 'Konto wurde gelöscht'      },
  'account.invalidCode':     { pl: 'Nieprawidłowy kod',          en: 'Invalid code',            cs: 'Neplatný kód',               de: 'Ungültiger Code'           },

  // ── Friends ───────────────────────────────────────────────────────────
  'friends.inviteSent':      { pl: 'Zaproszenie wysłane!',       en: 'Invitation sent!',        cs: 'Pozvánka odeslána!',         de: 'Einladung gesendet!'       },
  'friends.error.notFound':  { pl: 'Nie znaleziono użytkownika', en: 'User not found',          cs: 'Uživatel nenalezen',         de: 'Benutzer nicht gefunden'   },

  // ── Tabs system ───────────────────────────────────────────────────────
  'tabs.enabled':              { pl: 'Pasek zakładek włączony',                   en: 'Tab bar enabled',                         cs: 'Panel záložek povolen',                  de: 'Tab-Leiste aktiviert'                    },
  'tabs.disabled':             { pl: 'Pasek zakładek wyłączony',                  en: 'Tab bar disabled',                        cs: 'Panel záložek zakázán',                  de: 'Tab-Leiste deaktiviert'                  },
  'tabs.welcome.title':        { pl: 'Witaj w nowym systemie zakładek!',          en: 'Welcome to the new tab system!',          cs: 'Vítejte v novém systému záložek!',       de: 'Willkommen im neuen Tab-System!'         },
  'tabs.welcome.desc':         { pl: 'Otwieraj wiele kanałów jednocześnie i przełączaj się między nimi jednym kliknięciem — bez utraty kontekstu.', en: 'Open multiple channels at once and switch between them with one click — without losing context.', cs: 'Otevřete více kanálů najednou a přepínejte mezi nimi jedním kliknutím — bez ztráty kontextu.', de: 'Öffne mehrere Kanäle gleichzeitig und wechsle mit einem Klick zwischen ihnen — ohne Kontext zu verlieren.' },
  'tabs.welcome.pin':          { pl: 'Przypinaj ważne kanały',                    en: 'Pin important channels',                  cs: 'Připněte důležité kanály',               de: 'Wichtige Kanäle anheften'                },
  'tabs.welcome.multi':        { pl: 'Otwieraj wiele kanałów jednocześnie',       en: 'Open multiple channels at once',          cs: 'Otevřete více kanálů najednou',          de: 'Mehrere Kanäle gleichzeitig öffnen'      },
  'tabs.welcome.quick':        { pl: 'Szybki dostęp bez wychodzenia z serwera',   en: 'Quick access without leaving the server', cs: 'Rychlý přístup bez opuštění serveru',    de: 'Schneller Zugriff ohne den Server zu verlassen' },
  'tabs.welcome.disableHint':  { pl: 'Możesz wyłączyć zakładki w Ustawienia → Prywatność', en: 'You can disable tabs in Settings → Privacy', cs: 'Záložky můžete vypnout v Nastavení → Soukromí', de: 'Du kannst Tabs in Einstellungen → Datenschutz deaktivieren' },
  'tabs.welcome.disableBtn':   { pl: 'Wyłącz zakładki',                           en: 'Disable tabs',                            cs: 'Zakázat záložky',                        de: 'Tabs deaktivieren'                       },
  'tabs.welcome.gotIt':        { pl: 'Rozumiem, świetnie!',                       en: 'Got it, great!',                          cs: 'Rozumím, skvělé!',                       de: 'Verstanden, super!'                      },
  'tabs.settings.section':     { pl: 'Interfejs',                                 en: 'Interface',                               cs: 'Rozhraní',                               de: 'Benutzeroberfläche'                      },
  'tabs.settings.label':       { pl: 'Pasek zakładek',                            en: 'Tab bar',                                 cs: 'Panel záložek',                          de: 'Tab-Leiste'                              },
  'tabs.settings.desc':        { pl: 'Pokazuj pasek zakładek u góry — szybki dostęp do wielu kanałów jednocześnie', en: 'Show tab bar at the top — quick access to multiple channels at once', cs: 'Zobrazit panel záložek nahoře — rychlý přístup k více kanálům najednou', de: 'Tab-Leiste oben anzeigen — schneller Zugriff auf mehrere Kanäle gleichzeitig' },
  'tabs.settings.limit':       { pl: 'Limit otwartych zakładek',                  en: 'Open tab limit',                          cs: 'Limit otevřených záložek',               de: 'Limit offener Tabs'                      },
  'tabs.settings.limitDesc':   { pl: 'Maksymalna liczba nieprzypiętych zakładek', en: 'Maximum number of unpinned tabs',         cs: 'Maximální počet nepřipnutých záložek',   de: 'Maximale Anzahl nicht angehefteter Tabs' },
};

/** Translate a key to the given locale. Falls back to Polish, then the key itself. */
export function translate(key: string, locale: Locale): string {
  return T[key]?.[locale] ?? T[key]?.['pl'] ?? key;
}
