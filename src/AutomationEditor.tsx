/**
 * AutomationEditor — kompletny redesign systemu automatyzacji serwera
 *
 * Tryby:
 *   simple  — formularz (ulepszony, bez emoji, ikony Lucide)
 *   visual  — graficzny flow jak n8n (węzły + strzałki SVG)
 */

import React, {
  useState, useEffect, useRef, useLayoutEffect,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Plus, Trash2, Save, X, ArrowRight, ChevronDown, ChevronUp,
  UserPlus, UserMinus, Shield, ShieldOff, MessageSquare, Search,
  Smile, Ban, Mic, MicOff, Mail, VolumeX, FileText, AlertTriangle,
  Globe, Pin, Tag, Clock, Hash, Calendar, Users, Paperclip,
  AlignLeft, CalendarDays, ToggleLeft, ToggleRight, Settings2,
  List, Network, CircleDot, GitBranch, CheckCircle, Copy,
  Eye, EyeOff, Layers, Filter, Play, MessageCircle, MoreHorizontal,
  Bell, Pencil, Siren,
} from 'lucide-react';
import type {
  ServerAutomation, AutomationTrigger, AutomationActionType,
  AutomationCondition, AutomationAction, ServerRole, ChannelData,
} from './api';
import { automationsApi } from './api';

// ─── Extended types ───────────────────────────────────────────────────────────

export type ExtTrigger = AutomationTrigger | 'voice_join' | 'voice_leave' | 'message_deleted';
export type ExtActionType = AutomationActionType | 'set_nickname' | 'timeout_member' | 'remove_timeout';
export type ExtCondType =
  | AutomationCondition['type']
  | 'message_has_attachment'
  | 'message_length_above'
  | 'message_length_below'
  | 'time_between'
  | 'user_is_bot';

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface TriggerMeta {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  description: string;
  color: string;        // tailwind bg-*/border-* tokens
  textColor: string;
  hasConfig?: boolean;
}
const TRIGGER_META: Record<ExtTrigger, TriggerMeta> = {
  member_join:      { icon: UserPlus,    label: 'Member dołącza',         description: 'Nowy użytkownik dołącza do serwera',         color: 'bg-emerald-500/15 border-emerald-500/30', textColor: 'text-emerald-400' },
  member_leave:     { icon: UserMinus,   label: 'Member opuszcza',         description: 'Użytkownik opuszcza serwer',                  color: 'bg-red-500/15 border-red-500/30',       textColor: 'text-red-400'     },
  role_assigned:    { icon: Shield,      label: 'Rola nadana',             description: 'Użytkownik otrzymuje rolę',                   color: 'bg-indigo-500/15 border-indigo-500/30', textColor: 'text-indigo-400'  },
  role_removed:     { icon: ShieldOff,   label: 'Rola odebrana',           description: 'Rola jest odbierana użytkownikowi',           color: 'bg-zinc-500/15 border-zinc-500/30',     textColor: 'text-zinc-400'    },
  message_contains: { icon: Search,      label: 'Wiadomość zawiera',        description: 'Wiadomość pasuje do wyrażenia/słowa kluczowego', color: 'bg-amber-500/15 border-amber-500/30', textColor: 'text-amber-400', hasConfig: true },
  message_sent:     { icon: MessageSquare, label: 'Wiadomość wysłana',      description: 'Dowolna wiadomość w kanale',                  color: 'bg-sky-500/15 border-sky-500/30',       textColor: 'text-sky-400',    hasConfig: true },
  reaction_added:   { icon: Smile,       label: 'Reakcja dodana',          description: 'Reakcja emoji dodana do wiadomości',          color: 'bg-purple-500/15 border-purple-500/30', textColor: 'text-purple-400', hasConfig: true },
  member_banned:    { icon: Ban,         label: 'Banowanie',               description: 'Użytkownik jest banowany',                    color: 'bg-rose-500/15 border-rose-500/30',     textColor: 'text-rose-400'    },
  voice_join:       { icon: Mic,         label: 'Dołącza do głosowego',    description: 'Użytkownik wchodzi na kanał głosowy',         color: 'bg-teal-500/15 border-teal-500/30',     textColor: 'text-teal-400'    },
  voice_leave:      { icon: MicOff,      label: 'Opuszcza głosowy',        description: 'Użytkownik wychodzi z kanału głosowego',      color: 'bg-slate-500/15 border-slate-500/30',   textColor: 'text-slate-400'   },
  message_deleted:  { icon: Trash2,      label: 'Wiadomość usunięta',      description: 'Wiadomość zostaje usunięta',                  color: 'bg-orange-500/15 border-orange-500/30', textColor: 'text-orange-400'  },
};

interface ActionMeta {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  color: string;
  textColor: string;
  destructive?: boolean;
}
const ACTION_META: Record<ExtActionType, ActionMeta> = {
  assign_role:          { icon: Shield,       label: 'Przypisz rolę',          color: 'bg-indigo-500/15 border-indigo-500/30',  textColor: 'text-indigo-300'  },
  remove_role:          { icon: ShieldOff,    label: 'Usuń rolę',              color: 'bg-zinc-500/15 border-zinc-500/30',      textColor: 'text-zinc-300'    },
  send_channel_message: { icon: MessageSquare, label: 'Wyślij na kanał',       color: 'bg-sky-500/15 border-sky-500/30',        textColor: 'text-sky-300'     },
  send_dm:              { icon: Mail,         label: 'Wyślij DM',              color: 'bg-violet-500/15 border-violet-500/30',  textColor: 'text-violet-300'  },
  delete_message:       { icon: Trash2,       label: 'Usuń wiadomość',         color: 'bg-red-500/15 border-red-500/30',        textColor: 'text-red-300',    destructive: true },
  kick_member:          { icon: UserMinus,    label: 'Kicknij',                color: 'bg-orange-500/15 border-orange-500/30',  textColor: 'text-orange-300', destructive: true },
  ban_member:           { icon: Ban,          label: 'Zbanuj',                 color: 'bg-rose-500/15 border-rose-500/30',      textColor: 'text-rose-300',   destructive: true },
  mute_member:          { icon: VolumeX,      label: 'Wycisz',                 color: 'bg-amber-500/15 border-amber-500/30',    textColor: 'text-amber-300'   },
  log_to_channel:       { icon: FileText,     label: 'Loguj na kanał',         color: 'bg-teal-500/15 border-teal-500/30',      textColor: 'text-teal-300'    },
  warn_user:            { icon: AlertTriangle, label: 'Ostrzeż',               color: 'bg-yellow-500/15 border-yellow-500/30',  textColor: 'text-yellow-300'  },
  add_reaction:         { icon: Smile,        label: 'Dodaj reakcję',          color: 'bg-purple-500/15 border-purple-500/30',  textColor: 'text-purple-300'  },
  send_webhook:         { icon: Globe,        label: 'Wyślij webhook',         color: 'bg-cyan-500/15 border-cyan-500/30',      textColor: 'text-cyan-300'    },
  pin_message:          { icon: Pin,          label: 'Przypnij wiadomość',     color: 'bg-emerald-500/15 border-emerald-500/30', textColor: 'text-emerald-300' },
  set_nickname:         { icon: Tag,          label: 'Ustaw nick',             color: 'bg-lime-500/15 border-lime-500/30',      textColor: 'text-lime-300'    },
  timeout_member:       { icon: Clock,        label: 'Timeout',                color: 'bg-orange-500/15 border-orange-500/30',  textColor: 'text-orange-300', destructive: true },
  remove_timeout:       { icon: CheckCircle,  label: 'Usuń timeout',           color: 'bg-green-500/15 border-green-500/30',    textColor: 'text-green-300'   },
};

interface CondMeta {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
}
const COND_META: Record<ExtCondType, CondMeta> = {
  user_has_role:          { icon: Shield,      label: 'User ma rolę'         },
  user_not_has_role:      { icon: ShieldOff,   label: 'User nie ma roli'     },
  in_channel:             { icon: Hash,        label: 'W kanale'             },
  account_age_less_than:  { icon: Calendar,    label: 'Konto młodsze niż X dni' },
  account_age_more_than:  { icon: Calendar,    label: 'Konto starsze niż X dni' },
  member_count_above:     { icon: Users,       label: 'Liczba memberów >'    },
  member_count_below:     { icon: Users,       label: 'Liczba memberów <'    },
  message_has_attachment: { icon: Paperclip,   label: 'Wiadomość ma załącznik' },
  message_length_above:   { icon: AlignLeft,   label: 'Długość wiadomości >' },
  message_length_below:   { icon: AlignLeft,   label: 'Długość wiadomości <' },
  time_between:           { icon: Clock,       label: 'Godzina między X a Y' },
  user_is_bot:            { icon: CircleDot,   label: 'User jest botem'      },
};

// ─── Empty rule factory ────────────────────────────────────────────────────────

function emptyRule(): Partial<ServerAutomation> {
  return {
    name: '',
    enabled: true,
    trigger_type: 'member_join' as AutomationTrigger,
    trigger_config: {},
    actions: [],
    conditions: [],
    cooldown_seconds: 0,
  };
}
function emptyAction(type: ExtActionType = 'send_channel_message'): AutomationAction {
  return { type: type as AutomationActionType, config: {} };
}
function emptyCondition(type: ExtCondType = 'user_has_role'): AutomationCondition {
  return { type: type as AutomationCondition['type'] } as AutomationCondition;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Sel<T extends string>({
  value, onChange, options, placeholder,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; icon?: React.FC<{ size?: number; className?: string }>; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = options.find(o => o.value === value);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-xl text-sm text-white hover:border-white/20 transition-colors"
      >
        <span className="flex items-center gap-2 truncate">
          {cur?.icon && <cur.icon size={14} className="text-zinc-400 shrink-0"/>}
          <span className="truncate">{cur?.label ?? placeholder ?? '—'}</span>
        </span>
        <ChevronDown size={14} className={`text-zinc-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 top-full mt-1 bg-zinc-850 border border-white/[0.10] rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
            style={{ background: '#1c1c1e' }}
          >
            {options.map(o => (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-white/[0.06] transition-colors text-left ${o.value === value ? 'bg-white/[0.05] text-white' : 'text-zinc-300'}`}
              >
                {o.icon && <o.icon size={14} className="text-zinc-400 shrink-0"/>}
                <span>{o.label}</span>
                {o.value === value && <CheckCircle size={12} className="ml-auto text-indigo-400 shrink-0"/>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Input({ value, onChange, placeholder, textarea }: {
  value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean;
}) {
  const cls = "w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors";
  if (textarea) return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
      className={cls + ' resize-none'}/>
  );
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls}/>;
}

function NumInput({ value, onChange, min = 0, max = 99999, placeholder }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; placeholder?: string;
}) {
  return (
    <input type="number" value={value || ''} min={min} max={max} placeholder={placeholder}
      onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
      className="w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
    />
  );
}

// ─── Trigger config ────────────────────────────────────────────────────────────

function TriggerConfig({ trigger, config, onChange, roles, channels }: {
  trigger: ExtTrigger;
  config: ServerAutomation['trigger_config'];
  onChange: (c: ServerAutomation['trigger_config']) => void;
  roles: ServerRole[];
  channels: ChannelData[];
}) {
  const upd = (key: string, val: unknown) => onChange({ ...config, [key]: val });
  const textChs = channels.filter(c => c.type === 'text' || c.type === 'announcement');

  if (trigger === 'role_assigned' || trigger === 'role_removed') return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-500">Konkretna rola (opcjonalnie)</label>
      <Sel value={config.role_id ?? ''} onChange={v => upd('role_id', v || undefined)}
        placeholder="Dowolna rola"
        options={[{ value: '', label: 'Dowolna rola' }, ...roles.map(r => ({ value: r.id, label: r.name }))]}
      />
    </div>
  );

  if (trigger === 'message_contains') return (
    <div className="space-y-2">
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Słowo kluczowe / wyrażenie</label>
        <Input value={config.keyword ?? ''} onChange={v => upd('keyword', v)} placeholder="np. spam, !help"/>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Dopasowanie</label>
          <Sel value={(config.match_type ?? 'contains') as string} onChange={v => upd('match_type', v)}
            options={[
              { value: 'contains',    label: 'Zawiera'         },
              { value: 'starts_with', label: 'Zaczyna się od'  },
              { value: 'ends_with',   label: 'Kończy się na'   },
              { value: 'exact',       label: 'Dokładne'        },
              { value: 'regex',       label: 'Regex'           },
            ]}
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Kanał (opcjonalnie)</label>
          <Sel value={config.channel_id ?? ''} onChange={v => upd('channel_id', v || undefined)}
            placeholder="Dowolny kanał"
            options={[{ value: '', label: 'Dowolny kanał' }, ...textChs.map(c => ({ value: c.id, icon: Hash, label: c.name }))]}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
        <input type="checkbox" checked={!!config.case_sensitive} onChange={e => upd('case_sensitive', e.target.checked)}
          className="w-3.5 h-3.5 rounded accent-indigo-500"/>
        Uwzględnij wielkość liter
      </label>
    </div>
  );

  if (trigger === 'message_sent' || trigger === 'voice_join' || trigger === 'voice_leave') return (
    <div>
      <label className="text-xs text-zinc-500 mb-1 block">Kanał (opcjonalnie)</label>
      <Sel value={config.channel_id ?? ''} onChange={v => upd('channel_id', v || undefined)}
        placeholder="Dowolny kanał"
        options={[{ value: '', label: 'Dowolny kanał' }, ...channels.map(c => ({ value: c.id, icon: Hash, label: c.name }))]}
      />
    </div>
  );

  if (trigger === 'reaction_added') return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Emoji (opcjonalnie)</label>
        <Input value={config.emoji ?? ''} onChange={v => upd('emoji', v)} placeholder="👍"/>
      </div>
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Kanał (opcjonalnie)</label>
        <Sel value={config.channel_id ?? ''} onChange={v => upd('channel_id', v || undefined)}
          placeholder="Dowolny kanał"
          options={[{ value: '', label: 'Dowolny kanał' }, ...textChs.map(c => ({ value: c.id, icon: Hash, label: c.name }))]}
        />
      </div>
    </div>
  );

  return null;
}

// ─── Action config ────────────────────────────────────────────────────────────

function ActionConfig({ action, onChange, roles, channels, idx }: {
  action: AutomationAction;
  onChange: (a: AutomationAction) => void;
  roles: ServerRole[];
  channels: ChannelData[];
  idx: number;
}) {
  const upd = (key: string, val: unknown) => onChange({ ...action, config: { ...action.config, [key]: val } });
  const textChs = channels.filter(c => c.type === 'text' || c.type === 'announcement');
  const t = action.type as ExtActionType;

  return (
    <div className="space-y-2">
      {(t === 'assign_role' || t === 'remove_role') && (
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Rola</label>
          <Sel value={action.config.role_id ?? ''} onChange={v => upd('role_id', v)}
            placeholder="Wybierz rolę"
            options={roles.map(r => ({ value: r.id, label: r.name }))}
          />
        </div>
      )}
      {(t === 'send_channel_message' || t === 'log_to_channel') && (
        <>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Kanał</label>
            <Sel value={action.config.channel_id ?? ''} onChange={v => upd('channel_id', v)}
              placeholder="Wybierz kanał"
              options={textChs.map(c => ({ value: c.id, icon: Hash, label: c.name }))}
            />
          </div>
          {t === 'send_channel_message' && (
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Treść wiadomości</label>
              <Input textarea value={action.config.message ?? ''} onChange={v => upd('message', v)}
                placeholder="Siema {username}! Zmienne: {username} {mention} {server} {channel} {count} {time} {date} {role}"/>
            </div>
          )}
          {t === 'log_to_channel' && (
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
              <input type="checkbox" checked={!!action.config.include_details} onChange={e => upd('include_details', e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-indigo-500"/>
              Dołącz szczegóły (user, kanał, czas)
            </label>
          )}
        </>
      )}
      {(t === 'send_dm' || t === 'warn_user') && (
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Treść DM</label>
          <Input textarea value={action.config.message ?? ''} onChange={v => upd('message', v)}
            placeholder="Witaj na serwerze {server}! Twoja rola: {role}"/>
        </div>
      )}
      {t === 'warn_user' && (
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Kanał logów (opcjonalnie)</label>
          <Sel value={action.config.channel_id ?? ''} onChange={v => upd('channel_id', v || undefined)}
            placeholder="Nie loguj"
            options={[{ value: '', label: 'Nie loguj' }, ...textChs.map(c => ({ value: c.id, icon: Hash, label: c.name }))]}
          />
        </div>
      )}
      {(t === 'mute_member' || t === 'timeout_member') && (
        <>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Czas trwania (minuty)</label>
            <NumInput value={action.config.duration_minutes ?? 10} onChange={v => upd('duration_minutes', v)} min={1} max={10080} placeholder="10"/>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Powód (opcjonalnie)</label>
            <Input value={action.config.reason ?? ''} onChange={v => upd('reason', v)} placeholder="Naruszenie regulaminu"/>
          </div>
        </>
      )}
      {t === 'kick_member' && (
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Powód (opcjonalnie)</label>
          <Input value={action.config.reason ?? ''} onChange={v => upd('reason', v)} placeholder="Kick przez automatyzację"/>
        </div>
      )}
      {t === 'ban_member' && (
        <>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Powód (opcjonalnie)</label>
            <Input value={action.config.reason ?? ''} onChange={v => upd('reason', v)} placeholder="Ban przez automatyzację"/>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Usuń wiadomości (dni)</label>
            <NumInput value={action.config.delete_days ?? 0} onChange={v => upd('delete_days', v)} max={7}/>
          </div>
        </>
      )}
      {t === 'add_reaction' && (
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Emoji</label>
          <Input value={action.config.emoji ?? ''} onChange={v => upd('emoji', v)} placeholder="👍 lub :custom_emoji:"/>
        </div>
      )}
      {t === 'send_webhook' && (
        <>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">URL webhook</label>
            <Input value={action.config.url ?? ''} onChange={v => upd('url', v)} placeholder="https://..."/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Metoda</label>
              <Sel value={(action.config.method ?? 'POST') as string} onChange={v => upd('method', v)}
                options={[{ value: 'POST', label: 'POST' }, { value: 'GET', label: 'GET' }, { value: 'PUT', label: 'PUT' }]}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Body JSON (opcjonalnie)</label>
            <Input textarea value={action.config.body ?? ''} onChange={v => upd('body', v)} placeholder='{"content": "{username} dołączył!"}' />
          </div>
        </>
      )}
      {t === 'set_nickname' && (
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Nick (puste = usuń nick)</label>
          <Input value={(action.config as any).nickname ?? ''} onChange={v => upd('nickname', v)} placeholder="{username} [Member]"/>
        </div>
      )}
    </div>
  );
}

// ─── Condition config ─────────────────────────────────────────────────────────

function ConditionConfig({ cond, onChange, roles, channels }: {
  cond: AutomationCondition;
  onChange: (c: AutomationCondition) => void;
  roles: ServerRole[];
  channels: ChannelData[];
}) {
  const upd = (key: string, val: unknown) => onChange({ ...cond, [key]: val });
  const t = cond.type as ExtCondType;

  if (t === 'user_has_role' || t === 'user_not_has_role') return (
    <Sel value={cond.role_id ?? ''} onChange={v => upd('role_id', v)}
      placeholder="Wybierz rolę"
      options={roles.map(r => ({ value: r.id, label: r.name }))}
    />
  );
  if (t === 'in_channel') return (
    <Sel value={cond.channel_id ?? ''} onChange={v => upd('channel_id', v)}
      placeholder="Wybierz kanał"
      options={channels.map(c => ({ value: c.id, icon: Hash, label: c.name }))}
    />
  );
  if (t === 'account_age_less_than' || t === 'account_age_more_than') return (
    <div className="flex items-center gap-2">
      <NumInput value={cond.days ?? 7} onChange={v => upd('days', v)} min={1} max={3650} placeholder="7"/>
      <span className="text-xs text-zinc-500 shrink-0">dni</span>
    </div>
  );
  if (t === 'member_count_above' || t === 'member_count_below') return (
    <div className="flex items-center gap-2">
      <NumInput value={(cond as any).count ?? 100} onChange={v => upd('count', v)} min={1} placeholder="100"/>
      <span className="text-xs text-zinc-500 shrink-0">członków</span>
    </div>
  );
  if (t === 'message_length_above' || t === 'message_length_below') return (
    <div className="flex items-center gap-2">
      <NumInput value={(cond as any).length ?? 100} onChange={v => upd('length', v)} min={1} placeholder="100"/>
      <span className="text-xs text-zinc-500 shrink-0">znaków</span>
    </div>
  );
  if (t === 'time_between') return (
    <div className="grid grid-cols-2 gap-2">
      <Input value={(cond as any).from_hour ?? '08:00'} onChange={v => upd('from_hour', v)} placeholder="08:00"/>
      <Input value={(cond as any).to_hour ?? '22:00'} onChange={v => upd('to_hour', v)} placeholder="22:00"/>
    </div>
  );
  return null;
}

// ─── Flow Canvas (Visual mode) ────────────────────────────────────────────────

interface NodePos { x: number; y: number; w: number; h: number; }

function FlowArrows({ connections }: { connections: [NodePos, NodePos][] }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 Z" fill="#6366f1" opacity="0.7"/>
        </marker>
      </defs>
      {connections.map(([from, to], i) => {
        const sx = from.x + from.w / 2;
        const sy = from.y + from.h;
        const ex = to.x + to.w / 2;
        const ey = to.y;
        const mid = (sy + ey) / 2;
        const d = `M ${sx} ${sy} C ${sx} ${mid}, ${ex} ${mid}, ${ex} ${ey}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.3"
              strokeDasharray="4 4" markerEnd="url(#arrowhead)"/>
            <path d={d} fill="none" stroke="#818cf8" strokeWidth="1.5" strokeOpacity="0.15"/>
          </g>
        );
      })}
    </svg>
  );
}

function VisualFlowEditor({
  rule, onChange, roles, channels, selectedId, onSelect,
}: {
  rule: Partial<ServerAutomation>;
  onChange: (r: Partial<ServerAutomation>) => void;
  roles: ServerRole[];
  channels: ChannelData[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef   = useRef<HTMLDivElement>(null);
  const condRef      = useRef<HTMLDivElement>(null);
  const actionRefs   = useRef<Map<number, HTMLDivElement>>(new Map());
  const [arrows, setArrows] = useState<[NodePos, NodePos][]>([]);

  // Compute SVG arrow positions after every paint.
  // IMPORTANT: We use the functional setState form and compare JSON to detect
  // unchanged positions — when positions didn't change we return `prev` (same
  // reference), which tells React "nothing changed → skip re-render".
  // This breaks the naive infinite loop: useLayoutEffect → setArrows → re-render → repeat.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const base = containerRef.current.getBoundingClientRect();
    const getPos = (el: HTMLDivElement | null): NodePos | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    };
    const connections: [NodePos, NodePos][] = [];
    const trigPos = getPos(triggerRef.current);
    const condPos = (rule.conditions?.length ?? 0) > 0 ? getPos(condRef.current) : null;
    const source = condPos ?? trigPos;
    if (source && trigPos && condPos) connections.push([trigPos, condPos]);
    actionRefs.current.forEach((el) => {
      const ap = getPos(el);
      if (source && ap) connections.push([source, ap]);
    });
    setArrows(prev => {
      // Same values → same reference → React bails out → no extra render
      if (JSON.stringify(prev) === JSON.stringify(connections)) return prev;
      return connections;
    });
  });

  const trigger = rule.trigger_type as ExtTrigger ?? 'member_join';
  const tmeta = TRIGGER_META[trigger];

  const addAction = () => {
    onChange({ ...rule, actions: [...(rule.actions ?? []), emptyAction()] });
  };
  const removeAction = (i: number) => {
    onChange({ ...rule, actions: (rule.actions ?? []).filter((_, idx) => idx !== i) });
  };
  const updateAction = (i: number, a: AutomationAction) => {
    const acts = [...(rule.actions ?? [])];
    acts[i] = a;
    onChange({ ...rule, actions: acts });
  };
  const addCondition = () => {
    onChange({ ...rule, conditions: [...(rule.conditions ?? []), emptyCondition()] });
  };
  const removeCondition = (i: number) => {
    onChange({ ...rule, conditions: (rule.conditions ?? []).filter((_, idx) => idx !== i) });
  };
  const updateCondition = (i: number, c: AutomationCondition) => {
    const conds = [...(rule.conditions ?? [])];
    conds[i] = c;
    onChange({ ...rule, conditions: conds });
  };

  const nodeBase = "relative rounded-2xl border transition-all cursor-pointer select-none";
  const selectedRing = "ring-2 ring-indigo-500/60 ring-offset-1 ring-offset-transparent";

  return (
    <div ref={containerRef} className="relative w-full p-8 overflow-auto" style={{minHeight:'max(640px, 62vh)'}}>
      <FlowArrows connections={arrows}/>

      {/* Variables hint */}
      <div className="absolute top-3 right-3 text-[10px] text-zinc-600 bg-zinc-900/80 border border-white/[0.05] rounded-lg px-2 py-1">
        Zmienne: <span className="text-zinc-400">{'{username} {mention} {server} {channel} {count} {time} {date} {role}'}</span>
      </div>

      {/* ── Trigger node ── */}
      <div className="flex justify-center mb-8">
        <div ref={triggerRef}
          onClick={() => onSelect(selectedId === 'trigger' ? null : 'trigger')}
          className={`${nodeBase} w-72 p-4 ${tmeta.color} ${selectedId === 'trigger' ? selectedRing : 'hover:border-white/20'}`}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-black/20 ${tmeta.textColor}`}>
              <tmeta.icon size={16}/>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Wyzwalacz</div>
              <div className="text-sm font-semibold text-white">{tmeta.label}</div>
            </div>
            <Pencil size={12} className="ml-auto text-zinc-600"/>
          </div>
          <p className="text-[11px] text-zinc-500 pl-11">{tmeta.description}</p>

          <AnimatePresence>
            {selectedId === 'trigger' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-white/[0.08] space-y-2"
                onClick={e => e.stopPropagation()}
              >
                <label className="text-xs text-zinc-500 block">Typ wyzwalacza</label>
                <Sel value={trigger} onChange={v => onChange({ ...rule, trigger_type: v as AutomationTrigger, trigger_config: {} })}
                  options={(Object.keys(TRIGGER_META) as ExtTrigger[]).map(k => ({ value: k, icon: TRIGGER_META[k].icon, label: TRIGGER_META[k].label }))}
                />
                <TriggerConfig trigger={trigger} config={rule.trigger_config ?? {}} onChange={tc => onChange({ ...rule, trigger_config: tc })} roles={roles} channels={channels}/>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Conditions node ── */}
      {((rule.conditions?.length ?? 0) > 0) && (
        <div className="flex justify-center mb-8">
          <div ref={condRef}
            onClick={() => onSelect(selectedId === 'cond' ? null : 'cond')}
            className={`${nodeBase} w-72 p-4 bg-blue-500/10 border-blue-500/25 ${selectedId === 'cond' ? selectedRing : 'hover:border-blue-500/40'}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-black/20 text-blue-400">
                <Filter size={15}/>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Warunki</div>
                <div className="text-sm font-semibold text-white">{rule.conditions!.length} warunek{rule.conditions!.length > 1 ? 'ów' : ''} (AND)</div>
              </div>
              <Pencil size={12} className="ml-auto text-zinc-600"/>
            </div>
            <div className="space-y-1">
              {rule.conditions!.map((c, i) => {
                const cm = COND_META[c.type as ExtCondType];
                return (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-zinc-400 pl-11">
                    {cm && <cm.icon size={11} className="text-zinc-500 shrink-0"/>}
                    <span>{cm?.label ?? c.type}</span>
                  </div>
                );
              })}
            </div>
            <AnimatePresence>
              {selectedId === 'cond' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="mt-3 pt-3 border-t border-white/[0.08] space-y-3"
                  onClick={e => e.stopPropagation()}
                >
                  {rule.conditions!.map((c, i) => (
                    <div key={i} className="bg-black/20 rounded-xl p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sel value={c.type as ExtCondType} onChange={v => updateCondition(i, { type: v as AutomationCondition['type'] } as AutomationCondition)}
                          options={(Object.keys(COND_META) as ExtCondType[]).map(k => ({ value: k, icon: COND_META[k].icon, label: COND_META[k].label }))}
                        />
                        <button onClick={() => removeCondition(i)} className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"><Trash2 size={13}/></button>
                      </div>
                      <ConditionConfig cond={c} onChange={cc => updateCondition(i, cc)} roles={roles} channels={channels}/>
                    </div>
                  ))}
                  <button onClick={addCondition} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-blue-500/30 text-xs text-blue-400 hover:border-blue-500/60 transition-colors">
                    <Plus size={12}/> Dodaj warunek
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Actions row ── */}
      <div className="flex flex-wrap justify-center gap-4">
        {(rule.actions ?? []).map((a, i) => {
          const am = ACTION_META[a.type as ExtActionType];
          const nodeId = `action-${i}`;
          return (
            <div key={i}
              ref={el => { if (el) actionRefs.current.set(i, el); else actionRefs.current.delete(i); }}
              onClick={() => onSelect(selectedId === nodeId ? null : nodeId)}
              className={`${nodeBase} w-56 p-3.5 ${am?.color ?? 'bg-zinc-500/15 border-zinc-500/30'} ${selectedId === nodeId ? selectedRing : 'hover:border-white/20'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-black/20 ${am?.textColor ?? 'text-zinc-300'}`}>
                  {am?.icon ? <am.icon size={14}/> : <Zap size={14}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Akcja {i + 1}</div>
                  <div className="text-xs font-semibold text-white truncate">{am?.label ?? a.type}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); removeAction(i); }}
                  className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"><Trash2 size={12}/></button>
              </div>
              <AnimatePresence>
                {selectedId === nodeId && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }} className="mt-2 pt-2 border-t border-white/[0.08] space-y-2"
                    onClick={e => e.stopPropagation()}
                  >
                    <Sel value={a.type as ExtActionType} onChange={v => updateAction(i, { type: v as AutomationActionType, config: {} })}
                      options={(Object.keys(ACTION_META) as ExtActionType[]).map(k => ({ value: k, icon: ACTION_META[k].icon, label: ACTION_META[k].label }))}
                    />
                    <ActionConfig action={a} onChange={na => updateAction(i, na)} roles={roles} channels={channels} idx={i}/>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Add action / Add condition buttons */}
        <div className="flex flex-col gap-2 justify-center">
          <button onClick={addAction}
            className="w-16 h-16 rounded-2xl border-2 border-dashed border-indigo-500/30 text-indigo-400 hover:border-indigo-500/60 hover:bg-indigo-500/5 transition-all flex flex-col items-center justify-center gap-1 text-[10px]">
            <Plus size={18}/>
            <span>Akcja</span>
          </button>
          {(rule.conditions?.length ?? 0) === 0 && (
            <button onClick={addCondition}
              className="w-16 h-16 rounded-2xl border-2 border-dashed border-blue-500/20 text-blue-500 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-1 text-[10px]">
              <Filter size={16}/>
              <span>Filtr</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Simple form editor ───────────────────────────────────────────────────────

function SimpleEditor({
  rule, onChange, roles, channels,
}: {
  rule: Partial<ServerAutomation>;
  onChange: (r: Partial<ServerAutomation>) => void;
  roles: ServerRole[];
  channels: ChannelData[];
}) {
  const trigger = rule.trigger_type as ExtTrigger ?? 'member_join';
  const tmeta = TRIGGER_META[trigger];

  const addAction = () => onChange({ ...rule, actions: [...(rule.actions ?? []), emptyAction()] });
  const removeAction = (i: number) => onChange({ ...rule, actions: (rule.actions ?? []).filter((_, idx) => idx !== i) });
  const updateAction = (i: number, a: AutomationAction) => {
    const acts = [...(rule.actions ?? [])]; acts[i] = a; onChange({ ...rule, actions: acts });
  };
  const addCondition = () => onChange({ ...rule, conditions: [...(rule.conditions ?? []), emptyCondition()] });
  const removeCondition = (i: number) => onChange({ ...rule, conditions: (rule.conditions ?? []).filter((_, idx) => idx !== i) });
  const updateCondition = (i: number, c: AutomationCondition) => {
    const conds = [...(rule.conditions ?? [])]; conds[i] = c; onChange({ ...rule, conditions: conds });
  };

  const Section = ({ icon: Icon, title, color, children }: { icon: React.FC<{size?: number; className?: string}>; title: string; color: string; children: React.ReactNode }) => (
    <div className="border border-white/[0.07] rounded-2xl overflow-hidden">
      <div className={`flex items-center gap-2.5 px-4 py-3 ${color}`}>
        <Icon size={14} className="text-current opacity-80"/>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="p-4 space-y-3 bg-zinc-900/40">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Trigger */}
      <Section icon={Zap} title="Wyzwalacz" color="bg-amber-500/10 border-b border-amber-500/15">
        <Sel value={trigger} onChange={v => onChange({ ...rule, trigger_type: v as AutomationTrigger, trigger_config: {} })}
          options={(Object.keys(TRIGGER_META) as ExtTrigger[]).map(k => ({ value: k, icon: TRIGGER_META[k].icon, label: TRIGGER_META[k].label }))}
        />
        <TriggerConfig trigger={trigger} config={rule.trigger_config ?? {}} onChange={tc => onChange({ ...rule, trigger_config: tc })} roles={roles} channels={channels}/>
      </Section>

      {/* Conditions */}
      <Section icon={Filter} title={`Warunki (${rule.conditions?.length ?? 0}) — wszystkie muszą być spełnione`} color="bg-blue-500/10 border-b border-blue-500/15">
        {(rule.conditions ?? []).map((c, i) => (
          <div key={i} className="bg-black/20 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Sel value={c.type as ExtCondType} onChange={v => updateCondition(i, { type: v as AutomationCondition['type'] } as AutomationCondition)}
                  options={(Object.keys(COND_META) as ExtCondType[]).map(k => ({ value: k, icon: COND_META[k].icon, label: COND_META[k].label }))}
                />
              </div>
              <button onClick={() => removeCondition(i)} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 size={13}/>
              </button>
            </div>
            <ConditionConfig cond={c} onChange={cc => updateCondition(i, cc)} roles={roles} channels={channels}/>
          </div>
        ))}
        <button onClick={addCondition} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-blue-500/25 text-xs text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all">
          <Plus size={13}/> Dodaj warunek
        </button>
      </Section>

      {/* Actions */}
      <Section icon={Play} title={`Akcje (${rule.actions?.length ?? 0})`} color="bg-indigo-500/10 border-b border-indigo-500/15">
        {(rule.actions ?? []).map((a, i) => {
          const am = ACTION_META[a.type as ExtActionType];
          return (
            <div key={i} className="bg-black/20 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                {am && <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-black/30 ${am.textColor}`}><am.icon size={13}/></div>}
                <div className="flex-1">
                  <Sel value={a.type as ExtActionType} onChange={v => updateAction(i, { type: v as AutomationActionType, config: {} })}
                    options={(Object.keys(ACTION_META) as ExtActionType[]).map(k => ({ value: k, icon: ACTION_META[k].icon, label: ACTION_META[k].label }))}
                  />
                </div>
                <button onClick={() => removeAction(i)} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 size={13}/>
                </button>
              </div>
              <ActionConfig action={a} onChange={na => updateAction(i, na)} roles={roles} channels={channels} idx={i}/>
            </div>
          );
        })}
        <button onClick={addAction} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-indigo-500/25 text-xs text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all">
          <Plus size={13}/> Dodaj akcję
        </button>
      </Section>

      {/* Cooldown */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900/40 border border-white/[0.07] rounded-2xl">
        <Clock size={14} className="text-zinc-500 shrink-0"/>
        <span className="text-sm text-zinc-400 flex-1">Cooldown na użytkownika</span>
        <div className="flex items-center gap-2 w-36">
          <NumInput value={rule.cooldown_seconds ?? 0} onChange={v => onChange({ ...rule, cooldown_seconds: v })} min={0} max={86400} placeholder="0"/>
          <span className="text-xs text-zinc-500 shrink-0">sek</span>
        </div>
      </div>

      {/* Variables hint */}
      <div className="px-3 py-2.5 bg-zinc-900/60 rounded-xl border border-white/[0.05]">
        <div className="text-[11px] text-zinc-500 font-medium mb-1">Dostępne zmienne w treści wiadomości:</div>
        <div className="flex flex-wrap gap-1.5">
          {['{username}','{mention}','{server}','{channel}','{count}','{time}','{date}','{role}'].map(v => (
            <code key={v} className="text-[10px] bg-zinc-800 text-indigo-300 px-1.5 py-0.5 rounded-md border border-white/[0.06]">{v}</code>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Rule list card ────────────────────────────────────────────────────────────

function RuleCard({ rule, onEdit, onDelete, onToggle }: {
  rule: ServerAutomation;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const tmeta = TRIGGER_META[rule.trigger_type as ExtTrigger] ?? TRIGGER_META.member_join;
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`group flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all cursor-pointer ${rule.enabled ? 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.14]' : 'bg-zinc-900/30 border-white/[0.04] opacity-60'}`}
      onClick={onEdit}
    >
      {/* Trigger icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tmeta.color}`}>
        <tmeta.icon size={16} className={tmeta.textColor}/>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white truncate">{rule.name || 'Bez nazwy'}</span>
          {!rule.enabled && <span className="text-[10px] bg-zinc-700/60 text-zinc-500 px-1.5 py-0.5 rounded-full shrink-0">Wyłączone</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={`text-[11px] font-medium ${tmeta.textColor}`}>{tmeta.label}</span>
          <span className="text-zinc-700">·</span>
          <span className="text-[11px] text-zinc-500">{rule.actions.length} akcj{rule.actions.length === 1 ? 'a' : rule.actions.length < 5 ? 'e' : 'i'}</span>
          {rule.conditions.length > 0 && <>
            <span className="text-zinc-700">·</span>
            <span className="text-[11px] text-zinc-500">{rule.conditions.length} warunek{rule.conditions.length > 1 ? 'ów' : ''}</span>
          </>}
          {rule.cooldown_seconds > 0 && <>
            <span className="text-zinc-700">·</span>
            <span className="text-[11px] text-zinc-500 flex items-center gap-1"><Clock size={9}/> {rule.cooldown_seconds}s</span>
          </>}
        </div>
      </div>

      {/* Action chips (quick preview) */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {rule.actions.slice(0, 3).map((a, i) => {
          const am = ACTION_META[a.type as ExtActionType];
          if (!am) return null;
          return (
            <div key={i} className={`w-6 h-6 rounded-lg flex items-center justify-center ${am.color}`} title={am.label}>
              <am.icon size={12} className={am.textColor}/>
            </div>
          );
        })}
        {rule.actions.length > 3 && <span className="text-[10px] text-zinc-600">+{rule.actions.length - 3}</span>}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onToggle(!rule.enabled); }}
          title={rule.enabled ? 'Wyłącz' : 'Włącz'}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all">
          {rule.enabled ? <EyeOff size={13}/> : <Eye size={13}/>}
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <Trash2 size={13}/>
        </button>
      </div>

      <ChevronDown size={14} className="text-zinc-700 shrink-0 -rotate-90"/>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AutomationsTab({
  serverId, roles, channels,
}: {
  serverId: string;
  gi: string;
  roles: ServerRole[];
  channels: ChannelData[];
}) {
  type Auto = ServerAutomation;
  const [list, setList]       = useState<Auto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRule, setEditRule] = useState<Partial<Auto> | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [mode, setMode]       = useState<'simple' | 'visual'>('visual');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nameVal, setNameVal] = useState('');

  useEffect(() => {
    automationsApi.list(serverId)
      .then(l => { setList(l); setLoading(false); })
      .catch(() => setLoading(false));
  }, [serverId]);

  const openNew = () => {
    const r = emptyRule();
    setEditRule(r);
    setEditId(null);
    setNameVal('');
    setSelectedNode(null);
  };
  const openEdit = (rule: Auto) => {
    setEditRule({ ...rule });
    setEditId(rule.id);
    setNameVal(rule.name);
    setSelectedNode(null);
  };
  const cancelEdit = () => { setEditRule(null); setEditId(null); };

  const save = async () => {
    if (!editRule) return;
    const payload = { ...editRule, name: nameVal || 'Reguła' };
    if (!payload.actions?.length) { return; }
    setSaving(true);
    try {
      if (editId) {
        const updated = await automationsApi.update(serverId, editId, payload as any);
        setList(l => l.map(r => r.id === editId ? updated : r));
      } else {
        const created = await automationsApi.create(serverId, payload as any);
        setList(l => [created, ...l]);
      }
      cancelEdit();
    } catch { /* noop */ } finally { setSaving(false); }
  };

  const del = async (id: string) => {
    await automationsApi.delete(serverId, id).catch(() => {});
    setList(l => l.filter(r => r.id !== id));
  };

  const toggle = async (id: string, enabled: boolean) => {
    await automationsApi.toggle(serverId, id, enabled).catch(() => {});
    setList(l => l.map(r => r.id === id ? { ...r, enabled } : r));
  };

  // ── Edit view ──
  if (editRule !== null) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={cancelEdit}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all shrink-0">
            <ArrowRight size={15} className="rotate-180"/>
          </button>
          <div className="flex-1 min-w-0">
            <input
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              placeholder="Nazwa reguły..."
              className="w-full bg-transparent text-lg font-bold text-white placeholder-zinc-600 focus:outline-none border-b border-transparent focus:border-white/20 transition-colors pb-0.5"
            />
            <p className="text-xs text-zinc-600 mt-0.5">Reguła uruchamia się automatycznie w czasie rzeczywistym</p>
          </div>
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-white/[0.08] rounded-xl p-1 shrink-0">
            <button onClick={() => setMode('simple')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'simple' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <List size={12}/> Prosty
            </button>
            <button onClick={() => setMode('visual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'visual' ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Network size={12}/> Wizualny
            </button>
          </div>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shrink-0">
            <Save size={14}/>{saving ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>

        {/* Editor */}
        <div className="bg-zinc-950/60 border border-white/[0.06] rounded-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            {mode === 'visual' ? (
              <motion.div key="visual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VisualFlowEditor
                  rule={editRule} onChange={setEditRule} roles={roles} channels={channels}
                  selectedId={selectedNode} onSelect={setSelectedNode}
                />
              </motion.div>
            ) : (
              <motion.div key="simple" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
                <SimpleEditor rule={editRule} onChange={setEditRule} roles={roles} channels={channels}/>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Save footer */}
        {!editRule.actions?.length && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
            <AlertTriangle size={13}/> Dodaj co najmniej 1 akcję żeby zapisać regułę
          </div>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Automatyzacje</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Akcje uruchamiane automatycznie na podstawie zdarzeń serwera</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition-all shrink-0 shadow-lg shadow-indigo-500/20">
          <Plus size={14}/> Nowa reguła
        </button>
      </div>

      {/* Stats chips */}
      {list.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/60 border border-white/[0.07] rounded-full text-xs text-zinc-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
            {list.filter(r => r.enabled).length} aktywnych
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/60 border border-white/[0.07] rounded-full text-xs text-zinc-500">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"/>
            {list.filter(r => !r.enabled).length} wyłączonych
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-white/[0.02] animate-pulse"/>)}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <Zap size={28} className="text-indigo-400"/>
          </div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-1">Brak reguł automatyzacji</h3>
          <p className="text-xs text-zinc-600 max-w-xs mb-5">Twórz reguły które automatycznie wykonują akcje gdy coś się dzieje na serwerze — powitania, role, moderacja i więcej.</p>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition-all">
            <Plus size={14}/> Utwórz pierwszą regułę
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(rule => (
            <RuleCard key={rule.id} rule={rule} onEdit={() => openEdit(rule)}
              onDelete={() => del(rule.id)} onToggle={e => toggle(rule.id, e)}/>
          ))}
        </div>
      )}
    </div>
  );
}
