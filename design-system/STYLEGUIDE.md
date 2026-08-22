# Chord Hoard style guide — "Fake Book"

Implementation spec for the 2026-08 redesign (approved options 2a/2b/2c in
`Redesign.dc.html`; baseline in `Current UI.dc.html`). Written for Claude Code
to apply across the whole app: `css/app.css` + `js/ui/*`. No build step, no
frameworks — same constraints as today.

## 1. Identity in one paragraph

The app reads like a well-set fake book: warm paper, hairline rules, serif
chord symbols, quiet ALL-CAPS monospace metadata. Dark mode is **stage mode**:
a true near-black page where the current chord is the only bright thing.
Harmony gets colour, difficulty gets bars, beats get dots, and blue belongs to
the interface alone.

## 2. Tokens

`tokens.css` in this folder replaces the token blocks at the top of
`css/app.css` (same names + a few new ones, same light/dark/data-theme
contract). New tokens: `--font-display`, `--font-mono`, `--line-strong`,
`--lv-off`, `--beat-dot/--beat-on/--beat-off`, `--fs-meta/--ls-meta`,
`--fs-chord-row/-chart/-now/-next`.

Newsreader is **self-hosted** — DONE, do not re-add a CDN link. The files
live in `fonts/` (Google's `latin` subset of the variable font, roman +
italic, 276KB total, with `OFL.txt` alongside as the licence requires),
are declared with `@font-face` at the top of `css/app.css`, preloaded in
`index.html`, and precached by `sw.js`. A `fonts.googleapis.com` link would
break offline use, which is the whole point of the PWA.

`latin-ext` and `vietnamese` are deliberately not shipped: a sweep of every
JSON and JS file found only `ã` and `í` beyond ASCII, both inside `latin`'s
own range.

**Newsreader has no musical glyphs.** Verified against the upstream variable
TTF's cmap: 658 glyphs, and no `♭` (U+266D), `♯` (U+266F) or `‖` (U+2016).
Google's `text=` endpoint appears to offer them and returns an invalid font,
so that is a dead end. Consequences, both already handled:

- Accidentals in chord symbols fall back to the system serif by design. The
  `unicode-range` does not claim those codepoints, so the fallback is
  immediate rather than a failed lookup.
- Barlines and repeat marks in the chart hero are **CSS borders, not glyphs**
  (§5.3). A typed `|`/`:‖` would render in a different face at a different
  weight from the chords beside it.

## 3. The three type voices

| Voice | Font | Used for | Never for |
|---|---|---|---|
| Display | `--font-display` (Newsreader) | chord symbols, progression names (italic 600 for titles), lyric words (italic), editorial prose ("From the bandstand") | controls, metadata |
| UI | `--font` (system sans) | buttons, section labels, body copy in settings/filters | chord symbols |
| Meta | `--font-mono` | metadata lines, counts, key/BPM strips, control captions — ALWAYS uppercase, `letter-spacing: var(--ls-meta)` up to `.18em`, colour `--ink-faint` | anything the eye should land on first |

App title: Newsreader italic 600, first letter `--accent` (kept).

## 4. Symbology (strict)

- **Beats = round dots.** Filled `--beat-on`, unfilled `--beat-off`. 4px in
  browse/detail, 11px in perform. One dot per beat; playback fills them left
  to right within the sounding chord.
- **Difficulty = rising bars.** Three bars 3px wide, heights 5/8/11px, gap
  2px, `border-radius:1px`, bottom-aligned. Filled count = level (G1→1,
  G2→2, G3→3; piano P1–P4 uses 4 bars), fill colour = that level's `--lv-*`,
  rest `--lv-off`. Replaces the text badge everywhere a glance is enough;
  the detail view keeps a labelled badge (`G1`) in its mono meta line.
- **Harmony = function tint.** `.fn-*` classes exactly as today (text
  colour); perform mode may also use the tint for underline, beat dots and
  the queue rail at reduced opacity (~55%). Legend lives in settings only —
  no inline legend rows anywhere anymore.
- **Pin = push-pin icon** (existing SVG), outline `--ink-faint`, filled
  `--accent` when pinned. Present on every ledger row and the detail top bar.
- **Blue = interface.** Links, active states, pinned. Never harmony.

## 5. Components

### 5.1 Meta line
```css
.meta { font: 500 var(--fs-meta) var(--font-mono); letter-spacing: var(--ls-meta);
        text-transform: uppercase; color: var(--ink-faint); }
```
Content pattern: `4/4 · 4 BARS · MID · POP ROCK · hopeful` (moods stay
lowercase inside the caps line — they read as words, not codes).

### 5.2 Ledger row (Hoard) — replaces `.card`
Hairline-separated rows on `--bg`, no card boxes, no chips, no left stripe.
```
row      padding: 12px 20px; border-bottom: 1px solid var(--line-soft);
line 1   flex: name (display serif 700 19px) … [level bars] [pin]
line 2   chords: display serif 600 var(--fs-chord-row), tinted .fn-*;
         display:flex; flex-wrap:wrap; column-gap:18px; each chord
         min-width:24px  ← rhythm stays even whatever the symbol length
line 3   .meta
```
Whole row is the link; pin is a nested button (same
preventDefault/stopPropagation as today). Tap-and-hold or a second tap
target can reveal numerals + full moods (progressive disclosure);
`.card-numerals` as an always-visible line is gone.

Header above the list: serif italic title, cog, `GTR|PNO` mono pill toggle.
Search collapses to a hairline-underlined field with `⌕`, `FILTER` mono
button and the 🎲 roulette as an icon beside it (full-width pill removed).
Count line is `.meta`: `349 PROGRESSIONS`.

### 5.3 Chart hero (Detail) — replaces `.chord-strip`
A bar-line chart between 2px `--line-strong` rules:
`| C•••• | G•••• | Am•••• | F•••• :‖` — barlines display serif 24px
`--line`-ish (#b3ab94 on paper), chords display serif 700
`--fs-chord-chart` tinted by function, 4px beat dots underneath each
(neutral fill). End repeat `:‖` when the progression loops. During playback
the sounding chord's dots fill with its function tint.

### 5.4 Fold rows (Detail) — progressive disclosure
Everything below the transport is a hairline-separated fold row:
`label (ui 600 14px) …… summary (.meta) ›`. Key & capo, Chord shapes,
Solo with, As heard in. Open state swaps `›` for `⌄` and renders the
existing content (wheel, diagram strip, songs list) beneath. "From the
bandstand" prose renders in display serif 15.5px/1.5. Perform CTA is a
full-width dark bar (`--ink` bg, `--bg` text) pinned at the end.
Lyric words: display serif italic 15px `--ink-faint`, ABOVE the chart.

### 5.5 Control pills
Mono-voice pills: `border:1px solid var(--line); border-radius:var(--radius-pill);`
label in `.meta` style at 11–12px (`▶ PLAY`, `⟳ AUTO`, `− 96 +`, `LOOP`).
Primary play in detail: 40px circle, `--ink` bg / `--bg` glyph. Active pill:
`--accent` bg, `--on-accent` text. Min tap target 44px (pad the hitbox, not
the visual).

### 5.6 Perform — Teleprompter (replaces the 2×2 grid)
Layout, top to bottom (portrait):
1. **Title block** — name (display serif italic 600 22px, `--ink`),
   `.meta` line `C MAJOR · 4/4 · 96 BPM · NO CAPO` (capo mode swaps this
   line's content exactly as today's `infoText()`).
2. **Queue rail** — absolutely positioned left edge, vertically centred:
   every chord of the progression, display serif 600 26px, tinted by
   function at 55% opacity; the current one full-opacity with a 3px
   function-tint left rule. Tap a rail entry to jump there.
3. **NOW chord** — display serif 700 `--fs-chord-now`, `--ink`, 5px
   function-tint underline. Under it: 11px beat dots (function tint /
   `--beat-off`) + `4 BEATS` in `.meta`; then the chord's guitar shape
   (existing `guitarChordSVG`, ~96px, strings `--line`, dots `--ink`),
   piano keyboard when instrument = piano. Shape hidden below ~700px
   viewport height.
4. **NEXT** — `.meta` caption `NEXT` + chord at `--fs-chord-next`,
   function tint at 60%.
5. **Lyric words** — display serif italic 18px `--ink-dim`, single centred
   line (same shrink-to-fit logic from words.js).
6. **Control bar** — hairline-top row: `✕  ⚙  ▶ PLAY  ⟳ AUTO  − 96 +`.
   **Auto-hide:** fades out (opacity 0, pointer-events none) 4s after the
   last interaction while playback/auto-advance runs; any tap on the stage
   brings it back. Never auto-hide while idle. Keep wake-lock dot as a tiny
   `--accent-dim` ● beside the meta line, and arrow-key/pedal prev–next
   exactly as today (song/setlist context adds ‹ › to the control bar).
Advancing: auto-advance and playback move NOW/NEXT/rail together; the
whole progression no longer needs to fit on screen, so the fit-to-viewport
font loop only clamps the NOW chord (`clamp()` handles most of it).
Landscape: rail moves to a top horizontal strip; NOW and NEXT sit side by
side (NEXT right, 40% scale).

### 5.7 What's deleted
`.chip.static` meta chips, `.mood-tag` pills in lists, `.roulette-btn`
full-width pill, inline `.fn-legend` rows (settings keeps one), `.card`
boxes + left stripe, text `.badge` in the hoard list, the perform 2×2 grid,
`.perform-cell.blank` fillers, the perform words/legend row-swap.

## 6. Screen-by-screen mapping

| Screen | File | Change |
|---|---|---|
| Shell/header/tabbar | index.html, app.css | Serif italic title; tabbar unchanged structurally, active = `--accent` |
| Hoard | js/ui/hoard.js | Ledger rows (5.2); filters sheet keeps chips (selection UI is fine) but groups get `.meta` headings |
| Detail | js/ui/detail.js | Words above chart; chart hero (5.3); transport pills (5.5); fold rows (5.4); wheel/diagrams/songs render inside folds unchanged |
| Perform | js/ui/perform.js | Teleprompter (5.6); keep wake lock, capo mode, roulette 🎲 (control bar), song/setlist nav |
| Chords/Scales/Build/Songs | js/ui/*.js | Not redesigned yet — adopt tokens, type voices, meta lines and pills so nothing looks orphaned |
| Settings | settings-panel.js | Unchanged + the single remaining tint legend |

## 7. Non-negotiables

- 44px minimum tap targets; visible sizes may be smaller but hitboxes not.
- Every colour through a token; anything hardcoded is invisible in one theme.
- `body[data-tint="off"]` still neutralises all `.fn-*` colour (and perform
  falls back to `--ink` underline/dots).
- `prefers-reduced-motion`: no control-bar fade, instant show/hide.
- Chord/note strings still go through `prettySymbol()`; never hand-write ♭/♯.
- Newsreader must be precached in `sw.js` or the stage flashes fallback
  serif mid-gig.
