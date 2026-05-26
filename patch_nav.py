"""
patch_nav.py — Top-nav layout fixes
  N1  Wrap nav + tabs bar in ONE glass card (zero gap between them)
  N2  Server scroll: left/right arrows + fixed "+" button outside scroll track
  N3  Fix ring clipping on server-pill icons (move ring to outer wrapper)
  N4  Activity dots have py breathing room so overflow-hidden won't clip them
  N5  Own-avatar button: add slight padding so hover ring doesn't clip
  N6  Outer layout: gap-2 → gap-1.5 (slightly tighter overall)
"""

SRC = r'E:\Cordis-gm-main\src\App.tsx'
with open(SRC, 'r', encoding='utf-8') as f:
    code = f.read()

patches = []

def apply(label, old, new, count=1):
    global code
    if old not in code:
        patches.append(f'  MISS {label}')
        return
    n = code.count(old)
    code = code.replace(old, new, count)
    patches.append(f'  OK   {label}  (found {n}×)')

# ─── N1a: Outer div — gap-2 → gap-1.5 ────────────────────────────────────────
apply('N1a: outer gap-2→gap-1.5',
'flex flex-col h-[100dvh] w-full text-zinc-300 font-sans overflow-hidden relative bg-transparent p-2 gap-2',
'flex flex-col h-[100dvh] w-full text-zinc-300 font-sans overflow-hidden relative bg-transparent p-2 gap-1.5')

# ─── N1b: Wrap nav in glass card — insert wrapper div + strip nav's own glass ─
apply('N1b: nav glass-panel → wrapper div',
'      <nav className="h-12 shrink-0 z-30 glass-panel rounded-2xl px-2 grid" style={{gridTemplateColumns:\'auto minmax(0,1fr) auto\'}}>',
'      {/* Nav + tabs bar share ONE glass card — no gap, seamless grid */}\n      <div className="shrink-0 z-30 glass-panel rounded-2xl overflow-hidden flex flex-col">\n      <nav className="h-12 px-2 grid" style={{gridTemplateColumns:\'auto minmax(0,1fr) auto\'}}>')

# ─── N1c: Tabs bar — remove own glass-panel/rounded (uses parent's now) ───────
apply('N1c: tabs bar glass-panel strip',
'          <div className="shrink-0 glass-panel rounded-2xl overflow-hidden">',
'          <div className="border-t border-white/[0.05] overflow-hidden">')

# ─── N1d: Close wrapper div + keep mobile overlay outside it ──────────────────
apply('N1d: close nav+tabs wrapper before mobile overlay',
'      })()}\n\n      {isMobileOpen',
'      })()}\n      </div>{/* /nav+tabs-wrapper */}\n\n      {isMobileOpen')

# ─── N2: Center column — add scroll arrows, fix + button outside track ─────────
OLD_CENTER = (
    '        {/* Center col — server icons (scrollable, icon-only for space) */}\n'
    '        <div className="hidden md:flex items-center min-w-0 overflow-hidden px-1 relative"\n'
    '          style={{maskImage:\'linear-gradient(to right,transparent 0,black 16px,black calc(100% - 16px),transparent 100%)\','
    'WebkitMaskImage:\'linear-gradient(to right,transparent 0,black 16px,black calc(100% - 16px),transparent 100%)\'}}>\n'
    '          <div className="flex items-center gap-0.5 overflow-x-auto" style={{scrollbarWidth:\'none\',WebkitOverflowScrolling:\'touch\'}}>\n'
    '\n'
    '            {/* Server pills */}\n'
    '            {serverList.map(srv=>{'
)
NEW_CENTER = (
    '        {/* Center col — server tabs with left/right arrows, fixed + button */}\n'
    '        <div className="hidden md:flex items-center min-w-0 gap-0.5 px-1">\n'
    '          {/* Left scroll arrow */}\n'
    '          <button onClick={()=>srvTabsRef.current?.scrollBy({left:-200,behavior:\'smooth\'})}\n'
    '            className="shrink-0 w-5 h-full flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors">\n'
    '            <ChevronLeft size={12}/>\n'
    '          </button>\n'
    '          {/* Scrollable track with fade mask */}\n'
    '          <div className="flex-1 overflow-x-hidden"\n'
    '            style={{maskImage:\'linear-gradient(to right,transparent 0,black 10px,black calc(100% - 10px),transparent 100%)\','
    'WebkitMaskImage:\'linear-gradient(to right,transparent 0,black 10px,black calc(100% - 10px),transparent 100%)\'}}>\n'
    '          <div ref={srvTabsRef} className="flex items-center gap-0.5 overflow-x-auto py-0.5" style={{scrollbarWidth:\'none\',WebkitOverflowScrolling:\'touch\'}}>\n'
    '\n'
    '            {/* Server pills */}\n'
    '            {serverList.map(srv=>{'
)
apply('N2a: center column wrapper + left arrow', OLD_CENTER, NEW_CENTER)

# ─── N2b: Remove + button from inside scroll track, close track divs, add arrow + fixed + ─
OLD_ADD = (
    '            {/* Add server */}\n'
    '            <button onClick={()=>setCreateSrvOpen(true)} title="Dodaj serwer"\n'
    '              className="flex items-center justify-center w-7 h-7 rounded-xl border border-dashed border-white/[0.15] text-zinc-500 hover:text-white hover:border-white/[0.4] transition-all shrink-0 ml-0.5">\n'
    '              <Plus size={13}/>\n'
    '            </button>\n'
    '          </div>\n'
    '        </div>'
)
NEW_ADD = (
    '          </div>{/* /scroll track */}\n'
    '          </div>{/* /mask wrapper */}\n'
    '          {/* Right scroll arrow */}\n'
    '          <button onClick={()=>srvTabsRef.current?.scrollBy({left:200,behavior:\'smooth\'})}\n'
    '            className="shrink-0 w-5 h-full flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors">\n'
    '            <ChevronRight size={12}/>\n'
    '          </button>\n'
    '          {/* Add server — fixed outside scroll, always visible */}\n'
    '          <button onClick={()=>setCreateSrvOpen(true)} title="Dodaj serwer"\n'
    '            className="flex items-center justify-center w-7 h-7 rounded-xl border border-dashed border-white/[0.15] text-zinc-500 hover:text-white hover:border-white/[0.4] transition-all shrink-0">\n'
    '            <Plus size={13}/>\n'
    '          </button>\n'
    '        </div>'
)
apply('N2b: close track, add right arrow + fixed plus', OLD_ADD, NEW_ADD)

# ─── N3: Server pill icon — ring on wrapper span not on overflow-hidden span ───
# Move ring from inner <span class="overflow-hidden ring-..."> to outer <button>
# The button already has border; we'll keep ring separate via the icon wrapper.
# Strategy: replace the icon span that has both overflow-hidden AND ring with
# a two-layer approach: outer span has ring, inner span has overflow-hidden.
OLD_ICON_SPAN = (
    '                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden '
    '${isAct?\'ring-1 ring-[rgba(255,143,64,0.5)]\':\mention?\'ring-1 ring-amber-400/50\':unrd?\'ring-1 ring-sky-400/40\':\'\'}`}>'
)
# Note: actual source might have different escaping. Let me match actual source.
OLD_ICON_SPAN2 = (
    "                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${isAct?'ring-1 ring-[rgba(255,143,64,0.5)]':mention?'ring-1 ring-amber-400/50':unrd?'ring-1 ring-sky-400/40':''}`}>"
)
NEW_ICON_SPAN2 = (
    "                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 p-px ${isAct?'ring-1 ring-[rgba(255,143,64,0.5)]':mention?'ring-1 ring-amber-400/50':unrd?'ring-1 ring-sky-400/40':''}`}>\n"
    "                  <span className=\"w-full h-full rounded-[7px] overflow-hidden flex items-center justify-center\">"
)
apply('N3a: icon ring outer wrapper', OLD_ICON_SPAN2, NEW_ICON_SPAN2)

# Close the inner span (the one we just added) — after the icon content
OLD_ICON_CLOSE = (
    "                      : <span className={`w-full h-full flex items-center justify-center text-[10px] font-bold text-white rounded-lg ${isAct?'bg-gradient-to-br from-[#FF8F40] to-[#FFB454]':'bg-[#1a2030]'}`}>{srv.name.charAt(0).toUpperCase()}</span>}}\n"
    "                  </span>"
)
NEW_ICON_CLOSE = (
    "                      : <span className={`w-full h-full flex items-center justify-center text-[10px] font-bold text-white rounded-[7px] ${isAct?'bg-gradient-to-br from-[#FF8F40] to-[#FFB454]':'bg-[#1a2030]'}`}>{srv.name.charAt(0).toUpperCase()}</span>}}\n"
    "                  </span>{/* /overflow-hidden inner */}\n"
    "                  </span>{/* /ring outer */}"
)
apply('N3b: close inner overflow span', OLD_ICON_CLOSE, NEW_ICON_CLOSE)

# ─── N5: Own avatar button — keep overflow-hidden but add ring outside ─────────
apply('N5: own avatar button small padding',
'          <button onClick={openOwnProfile} className="w-7 h-7 rounded-full border-2 border-white/[0.08] overflow-hidden hover:border-indigo-500/50 transition-all shrink-0 shadow-sm ml-0.5">',
'          <button onClick={openOwnProfile} className="w-7 h-7 rounded-full border-2 border-white/[0.08] overflow-hidden hover:border-indigo-500/50 transition-all shrink-0 shadow-sm ml-0.5 ring-0 hover:ring-2 hover:ring-indigo-500/20">')

# ─── Report ───────────────────────────────────────────────────────────────────
ok = sum(1 for p in patches if 'OK' in p)
print(f'\nApplied {ok} / {len(patches)} patches:')
for p in patches: print(p)

with open(SRC, 'w', encoding='utf-8') as f:
    f.write(code)
print(f'\nSaved. ({len(code)} chars)')
