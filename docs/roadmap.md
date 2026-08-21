# Chord Hoard: Advanced Roadmap

Written 2026-08-21, agreed with Jack. This is the implementation plan for everything
beyond the current phase 4 work. It is written to be executed by an agent (Sonnet or
Opus) one item at a time.

## How to use this document

Read CLAUDE.md in full first. It is the single source of truth for architecture rules,
data model, engine API, copy voice, and workflow. Nothing in this roadmap overrides it.
The non-negotiables that every item below was designed around:

- Vanilla HTML/CSS/JS, no build step, no frameworks, no npm packages, ES modules only.
- Engine code (`js/engine/`) is pure, DOM-free, and unit-tested in `tools/test-engine.js`.
  If the UI needs a musical fact, it goes in the engine.
- All data ships as static JSON under `data/`. Relative URLs only (the app runs from a
  GitHub Pages subpath). localStorage keys are namespaced `chordhoard.*` and any new key
  automatically rides along in export/import because `js/ui/backup.js` sweeps by prefix.
- Mobile-first: test at 360x780 and 780x360. Offline-first: any new shipped file must be
  added to the sw.js precache list, and CACHE_VERSION must be bumped whenever any shipped
  file changes.
- `node tools/test-all.js` must pass before every commit. Never commit red.
- Copy voice: friendly bandmate, UK spelling, no em-dashes anywhere in app copy or data,
  no "it's not X, it's Y" constructions, theory-dense before emotive.

Work the tiers in order unless Jack redirects. Within a tier, items are ordered by
dependency, then by value. Each item states its goal, the design and the reasoning
behind it, what to build (engine / data / UI / storage / tests), gotchas learned from
this codebase, and acceptance criteria. Treat acceptance criteria as the definition of
done. Update CLAUDE.md's phase status and this file's checkboxes as items land.

A sizing note: sizes are relative (S under ~150 lines touched, M a few hundred, L a
serious multi-file feature). They are there to help you plan a session, not to be
reported against.

---

## Tier 0: Close phase 4 and finish loose ends

### 0.1 Song builder  [x]  (L)  DONE 2026-08-21

**Goal.** The last open phase 4 feature. 2 to 4 named sections (verse / prechorus /
chorus / bridge, per the schema's section vocab) displayed simultaneously, each section
holding one progression, auto-suggested for mood and key continuity or hand-picked,
saveable and exportable. This is the feature that turns a hoard of fragments into songs.

**Design and reasoning.** A song is a small JSON object, not a new progression format:

```json
{
  "id": "song-1723712345",
  "name": "Untitled song",
  "tonic": "G",
  "sections": [
    { "label": "verse", "progId": "folk-jig-01", "tonicOverride": null },
    { "label": "chorus", "progId": "pop-axis-03", "tonicOverride": null }
  ]
}
```

Store the array under `chordhoard.songs`. Reference progressions by id only (ids are
stable forever, and `built-*` ids from the dynamic builder are equally valid here, which
is free integration). `tonic` is the song-level key; `tonicOverride` exists for the rare
deliberate key change and is null otherwise. Do not store realized chords, ever.

Suggestion logic belongs in the engine as a new pure module, `js/engine/song.js`:

- `sectionSuggestions(entries, currentSections, songTonic)` returns ranked candidate
  entries for the next section. Rank by: shared mood tags (weight highest, moods are the
  user-facing continuity), same mode or relative major/minor of the song tonic, then
  contrast heuristics (a chorus candidate ranks up if its first chord differs from the
  verse's first chord, and if its average beats-per-chord is shorter, both cheap proxies
  for lift).
- Keep the scoring function exported separately so `tools/test-engine.js` can assert
  ordering on fixed fixtures without caring about exact scores.

UI is a new route `#/songs` plus a builder view: section slots rendered side by side
(stacked on portrait mobile, columns on landscape/desktop), each slot showing the
progression's numerals + named chords in the song key via the existing
`progression.render`, tinted via `function-tint.js`. "Suggest" per empty slot shows the
top 5 candidates as tappable cards with mood tags visible. Manual pick opens the same
filter sheet the Hoard uses if practical; if that coupling is awkward, a simple
searchable list is fine for v1.

Performance mode must accept a song: extend `perform.js` to take an ordered list of
(entry, tonic) pairs and swipe or arrow between sections. Reuse the existing 2-column
grid per section, do not attempt to show all sections at once in performance mode.

**Storage.** `chordhoard.songs` (array as above). Rides along in backup automatically.

**Gotchas.**
- `perform.js` hides the whole app header and does its own fit-to-viewport height math in
  `layout()`, measuring `.perform-topbar`. Any new strip content must live inside the
  existing measured wrappers or the sizing breaks.
- `app.js` and view modules have mutual imports; the established pattern (see the
  chords-lib/detail and settings-panel notes in CLAUDE.md) is to only read cross-module
  values inside event handlers, never at module-evaluation time.
- If a saved song references a deleted `built-*` progression, render the slot as a
  visible "missing progression" state, not a throw.

**Tests.** Engine: `sectionSuggestions` ordering on fixtures; song objects with a
missing progId do not throw at the engine level. Add a jsdom boot check (the pattern
used for the circle-of-fifths verification) that builds a 2-section song and enters
performance mode.

**Acceptance.** Can assemble a 3-section song from suggestions in under a minute on
mobile; saved songs survive reload; performance mode plays through a song section by
section; export/import round-trips songs; test-all green.

### 0.2 Manual light/dark override  [x]  (S)  DONE 2026-08-21

**Goal.** Close the remainder of backlog item 15. The CSS plumbing already exists:
`:root[data-theme="light"|"dark"]` is declared and the dark block is written as
`:root:not([data-theme="light"])`, so the override works the moment something sets the
attribute.

**Build.** A `chordhoard.theme` key with three states: `"light"`, `"dark"`, absent
(follow system). A second `settingsRow()` in `app.js`'s `buildSettingsPanel()` with a
three-way control (System / Light / Dark). On load, `app.js` reads the key and sets
`document.documentElement.dataset.theme` before first paint (do it in a plain inline
module statement at the top of app.js's boot, not after render, to avoid a flash).
"System" deletes both the key and the attribute.

**Acceptance.** Switching is instant with no re-render; choice survives reload; system
mode tracks the OS again after an explicit choice is cleared; no hardcoded colours added.

### 0.3 Soloing scales: pentatonic, blues, CAGED positions  [x]  (M/L)  DONE 2026-08-21

**Goal.** Backlog item 17. Pentatonic and blues scales in the Scales tab, CAGED position
cheat sheets for guitar soloing, and a recommended soloing scale flagged on each
progression. This is the bridge between the library and actually improvising over it,
which is Jack's job on stage.

**Design and reasoning.** Two design decisions were made when this was backlogged and
they stand:

1. Pentatonic and blues are NOT modes. Do not add them to `vocab.json`'s modes list or
   to `DIATONIC_NUMERALS`. They are a new engine concept: `js/engine/solo-scales.js`
   with a small table of scale formulas in semitones (major pentatonic [0,2,4,7,9],
   minor pentatonic [0,3,5,7,10], blues [0,3,5,6,7,10]) and a speller that reuses
   `theory.js`'s letter/accidental machinery so Bb blues is spelled with the right
   letters, not enharmonic sludge. The blues b5 is the one place a scale legitimately
   has two notes on one letter (Eb and E over a Bb root, for example); spell the b5 as
   a flattened 5th letter and add a one-line comment in the module explaining why.
2. The recommended scale per progression is COMPUTED, never stored on 349 entries.
   `recommend(entry)` in the same module: gather the progression's pitch classes via
   `progression.render` in the home key, score each candidate scale (major/minor
   pentatonic and blues off the tonic, plus relative alternatives) by coverage of the
   progression's pitch classes minus penalties for scale notes that clash with chord
   tones (a scale note a semitone above any chord tone of a long-held chord is the
   clash that matters). Return the best plus a one-word reason code the UI can turn
   into copy. Add an optional `soloScale` override field to the schema ONLY if testing
   proves the computation wrong often; start without it.

CAGED position sheets are data plus a renderer: five positions per pentatonic shape as
fret-window data in a new `data/solo-shapes.json`, rendered by extending
`js/ui/diagrams.js`'s existing SVG conventions (classed shapes, no colour attributes,
CSS owns the palette). Show them in the Scales tab under a new "Soloing" section, and
on the progression detail view as a single recommended-scale line linking into the
Scales tab.

**Gotchas.** `diagrams.js` has its own test file (`tools/test-diagrams.js`) which must
be extended, not just kept passing. The Scales tab (`scales-lib.js`) is hash-driven;
deep links into a specific soloing scale should follow its existing hash parameter
style. Any new data file goes into the sw.js precache list.

**Tests.** Spelling assertions for awkward keys (Bb blues, F# minor pentatonic);
`recommend()` fixtures including at least one modal entry and one heavily borrowed
entry; diagram output structure tests.

**Acceptance.** Every supported tonic renders correct pentatonic/blues spellings on
both instruments; five CAGED positions render for guitar; every progression detail
shows a recommended scale with a reason; recommendations look sane on a spot-check of
a dozen entries across batches (do the spot-check and report it); test-all green.

---

## Tier 1: Audio (the multiplier)

### 1.1 Web Audio playback engine  [x]  (L)  DONE 2026-08-21

**Goal.** Hear any progression, in any key, on demand. This is the single
highest-leverage feature in the roadmap: every teaching feature in tier 3 depends on
it, and it converts the app from a reference into an instrument.

**Design and reasoning.** Web Audio API only, no samples, no dependencies. A shipped
sample library would blow up the offline cache and violate the no-dependency rule; a
small synthesized voice is fine for reference playback (the bar is "clearly conveys the
harmony", not "sounds like a Steinway").

Split it exactly along the project's engine/UI line:

- `js/engine/audio-notes.js` (pure, testable): note name + octave to frequency
  (A4 = 440, twelve-tone equal temperament, use the existing pitch-class machinery in
  `theory.js` rather than a parallel note table), plus voicing selection: given a
  realized chord (`chords.realize` output including `bassNote`), return concrete
  pitches. Root position around C3 for the bass note, chord tones voiced in a fixed
  octave window (roughly C4 to C5) so consecutive chords do not leap wildly. Keep this
  pure so tests can assert exact frequencies and voicings without an AudioContext.
- `js/ui/audio-player.js` (owns the AudioContext, the only file allowed to): a small
  polysynth. Per note: one oscillator pair (triangle + sine an octave below at low
  gain gives a passable keyboard-ish tone), a gain envelope (fast attack, gentle
  release), a single shared lowpass filter and master gain with a compressor to stop
  chord stacks clipping. Scheduling uses the AudioContext clock with a lookahead
  timer (the standard "tale of two clocks" pattern: a setInterval around 25ms
  scheduling everything due in the next 100ms). Never schedule from requestAnimationFrame
  and never rely on setInterval timing itself, or backgrounded tabs will stutter.

Tempo: the data's `tempo` field is a feel, not a BPM. Map slow/mid/fast to default BPMs
(around 72/104/144), overridable by a BPM stepper in the player UI. Beats come from the
entry's `numerals[].beats` against its `timeSig`, which the data model already
guarantees adds up.

Player UI: a compact transport on the detail view (play/stop, loop toggle, BPM, count-in
toggle, metronome toggle) and a play button on performance mode's strip. During
playback, highlight the sounding chord in the existing chord strip / performance grid by
toggling a class; drive the highlight from the same scheduler (schedule a DOM class
flip via setTimeout aligned to the audio clock offset, and accept the few ms of drift,
it is a highlight, not a DAW).

Metronome: a short filtered noise or high sine blip on each beat, accented on beat 1,
generated in code. Count-in: one bar of metronome before the first chord.

**Gotchas.**
- Autoplay policy: the AudioContext must be created or resumed inside the first user
  gesture. Create it lazily on first play tap, keep the instance as a singleton.
- iOS silent switch and interruptions: handle `statechange` and resume on the next
  gesture; never assume a resumed context stays running.
- Wake lock already exists in performance mode; playback there must not fight it.
- CACHE_VERSION bump, new files into sw.js precache.
- Do not build v2's full audio ambitions (per-instrument realistic voices, strum
  patterns): flat block chords with the correct bass note, plus the metronome, is the
  deliverable. Design the player module so a strum/arpeggio pattern parameter can be
  added later without rework (take a `pattern` argument that v1 always passes as
  `"block"`).

**Tests.** All of `audio-notes.js` is unit-testable in Node: frequency maths,
voicing windows, bass note handling for slash chords (`I/3` in C must put an E below
the C-E-G stack). The scheduler and synth are verified by a manual checklist in the PR
description plus a jsdom smoke test that the module imports and its schedule
computation (pure part) produces the right chord-change timestamps for a fixture entry.

**Acceptance.** Any entry plays in any supported key with correct pitches including
slash basses; loop is gapless (schedule the loop boundary ahead, do not stop/start);
BPM changes apply on the next bar; works on mobile Safari and Chrome after one tap;
performance mode can play with the grid highlighting along; test-all green.

### 1.2 Builder and chord library audition  [x]  (S/M)  DONE 2026-08-21

**Goal.** Once 1.1 exists, wire single-chord audition everywhere chords appear:
tapping a suggestion in the dynamic builder plays it, a play affordance on the Chords
tab plays the displayed chord, and the ear-training tier gets its sound for free.

**Build.** `audio-player.js` exposes `playChord(realized, {duration})` alongside
`playProgression(...)`. Add audition taps in `builder.js` (suggestion buttons) and
`chords-lib.js`. Keep the affordance consistent: a small speaker icon, not a whole-cell
tap (whole-cell taps are already taken by navigation/cycling in most views, see the
backlog item 14 lesson about competing tap meanings).

**Acceptance.** Auditioning a suggestion in the builder does not place it; chord
library plays the exact displayed voicing's pitch classes; no context errors when
tapping rapidly.

---

## Tier 2: Performance quick wins

Cheap, high-joy items. Do them as palate cleansers between big tiers if preferred;
none depend on audio.

### 2.1 Improv roulette  [x]  (S)  DONE 2026-08-21

**Goal.** For musical-improv rehearsal and warmups: "something villainous in 3/4,
now". One tap from filters to a full-screen playable progression.

**Design.** A "Surprise me" action on the Hoard view that respects the CURRENT filter
state: pick a uniformly random entry from the filtered result set and jump straight
into performance mode for it in its home key. If the filter set is empty, disable the
button rather than falling back silently. Add a reroll button inside performance
mode's strip (small dice icon next to the existing controls) that draws another from
the same filtered set without leaving performance mode. Pass the filtered id list via
the existing route/state mechanism rather than recomputing filters inside perform.js.

**Gotchas.** Perform mode's strip and topbar are measured for layout; add the dice
inside the existing strip. Do not let reroll repeat the current entry when the set has
more than one member.

**Acceptance.** Filter to a mood + time signature, one tap lands in performance mode
on a matching entry, reroll cycles within the filter, works offline.

Implementation note: the filtered id pool is ephemeral module-scoped state in
a new `js/ui/roulette.js` (`setPool`/`isActivePool`/`pickFrom`), not
persisted — like the performance view's capo toggle, it only needs to
survive the hash change from Hoard into Performance mode. `hoard.js` gained
a full-width "🎲 Surprise me" pill under the search row (disabled, not
hidden, when the filtered set is empty) that calls `roulette.setPool()` with
the current `results()` ids and jumps to `#/perform/<id>/<homeKey>` (home
key explicitly, not the remembered per-progression key choice, since a
surprise should surprise). `perform.js`'s standalone `render()` builds a
small reroll dice via `rerollControl()`, shown only when
`roulette.isActivePool(entry.id)` (pool has more than one member and
includes the entry on screen) — so a perform link reached the ordinary way
(from the detail view) never grows a dice it has nothing to reroll within.
Reroll excludes the current entry per `roulette.pickFrom(excludeId)`; it
changes the URL (`location.hash`) rather than patching the grid in place,
which is the same "a route change fully rebuilds the view" pattern already
used for song section prev/next. Verified in a real browser: filtering to
zero results disables the button; repeated rerolls cycle through the
filtered set without repeating; the strip (dice + capo hint together, the
worst case) does not overflow at 360 width or 780×360 landscape.

### 2.2 Setlists  [x]  (M)  DONE 2026-08-21

**Goal.** An ordered list of items (progressions with a chosen key, or songs once 0.1
lands) for a gig or rehearsal, playable start to finish in performance mode.

**Design.** `chordhoard.setlists`: array of `{ id, name, items: [{ kind: "prog" |
"song", refId, tonic }] }`. Build the management UI into the Pins area rather than a
new top-level tab (a setlist is curated pins with an order; keep the information
architecture tight). Reordering: up/down buttons, not drag-and-drop (drag is a
minefield on mobile and the lists are short). Performance mode gains previous/next
item navigation: on-screen arrows in the strip plus ArrowLeft/ArrowRight key handling.
The key handling is deliberately also the Bluetooth pedal story: page-turner pedals
present as keyboards sending arrow keys, so setlists plus this handler equals
hands-free gigging with zero pedal-specific code. Mention that in the UI copy for
setlists ("works with page-turner pedals").

**Gotchas.** Keyboard listeners in perform.js must be added on enter and removed on
exit (the view is a takeover, not a page). A setlist item whose refId no longer
exists renders as a skippable missing state.

**Acceptance.** Build a 5-item setlist, play it end to end using only arrow keys;
survives reload and export/import; missing references degrade gracefully.

Implementation note: `js/ui/setlists-store.js` mirrors `songs-store.js`
exactly (`chordhoard.setlists`, read-modify-write-the-whole-array, rides
along in backup automatically via the prefix sweep). `js/ui/setlists.js` is
the list (#/setlists) and editor (#/setlists/new, #/setlists/<id>), styled
by reusing the song builder's generic CSS classes (`.song-card`,
`.song-slot`, `.song-back`, `.song-save-btn`…) since the visual language is
identical; only what's genuinely new to a setlist (up/down reorder buttons,
the kind badge, the add-item search across both progressions and songs)
gets its own `.setlist-*` classes. No new top-level tab: the Hoard's Pins
filter group gained a "Manage setlists →" link (`hoard.js`'s `buildSheet()`,
gated on `key === "pinned"`) since a setlist is curated pins with an order.
Reordering is plain up/down buttons (disabled at each end), not
drag-and-drop, per the roadmap's own reasoning about mobile drag.
Performance mode gained a THIRD route, `#/perform-setlist/<id>[/<index>]`
(`perform.js`'s `renderSetlist()`), which flattens a setlist into a linear
sequence of playable steps before handing off to the same
`buildPerformanceView()` core: a "prog" item is one step, a "song" item
expands into ALL of that song's own sections in order (reusing
`renderSong()`'s `realizeSong()` call, so a song's key/tonic resolution
never needs a second implementation) — so a whole song plays through inside
the setlist rather than needing its own nested prev/next, and the
page-turner-pedal story (arrow keys = ArrowLeft/ArrowRight, already wired
for song sections) covers a whole gig set for free. A missing "prog" or
"song" reference renders as a skippable placeholder (`buildMissingSectionView`,
now parameterised with a `backLabel` so the placeholder correctly says "Back
to the setlist" rather than the song-only wording it used to hardcode).
Caught and fixed while wiring this up: `css/app.css`'s
`body[data-route="perform"|"perform-song"]` rules (hiding the header/tabbar
for the full-viewport takeover) did not list `"perform-setlist"`, so the new
route would have kept the ordinary header and tab bar visible underneath the
performance grid — fixed by adding the new route to both rules. Verified in
a real browser: built and saved a 5-item setlist (mixed progressions across
different keys) from the search-based picker, reordered an item, reloaded
the editor from storage, played it through with ArrowRight/ArrowLeft
(stepping via real separate keyboard events, since firing several in the
same synchronous tick only ever applies the first — location.hash changes
are asynchronous), confirmed Next/prev disable correctly at both ends,
forced a missing-reference item and confirmed the placeholder degrades
without throwing and reads correctly, round-tripped the setlist through
`backup.exportData()`/`importBackup()`, and confirmed the header/tab bar
now hide correctly on `#/perform-setlist/...`.

### 2.3 Auto-advance (play-along highlight without audio)  [x]  (S)  DONE 2026-08-21

**Goal.** In performance mode, a tempo-driven highlight that walks the grid cell by
cell so you can play along hands-free. With audio (1.1) present it is the same
highlight driven by the scheduler; without audio it is a silent visual metronome.

**Design.** A start/stop control and BPM stepper in the perform strip. Advance timing
comes from each chord's beats at the chosen BPM. Highlight = a class on the current
cell (reuse or mirror the playback-highlight class from 1.1 so the two features stay
visually identical). Loop at the end. If 1.1 has landed first, implement this as the
audio player's highlight path with the synth muted, one code path, not two.

**Acceptance.** Highlight timing matches the chord durations including odd metres
(test a 6/8 and a 5/4 entry); stays smooth with the screen kept awake; blank filler
cells are skipped.

Implementation note: one code path, exactly as specified. `audio-player.js`'s
`playProgression()` gained a `muted` option that skips `scheduleChordAudio()`/
`scheduleClick()` calls but keeps the AudioContext clock driving the
schedule and still fires `onChordChange`/`onStop` on time, so the highlight
stays sample-accurate and immune to a backgrounded tab exactly like real
playback, just silent. `perform.js`'s `buildPerformanceView()` gained a
second strip row (`.perform-auto-row`, inside `.perform-topbar` so
`layout()`'s fit-to-viewport measurement of the topbar's whole height
already accounts for it) with an "Auto-advance" toggle and a compact BPM
stepper (defaulting to `bpmForTempo(entry.tempo)`, independent of the Play
button's fixed tempo). Auto-advance calls `audioPlayer.playProgression(...,
{ loop: true, muted: true, onChordChange: highlightSounding })` — the SAME
`highlightSounding`/`applyHighlight` the audible Play button already used,
so the two controls are visually identical, per the acceptance criteria.
Because only one `audioPlayer` transport runs at a time, Play and
Auto-advance are mutually exclusive; a local `activeControl` variable
("play" | "auto" | null) tracks which button is currently "on" so a click on
either one always means "start or stop THIS control" rather than a stray
tap on one silently stopping the other without starting anything. Verified
in a real browser: toggling Auto-advance walks the highlight across the
grid and keeps looping past a full pass; the BPM stepper adjusts in
4-BPM steps; clicking Play while Auto-advance is running stops the walk and
starts audible playback (and vice versa), each button's own UI resetting
correctly; the new row does not overflow the strip at 360 width or 780×360
landscape, including the worst case (auto row + reroll dice + capo toggle
all present together).

### 2.4 Random word generator  [ ]  (L)

Designed with Jack 2026-08-21 in a full requirements pass. Every decision below
was argued through and settled; the "rejected" list at the end is as binding as
the rest, so do not re-propose those.

**Goal.** Lyric prompts sitting alongside the chords. Four random words per
progression, so a rehearsal or a gig has a starting point for words as well as
harmony. Built for musical improv, where the chords are only half of what you
have to invent on the spot.

**Design and reasoning.**

Four words shown as a **banner**, not one word per chord. Per-chord attachment
was the original proposal and was rejected on two grounds. First, performance
mode's `layout()` cannot take a second line of text under every chord symbol
without cells silently colliding (its shrink loop cannot see the overflow; see
2.6). Second, a prompt tied to a chord changes every 2.3 seconds at 104bpm with
4-beat chords, which is faster than anyone can finish a sung line. Per-chord
attachment stays on the backlog for after 2.6 hardens the layout.

The four words carry a deliberate **complexity gradient**, tier 1 through tier 4,
plain to rare ("dog" through to "calamitous"). This is never explained in the UI.
It reads as four different flavours of inspiration and the gradient is understood
implicitly. There is no difficulty selector; position in the banner IS the tier.

Words are **not coupled to the music**. Mood tagging (reusing `vocab.json`'s 41
moods) and harmonic-function biasing (via `harmony.classify`) were both designed
and both rejected: for improv the words work better as an orthogonal axis, and
coupling them narrows what you can do with them rather than widening it.

**Data.** New file `data/words.json`, added to the sw.js precache.

```json
{
  "comment": "...",
  "version": 1,
  "tiers": {
    "1": ["dog", "..."],
    "2": ["..."],
    "3": ["..."],
    "4": ["calamitous", "..."]
  }
}
```

- 500 plain lowercase strings per tier, 2000 total. No tags of any kind on any
  word: nothing would read them, and this codebase does not store what it does
  not use (no complexity field on entries, no stored scale recommendations).
- **The axis is familiarity.** Tier 1 most common in everyday English, tier 4
  rarest. Syllable count and abstractness may correlate naturally; they are not
  the axis.
- **Hard guard on tier 4: vivid and rare, never academic and rare.** A word you
  have to parse is useless on stage. "Calamitous" yes, "perspicacious" no. This
  is the single most important instruction for whoever writes the list, and it is
  what the sample below exists to prove.
- Categories (nouns, adjectives, moods, locations, infinitives, proper nouns) are
  an authoring balance guideline, documented in `data/schema.md`, never stored.
- Proper nouns restricted to archetypes, myth, generic geography and occupational
  figures ("the Baron", "Atlantis", "the lighthouse keeper"). No real people. A
  random generator shown to a room must not be able to surface a real person's
  name or a place with political weight.
- **Hard 14-character cap**, validated. 12 was considered and raised because
  familiar-but-rare tier 4 words run long ("cantankerous" is 12), and a validated
  constraint beats a responsive one here because the failure shows up on stage.
- House JSON conventions: 2-space indent, LF, trailing newline, comment as a
  string key (the `moves.json` pattern). Roughly 25-30KB against a current
  787KB first-visit payload.

**Sourcing.** Research what categories make good improv prompts, then write
original lists. Do not copy a word list wholesale from any site: individual
common words are not copyrightable but a specific curated compilation can be,
and scraping also imports that source's quality problems. Be honest in planning
that 2000 curated, tiered, category-balanced words is a content-writing task
that will dominate the effort on this item.

**Process gate.** Write a **50-word sample split roughly 12-13 per tier** and get
Jack's sign-off before writing the remaining 1,950. Splitting it across all four
tiers is the point: he is signing off on the gradient, not just the vocabulary.

**Engine: the shuffle bag.** New pure module (suggested `js/engine/word-bag.js`).
Jack's requirement is no repeats even across sessions, and drawing at random from
2000 fails that fast: four words per entry means ~100 words drawn after 25
progressions, where collisions are already likely. So:

- A small seeded PRNG (mulberry32 or similar, about five lines), deterministic
  and unit-testable. "The shuffle is correct" is otherwise unfalsifiable.
- Per tier, a `{ seed, cursor }` pair. Draw sequentially through the deterministic
  shuffle of that tier; reseed only when the tier is exhausted. This guarantees
  all 500 words in a band are seen before any repeat.
- Store `version` from `words.json` alongside the bags. A version bump resets
  them, rather than leaving cursors pointing into a list that changed underneath.
- Engine modules never fetch: the UI passes parsed data in, per the
  `solo-scales.js` / `cagedPositions()` precedent.

**Storage.** `chordhoard.words`, shape
`{ enabled, version, bags: { "1": {seed, cursor}, … } }`. Rides backups
automatically via `backup.js`'s prefix sweep. **`enabled` defaults to true.** See
the release flag at the end of this item.

**Audio.** Add an `onLoop` callback to `playProgression()`'s options, fired at the
existing loop-reset point in the scheduler (around the `chordCursor`/`clickCursor`
reset). About three lines. Do NOT infer the loop boundary by watching
`onChordChange` for index 0: it breaks on single-chord progressions where the
index is always 0, and it makes a documented event out of a side effect of index
arithmetic.

**UI.**

- A banner of four words, rendered **in tier order 1 to 4** so the gradient is
  visible.
- **Performance mode**: the banner must live **inside `.perform-topbar`**, which
  is the only element `layout()` measures for chrome height. Anything placed
  between the topbar and the grid is invisible to that math and reintroduces the
  overflow bug. **Hide the colour legend (`.perform-legend`) whenever words are
  showing**, which holds the topbar at three rows so the banner adds no net
  chrome height. Both are secondary reference text and during a performance a
  lyric prompt outranks a reminder of what the tint colours mean.
- Applies to **all three perform routes** (`#/perform`, `#/perform-song`,
  `#/perform-setlist`), which is free since they share `buildPerformanceView()`.
  During a setlist each item gets its own fresh four words as you arrow through.
- **Detail view**: directly under the chord strip, above the transport. The chord
  strip is "what am I playing", the words are "what am I singing about"; they
  read as a pair, and it keeps the transport next to the key picker.
- A **reroll control** next to the banner on both surfaces, reusing the roulette's
  dice pattern. Without it the only way to reject a bad word set is to leave and
  re-enter the view, which is four taps mid-rehearsal.
- Words regenerate on every entry render, and a fresh set arrives **on each loop
  boundary** via `onLoop`. Never on chord change. On the detail view that means
  rotation only happens when its Loop toggle is on.
- On/off is a `settingsRow()` in the existing settings cog panel, not a per-view
  button.

**Validation.** `tools/validate.js` gains checks on `words.json`: exactly four
tiers, expected count per tier, consistent lowercase casing, the 14-character
cap, and **no duplicate word anywhere in the file**. That last one is what keeps
the no-repeat guarantee honest; a duplicate silently breaks it.

**Gotchas.**
- `cache.addAll` is atomic, so one wrong precache URL fails the whole service
  worker install. Bump `CACHE_VERSION`.
- Lazy-fetch on the `getMoves()` pattern (module-scope promise, nulled in
  `.catch` so failures are not cached). On failure disable the feature quietly
  rather than breaking the view.
- Copy voice applies to the words themselves and to every label: no em-dashes,
  UK spelling.

**Tests.** The PRNG is deterministic for a fixed seed; a full pass through a tier
yields all 500 words with no repeat; a version bump resets the bag; the banner
draws one word per tier in order.

**Acceptance.** Four words appear above the perform grid and under the detail
chord strip with the toggle on, and nowhere with it off; the topbar stays at
three rows in perform mode; the gradient is visibly plain-to-rare; reroll draws
a fresh set without leaving the view; a full pass through a tier never repeats a
word, across reloads; words survive export/import; `test-all` green.

**Flagged for release.** Defaulting `enabled` to true is right for Jack and wrong
for a stranger, who gets four random words above their chords before knowing what
they are. Revisit before any wider release.

**Rejected during design, do not re-propose.** Mood or harmonic-function coupling
of words. Words on Hoard cards (349 cards of random words destroys the scanning
the Hoard exists for). Rotation on chord change. A Common/Mixed/Obscure
difficulty selector, superseded by the positional gradient. Audience suggestion
capture and genre prompt cards.

### 2.5 Metronome button and tap tempo  [ ]  (S/M)

**Goal.** Give performance mode a metronome, and give both transports a tap
tempo, so tempo can be set by feel rather than by stepping 4 BPM at a time.

**Design.** Most of the metronome already exists and is simply not wired up.
`playProgression()` already accepts `metronome` and `countIn` flags and already
generates an accented downbeat click; perform mode's two call sites just never
pass them. So this is a small metronome button in the perform strip opening a
compact popover with metronome on/off, count-in, and tap tempo.

**Tap tempo does not exist anywhere in the repo** and is genuinely new (verified
by grep: every `tap` in the codebase is the `--tap: 44px` touch-target variable,
the `.diagram-tap` class, or prose). It is small: average the last four taps,
discard gaps over two seconds, write the result into the existing stepper value.

**Gotchas.** The perform strip already holds nine controls with no `flex-wrap`,
and `.perform-strip-info` is the flex spacer that gets ellipsised as things are
added. A popover is the consolidation move; adding more inline pills is not.
The BPM stepper is currently duplicated verbatim in `detail.js` and `perform.js`
(same step of 4, same 40-220 clamp); tap tempo is a reason to share it.

**Acceptance.** Metronome and count-in work in performance mode; four taps set a
sensible BPM and a stale tap does not poison it; the strip does not overflow at
360 width or 780x360.

### 2.6 Performance mode fixes  [ ]  (S/M)

**Goal.** Three known defects in performance mode, all in `perform.js`.

**1. Play ignores its own BPM stepper.** `perform.js`'s Play button hardcodes
`bpmForTempo(entry.tempo)`; the stepper next to it only drives auto-advance.
Make Play read the stepper.

**2. Play does not loop.** Auto-advance passes `loop: true`, Play passes nothing.
On stage, playback stopping dead after one pass is almost never wanted. Make Play
loop, which also makes 2.4's word rotation behave consistently across both
controls.

**3. Chord symbols overflow their cells.** Jack asked for a blanket 15% shrink.
Do that for immediate relief, but the blanket shrink is a band-aid: it shrinks
every chord including the ones that already fit. The real cause is that
`layout()`'s shrink loop cannot detect the overflow. `.perform-cell` is a centred
flex column with no `overflow` set, inside `.perform-grid` which is
`overflow: hidden` with fixed `1fr` rows, so excess content overflows
symmetrically into neighbouring rows instead of extending the scrollable box, and
`grid.scrollHeight > grid.clientHeight` stays false while cells visibly collide.
Fix the detection. Two smaller faults in the same function while in there: the
shrink loop caps at about 28% total reduction (0.9 twelve times), and the 14px
floor is applied before the loop rather than inside it, so the loop can drive the
size far below its own floor.

**Gotchas.** `layout()` is the most load-bearing and least-tested function in
performance mode, and it is called on initial render, one `requestAnimationFrame`
later, on resize, and on every capo toggle. Its width guess counts characters of
the chord symbol only, so a wide sub-line contributes nothing and instead wraps,
converting a width problem into the height problem that is poorly detected.

**Acceptance.** Play honours the stepper and loops; no chord symbol overflows its
cell on a 16-chord entry at 360x780 or 780x360; the shrink loop's own floor is
respected; `test-all` green.

---

## Tier 3: Teaching

These make the app a theory teacher rather than a reference. 3.1 and 3.2 depend on
tier 1 audio. 3.3 and 3.4 do not.

### 3.1 Ear training  [ ]  (L)

**Goal.** Quiz modes built from the app's own material, so practice transfers directly
to using the app. Three quiz types, in order of build:

1. **Chord quality** (needs 1.2 only): hear a chord, pick its quality from the
   qualities the app knows (maj, min, dim, aug, sus2, sus4, dom7, min7, maj7, 6, add9).
   Start with maj/min/sus only and widen with mastery.
2. **Function** (needs 1.1): hear a short diatonic progression with one highlighted
   mystery chord, answer tonic / subdominant / dominant / borrowed. The answer key is
   `harmony.classify`, which already exists and already drives the tint. This quiz
   literally teaches the app's own colour language.
3. **Numerals** (hard mode): hear a 3-4 chord diatonic progression, enter the numerals
   from a button palette (never free text).

**Design and reasoning.** A new route `#/train` and module `js/ui/trainer.js`, with
question generation in a pure engine module `js/engine/quiz.js` (given a difficulty
level and a seeded RNG, return question specs; seeding makes tests deterministic).
Questions are GENERATED from theory, not sampled from the 349 entries, so the pool is
unbounded, but each answer screen should link one real entry from the hoard that
features the quizzed relationship ("hear it in the wild"), found via the chord-search
index from 4.3 if it exists yet, otherwise a precomputed lookup.

Spaced repetition: keep it deliberately simple, a per-fact bucket system (Leitner, 5
boxes) rather than a full SM-2 implementation. Facts are keyed like
`"quality:min7"` or `"function:major:bVI"`. Store under `chordhoard.training` with
box number and due date. Absolutely no streak-shaming copy; due counts, not guilt.

Explanations on answer reveal come from `chord-copy.js`'s existing tables, which is the
whole reason the copy was centralised. Do not write new theory prose in the trainer.

**Gotchas.** Playing quiz audio must randomise the key per question (otherwise you
learn absolute pitch anchors, not relationships). Keep answer button order stable
between questions of the same type; shuffling answer positions adds difficulty without
adding learning.

**Tests.** `quiz.js` fully unit-tested: generated questions are answerable (the
correct answer is always among the options), difficulty gates hold, seeded runs are
reproducible. Leitner scheduling maths tested with fixed dates.

**Acceptance.** All three quiz types playable end to end on mobile; wrong answers show
the chord-copy explanation and a real-entry link; progress survives reload and rides
in backups; test-all green.

### 3.2 Voice leading on piano  [ ]  (M/L)

**Goal.** For each progression, show the piano diagrams as smooth inversions rather
than all root position, teaching WHY inversions exist. Directly targets Jack's stated
piano level: solid on inversions for white-key-root triads, slower elsewhere.

**Design and reasoning.** Engine first: `js/engine/voicelead.js`,
`smoothPath(realizedChords)` returns an inversion choice per chord minimising total
movement. Model each candidate inversion as a set of pitch heights in a fixed octave
window, cost = sum of semitone distances matched greedily between consecutive chords
plus a small penalty for doublings and for drifting outside the window. With at most
4 notes per chord and 3-4 inversions each, brute force per step is fine; do not
implement anything clever. First chord defaults to root position.

UI: a "Smooth" toggle on the detail view's piano diagrams. Off = current behaviour
(root position). On = diagrams re-render with the computed inversions, each labelled
("1st inversion") with the moving notes highlighted, plus a one-line summary like
"Only two notes move between these chords". The label copy comes from a small table in
`chord-copy.js` territory, not scattered strings.

Respect the complexity system: when the smooth toggle is on, `complexity.rate` should
be consulted per chosen voicing where inversion changes difficulty (a slash-bass-like
shape may be P3 where root position was P1). Simplest honest approach: show the
existing per-key rating unchanged and add a footnote line when smooth mode uses
inversions beyond the rated level. Do not silently re-rate.

**Tests.** Fixture progressions with known optimal paths (I-IV-V-I in C should keep
common tones: C-E-G to C-F-A to B-D-G style movement); window drift bounded; degenerate
cases (2-note power chords, single-chord progressions) do not throw.

**Acceptance.** Toggling smooth mode on a diatonic entry visibly reduces hand movement
across the diagrams; moving notes are highlighted; toggle state is per-session
(ephemeral, like the capo toggle, per that precedent); test-all green.

### 3.3 Guided tours  [ ]  (M)

**Goal.** Short interactive lessons that walk through REAL entries in the hoard.
Launch set of four: "Meet the circle of fifths", "Borrowed chords 101", "Why the
Andalusian Cadence pulls downhill", "Modes are just moods" (working titles; final
titles per copy voice rules).

**Design.** A tour is data: `data/tours.json`, an array of steps, each step =
`{ text, action }` where action deep-links into the app (a route hash plus optional
highlight selector). A tiny runner (`js/ui/tour.js`) renders the text in a dismissible
card anchored at the bottom of the screen, with next/back, driving `location.hash`
between steps and applying a highlight class to the target element. No overlay
library, no spotlight masks; a positioned card plus one CSS highlight class.

Tour prose is app copy: full copy voice rules apply, and it must go through the same
review bar as chord-copy. Since tours cite specific entries by id, `tools/validate.js`
gains a check that every id referenced in tours.json exists.

**Gotchas.** Tours cross routes, so the runner must survive re-renders: keep runner
state in module scope, re-apply highlights after each route render (hook the existing
route-change path in app.js). If an element is missing (layout changed), show the step
text without a highlight rather than breaking the tour.

**Acceptance.** All four tours completable on mobile portrait; tour ids validated;
leaving mid-tour and returning to normal browsing leaves no stray highlight classes;
test-all green.

### 3.4 Practice mode  [ ]  (M)

**Goal.** Turn the playability profile (shaky/nope marks) into a daily practice habit.

**Design.** A "Practice" section (a card on the Hoard or a row in settings, judgement
call, propose to Jack before building) that generates a session from the user's own
data: pick 2-3 chords marked shaky, find hoard entries where that chord is the ONLY
non-playable one (the existing "One chord to practise" filter logic, reused, not
reimplemented), and present them as today's set. Completing an entry (self-reported
tap) logs to `chordhoard.practice` (date, chord symbols practised). After three logged
sessions containing a chord, prompt: "Still shaky, or ready to mark it playable?",
which writes through the existing `playability.js` API.

Streaks: show current streak modestly. Per Jack's wellbeing-adjacent preferences and
the copy voice, keep it encouraging and never guilt-based; a missed day resets a
number, not a tone.

**Acceptance.** With at least one shaky mark set, a practice session generates in one
tap; the promotion prompt appears after the third session and actually updates the
profile; empty states (no marks at all) explain how to mark chords instead of showing
a blank screen.

---

## Tier 4: Songwriting depth

### 4.1 "Sounds like" similarity links  [ ]  (M)

**Goal.** Backlog item 6. On each detail view, a short list of related progressions:
same bones different groove, one chord different, same mood different mode.

**Design and reasoning.** Similarity is computed, never stored (349 entries would make
stored links rot instantly). `js/engine/similar.js`:

- Normalise each entry to its numeral sequence (strip beats, keep order and suffixes).
- Score pairs on: Levenshtein distance over numeral tokens (weight highest; distance 1
  means "one chord different" and gets its own labelled subsection), longest common
  contiguous subsequence of length >= 3 (catches shared turnarounds), shared mode, and
  mood-tag overlap as a tiebreaker only (mood alone must never make two harmonically
  unrelated entries "similar").
- Return the top 5 with a reason code per match ("one chord different", "shares its
  turnaround", "same shape, different metre") that the UI renders as the link label.
  The reason codes are the feature; an unexplained list of links teaches nothing.

Precompute at load time lazily: computing 349x349 token distances on demand for one
entry is trivial (349 comparisons), so compute per detail-view visit, no index needed.
Keep it under ~10ms by comparing token arrays, not strings.

**Tests.** Fixture pairs with known relationships (the axis progression and its
rotation must find each other; a 12-bar blues must not match a 4-bar folk loop just
because both contain I and IV).

**Acceptance.** Detail view shows up to 5 related entries with human-readable reasons;
tapping navigates; no entry lists itself; distance-1 matches labelled as such;
computation causes no visible lag on mobile.

### 4.2 Reverse lookup ("what song is this?")  [ ]  (M)

**Goal.** Enter the chords of a song you like (as chord names, the way songbooks and
tabs give them); the app infers key and numerals, then finds hoard matches. Teaches
"why the songs I like work" better than any lesson.

**Design.** New section on the Build tab (it is the same mental activity as building).
Input: tappable chord palette (root picker + quality picker, same vocabulary as the
chord library), never free text parsing in v1. Engine work in
`js/engine/reverse.js`:

- `inferKeys(chordSymbols)` scores the 24 supported tonic/mode candidates by how many
  input chords are diatonic (via the pitch-class diatonic test that
  `harmony.js`/scales already use), preferring keys where the FIRST and LAST chords
  are tonic or dominant. Return ranked candidates, not one answer; ambiguity is real
  (C-Am-F-G reads in C major and A minor) and the UI should show the top 2-3 as tabs.
- For each candidate key, map chords to numerals (this is `chords.realize` run
  backwards; implement it directly by realizing all plausible numerals per degree and
  matching pitch-class sets, memoised per tonic).
- Feed the numeral sequence into 4.1's similarity scorer against the library.

**Gotchas.** Input chords outside the numeral grammar (a 9th chord from a jazz tab)
should degrade to their triad/7th core with a gentle note, not error. Enharmonic
input (someone enters G# major in a flat key context) must resolve via pitch classes,
which the engine already handles, but the DISPLAY of the inferred numerals must use
the app's locked spellings.

**Acceptance.** Entering C-Am-F-G yields I-vi-IV-V in C major as top reading with the
doo-wop family as matches; entering something chromatic returns honest partial matches
rather than nothing; every inferred numeral round-trips through `numeral.parse`.

### 4.3 Search by chord content  [ ]  (M)

**Goal.** Hoard filters for harmonic content: "contains bVI", "ends V to i",
"contains a slash bass". For a songwriter this is the difference between browsing by
vibe and browsing by tool.

**Design.** Extend the Hoard filter sheet with a "Contains chord" group. Backing it: a
small index built once at load in `js/ui/app.js` alongside the existing manifest load,
mapping normalised numeral tokens to entry ids. Offer the numerals worth searching
for, grouped: borrowed colour (bVI, bVII, bIII, iv-in-major, III), texture (any sus,
any 7th, any slash bass, dim, aug), and cadence endings (ends V-I, ends V-i, ends
bVII-I, ends IV-I). Cadence matching looks at the last two numerals with suffixes
stripped except quality. Do not build free-text numeral search in v1; the curated
list covers real use and free text needs error states the filter sheet cannot host.

**Gotchas.** The filter sheet already hosts several groups (collection, playability,
etc.); follow its existing chip markup and state handling in `hoard.js` exactly, and
make the new group composable with all existing filters (AND semantics like the
rest). The dedupe-normalised token must match how numerals are actually written in
data (`bVI`, not `♭VI`).

**Acceptance.** "Contains bVI" plus mood and collection filters compose correctly;
cadence filters match only true endings; counts shown per chip if the sheet already
shows counts, else omitted consistently; filter state still shareable via the
roulette (2.1) path.

### 4.4 Melody hints  [ ]  (S/M)

**Goal.** Per chord in the detail view, which scale notes are safe targets and which
chord tones are the strong landings, for writing toplines.

**Design.** Pure engine addition `melodyTargets(realized, tonic, mode)` in a small
module or inside `harmony.js`: chord tones ranked (3rd and 7th as colour tones, root
and 5th as anchors), plus the scale notes that sit a step above a chord tone
(resolvable tensions), minus avoid notes (a scale note a semitone above a chord tone,
the same clash rule as 0.3's recommender, share the helper). UI: an expandable
"Topline hints" row per chord on the detail view showing the note names in the current
key, with the one-line copy convention from chord-copy (lead with what resolves where).

**Acceptance.** Hints update with transposition; avoid notes never listed as targets;
shares its clash logic with 0.3 (one implementation, imported by both).

### 4.5 Shareable links  [ ]  (S/M)

**Goal.** Share any progression (including built ones) or song by URL, no backend.

**Design.** Encode into the hash: for library entries, `#/prog/<id>?k=<tonic>` likely
already close to what exists, just ensure key state is in the URL. For built
progressions and songs (which live only in the sharer's localStorage), serialise the
JSON, compress-ish (JSON is small; base64url of the JSON is fine under practical URL
limits for 16 chords; measure and cap), and use `#/shared/<blob>`. The receiving app
renders it read-only with a "Save to my hoard" button that writes it into
`chordhoard.built` / `chordhoard.songs` through the existing save paths.

**Gotchas.** Validate the decoded blob with the same rules as `tools/validate.js`'s
entry checks before rendering (a hostile or truncated blob must fail to a friendly
error, not a throw). GitHub Pages subpath: hash-based routing already avoids server
config, keep it that way. Cap blob size and reject over-limit URLs explicitly.

**Acceptance.** A built progression shared from one browser profile opens and saves in
a fresh profile with no shared state; malformed blobs show a friendly error; normal
entry links still work as before.

---

## Tier 5: MIDI (stretch)

### 5.1 Web MIDI input: "what am I playing?"  [ ]  (M/L)

**Goal.** Plug in a MIDI keyboard, the app names the chord under your hands live, and
in practice contexts checks it against the expected chord. This closes the loop
between the app and the physical instrument.

**Design.** `js/ui/midi-in.js` owns Web MIDI access (Chromium only; feature-detect
and hide the whole feature elsewhere, with a one-line note in settings). Held-note
tracking from noteon/noteoff into a pitch-class set, debounced ~50ms so arpeggiated
grabs settle. Chord identification is pure engine work: `identify(pitchClassSet)` in
`js/engine/identify.js`, matching against the chord formulas the engine already owns,
returning best matches with inversion awareness (lowest sounding note = bass, name it
C/E style when it is not the root). Where it is used: a live readout panel in the
Chords tab, and a "check me" mode on the detail view and in practice mode (3.4) that
lights each chord green as you play it correctly in sequence.

**Gotchas.** Web MIDI needs a permission prompt and a secure context (Pages is
https, fine). Identification must be spelling-aware relative to current key context
when one exists (in the key of Eb, pitch set {3,7,10} displays as Eb, not D#).
Sustain pedal (CC64) should not hold notes into the set forever; ignore CC entirely
in v1 and note it.

**Acceptance.** With a MIDI keyboard attached in Chrome: triads and 7ths named
correctly in under 100ms perceived; inversions shown slash-style; check-me mode
walks a progression; every other browser shows no broken UI.

### 5.2 MIDI file export  [ ]  (M)

**Goal.** Export any progression or song as a .mid file for a DAW.

**Design.** A standard MIDI file is a simple binary format writable with DataView in
~150 lines, no dependency needed: format 0, one track, chord notes from the SAME
voicing logic as audio playback (`audio-notes.js`, share it), tempo from the player's
BPM mapping, time signature meta events from `timeSig`. Trigger from the detail view
share/export area and from songs. Generate a Blob and a download link.

**Gotchas.** Beats in the data are beats of the entry's time signature; MIDI ticks
need a consistent PPQ (use 480) and correct handling of 6/8 (the data's 6 beats per
bar are eighth notes; map via the timeSig denominator, and add a test for exactly
this because it is the mistake everyone makes).

**Acceptance.** Exported files open with correct chords, tempo, metre in at least two
DAWs or MIDI players (verify with a hex-level unit test of the byte stream plus one
manual import); 6/8 and 5/4 entries land on the right grid; slash chords include the
bass note below the triad.

---

## Suggested execution order

0.1 song builder → 1.1 audio → 2.1 roulette → 2.2 setlists (+2.3 auto-advance folds
into audio's highlight) → 0.3 soloing scales → 3.1 ear training → 3.2 voice leading →
4.1 similarity → 4.3 chord search → 4.2 reverse lookup → 3.3 tours → 3.4 practice →
4.4 melody hints → 4.5 share links → 0.2 theme toggle (anytime, it is an hour) →
tier 5 when the mood strikes.

Updated 2026-08-21 after tier 2 landed: next up is **2.4 random word generator**,
then 2.5 metronome/tap tempo, then 2.6 performance mode fixes. Jack chose words
first explicitly. That is safe despite 2.6 fixing a layout bug the banner sits on
top of, because 2.4 hides the colour legend whenever words are showing, so the
perform topbar stays at three rows and the banner adds no net chrome height. One
coupling to expect: 2.4 adds an `onLoop` callback to `audio-player.js`, the same
file 2.6 touches for the Play-loop fix.

Rationale: the song builder closes phase 4 and unblocks setlists containing songs;
audio is the multiplier everything in tier 3 wants; roulette and setlists are the
fastest wins for Jack's actual gigs; similarity before reverse lookup because 4.2
reuses 4.1's scorer; tours late because they should tour features that exist.

## Standing instructions for the executing agent

- One roadmap item per session/PR where possible. Land it green, tick its checkbox
  here, update CLAUDE.md (phase status and any new architectural facts an agent would
  need next session), THEN move on.
- Every new engine module gets tests in the same commit. Every new shipped file goes
  into the sw.js precache. Every shipped change bumps CACHE_VERSION.
- New localStorage keys: `chordhoard.*` prefix, document them in CLAUDE.md, and they
  are then covered by backup automatically.
- When a design judgement call comes up that this document does not settle, ask Jack
  rather than guessing, and record the decision in CLAUDE.md like previous decisions
  were recorded.
- Copy voice rules apply to every user-facing string in every item above, including
  button labels and empty states. No em-dashes. Read the voice section of CLAUDE.md
  again before writing any copy; it is the most commonly violated rule.
