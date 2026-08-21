# CLAUDE.md — Chord Hoard

Chord Hoard is an offline-first, mobile-first web app for songwriters and improvising
musicians: a searchable hoard of hundreds of tagged chord progressions, plus a chord
library, scale library, and a dynamic progression builder. It is being built for Jack
(owner), a musical-improv performer and songwriter, but is designed so it could one day
be released to songwriters generally.

Read this whole file before doing any work. It is the project's single source of truth.
Update the **Phase status** section when you complete work.

## The user (drives the complexity system)

Jack plays piano and guitar at beginner/intermediate level.

**Piano:** all standard major/minor triads in first inversion (slower when the chord root
is a black key). All inversions solid for natural-root (white-key-root) maj/min chords.
Knows sus2, sus4, maj7, min7, dom7 variants only for chords diatonic to C major.

**Guitar:** all of the above plus all black-key/incidental roots. Comfortable with open
chords, power chords, and finding chords/triads with 6th- and 5th-string roots via the
CAGED system.

Limited theory knowledge — the app must always show *both* Roman numerals and named
chords, and explanatory notes should teach gently without jargon walls.

## Product decisions (agreed with user — do not change without asking)

- Name: **Chord Hoard**. Favourites are called **pins** ("pin it to your hoard").
- Offline-first PWA, deployed to GitHub Pages (phase 5). Shareable URL, installable,
  works with zero data once cached.
- ~350 progressions in v1, generated in themed batches. (Raised from ~300 on
  2026-08-03: the themed batch list ran to twelve rather than the eight originally
  assumed, and Jack chose to keep every theme rather than fold any together.) Musical-theatre range matters:
  everything from "silly song about cheese-making" to "epic space opera" — but tags and
  copy should speak to songwriters generally, not just theatre.
- Song examples: 2–3 **famous, high-confidence** songs per progression (key + section).
  Omit rather than guess. Obscure progressions may legitimately have none.
- Dynamic progression builder ships in v1.
- Audio playback: originally scoped as v2 ("design data/UI so it can slot in, but
  do not build it"). Superseded 2026-08-21 by `docs/roadmap.md`, agreed with Jack,
  which promoted it to tier 1 ("the multiplier" — everything in the roadmap's
  teaching tier depends on it) and it shipped in v1. See the phase status entry
  for roadmap 1.1.
- Favourites/pins, saved song structures, and playability profiles live in
  `localStorage` on the user's device. Provide JSON export/import for backup/sharing.

## Architecture rules (hard constraints)

- **Vanilla HTML/CSS/JS. No build step. No frameworks. No runtime dependencies.**
  ES modules loaded natively. This must stay easy to modify and host anywhere.
- Node is used ONLY for repo tooling in `tools/` (validation, tests, data generation
  helpers). Standard library only — no npm packages without a very good reason.
- All app data ships as static JSON under `data/`.
- Everything must work from a **subpath** (GitHub Pages `…/chord-hoard/`): relative
  URLs only, no absolute `/` paths.
- Mobile-first. Test layouts at 360×780 (portrait) and 780×360 (landscape).
- Progressions are stored ONCE as Roman numerals + metadata. Never store per-key chord
  names, diagrams, or anything else the engine can compute.
- `localStorage` keys are namespaced `chordhoard.*`.

## Repo layout

```
chord-hoard/
  CLAUDE.md
  README.md
  index.html            # app shell (phase 2)
  css/
  js/
    engine/             # pure logic, no DOM. Fully unit-tested.
      theory.js         # pitch/letter/spelling primitives
      numeral.js        # Roman numeral parsing
      chords.js         # chord realization (numeral + key → named chord + notes)
      capo.js           # capo suggestions for guitar
      complexity.js     # complexity rating + playability profiles
      progression.js    # progression-level API (load entry, render in key)
      song.js           # song-builder suggestion scoring + section realization
    ui/                 # DOM code (phase 2+)
      chord-copy.js     # the ONE place chord explanations are written
      songs.js          # song builder view (#/songs, #/songs/<id>)
      songs-store.js    # chordhoard.songs storage
  data/
    schema.md           # human-readable schema description
    vocab.json          # controlled vocabularies (moods, genres, feels)
    progressions/       # *.json, one file per themed batch
    guitar-chords.json  # guitar voicing shapes (phase 2)
    moves.json          # dynamic-builder suggestion rules (phase 4)
  tools/
    validate.js         # node tools/validate.js — MUST pass before any commit
    test-engine.js      # node tools/test-engine.js — MUST pass before any commit
    test-copy.js        # node tools/test-copy.js — guards chord-copy.js
  docs/
    inspiration.md      # Jack's original progression list (see note below)
```

`docs/inspiration.md` note: entries **1–40 are off-target — ignore them**. Entries
41–66 (and the overall style of mood labels + terse performance notes) are on-target
inspiration for library generation.

## Data model

### Progression entry (JSON)

```json
{
  "id": "folk-jig-01",
  "name": "Fiddler's Lift",
  "mode": "major",
  "numerals": [
    { "numeral": "I", "beats": 6 },
    { "numeral": "IV", "beats": 6 },
    { "numeral": "V", "beats": 6 },
    { "numeral": "I", "beats": 6 }
  ],
  "bars": 4,
  "timeSig": "6/8",
  "homeKey": "G",
  "tempo": "fast",
  "moods": ["joyful", "rustic", "dancing"],
  "genres": ["folk"],
  "instrument": "both",
  "notes": "A common folk move — play it quickly in 6/8 so it feels like a jig. Strum or roll the chords rather than blocking them.",
  "songs": [
    { "title": "…", "artist": "…", "key": "D", "section": "chorus" }
  ]
}
```

Rules:

- `id`: unique, kebab-case, stable forever (pins reference it).
- `mode`: one of `major`, `minor`, `dorian`, `mixolydian`, `lydian`, `phrygian`.
  Numerals are ALWAYS measured against the **major scale of the tonic** (see syntax
  below), regardless of mode — mode just sets the default palette and the relative
  scale shown in the UI.
- `numerals[].beats`: duration in beats of the time signature (6/8 bar = 6 beats).
  A chord may span multiple bars or half a bar; total beats must equal
  `bars × beats-per-bar`.
- `bars`: 2–16. Vary: 2, 4, 6, 8, 12-bar-blues shapes, odd phrase lengths.
- `homeKey`: the key it sounds/plays best in (tonic note, e.g. `"G"`, `"Bb"`, `"F#"`).
- `tempo`: `slow` | `mid` | `fast` (searchable feel, not BPM).
- `moods`/`genres`: values MUST exist in `data/vocab.json`. Add new vocab entries
  deliberately and sparingly — filters die when vocab sprawls.
- `instrument`: `guitar` | `piano` | `both` — where it shines, not where it's possible.
- `notes`: 1–3 sentences, performance-focused, in the voice of a friendly bandmate
  (see docs/inspiration.md entries 41–66 for tone).
- `songs`: 0–3 entries, famous only. `section`: `intro`|`verse`|`prechorus`|`chorus`|
  `bridge`|`outro`|`throughout`.
- NO complexity field — complexity is computed per key/instrument by the engine.

### Roman numeral syntax (the contract between data and engine)

```
numeral  := accidental? degree suffix* bass?
accidental := "b" | "#"          (relative to the MAJOR scale of the tonic)
degree   := I II III IV V VI VII (uppercase = major triad)
          | i ii iii iv v vi vii (lowercase = minor triad)
suffix   := "sus2" | "sus4" | "7" | "maj7" | "6" | "add9" | "dim" | "aug" | "5"
bass     := "/" digit 1–7        (diatonic scale degree of the bass note)
```

- Degrees are always relative to the tonic's major scale. Natural minor is therefore
  spelled `i · bIII · iv · v · bVI · bVII` (+ `iidim`); harmonic-minor dominant is `V`.
- `7` on uppercase = dominant 7th (`V7`); on lowercase = minor 7th (`ii7`).
- `maj7` = major 7th (on uppercase). `6` = added 6th. `add9` = added 9th.
- `dim` / `aug` replace the triad quality; write them on lowercase/uppercase
  respectively by convention (`viidim`, `bIIIaug`).
- `5` = power chord (root + fifth, no third) — guitar-flavoured.
- At most ONE of {sus2, sus4, dim, aug, 5}; at most ONE of {7, maj7, 6, add9};
  sus may combine with 7 (`V7sus4`). Nothing fancier in v1 (no 9/11/13, no m7b5, ø, °7).
- Secondary dominants are written as chromatic numerals, not slash notation:
  E major in C is `III`, not `V/vi`.
- Slash bass example: `I/3` in C = C/E.

### Chord formulas (semitones from root)

maj [0,4,7] · min [0,3,7] · dim [0,3,6] · aug [0,4,8] · sus2 [0,2,7] · sus4 [0,5,7] ·
5 [0,7] · dom7 +[10] · min7 +[10] · maj7 +[11] · 6 +[9] · add9 +[14]

### Note spelling (must be correct, not just enharmonically equivalent)

Work in (letter, accidental) space, not semitone space:

1. Tonic has a letter (e.g. key `Bb` → letter B, accidental −1).
2. A numeral's degree fixes the chord-root **letter**: tonic letter + (degree−1) steps
   through A–G. Its accidental is whatever makes the semitone distance match the major
   scale degree (adjusted by the numeral's b/#).
3. Chord tones stack in thirds from the root letter (root, +2 letters, +4 letters…),
   each tone's accidental making the semitone interval match the chord formula.
   sus2/sus4/add9/6 tones use letter distance 1/3/1/5 from root respectively.

This yields `bVI` in C minor = **Ab** (not G#), `V` in C# major = **G#** (not Ab), and
the dim fifth of `viidim` in C = **F natural** over B, automatically.

Supported keys (spelling choices locked):
majors `C G D A E B F# F Bb Eb Ab Db` · minors `Am Em Bm F#m C#m G#m Dm Gm Cm Fm Bbm Ebm`.
Transposition UI offers exactly these 12 tonics per mode.

## Chord engine API (js/engine/ — pure functions, no DOM, no state)

- `numeral.parse(str)` → `{accidental, degree, upper, suffixes, bass}` — throws on
  invalid input (validation relies on this).
- `chords.realize(parsed, tonic, /*mode not needed*/)` → `{symbol, root, quality,
  notes, pitchClasses, bassNote}` e.g. `("bVI","C")` → `{symbol:"Ab", notes:["Ab","C","Eb"]…}`.
- `progression.render(entry, tonic)` → array of realized chords with beats, plus
  derived info (all distinct chords used).
- `capo.suggest(realizedChords, tonic)` → `{capo, playAs, shapes}` — smallest capo
  0–7 that maps the progression's chords onto open-friendly shapes (open-shape tonics:
  C, A, G, E, D major / Am, Em, Dm minor); `null` if capo 0 is already best.
- `complexity.rate(realizedChords, instrument, profile)` → `{level, perChord}` using
  the level definitions below; `profile` is an optional map of chord symbol →
  `playable` | `shaky` | `nope` that overrides the defaults.

### Complexity levels (defaults, before personal profile overrides)

Piano — **P1**: maj/min triads with white-key roots, plus sus2/sus4/7/maj7/min7 on
chords diatonic to C major. **P2**: any maj/min triad (black-key roots). **P3**:
sus/7th/6/add9 colours outside C-diatonic; slash-bass chords. **P4**: dim, aug,
anything borrowed/chromatic with extensions.
Guitar — **G1**: open chords, power chords, natural- and incidental-root maj/min via
CAGED (Jack's baseline). **G2**: barre-heavy keys, sus/7th colours off the open shapes.
**G3**: dim, aug, unusual voicings.
A progression's level = its hardest chord. Ratings are computed **per key** — the same
numerals can be P1 in C and P3 in Eb — and capo suggestions can lower the guitar level.

## Feature set (v1)

Search/filter by collection, mood, genre, mode, bars, time signature, tempo, instrument,
computed complexity, and playability profile ("only chords I've marked playable" / "all playable
except exactly one, for practice"). Progression cards: numerals + named chords in the
chosen key, transpose control, capo indicator, guitar + piano diagrams, notes, songs,
pin button (records the key). Chord library: browse by root/quality, piano diagram +
multiple guitar voicings, common next-chord suggestions. Scale library: any supported
key/mode → scale notes on both instruments, diatonic chords with numerals, common
borrowed moves. Dynamic builder: start from any chord, get next-move suggestions at
three spice levels (🌶 diatonic, 🌶🌶 tasteful colour, 🌶🌶🌶 borrowed/chromatic),
context-aware over the whole progression so far; save results into the library. Song
builder: 2–4 named sections (verse/prechorus/chorus/bridge) displayed simultaneously,
auto-suggested for mood/key continuity or hand-picked, saveable + exportable. Performance
mode: one progression or full song structure, huge type, zero scrolling, portrait or
landscape, Screen Wake Lock held.

## Live deployment

Live at **https://jdw96.github.io/chord-hoard/** (GitHub Pages, repo `jdw96/chord-hoard`,
deploy from main branch root). As of 2026-08-15, a Cowork session with `mcp__workspace__bash`
access to this clone can push directly: Jack issued a fine-grained PAT (scoped to just
this repo, Contents: read/write) and it's stored as `origin`'s push URL in this local
clone's `.git/config` (never committed, never in a tracked file). Ship loop: edit, run
`node tools/test-all.js`, bump `CACHE_VERSION` in sw.js if any shipped file changed,
`git add -A && git commit` with a real message, `git push origin main`. Watch for CRLF
line endings in the working tree turning every file into a false diff — normalise with
`sed -i 's/\r$//'` before trusting `git diff`; `.gitattributes` (added 2026-08-15) should
prevent this recurring. This does NOT apply to every environment: an older, more locked-down
cloud sandbox genuinely could not reach github.com — if `git ls-remote origin` or
`curl https://github.com` fails, fall back to listing changed files and asking Jack to
push himself (GitHub Desktop or the web uploader).

## Copy voice rules (agreed 2026-08-02 — apply to ALL app copy and data text)

- Sound like a human wrote it. NO em-dashes anywhere in app copy or data text.
- No "it's not X, it's Y" / contradictory-conclusion constructions.
- Progression names: use the canonical/obvious name where one exists ("12-Bar Blues",
  "Doo-Wop", "Axis Progression", "Andalusian Cadence", "Jazz 2-5-1", "Ceilidh").
  Otherwise descriptive beats emotive ("Atmospheric film soundtrack", "Carnival music",
  not "Villain's Tango"-style cleverness).
- Chord/scale explanation copy must earn its words. Lead with: what tension is created,
  what function the chord serves (theory function AND emotional function), and what
  usually comes next. Cut everything else.

## Feedback backlog — 2026-08-02, phased 2026-08-03

Phase 2.5 (design & UX polish) was agreed and inserted before phase 3. Status below.

1. Repo workflow: replace manual drag-upload with proper pushes — GitHub Desktop on
   Jack's machine, or git run locally via an on-computer session. [workflow, anytime]
2. Rename ALL progressions per the naming rule above; rewrite all `notes` per the voice
   rules. [phase 3 prep, DONE 2026-08-03] All 24 seeds renamed and rewritten; ids left
   untouched so nothing referencing them breaks. The rules now also live in
   `data/schema.md` so each generated batch is written against them rather than
   against the older seed entries.
3. Key selector: circle-of-fifths wheel showing each key's accidentals
   (e.g. "E: F♯ C♯ G♯ D♯"). Memorisation aid. [phase 2.5, DONE 2026-08-15]
   `js/ui/circle-of-fifths.js` is a pure data + SVG module (no DOM, matching
   diagrams.js's pattern): 12 positions in true ascending-fifths order,
   major tonic on the outer ring and its true relative minor on the inner
   ring at the same position, using exactly the app's 12 locked tonic
   spellings. `accidentalsFor()` computes each key's sharps/flats by
   realising its seven diatonic chords through the engine (never
   hardcoded), in standard key-signature order (F C G D A E B / B E A D G
   C F), not scale-degree order. Only the ring matching the current mode's
   family is tappable (carries `data-tonic` + `role="button"`); the other
   ring is shown dim, for context, like a printed circle-of-fifths poster.
   A caption below the wheel reads e.g. "E major / C♯ minor — F♯ C♯ G♯ D♯",
   updating live as wedges are tapped.
   Originally shipped alongside the flat key-button rows; Jack asked the
   same day to drop the rows since the wheel's active ring already covers
   the exact same 12 tonics — `key-row`/`key-btn` stay in `css/app.css`
   (chords-lib.js's root picker still uses them) but detail.js and
   scales-lib.js no longer render one. The wheel picked up the row's "home
   key" dashed-border treatment as a `home` wedge class so that information
   wasn't lost. Wiring differs by view: detail.js reuses the same
   `chooseTonic()` the row used to call; scales-lib.js sets `location.hash`
   since that view is link-driven.
   Also fixed the same day: the detail view's capo-suggestion line used to
   sit ABOVE the key picker and only render when `capo.suggest()` returned
   a hint, so tapping a wedge could change that block's height and shove
   the wheel around mid-tap — annoying when picking several keys in a row.
   It now lives inside `.key-picker`, after the wheel, and always renders
   ("Capo N — play as X" or "No capo needed"), so its height is constant
   and it can never move anything else on the page.
   Verified end to end with a jsdom-driven boot of the real app (not just
   unit tests) since no headless browser is reachable from
   this sandbox.
4. Hoard/detail chord diagrams: uniform size, bigger, tappable → full-size popup, plus
   a button through to the Chords tab. [phase 2.5, DONE 2026-08-15, done together
   with item 14] Scoped to the detail view's "Chord shapes" strip — Hoard cards
   show chord names as text, not diagrams, and that was a deliberate call in the
   item 9 repaint, so it was left alone. `diagram-popup.js` is a small singleton
   overlay (one instance at the end of `<body>`, reused across opens, closes on
   Escape/backdrop/route change) that any single-chord-diagram view can call
   into; its popup carries a "Open in Chords tab" link built from `chord-link.js`.
   `--diagram-guitar-w`/`--diagram-piano-w` bumped up for the inline strip too.
5. Capo mode: a toggle that applies the suggested capo — played shapes LARGE for
   sight-reading, sounding chords/key small alongside. [phase 2.5, DONE 2026-08-15]
   Lives in Performance mode (`perform.js`), guitar only, only shown when
   `capo.suggest()` actually returns a hint. Toggling re-renders the grid at the
   `playAs` tonic (same numerals, different tonic — `renderIn(entry, playedTonic)`)
   so the big symbols become the shapes to play, with a small "sounds X" per chord
   and the strip text swapping to "Capo N · playing as X · sounds Y". Ephemeral
   like the detail view's per-chord badge toggle — resets on re-entry, not stored.
6. "Sounds like / common variations" section linking similar progressions. [phase 3]
7. Chord-swap advice with tappable swaps, each stating its impact. [phase 4 — builder]
8. Chords tab "where next?" blurbs: functional not cute. [phase 2.5, DONE 2026-08-03]
9. Design overhaul. [phase 2.5, DONE 2026-08-15 — repaint 2026-08-03, function
   tinting 2026-08-15]
   Three directions were mocked up for Jack; he chose function colour on a neutral
   chassis, with the gold dropped for a pastel blue. What landed:
   - Palette rebuilt around light/dark. Light is the base `:root` declaration, dark
     overrides colours only under `prefers-color-scheme: dark`, and
     `:root[data-theme="light"|"dark"]` is reserved for a manual override that has no
     UI yet. Every colour in the app now lives in those two blocks — no rule outside
     them may hardcode a hex, or it goes invisible in one mode.
   - Gold retired. `--gold*` renamed `--accent*`; the accent is interface-only, which
     leaves colour free to mean harmonic function later.
   - Piano diagrams draw real keys. They used to be outlines over the page colour,
     which read as negative space. `diagrams.js` now emits classed shapes carrying no
     colour attributes at all and `css/app.css` owns the palette. Keys are larger
     (whiteW 12→14, whiteH 56→64) and light mode separates them with true black,
     because a grey hairline on a white key vanishes at this size.
   - Complexity moved onto the card's left edge as a stripe. `hoard.js` puts the
     `lv-*` class on the card as well as the badge; `.card:hover` sets three border
     sides rather than the shorthand so it cannot repaint the stripe.
   - Function tinting: `js/engine/harmony.js` is a new pure engine module,
     `classify(numeral, tonic, mode)` → `"tonic" | "subdominant" | "dominant" |
     "borrowed"`. Borrowed wins first (numeral not diatonic to the tonic+mode,
     tested by pitch classes — the SAME test the Scales tab's "Borrowed chords"
     section already used); a diatonic chord then falls into the classic
     three-function grouping by scale degree (1/3/6 tonic, 2/4 subdominant,
     5/7 dominant), independent of mode. `DIATONIC_NUMERALS` (the six modes'
     own seven diatonic numerals) now lives there as the one source of truth —
     scales-lib.js's `MODES` table reads its `numerals` field from it instead
     of carrying its own copy, so the Scales tab and the tint engine can never
     disagree about what's diatonic. `js/ui/function-tint.js` wraps
     `classify()` as `tintClass()`, returning the CSS class name
     (`fn-tonic`/`fn-subdominant`/`fn-dominant`/`fn-borrowed`) directly.
     Colours: tonic teal, subdominant purple, dominant amber, borrowed coral
     (blue stays reserved for the interface accent). Text colour only, no
     background pills, to keep the neutral chassis. Wired into all five
     chord-bearing views — Hoard cards (numerals + chord names, built as
     interleaved tinted spans via a new `interleave()` helper in util.js
     rather than one joined string), the Chords tab's "where next?"
     destination cards, the Scales tab's diatonic grid and borrowed-chord
     list, the detail view's chord-by-chord strip, and performance mode's
     grid. First cut (2026-08-15 AM) shipped Hoard/Chords/Scales only and
     Jack asked the same day for detail + performance too, since clicking a
     card into its detail page or performance mode was the obvious next
     thing to try and the colour just vanished there. In performance mode
     the tint follows the chord's real harmonic function, not the
     capo-mode played shape — the function doesn't change under a capo,
     only which shape your hands make, confirmed by a jsdom check that
     toggling capo mode leaves every cell's `fn-*` class untouched.
     A toggle in the settings panel (backlog item 15) flips it via
     `body[data-tint="off"]`; the toggle is CSS-only (the `.fn-*` classes are
     always in the DOM, the toggle just flips whether they paint), so no
     re-render is needed and it's instant. Persisted to
     `chordhoard.functionTint`, defaulting on. `js/ui/function-tint.js` also
     exports `legendCaption()` — "Colour: Tonic · Subdominant · Dominant ·
     Borrowed", each word in its own colour — the actual key explaining what
     the tint means, since the header icon alone wasn't legible as one
     (Jack's second same-day note). One shared component, placed once per
     view near where the tinted chords first appear; performance mode gets
     a `.perform-legend` variant sized into a `.perform-topbar` wrapper (so
     `layout()`'s fit-to-viewport height math still measures the right
     element). The `.fn-*` rules are deliberately the LAST block in
     app.css: several of the elements they tint (`.dest-numeral`,
     `.degree-numeral`, `.degree-symbol`, `.visitor-symbol`, `.chord-numeral`,
     `.perform-numeral`) already set their own `color` at equal specificity,
     and source order is what breaks the tie.
10. Instrument toggle rescoped: hidden on Chords/Scales/Build via
    `body[data-route]` in CSS, where it changed nothing. [phase 2.5, DONE 2026-08-03]
11. Scales tab scale-note chips are now links that make that note the tonic, keeping
    the mode, with a hint line. [phase 2.5, DONE 2026-08-03]
12. Scales tab copy rewritten; headings are now "Chords in this scale" and
    "Borrowed chords". [phase 2.5, DONE 2026-08-03]

13. Song examples: deferred to one pass at the end of phase 3, agreed 2026-08-03.
    Generating them inline was producing almost none, because the bar is famous plus
    high-confidence on progression AND key AND section together, and most entries fail
    it from memory alone. Do the whole library in one sweep with web verification once
    the ~300 exist, so the research happens once and the standard stays even. Until
    then every generated entry ships `"songs": []`. [phase 3 tail, DONE 2026-08-15]
    Swept all 14 files. Verification matched real chord/section data (mostly via
    Hooktheory TheoryTab and Wikipedia) against each entry's actual `numerals`/`mode`,
    never `homeKey`. Result: 102 of 349 entries (29%) carry 1-3 songs, 159 song
    credits total. Coverage is intentionally uneven: diatonic/pop/electronic batches
    landed 20-75% (these progressions are extremely well documented), while
    odd-metres-long-forms landed 0/25 and modal-depth/cinematic landed under 10% —
    both bars (exact functional progression AND exact section) are genuinely hard to
    clear for borrowed-chord-heavy, modal, or metre-driven entries, so most of those
    correctly ship empty rather than padded. Coverage revisit is a fair v1.x task if
    Jack wants to push it further with a fresh web-search budget, particularly on
    country-americana (only 12%, hit tool-access limits mid-sweep rather than a real
    shortage of songs) and modal-depth/jazz-standards.

## Feedback backlog — added 2026-08-03, not yet phased

14. Chord diagrams clickable to cycle through the other voicings on file, and the
    chosen voicing remembered for next time. Storage is per chord symbol, not per
    progression, so picking an easier F once fixes it everywhere. `chordhoard.*`
    key, same export/import as pins. Supersedes the "tappable → popup" half of
    backlog item 4; do them together. [DONE 2026-08-15, done together with item 4]
    Resolved the two competing "tap" meanings by splitting the affordance: tapping
    a guitar diagram cycles voicings in place (when there's more than one on file)
    and remembers the choice; a small ⤢ button is the popup trigger instead, always
    present on guitar cells so the popup stays reachable even when the main tap is
    busy cycling, and the popup itself carries its own "Try another shape" control
    kept in sync with the inline cell. Piano cells have nothing to cycle, so the
    whole cell just opens the popup. `voicing-choice.js` keys the memory by
    `<root pitch class>:<shape suffix>` (the same lookup `diagrams.voicingsFor()`
    uses), NOT by numeral or progression, under `chordhoard.voicing` — export/import
    doesn't exist yet (that's phase 4), but the key follows the same storageGet/Set
    pattern as every other `chordhoard.*` key so it'll fall into whatever scheme
    phase 4 picks.
15. Settings cog. [DONE 2026-08-15 for the cog itself; the light/dark override
    it was originally proposed for is still open]
    Built earlier than planned: the function-tint toggle (backlog item 9)
    originally lived as its own header icon, hidden via CSS on routes it did
    nothing on (`body[data-route="prog"|"perform"|"build"] .tint-toggle`).
    Jack pointed out it kept disappearing as tinting spread to more views and
    asked for a permanent settings cog instead, so the icon and its per-route
    hiding rule are gone. `js/ui/settings-panel.js` is a small singleton
    overlay (same one-instance-at-the-end-of-body pattern as
    `diagram-popup.js`, deliberately a separate set of CSS classes rather than
    sharing `.diagram-popup*` since the two dialogs are conceptually
    different and may drift): `openSettingsPanel(build)` / `closeSettingsPanel()`
    / a `settingsRow(label, description, control)` helper so every future
    row looks the same. `app.js`'s `buildSettingsPanel()` is the one place
    that fills it, currently one row (the colour switch) plus
    `function-tint.js`'s `legendCaption()` for context. The header cog
    (`.settings-btn`, gear SVG) is now visible on every route with a header —
    but performance mode hides the WHOLE header for its full-viewport
    takeover (pre-existing, unrelated design decision), so it needed its own
    small entry point: `.perform-settings` in `perform.js`'s strip, next to
    the exit button, opening the identical panel via the same
    `buildSettingsPanel` (imported from `app.js`; safe despite the mutual
    import because, like `state`/`renderIn`, it's only read inside a click
    handler, never at module-evaluation time — see the chords-lib/detail
    circular-import lesson elsewhere in this file). Next natural row: the
    manual light/dark override this item originally asked for. The plumbing
    is already there: `:root[data-theme="light"|"dark"]` is declared in
    `css/app.css` and the dark block is written as
    `:root:not([data-theme="light"])`, so the override works the moment
    something sets the attribute. Needs a `chordhoard.theme` key and a
    "follow system" third state that clears it, then a second
    `settingsRow()` in `buildSettingsPanel()`.
16. Performance view grid is wrong for long progressions. It currently reflows to
    3×3 and squeezes chords past readability once there are more than eight.
    Jack's proposal: fix the grid at TWO columns always and add rows as needed, so
    four chords are 2×2, eight are 2×4, ten are 2×5, and any shortfall is drawn as
    empty cells rather than reflowing. Chord size then shrinks predictably with row
    count instead of jumping when the column count changes. Applies to short
    progressions too: a two-chord entry sits on the same 2×2 base with two blanks.
    [DONE 2026-08-15] Implemented exactly as proposed, portrait AND landscape
    (the proposal said "always" and was taken at its word — revisit if landscape
    rows feel too squat). Blank filler cells are dashed and dimmed
    (.perform-cell.blank, aria-hidden). The grid also sets explicit
    grid-template-rows now, so blanks can't collapse.
17. Pentatonic and blues scales in the Scales tab, plus guitar position cheat
    sheets (CAGED shapes across the neck) for soloing, plus a recommended soloing
    scale flagged on each progression. Two design notes before starting: these are
    not modes, so they do not belong in `vocab.json`'s `modes` list and need their
    own concept in the engine; and the recommended scale should be COMPUTED from
    the progression's pitch classes rather than stored on 349 entries, with a
    stored override field only if the computation turns out to be wrong often.
18. Performance view restructure: show the progression title, and generally give
    a bit less space to the chords and a bit more to everything else. Raised by
    Jack 2026-08-21 while scoping the word generator (roadmap 2.4) and explicitly
    deferred. Do it after roadmap 2.6, which fixes the `layout()` overflow
    detection this would otherwise have to work around.
19. Per-chord word attachment: one random word under each chord in the perform
    grid, rather than roadmap 2.4's four-word banner. This was the original shape
    of 2.4 and was deferred, not rejected, for two reasons: `layout()` cannot
    currently take a second line of text per cell without cells silently
    colliding (roadmap 2.6 fixes that), and a prompt that changes every 2.3
    seconds is faster than a singer can use. Revisit only after 2.6, and only if
    the banner turns out to be too few points of inspiration in practice.

### Chord explanation copy (phase 2.5, agreed with Jack 2026-08-03)

Working doc: `docs/phase-2.5-copy.md` (tables, sources, review notes).

- Every chord explanation is three lines: **Tension** (how much, what kind), **Theory**
  (function, which note does the work, what that does to the ear), **Next** (usual
  destinations, cadence named where one exists, UK name first).
- All of it lives in `js/ui/chord-copy.js`, keyed by **numeral and family** (major-ish
  or minor-ish HOME), never by chord name. Both the Chords tab and the Scales tab read
  it, so the same relationship cannot be described two different ways.
- `OVERRIDES` holds mode-specific readings, keyed `"<mode>|<numeral>"`, for the five
  cases where mode changes the function (lydian IV, mixolydian V, dorian IV,
  dorian bVI, phrygian V).
- Whether a chord is in the scale or borrowed is **computed from pitch classes** per
  key, never written into the prose. V7 is diatonic in major and borrowed in lydian,
  and only the notes know that.
- Lists longer than `HEAD_COUNT` (8) use `revealList`, so nothing is silently cut.
- Writing rule Jack stressed: factual, theory-founded, information-dense first;
  emotional colour only where a technical term needs unpacking. Avoid the
  ", so [effect]" join, "which is why", inflated stakes, and rewording an identical
  fact just to avoid repeating it. `tools/test-copy.js` enforces the mechanical part.

## Phases & status

Beyond the phases below, `docs/roadmap.md` (written 2026-08-21, agreed with Jack) is
the detailed implementation plan for everything after phase 4: song builder, audio
playback, soloing scales, ear training, voice leading, setlists, similarity links,
reverse lookup, MIDI and more, each with design reasoning, gotchas and acceptance
criteria. Executing agents should read it before starting any post-phase-4 feature
and tick items off there as they land.

- [x] **Phase 0** — plan agreed, CLAUDE.md written
- [x] **Phase 1** — scaffold, chord engine, schema, vocab, ~24 seed progressions,
      validation + engine tests
- [x] **Phase 2** — UI: browse/search/filter, cards, diagrams (guitar-chords.json from
      an MIT-licensed chord DB + generated piano SVGs), transpose/capo, chord library,
      scale library, performance mode + wake lock
- [x] **Phase 2.5** — design & UX polish. All items landed: 8, 10, 11, 12 (chord
      explanation copy, shared copy table, instrument toggle scope, scale-note
      links), 4 + 14 (diagram popup + voicing cycling, DONE 2026-08-15), 5 (capo
      mode, DONE 2026-08-15), 3 (circle-of-fifths wheel, DONE 2026-08-15), and 9
      (light/dark palette repaint 2026-08-03 + function-colour tinting
      2026-08-15, closing the phase).
- [x] **Phase 3** — library generation to ~350 in themed batches of ~25, one file per
      batch, `node tools/validate.js` after each. All twelve batches landed
      2026-08-03 at 25 each, library at 349: theatre · pop-rock · folk-celtic ·
      blues-soul-gospel · diatonic-essentials · jazz-standards · cinematic ·
      latin-reggae · electronic-indie · country-americana · odd-metres-long-forms ·
      modal-depth · comedy-novelty. Song-examples pass (backlog item 13) closed
      2026-08-15: 102 of 349 entries carry verified songs (159 credits) — see
      backlog item 13 for the coverage breakdown and where to push further if wanted.
      The Hoard has a **Collection** filter over these batches. The collection is
      derived at load time from the manifest filename in `js/ui/app.js`, never
      stored on entries, and its display label comes from the `collections` map in
      `data/progressions/index.json`. Adding a batch means adding it to `files`,
      `collections` and the sw.js precache list; nothing in the UI needs touching.
      `diatonic-essentials.json` is the reference batch, added at Jack's request
      2026-08-03: the plain major and minor diatonic progressions, mostly triads in
      easy keys, so the fundamentals are covered before the library goes exotic. It
      is the only batch that also carries the two diatonic diminished chords
      (`viidim` in major, `iidim` in minor) and the natural-minor `v`. Keep it plain
      if it is ever extended.
      Each batch must spread time signatures and bar counts deliberately, because the
      dedupe rule (mode + numeral sequence + timeSig) bites harder as the library grows.
- [x] **Phase 4** — pins, playability profiles, song builder, dynamic
      builder (moves.json), PWA/service worker, export/import.
      Landed 2026-08-15: **pins** (`js/ui/pins.js`, `chordhoard.pins` as id → tonic;
      shared pinButton() on Hoard cards and the detail top bar; the recorded key
      follows the detail view's key choice while pinned; "Pinned only" filter chip
      in the Hoard sheet), **playability profiles** (`js/ui/playability.js`,
      `chordhoard.playability` keyed instrument → chord symbol → playable/shaky/
      nope; marker rows live in the detail view's diagram popup and on the Chords
      tab, one row per instrument there; unmarked chords default to playable iff
      their computed level is the bottom rung (P1/G1), marks always win; Hoard
      filter group "Playability" with "All chords playable" / "One chord to
      practise" counting DISTINCT unplayable chords), and **export/import**
      (`js/ui/backup.js`: export sweeps every `chordhoard.*` localStorage key by
      prefix so new keys ride along automatically; import only writes keys with
      that prefix, format-checked, from the settings panel with a status line
      and a reload on success). PWA/service worker was already live pre-phase-4.
      Also landed 2026-08-15: the **dynamic builder** (`js/ui/builder.js` +
      `js/ui/built.js` + `data/moves.json`, replacing the Build tab placeholder).
      moves.json holds degree→ranked-degrees `transitions` (mode-agnostic, mapped
      through DIATONIC_NUMERALS at suggestion time), per-family `colours` for
      spice 2 (slash basses only in the major table, because bass digits read
      against the tonic's MAJOR scale — i/3 in Am would give Am/C#), and
      per-family `borrowed` pools for spice 3, filtered per mode with
      isDiatonic() so anything the mode already owns drops out. Context rules
      v1: rank from the last chord placed, never re-suggest the chord you're on,
      nudge degree 1 forward after 3+ chords away from home. Saves write a FULL
      schema entry (4 beats per chord, 4/4, bars = chord count, 16-bar cap,
      moods/genres empty) to `chordhoard.built` and register it under the
      derived "built" collection ("My progressions"), so cards, detail,
      transpose, capo, complexity, performance mode and pins all work on saved
      results with no special casing; ids are `built-*` and stable, and the
      chordhoard.* prefix means they ride along in backups. tools/validate.js
      now also validates moves.json (numerals parse + realise, transitions
      cover degrees 1–7, no minor-family slash basses); schema.md documents the
      file. The header instrument toggle is UNHIDDEN on #/build now (suggestion
      buttons carry per-instrument complexity badges, so it does something
      there again).
      Closed phase 4, 2026-08-21: the **song builder** (roadmap item 0.1),
      `js/engine/song.js` + `js/ui/songs.js` + `js/ui/songs-store.js`, new
      routes `#/songs[/<id>]` (list, and an editor for `id` "new" or an
      existing song) and `#/perform-song/<id>[/<sectionIndex>]`. A song is a
      small object — `{ id, name, tonic, sections: [{ label, progId,
      tonicOverride }] }` — stored as an array under `chordhoard.songs`
      (`js/ui/songs-store.js`, same read-modify-write-the-whole-blob pattern
      as `pins.js`; rides along in backup automatically via the prefix
      sweep). Sections reference progressions by id only, same discipline as
      everywhere else in the schema, so `built-*` ids work here for free and
      nothing goes stale when a referenced progression's data changes.
      `js/engine/song.js` is pure and DOM-free per the engine rule: `tonicsFor`
      (which lives in `js/ui/detail.js`, a UI module) is passed IN as a
      parameter rather than imported, so the engine never depends on UI code.
      `scoreCandidate(entry, currentSections, songTonic, entriesById)` ranks a
      candidate progression for the next empty section slot — shared mood
      tags weighted highest, then key relationship to the song's own tonic
      (same pitch class, or its relative major/minor, computed both
      directions from one symmetric formula so the song doesn't need a
      stored mode), then mode continuity with whatever mode dominates the
      sections chosen so far, then a small "lift" bonus (different opening
      chord, quicker average pace) against the most recently chosen section.
      `sectionSuggestions()` wraps it into a ranked, already-used-ids-excluded
      list; the editor shows the top 5 plus a name-search fallback per
      section. `renderSong(song, entriesById, tonicsFor)` realizes every
      section, returning `{ missing: true }` instead of throwing for a
      section whose `progId` no longer resolves (a deleted `built-*` entry) —
      both the editor (a "Choose another" recovery slot) and performance mode
      (a full-viewport "this section's progression isn't in the hoard any
      more" placeholder with working exit/prev/next) render that state
      rather than crashing. Sections are capped at 2–4 per the roadmap's own
      framing of a song (2 minimum enforced on save, "Add section" hidden at
      4); the label dropdown offers the full `data/vocab.json` `sections`
      list rather than just verse/chorus/bridge, since a song may reasonably
      want an intro or outro too.
      `perform.js` was refactored (not duplicated) to serve both routes: the
      chord-grid-building, fit-to-viewport `layout()`, capo mode and wake
      lock logic all moved into one shared `buildPerformanceView()`, called
      by the existing single-progression `render()` with no `nav` (unchanged
      behaviour, verified against the pre-existing route) and by the new
      `renderSong()` with a `{ prevHref, nextHref }` nav object that adds
      strip buttons AND ArrowLeft/ArrowRight keyboard handling (wired and torn
      down alongside the view's other listeners in the same `cleanup()`). Per
      the roadmap's own gotcha note, prev/next are plain hash-changing links
      rather than in-place DOM patches — that re-triggers the view's full
      teardown/rebuild on every section change, which is cheap because
      `renderIn()` is cached, and keeps this feature from needing a special
      exception to the app's normal "a route change fully rebuilds the view"
      lifecycle. Songs are deliberately NOT registered into `state.entries`
      or the Hoard's Collection filter (a song is a different kind of thing
      from a single progression) but DO get a 5th tab bar entry
      (`index.html`, `TAB_FOR_ROUTE`) since — unlike a builder draft — a
      saved song has nowhere else discoverable to live. `js/ui/songs.js`
      imports `state`/`renderIn` from `app.js` and `app.js` imports
      `songs.js`'s `render`; this is the same circular-import shape already
      established between `app.js` and `builder.js`, safe because neither
      side touches the other's exports at module-evaluation time, only
      inside function bodies called later.
      Verified end to end in a real browser (localhost, mobile viewport):
      built a 2-section song from suggestions, saved, reloaded the editor
      from storage, played it through with next/prev (strip buttons, arrow
      keys, and the disabled state at each end), forced a missing-progression
      section and confirmed both the editor and performance-mode placeholders
      degrade without throwing (console clean throughout), confirmed the
      existing single-progression `#/perform/<id>` route is byte-for-byte
      unaffected, and round-tripped a saved song through
      `backup.exportData()`/`importBackup()`. No permanent jsdom boot-check
      file was added (CLAUDE.md's existing references to one are one-off
      scripts run during earlier phases, never committed under `tools/`, and
      `test-all.js`'s header requires Node standard library only — adding
      jsdom as a devDependency to get one would break that); `node
      tools/test-engine.js` gained 6 new song.js tests instead (key relation
      both directions, score ordering by mood/key/contrast, suggestion
      ranking and used-id exclusion, override vs re-spelled section tonic,
      and the missing-progId non-throw), and manual browser verification
      covered the DOM/routing/storage integration that a unit test can't.

Post-phase-4 work follows `docs/roadmap.md`, tier by tier; land an item, tick
its checkbox there, and note any new architectural fact here. Landed so far:

- **Roadmap 0.1, song builder** — see the phase 4 entry above (closed the
  phase).
- **Roadmap 0.2, manual light/dark override**, DONE 2026-08-21. A
  `chordhoard.theme` key (`"light"` | `"dark"` | absent for "follow system"),
  applied synchronously at the top of `app.js` (before `init()`'s async data
  fetch, so a returning visitor with an explicit choice never sees a flash of
  the system default) and exposed as `setTheme()`/`currentTheme()`. A third
  `settingsRow()` in `buildSettingsPanel()` (System / Light / Dark, same
  segmented-control look as the instrument toggle) — CSS-only, no re-render,
  same pattern as the existing function-tint toggle.
  Fixed a real gap while wiring this up: `css/app.css` only ever had ONE
  place declaring dark colours, `:root:not([data-theme="light"])` nested
  inside `@media (prefers-color-scheme: dark)`. That lets `data-theme="light"`
  cancel an OS-dark device back to light, but a `data-theme="dark"` override
  did nothing on an OS-light device, because the media query itself never
  matches there regardless of the attribute. There are now two dark blocks
  (same tokens, kept in sync by hand, noted in a comment on both): the
  existing media-query one, and a new `:root[data-theme="dark"]` block
  outside any media query so forcing dark works unconditionally. Verified in
  a real browser both directions (`resize_window`'s `colorScheme` param
  standing in for the OS setting): system-follows-OS in both light and dark,
  forced light cancels OS-dark, forced dark overrides OS-light, and a real
  page reload (not a same-document hash change) confirmed the choice
  persists with the attribute set before first paint.
- **Roadmap 0.3, soloing scales**, DONE 2026-08-21. Pentatonic/blues scales,
  a computed per-progression recommendation, and CAGED guitar cheat sheets.
  `js/engine/solo-scales.js` (pure, DOM-free):
  - `SCALES` holds major pentatonic, minor pentatonic and blues as
    letter-step + semitone formulas, spelled via `theory.js`'s `spellFrom()`
    — that one function does all the real work, including the blues scale's
    "blue note" sharing a LETTER with the 4th (spelled as a raised 4th, e.g.
    Bb blues has both Eb and E natural) rather than as a flattened 5th,
    because its letter-step is deliberately the same as the 4th's.
  - `recommend(entry, tonic = entry.homeKey)` scores 6 candidates (major/
    minor pentatonic and blues, rooted at `tonic` and at its relative) by
    coverage of the progression's realised pitch classes minus a
    beats-weighted clash penalty, returns `{ scaleKey, tonic, reason, score }`
    with `reason` "home" or "relative". Takes `tonic` as a parameter
    (defaulting to `entry.homeKey`) specifically so the detail view can pass
    its currently-chosen key and have the recommendation follow transposition
    the same way the capo hint and diagrams already do. The "relative"
    candidate always uses the plain natural-minor-style relative (a minor
    3rd), even for dorian and phrygian entries, which is NOT an
    approximation: pentatonic scales omit exactly the 2nd and 6th degrees
    that dorian/phrygian/natural-minor differ on, so "this tonic's minor
    pentatonic" is diatonically safe in all three, and is structurally
    identical to "the relative major's major pentatonic" — see the function's
    own comment for the derivation. A spot-check across all 14 batches (one
    entry per collection) came back sane on inspection, including two
    instructive edge cases worth knowing about: a 12-bar blues built entirely
    on dominant 7ths scored only 0.06 (no single pentatonic covers three
    different dominant-7th colours well, which is honest, not a bug) and a
    bossa nova scored negative (extended jazz harmony genuinely doesn't suit
    a straight pentatonic) — both correctly trigger the detail view's
    "Closest fit" wording (see below) instead of a confident "Solo with".
  - `cagedPositions(tonicStr, shapesData)` transposes the 5 CAGED
    minor-pentatonic box shapes (`data/solo-shapes.json` — geometry only,
    fetched by the UI layer and passed in, engine modules never fetch their
    own data) to a given tonic, and RECOMPUTES each note's scale degree from
    the string tuning rather than trusting a stored label, throwing if a fret
    offset isn't actually a minor-pentatonic interval from the shape's root.
    `tools/test-diagrams.js` runs this over the real data file as a standing
    check, so a future transcription error in the JSON fails the suite.
  - `data/solo-shapes.json` itself came from a dedicated research pass
    (`docs/research/caged-pentatonic-shapes.md`): cross-checked against an
    interactive fretboard tool's raw SVG data AND independent pitch-class
    arithmetic, both agreeing on all 30 string-transitions across the 5
    boxes, plus a second source confirming the CAGED shape-order convention
    (Box 1 = E-shape). Verified again by hand against the engine's own output
    before shipping. Box 3 (C-shape) has a real, sourced irregularity — its B
    string spans a 3-fret gap instead of the usual 2 — which is exactly the
    kind of fact freehand guessing would have gotten wrong, hence the
    research pass rather than writing the data from memory.
  UI: `js/ui/scales-lib.js` gained a "Soloing" section (three scale cards —
  the family-appropriate pentatonic at the tab's own tonic, blues, and the
  relative pentatonic — each with a piano diagram via the existing
  `pianoScaleSVG()`, reused as-is since it already accepted a plain note-name
  array) and, guitar-only, a "CAGED positions" strip rendering all 5 boxes
  via a new `js/ui/diagrams.js` export `cagedShapeSVG()` (same classed-shape,
  no-colour-attributes convention as the rest of the file; a scale-degree
  number sits inside each dot instead of a bare dot, since a box diagram's
  whole point is which finger plays which degree). `js/ui/detail.js` gained
  a one-line "Solo with: <scale> · <reason>" recommendation linking into the
  Scales tab's matching `#/scales/<tonic>/<mode>` route (reusing the EXISTING
  route scheme exactly, no new hash parameter needed, since major/minor
  pentatonic map onto the "major"/"minor" mode tabs that already exist); a
  low score (<0.15) softens the copy to "Closest fit" instead of "Solo with".
  Data flow for both UI spots follows the existing lazy-fetch-and-fill-in
  pattern (`getSoloShapesData()`/`getGuitarData()`/`getMoves()`), so a slow
  or failed fetch degrades to a placeholder rather than blocking the rest of
  the page.
- **Roadmap 1.1, Web Audio playback engine**, DONE 2026-08-21. Split exactly
  along the engine/UI line the roadmap specified:
  - `js/engine/audio-notes.js` (pure, DOM-free): `frequencyOf(note, octave)`
    (A4 = 440, 12-TET, built on `theory.js`'s `pitchClass`/`parseNote` rather
    than a parallel note table); `voiceChord(realized, {bassOctave, tonesOctave})`
    which puts the bass note low (default octave 3) and stacks the chord tones
    upward from octave 4, bumping each successive tone up an octave whenever
    its pitch class would otherwise fall at or below the previous tone — a
    fixed window rather than voice-leading against the prior chord, which is
    enough to keep consecutive chords from leaping wildly without needing
    history; `buildSchedule(chords, bpm)` turns a rendered chord list into
    `{events, totalSec, secPerBeat}`. One deliberate simplification from the
    roadmap text: a "beat" in scheduling is the data's own beat unit (the
    time signature's numerator count), not necessarily a quarter note — BPM
    is the click rate of that unit. This is the right model for a reference
    player (unlike MIDI export's tick math, which will have to care about
    the time-signature denominator when roadmap 5.2 is built) and keeps the
    scheduler simple. `TEMPO_BPM` maps the data's `tempo` feel field to
    72/104/144 as the roadmap specified. Tested in `tools/test-engine.js`
    (frequency maths against known reference pitches, voicing stacking
    including the ascending-bump case, slash-bass placement below the
    stack — `I/3` in C puts E3 under the C4-E4-G4 stack — BPM mapping, and
    schedule layout on both a synthetic fixture and a real 6/8 entry run
    through `progression.render`).
  - `js/ui/audio-player.js` is the ONE file that owns an `AudioContext`
    (singleton, created lazily inside `playChord()`/`playProgression()`,
    which callers only ever invoke from a click handler, satisfying the
    autoplay-gesture requirement without any extra plumbing). A polysynth
    voice is one triangle oscillator plus a sine an octave below at low
    gain, per-note gain envelope (fast attack, gentle release), shared
    lowpass filter + compressor + master gain. The metronome is a short
    filtered square-wave blip, accented on beat 1. Scheduling follows the
    standard lookahead-timer pattern (a `LOOKAHEAD_MS` = 25ms `setInterval`
    scheduling whatever falls within `SCHEDULE_AHEAD_SEC` = 0.1s of the
    AudioContext clock) rather than scheduling everything up front or
    trusting `setInterval`'s own timing — the audio itself sits on the
    AudioContext clock (sample accurate, immune to a backgrounded tab);
    only the paired DOM highlight callback rides a `setTimeout` aligned to
    that clock, so it can drift by a few ms, which is fine for a highlight.
    Looping is gapless because the next iteration's early events get
    scheduled inside the same scheduler tick, before the current iteration
    ends, rather than via a stop/restart. `playProgression()` returns a
    controller `{stop()}`; only one playback runs at a time — starting a
    new one stops the last via the module-level `current` reference.
  - UI wiring: the detail view (`js/ui/detail.js`) gained a compact
    transport (play/stop, a BPM stepper defaulting to `bpmForTempo(entry.tempo)`,
    and loop/count-in/metronome toggles) placed between the chord strip and
    the key picker. Transport state (`bpm`/`loopOn`/`countInOn`/`metronomeOn`)
    lives at `render()` scope so it survives a redraw (e.g. the per-chord
    level badge toggle), but `draw()` unconditionally calls
    `audioPlayer.stopPlayback()` at its own top before rebuilding — a key
    change swaps out the chord set under any in-flight playback, and
    stopping on every redraw (rather than only on a real key change) keeps
    the DOM-bound highlight callbacks from ever running against detached
    nodes after a rebuild. A `hashchange` listener (registered once per
    `render()` call, matching the one-shot pattern already used elsewhere)
    stops playback when the view is left entirely. The sounding chord gets
    a `.sounding` class via a live `querySelectorAll` lookup inside the
    `onChordChange` callback rather than a cached node array, so it always
    targets whichever chord-strip is currently in the DOM.
    Performance mode (`js/ui/perform.js`) gained a play button in the strip
    (`.perform-play-toggle`, next to the settings cog) that always plays the
    real sounding chords at the current tonic, never the capo-played shapes
    — same precedent as the existing tint rule (harmonic function doesn't
    change under a capo, only which shape your hands make). Highlighting
    uses a tracked `soundingIndex` plus `applyHighlight()` (rather than only
    the live callback) specifically because `buildGrid()` gets called again
    when capo mode toggles mid-playback, and re-applying immediately after
    a rebuild avoids a gap until the next chord-change event. `cleanup()`
    (already wired to `hashchange`, matching the wake-lock teardown) also
    calls `audioPlayer.stopPlayback()`, so leaving performance mode — via
    exit, prev/next song-section nav, or backing out — always stops audio.
  - Verified in a real browser (localhost, mobile viewport): play/stop,
    the BPM stepper, and all three toggles on the detail view; loop keeps
    playing past one full pass; count-in shows a counting-down beat label;
    manual stop and natural end-of-progression stop both reset the button
    and clear the highlight cleanly; performance mode's play button
    highlights the grid; navigating away mid-playback (both routes) throws
    no console errors. `sw.js` precache gained the two new files and
    `CACHE_VERSION` bumped to v17. `node tools/test-all.js` green throughout.
- **Roadmap 1.2, builder and chord library audition**, DONE 2026-08-21. Wired
  `audioPlayer.playChord()` in everywhere a single chord is displayed:
  - `js/ui/builder.js`'s suggestion buttons — `suggestionBtn()` now returns a
    `.build-sug-wrap` (`position: relative`) holding the existing add-button
    unchanged plus a small `.build-sug-audition` speaker button absolutely
    positioned in the corner (same visual pattern as `diagrams.js`'s
    `.diagram-expand` popup shortcut). Deliberately NOT a whole-cell tap —
    the cell's own tap already places the chord, and backlog item 14 already
    settled that one tap can only mean one thing, so a second affordance
    needs its own hit target rather than overloading the first.
  - `js/ui/chords-lib.js`'s chord-hero header — a `.chord-hero-audition`
    button next to the big chord symbol, playing `realized` (the exact
    displayed notes, not any one guitar voicing among the several shown
    below).
  Both call `audioPlayer.playChord(realized)` directly; auditioning never
  touches builder state (confirmed no chord gets placed) and never
  navigates (confirmed the hash is untouched by a click). `sw.js`
  `CACHE_VERSION` bumped to v18 (no new files, existing ones changed).
  Verified in a real browser: the builder's audition button plays without
  placing, the add-button still places correctly afterwards, and the chord
  library's audition button fires with no console errors and no route
  change. This closes roadmap tier 1.
- **Roadmap tier 2, performance quick wins**, DONE 2026-08-21 (2.1 improv
  roulette, 2.2 setlists, 2.3 auto-advance — see `docs/roadmap.md` for full
  build notes on each). New files: `js/ui/roulette.js` (ephemeral,
  non-persisted filtered-id pool for "Surprise me" + reroll), `js/ui/setlists.js`
  and `js/ui/setlists-store.js` (`chordhoard.setlists`, mirroring
  `songs-store.js`'s shape and read-modify-write pattern exactly). New
  routes: `#/setlists[/<id>]` and `#/perform-setlist/<id>[/<index>]` — the
  latter is a THIRD mode `perform.js` now serves (alongside a lone
  progression and a song), flattening a setlist's items into one linear
  step sequence (a "song" item expands into all of its own sections) before
  handing off to the shared `buildPerformanceView()` core, so prev/next,
  arrow-key nav, capo mode, tinting and the missing-reference placeholder
  all work on it for free. No new top-level tab: setlists are reached from
  the Hoard's Pins filter group ("Manage setlists →"), same reasoning as
  pins themselves living there rather than on the tab bar.
  `audio-player.js`'s `playProgression()` gained a `muted` option (skips the
  actual tones/clicks, keeps the AudioContext clock scheduling the
  callbacks) so auto-advance's silent highlight walk and the audible Play
  button are one code path, not two; a local `activeControl` flag in
  `perform.js` keeps the two controls mutually exclusive without either one
  silently stopping the other on a stray tap. Fixed while wiring up the new
  `perform-setlist` route: `css/app.css`'s
  `body[data-route="perform"|"perform-song"]` header/tab-bar-hiding rules
  did not list the new route name, so it initially rendered the full-viewport
  takeover underneath a still-visible header — both rules now list all
  three perform route names. `sw.js` precache gained the three new files;
  `CACHE_VERSION` bumped to v19.
- **Roadmap 2.4, random word generator**, DONE 2026-08-21. Four random
  lyric-prompt words alongside the chords, plain to rare, for improv where
  the chords are only half of what you have to invent.
  `data/words.json` is 2000 curated words in four tiers of 500 (`version`,
  `tiers` keyed "1"-"4"), written against a 50-word sample Jack signed off in
  `docs/words-sample.md` — the calibration that matters is in tier 4: rare
  enough not to be an everyday word, familiar enough that nobody in the room
  has to stop and parse it. Tier 4 has now been recalibrated TWICE against
  that line (the sample, then 100 words swapped out of the finished list at
  `version` 2 — archaic trades, nautical kit, obscure myth and latinate
  adjectives out; trouble words, character types, strong plain adjectives and
  active verbs in). If it needs a third pass, `docs/words-sample.md` records
  what was cut and why, so the same judgement can be applied rather than
  re-derived. A `version` bump deliberately resets every stored shuffle bag;
  that costs only the current position in the walk, and the alternative is a
  cursor pointing into a list that changed underneath it. No tags of any kind on any word, and words are
  deliberately NOT coupled to the harmony (mood tagging and function biasing
  were both designed and both rejected). `data/schema.md` documents the
  authoring rules; `tools/validate.js` checks four tiers, 500 each, lowercase
  a-z, a 14-character cap, and no duplicate anywhere in the file — that last
  one is what keeps the no-repeat guarantee honest.
  `js/engine/word-bag.js` (pure, DOM-free) is the shuffle bag: mulberry32,
  plus a `{ seed, cursor }` pair per tier. The seed defines a deterministic
  shuffle recomputed every session and the cursor walks it, reseeding only
  when a tier is exhausted — so all 500 words in a tier are seen before any
  repeat, and that survives reloads on two stored numbers per tier. `seedFn`
  is passed IN rather than the module reaching for `Math.random()`, which is
  what makes the shuffle unit-testable; `tools/test-engine.js` has 8 tests
  including a full 500-draw no-repeat pass and a JSON round-trip proving a
  reload doesn't change the walk.
  `js/ui/words.js` owns the lazy fetch (getMoves pattern), `chordhoard.words`
  storage (`{ enabled, version, bags }`, riding backups via the prefix sweep)
  and `createWordBanner()`, shared by the detail view (under the chord strip:
  the strip is what you're playing, the words are what you're singing about)
  and all three perform routes. In performance mode the banner MUST sit
  inside `.perform-topbar` — that is the only element `layout()` measures
  chrome height from — and it shares the third row with the colour legend,
  CSS showing exactly one of them, so the topbar stays three rows tall.
  **On/off is `body[data-words]`, CSS-only**, like the function-tint toggle,
  with a `settingsRow()` in the cog panel. That is not a stylistic choice:
  the cog is reachable from inside performance mode, and re-rendering that
  view to apply a setting would rebuild it out from under its wake lock and
  resize listeners. The banner also holds off drawing until it is visible, so
  toggling it on later doesn't burn bag positions nobody saw.
  Words rotate on **loop boundaries only**, never on chord change (at 104bpm
  a chord goes by faster than anyone can finish a sung line). That needed a
  new `onLoop` option on `playProgression()`, fired where the scheduler
  actually resets its cursors — deliberately not inferred by watching
  `onChordChange` for index 0, which breaks on single-chord progressions.
  A reroll dice sits next to the banner on both surfaces so a bad set costs
  one tap, not four.
  The banner **shrinks its text to fit one line** rather than wrapping
  (`fit()` in `words.js`), because a banner that is one line for "dog · rain
  · feral · kraken" and two for "kitchen · cathedral · smuggler ·
  cantankerous" reflows the view on every redraw — Jack spotted it the same
  day. The 13px floor is measured, not guessed: over 2000 random draws at
  375px wide, none needed to go below it and the smallest any draw asked for
  was 13.6px, so only the theoretical worst case (the longest word in all
  four tiers at once, needing 12px) falls back to wrapping. Re-measure it if
  the type scale or the 14-character cap ever changes. `min-width: 0` on
  `.word-banner-words` is load-bearing: without it that flex child refuses to
  shrink below its content, grows past the banner, and never reports the
  overflow `fit()` measures. `enabled` defaults to true, which is right for Jack and
  flagged in the roadmap for revisiting before any wider release.
  `sw.js` precaches the three new files; `CACHE_VERSION` bumped to v20.

- **Double-tap-to-zoom disabled**, 2026-08-21 (Jack, on the phone). `body`
  in `css/app.css` sets `touch-action: manipulation`. The app is full of
  things you tap in quick succession — cycling a chord voicing, rerolling
  words, stepping BPM, tapping round the circle of fifths — and a second tap
  landing inside the browser's double-tap window was zooming the page.
  `manipulation` allows panning and pinch-zoom and only drops the double-tap
  gesture, so nobody loses the ability to zoom in and read; `user-scalable=no`
  in the viewport meta would have taken that away, which is why it is NOT
  used and the meta is unchanged. `touch-action` is not inherited, but the
  browser intersects it with every ancestor of the touched element, so the
  `body` declaration alone covers the whole app including the fixed
  full-viewport performance view. Jack asked for it everywhere regardless, so
  the file's existing `*` rule (the one that sets `box-sizing`) carries the
  same declaration: belt and braces, and it means nothing added later can
  miss it. Zero specificity, so a future control needing different touch
  semantics still overrides it. Nothing in the app listens for `dblclick` or
  raw touch events, so there was nothing to break. Verified across six routes
  plus the settings overlay: 11,450 elements, every one computing
  `manipulation`.

- [ ] **Phase 5** — GitHub repo + Pages deploy (user creates account; walk them through)
- v2 backlog: shareable song-structure links, MIDI export

## Workflow rules for agents

1. `node tools/test-all.js` runs every check in order and stops at the first failure.
   Run it before any commit; never commit red. Individually: `validate.js` after ANY
   change to `data/`, `test-engine.js` after any change to `js/engine/`,
   `test-copy.js` after any change to `js/ui/chord-copy.js`, `test-diagrams.js` after
   any change to `js/ui/diagrams.js` or `data/guitar-chords.json`.
   Note for agents: Jack is on Windows PowerShell 5.1, which has no `&&` operator.
   Chain commands with `;` or use the single script above.
2. Validation must check: schema completeness, numeral parse, beats arithmetic, vocab
   membership, id uniqueness, dedupe (same mode + numeral sequence + timeSig = dupe),
   every entry realizes + transposes in all 12 keys without throwing, song keys valid.
3. Engine code is pure and unit-tested; UI code imports the engine, never reimplements
   theory. If the UI needs a fact about music, it goes in the engine.
4. Data files are hand-editable JSON: 2-space indent, stable field order as in the
   schema example.
5. Voice and tone everywhere: friendly bandmate, plain English, UK spelling. Explain
   theory terms on first use in UI copy.
6. Don't add npm dependencies, build steps, or frameworks. Don't rename fields or
   change numeral syntax without updating this file, the validator, and all data.
7. Update the Phase status checklist here as phases complete.
