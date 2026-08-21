# Progression entry schema

Reference for generating and validating files in `data/progressions/`. The single
source of truth is CLAUDE.md — if the two ever disagree, CLAUDE.md wins and this
file needs updating.

Each progression file is a JSON array of entry objects, 2-space indent, fields in
exactly this order:

```json
{
  "id": "andalusian-fall-01",          // unique, kebab-case, stable forever (pins reference it)
  "name": "Andalusian Cadence",        // canonical name if one exists, else descriptive
  "mode": "minor",                     // major | minor | dorian | mixolydian | lydian | phrygian
  "numerals": [                        // the progression itself, in order
    { "numeral": "i", "beats": 4 },    // beats are counted in the time signature's unit
    { "numeral": "bVII", "beats": 4 }, //   (a 6/8 bar = 6 beats); a chord may span more
    { "numeral": "bVI", "beats": 4 },  //   or less than a bar
    { "numeral": "V", "beats": 4 }
  ],
  "bars": 4,                           // 2–16; total beats MUST equal bars × top number of timeSig
  "timeSig": "4/4",                    // e.g. 4/4, 3/4, 6/8, 12/8, 5/4
  "homeKey": "A",                      // tonic NOTE only (e.g. "A", "Bb", "F#"), the key it plays best in
  "tempo": "mid",                      // slow | mid | fast (a feel, not BPM)
  "moods": ["dramatic", "sultry", "defiant"],   // every value must exist in data/vocab.json
  "genres": ["latin", "rock"],                  // same — vocab-controlled
  "instrument": "both",                // guitar | piano | both — where it shines
  "notes": "…",                        // 1–3 sentences, friendly bandmate, UK spelling, performance-focused
  "songs": [                           // 0–3 famous, high-confidence examples; empty array is fine
    { "title": "Sultans of Swing", "artist": "Dire Straits", "key": "D", "section": "verse" }
  ]
}
```

## Rules

- **Numerals are always measured against the tonic's MAJOR scale**, whatever the
  mode. Natural minor is `i · bIII · iv · v · bVI · bVII` (+ `iidim`); the
  harmonic-minor dominant is plain `V`. Mixolydian leans on `bVII`, dorian on `IV`
  over a minor `i`, phrygian on `bII`. A secondary-dominant sound is written as a
  chromatic numeral (`III` for E major in C), never slash-of notation.
- `homeKey` must be a supported tonic for the entry's mode family:
  major-family (major, mixolydian, lydian): `C G D A E B F# F Bb Eb Ab Db`;
  minor-family (minor, dorian, phrygian): `A E B F# C# G# D G C F Bb Eb`.
- `songs[].key` uses the same tonic-note convention as `homeKey`, and `section`
  must be one of the `sections` vocab values. Omit songs rather than guess.
- No complexity field — the engine computes complexity per key/instrument.
- No duplicate (mode + numeral sequence + timeSig) combos across the library.
  **Beats are not part of the key.** `I(8) IV(8)` and `I(4) IV(4)` are the same
  entry as far as the validator is concerned, and so are a 12-bar and a 14-bar
  blues that happen to hit the same chords in the same order. Changing how long
  a chord lasts, or how many bars the form runs to, does not make a new
  progression: only a different chord sequence, mode or time signature does.
  This is the mistake that generated batches keep making, so check the sequence
  itself against the library rather than the shape of the entry.
- `name`: use the canonical name where the progression has one, in title case
  (`12-Bar Blues`, `Doo-Wop`, `Axis Progression`, `Andalusian Cadence`,
  `Jazz 2-5-1`, `Ceilidh`). Otherwise describe it in sentence case
  (`Heroic fanfare`, `Descending bass line`, `Phrygian vamp`). Descriptive beats
  evocative: no `Villain's Tango`-style titles.
- `notes`: no em-dashes, and no "it's not X, it's Y" constructions. Lead with the
  theory fact that makes the progression what it is, then how to play it. Cut
  anything that is neither. See the copy voice rules in CLAUDE.md.

## Roman numeral grammar

```
numeral    := accidental? degree suffix* bass?
accidental := "b" | "#"           (relative to the tonic's MAJOR scale)
degree     := I II III IV V VI VII   (uppercase = major triad)
            | i ii iii iv v vi vii   (lowercase = minor triad)
suffix     := "sus2" | "sus4" | "7" | "maj7" | "6" | "add9" | "dim" | "aug" | "5"
bass       := "/" digit 1–7       (diatonic scale degree of the bass note)
```

- `7` on uppercase = dominant 7th (`V7`); on lowercase = minor 7th (`ii7`).
- At most ONE of {sus2, sus4, dim, aug, 5}; at most ONE of {7, maj7, 6, add9};
  the only cross-group combination allowed is sus + 7 (`V7sus4`).
- Case conventions (parser-enforced): `dim` on lowercase (`viidim`, `#idim`),
  `aug` and `maj7` on uppercase (`bIIIaug`, `IVmaj7`).
- `5` = power chord (root + fifth, no third).
- Slash bass: `I/3` in C = C/E; `V/7` in G = D/F#.
- Nothing fancier in v1: no 9/11/13, no m7b5, no ø or °7 symbols.

## data/moves.json (dynamic builder rules)

Suggestion rules for the Build tab. Three parts:

- `transitions`: for each scale degree you are on (`"1"`–`"7"`), the ranked
  degrees to try next. Mode-agnostic — the builder maps degrees through the
  current mode's own diatonic numerals (`DIATONIC_NUMERALS` in
  `js/engine/harmony.js`), so `5 → 1` means V→I in major and v→i in minor.
- `colours`: per family (`major`/`minor`), per destination degree, the
  tasteful-colour variants offered at spice level two (sus, 7ths, 6, add9,
  slash basses). Slash basses appear only in the major table: bass digits
  read against the tonic's MAJOR scale, so `i/3` in A minor would give
  Am/C#, which nobody wants.
- `borrowed`: per family, the spice-three pool. The builder filters it per
  mode with `isDiatonic()`, so anything the current mode already owns (like
  bVII in mixolydian) drops out by itself.

Every numeral must parse and realise; `tools/validate.js` checks the file.

## data/solo-shapes.json (CAGED pentatonic box shapes, roadmap 0.3)

The 5 standard moveable minor-pentatonic "box" shapes on 6-string guitar,
CAGED order (`id`: `"E"`, `"D"`, `"C"`, `"A"`, `"G"` → `box`: 1–5). Pure
geometry, nothing musical is stored twice:

- `tuning`: open strings low to high, `["E","A","D","G","B","E"]`.
- Each shape's `strings` object maps a string number (6 = low E, 1 = high E)
  to the fret OFFSETS played on it, relative to the shape's own reference
  fret (offset 0). Every string has exactly two offsets except Box 3's
  string 2, which has the well-known 3-fret "stretch" (`[1, 4]` instead of
  the usual 2-fret gap) — see `docs/research/caged-pentatonic-shapes.md` for
  the sourcing and cross-checks behind this data.
- `root`: `{ string, offset }` — which note in the shape is scale degree 1,
  used to work out the reference fret for a given tonic.

Scale-degree labels (`1`, `♭3`, `4`, `5`, `♭7`) are NOT stored here — they're
recomputed from the tuning and the declared root by
`js/engine/solo-scales.js`'s `cagedPositions()`, which throws if a fret
offset doesn't land on a real minor-pentatonic interval. `tools/test-diagrams.js`
runs that check over this file as a standing test, so a transcription
mistake fails the suite rather than silently mislabelling a fret.

Major pentatonic and blues do NOT get their own shape data: major pentatonic
of a tonic is the identical five notes as minor pentatonic of its relative
minor (same shapes, rooted differently — see `cagedPositions()`'s own
comment), and blues fretboard positions are a deliberately deferred follow-up
(v1 ships the plain minor-pentatonic boxes only).

## data/words.json (lyric prompt words, roadmap 2.4)

Four tiers of 500 plain lowercase words, 2000 in total. The word generator
draws one word per tier and shows them in tier order, so a banner reads plain
to rare from left to right.

- `version`: bump it whenever the word lists change. The shuffle bag stores
  this alongside its cursors and resets itself when the number moves, rather
  than leaving a cursor pointing into a list that changed underneath it.
- `tiers`: keys `"1"` to `"4"`, exactly 500 words each, sorted alphabetically
  so a duplicate is easy to spot by eye as well as by validator.
- **The axis is familiarity in everyday English**, tier 1 most common through
  to tier 4 rarest. Syllable count and abstractness correlate with it
  naturally; they are not the axis. The gradient is never explained in the
  UI, it just reads as four flavours of inspiration.
- **Tier 4 is vivid and rare, never academic and rare.** A word you have to
  stop and parse is useless on stage. `cantankerous` and `curmudgeon` are in,
  `perspicacious` and `lugubrious` are out. Signed off with Jack against the
  50-word sample in `docs/words-sample.md`, which also records where the line
  sits: rare enough not to be an everyday word, familiar enough that nobody in
  the room has to work it out.
- No tags of any kind are stored on a word. Nothing would read them, and this
  codebase does not store what it does not use.
- Words are deliberately NOT coupled to the harmony. Mood tagging and
  harmonic-function biasing were both designed and both rejected; for improv
  the words work better as an orthogonal axis.
- Category balance is an authoring guideline, not stored data. Each tier is
  written to spread across concrete nouns, people and occupational figures,
  places and geography, adjectives and moods, verbs, and a small number of
  archetype or myth names.
- Proper nouns stay inside archetypes, myth, generic geography and
  occupational figures (`atlantis`, `kraken`, `pharaoh`). No real people, no
  places with political weight: a generator shown to a room must not be able
  to surface either.
- UK spelling throughout (`harbour`, `sulphur`, `marvellous`, `smoulder`).

`tools/validate.js` checks the mechanical half: four tiers, 500 each,
lowercase a–z only, a hard 14-character cap, and no duplicate word anywhere
in the file. That last one is what keeps the shuffle bag's no-repeat
guarantee honest.
