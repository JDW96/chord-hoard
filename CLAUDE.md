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
- Audio playback is **v2**: design data/UI so it can slot in, but do not build it.
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
    ui/                 # DOM code (phase 2+)
      chord-copy.js     # the ONE place chord explanations are written
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
deploy from main branch root). Updates are currently manual: Jack drags changed files
into the repo's web uploader. Bump `CACHE_VERSION` in sw.js whenever any shipped file
changes, and always tell Jack exactly which files to re-upload. The cloud sandbox
CANNOT reach github.com (egress blocked) — never attempt to push from a cloud session.

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
9. Design overhaul. [phase 2.5, repaint DONE 2026-08-03, function tinting TODO]
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
   Still to do: tint each chord by harmonic function (tonic teal, subdominant purple,
   dominant amber, borrowed coral — blue is reserved for the interface, so subdominant
   moved off it). Needs an engine module classifying a numeral's function, wired into
   the Hoard, Chords and Scales tabs, with a toggle defaulting to on.
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
15. Settings cog, first job being a manual light/dark override. The plumbing is
    already there: `:root[data-theme="light"|"dark"]` is declared in `css/app.css`
    and the dark block is written as `:root:not([data-theme="light"])`, so the
    override works the moment something sets the attribute. Needs the control, a
    `chordhoard.theme` key, and a "follow system" third state that clears it.
16. Performance view grid is wrong for long progressions. It currently reflows to
    3×3 and squeezes chords past readability once there are more than eight.
    Jack's proposal: fix the grid at TWO columns always and add rows as needed, so
    four chords are 2×2, eight are 2×4, ten are 2×5, and any shortfall is drawn as
    empty cells rather than reflowing. Chord size then shrinks predictably with row
    count instead of jumping when the column count changes. Applies to short
    progressions too: a two-chord entry sits on the same 2×2 base with two blanks.
17. Pentatonic and blues scales in the Scales tab, plus guitar position cheat
    sheets (CAGED shapes across the neck) for soloing, plus a recommended soloing
    scale flagged on each progression. Two design notes before starting: these are
    not modes, so they do not belong in `vocab.json`'s `modes` list and need their
    own concept in the engine; and the recommended scale should be COMPUTED from
    the progression's pitch classes rather than stored on 349 entries, with a
    stored override field only if the computation turns out to be wrong often.

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

- [x] **Phase 0** — plan agreed, CLAUDE.md written
- [x] **Phase 1** — scaffold, chord engine, schema, vocab, ~24 seed progressions,
      validation + engine tests
- [x] **Phase 2** — UI: browse/search/filter, cards, diagrams (guitar-chords.json from
      an MIT-licensed chord DB + generated piano SVGs), transpose/capo, chord library,
      scale library, performance mode + wake lock
- [~] **Phase 2.5** ← **current** — design & UX polish. Done: items 8, 10, 11, 12
      (chord explanation copy, shared copy table, instrument toggle scope, scale-note
      links), 4 + 14 (diagram popup + voicing cycling, DONE 2026-08-15), 5 (capo
      mode, DONE 2026-08-15), 3 (circle-of-fifths wheel, DONE 2026-08-15), and the
      item 9 repaint (light/dark palette, pastel-blue accent, real piano keys,
      complexity stripe). Remaining: 9's function tinting
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
- [ ] **Phase 4** — pins, playability profiles, song builder, dynamic builder
      (moves.json), PWA/service worker, export/import
- [ ] **Phase 5** — GitHub repo + Pages deploy (user creates account; walk them through)
- v2 backlog: audio playback (Web Audio), shareable song-structure links, MIDI export

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
