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
- ~300 progressions in v1, generated in themed batches. Musical-theatre range matters:
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

Search/filter by mood, genre, mode, bars, time signature, tempo, instrument, computed
complexity, and playability profile ("only chords I've marked playable" / "all playable
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
   rules. [phase 3 prep — must land before mass generation]
3. Key selector: circle-of-fifths wheel showing each key's accidentals
   (e.g. "E: F♯ C♯ G♯ D♯"). Memorisation aid. [phase 2.5, TODO]
4. Hoard/detail chord diagrams: uniform size, bigger, tappable → full-size popup, plus
   a button through to the Chords tab. [phase 2.5, TODO]
5. Capo mode: a toggle that applies the suggested capo — played shapes LARGE for
   sight-reading, sounding chords/key small alongside. [phase 2.5, TODO]
6. "Sounds like / common variations" section linking similar progressions. [phase 3]
7. Chord-swap advice with tappable swaps, each stating its impact. [phase 4 — builder]
8. Chords tab "where next?" blurbs: functional not cute. [phase 2.5, DONE 2026-08-03]
9. Design overhaul: current brown background + negative-space piano diagram is hard to
   read. Brainstorm options with Jack; chords must POP; must work in light AND dark
   mode. [phase 2.5, TODO — design proposals first, then implement]
10. Instrument toggle rescoped: hidden on Chords/Scales/Build via
    `body[data-route]` in CSS, where it changed nothing. [phase 2.5, DONE 2026-08-03]
11. Scales tab scale-note chips are now links that make that note the tonic, keeping
    the mode, with a hint line. [phase 2.5, DONE 2026-08-03]
12. Scales tab copy rewritten; headings are now "Chords in this scale" and
    "Borrowed chords". [phase 2.5, DONE 2026-08-03]

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
      links). Remaining: 3 (circle of fifths), 4 (diagrams), 5 (capo mode),
      9 (design overhaul)
- [ ] **Phase 3** — library generation to ~300 in themed batches (each batch validated;
      dedicated musical-theatre mood batches: patter, 11-o'clock number, villain song,
      torch ballad, opening number… tagged with general-purpose mood words)
- [ ] **Phase 4** — pins, playability profiles, song builder, dynamic builder
      (moves.json), PWA/service worker, export/import
- [ ] **Phase 5** — GitHub repo + Pages deploy (user creates account; walk them through)
- v2 backlog: audio playback (Web Audio), shareable song-structure links, MIDI export

## Workflow rules for agents

1. `node tools/validate.js && node tools/test-engine.js` must pass after ANY change to
   `data/` or `js/engine/`. `node tools/test-copy.js` must pass after any change to
   `js/ui/chord-copy.js`. Never commit red.
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
