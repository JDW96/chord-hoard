# CAGED minor pentatonic box shapes — reference data

Fret-offset reference for the 5 standard moveable minor pentatonic "box" shapes on
6-string guitar, standard tuning (low to high: E A D G B E). Data below is verified
against the interactive fretboard tool at pentatonicbox.com (read directly from its
rendered SVG note data, not just its prose) and independently re-derived from raw
pitch-class arithmetic (scale = 1, b3, 4, 5, b7 against A minor pentatonic: A C D E G).
Both methods agreed on every fret for every string. A third source (Ry Naylor Guitar)
independently confirms the CAGED shape-name order and Box 1's root strings. **Box
numbering convention used: Box 1 = E-shape**, root on strings 6 and 4 (see "Numbering
convention" below for why).

All offsets are relative to each box's own reference fret (offset 0 = the lowest fret
used anywhere in that box, i.e. fret 0 of the moveable shape). To play in a given key,
add the reference fret to (root's fret on string 6 or string 5, whichever the shape
anchors on) — e.g. for A minor pentatonic Box 1, reference fret = 5.

## Box 1 — E-shape

| String | Fret offset(s) | Scale degree(s) |
|---|---|---|
| 6 (low E) | 0, +3 | 1, b3 |
| 5 (A) | 0, +2 | 4, 5 |
| 4 (D) | 0, +2 | b7, 1 |
| 3 (G) | 0, +2 | b3, 4 |
| 2 (B) | 0, +3 | 5, b7 |
| 1 (high E) | 0, +3 | 1, b3 |

**Root location:** primary root = string 6, offset 0. Secondary root = string 4,
offset +2. (String 1, offset 0, is a third occurrence of the same pitch class as the
string 6 root, two octaves up — same shape recurrence, not a distinct scale position.)

## Box 2 — D-shape

| String | Fret offset(s) | Scale degree(s) |
|---|---|---|
| 6 (low E) | +1, +3 | b3, 4 |
| 5 (A) | 0, +3 | 5, b7 |
| 4 (D) | 0, +3 | 1, b3 |
| 3 (G) | 0, +2 | 4, 5 |
| 2 (B) | +1, +3 | b7, 1 |
| 1 (high E) | +1, +3 | b3, 4 |

**Root location:** primary root = string 4, offset 0. Secondary root = string 2,
offset +3.

## Box 3 — C-shape

| String | Fret offset(s) | Scale degree(s) |
|---|---|---|
| 6 (low E) | +1, +3 | 4, 5 |
| 5 (A) | +1, +3 | b7, 1 |
| 4 (D) | +1, +3 | b3, 4 |
| 3 (G) | 0, +3 | 5, b7 |
| 2 (B) | +1, **+4** | 1, b3 |
| 1 (high E) | +1, +3 | 4, 5 |

**Root location:** primary root = string 5, offset +3. Secondary root = string 2,
offset +1.

**Irregularity:** this is the box with the well-known "stretch." Every string in Box 3
has exactly 2 notes, but string 2 (B) spans offset +1 to +4 — a 3-fret gap, one fret
wider than the +1-to-+3 (or 0-to-+3) gap every other string in this box uses. It is
NOT a genuine 3-note string (some simplified diagrams draw a 3rd, optional passing
tone here instead of the stretch — if Chord Hoard wants to support that alternate
fingering it should be a distinct, explicitly-optional data point, not folded into the
base shape). The gap exists because the B string's scale tones (root-string offset 0
region) skip a fret that every neighbouring string happens to have filled — confirmed
against raw note math, not a transcription error.

## Box 4 — A-shape

| String | Fret offset(s) | Scale degree(s) |
|---|---|---|
| 6 (low E) | 0, +3 | 5, b7 |
| 5 (A) | 0, +3 | 1, b3 |
| 4 (D) | 0, +2 | 4, 5 |
| 3 (G) | 0, +2 | b7, 1 |
| 2 (B) | +1, +3 | b3, 4 |
| 1 (high E) | 0, +3 | 5, b7 |

**Root location:** primary root = string 5, offset 0. Secondary root = string 3,
offset +2.

## Box 5 — G-shape

| String | Fret offset(s) | Scale degree(s) |
|---|---|---|
| 6 (low E) | +1, +3 | b7, 1 |
| 5 (A) | +1, +3 | b3, 4 |
| 4 (D) | 0, +3 | 5, b7 |
| 3 (G) | 0, +3 | 1, b3 |
| 2 (B) | +1, +3 | 4, 5 |
| 1 (high E) | +1, +3 | b7, 1 |

**Root location:** primary root = string 6, offset +3. Secondary roots = string 3,
offset 0, and string 1, offset +3 (same pitch class as string 6's root, an octave up
— same shape recurrence, not a distinct position, exactly as in Box 1).

Note: Box 5's own reference fret (offset 0) sits on strings 4 and 3, where the note is
NOT a root (it's 5 and 1 respectively — string 3 offset 0 IS a root, string 4 offset 0
is not). The "primary root" is picked by lowest-pitched string carrying a root (see
below), which lands on string 6, not on the box's literal lowest fret. This mirrors
standard CAGED chord pedagogy: the G-shape barre chord's headline root is also the
low-E-string one, even though the open G chord's lowest fretted note is elsewhere.

### How "primary root" was chosen

Rule applied consistently across all 5 boxes: **primary root = the root note on the
lowest-pitched string that carries a root in that box.** This was checked against each
box's underlying CAGED open-chord shape (which strings carry the root in the open E,
D, C, A, and G chords) and matches in all 5 cases: E-shape → string 6, D-shape →
string 4, C-shape → string 5, A-shape → string 5, G-shape → string 6. (C-shape and
A-shape both anchor on string 5 because neither open C nor open A chord uses string 6.)
An alternative rule — "root at the box's own reference/lowest fret" — gives the same
answer for Boxes 1, 2 and 4, but breaks for Box 3 (whose reference fret carries a 5,
not a root) and disagrees with the lowest-pitched-string rule for Box 5. The
lowest-pitched-string rule was used everywhere for consistency.

## Numbering convention (investigated, as requested)

Two conventions are in active use across sources:

1. **CAGED shape order, "Box 1 = E-shape."** This is what pentatonicbox.com,
   guitarhabits.com, and most rock/blues guitar lesson content use. Ascending the
   neck from open position, the shape sequence is **E → D → C → A → G**, then it
   repeats an octave up. Box 1 (E-shape) is taught first because for the most common
   practice key (E minor or A minor), it falls in the most natural low-neck hand
   position and is the shape almost every "minor pentatonic scale" beginner diagram
   shows. Ry Naylor Guitar independently confirms this exact order (calls the shapes
   Em/Dm/Cm/Am/Gm-shape in the same E-D-C-A-G sequence, Position 1 rooted on string 6).
2. **Strict ascending-fret-position numbering.** Some sources instead number boxes
   purely by where they fall on the neck for a given key, starting from whichever
   shape is lowest. For A minor pentatonic this makes the G-shape (frets 2-5, this
   doc's "Box 5") into "Position 1," and shifts everything else up by one. This
   produces the same 5 shapes and the same fretboard coverage, just a different label
   ordering — musically identical, pedagogically different.

**Recommendation: use convention 1 (Box 1 = E-shape, CAGED order E-D-C-A-G).** It is
the overwhelming majority convention in guitar pedagogy content (Fender-adjacent
lesson sites, GuitarHabits, PentatonicBox, Ry Naylor, and the general search-result
consensus), it's root-anchored rather than key-dependent (Box 1 always means
"E-shape," regardless of which key you're playing in — the strict-ascending scheme's
"Box 1" changes shape identity depending on the root note chosen), and it's what a
player will already have encountered if they've seen ANY "5 pentatonic box" diagram
before. Chord Hoard's engine already computes complexity/voicing per key elsewhere in
the codebase (see `js/engine/capo.js`), so anchoring box identity to the shape rather
than to absolute neck position is also the more implementation-friendly choice: a
lookup table of 5 shapes keyed E/D/C/A/G is root-independent, whereas strict ascending
numbering would require re-sorting boxes per root note.

## Adjacency

Each box shares its full set of boundary notes with the next box up the neck. The
reference-fret gaps between consecutive boxes follow a repeating **+3, +2, +2, +3, +2**
pattern (summing to 12 = one octave), in the order G→E→D→C→A→G...:

| Transition | Reference fret gap | Shared frets (per string, absolute, in key of A) |
|---|---|---|
| Box 5 → Box 1 | +3 (fret 2 → 5) | fret 5 on **all 6 strings** (full unison overlap — the widest shared boundary of the cycle) |
| Box 1 → Box 2 | +2 (fret 5 → 7) | fret 7 on strings 5,4,3; fret 8 on strings 6,2,1 |
| Box 2 → Box 3 | +2 (fret 7 → 9) | fret 10 on strings 6,5,4,2,1; fret 9 on string 3 |
| Box 3 → Box 4 | +3 (fret 9 → 12) | fret 12 on strings 6,5,4,3,1; fret 13 on string 2 |
| Box 4 → Box 5 (next octave) | +2 (fret 12 → 14) | fret 15 on strings 6,5,2,1; fret 14 on strings 4,3 |

This was verified directly rather than assumed: each box's highest-fret note per
string was checked against the next box's lowest-fret note on that same string, and
they matched exactly in all 30 string-transitions (5 boundaries x 6 strings). Box 1's
own shape reappears starting at fret 17 (5 + 12), confirming the whole 5-box cycle
tiles the neck in an exact repeating octave pattern.

## Sources

- **pentatonicbox.com** (`/a-minor-pentatonic` and the interactive tool at `/`,
  `?root=A&scale=minor`) — primary numeric source. The prose page gave the box
  fret-ranges (Box 1: 5-8, Box 2: 7-10, Box 3: 9-12, Box 4: 12-15, Box 5: 2-5) and
  the root-note callouts ("root A at fret 5 on low E and high e," "root A returns at
  fret 12 on the A string"). The interactive tool was inspected directly (via its
  rendered SVG markup, isolating one box at a time by toggling the Box 1-5 buttons
  and reading each `<circle>` element's fret position, string, and root-marker
  colour) to extract the exact per-string, per-box fret list used to build every
  table above — this is a direct read of the tool's actual scale data, not a
  paraphrase of a description.
- **rynaylorguitar.com** (`/lessons/guitar-minor-pentatonic-scale`) — cross-check for
  the CAGED shape naming and ordering. Confirmed the E-D-C-A-G sequence and that
  "Position 1" (their term) is the Em-shape rooted on string 6, matching this doc's
  Box 1.
- **Independent pitch-class derivation** — every fret offset above was also computed
  from scratch from raw semitone/pitch-class arithmetic (A minor pentatonic = pitch
  classes {A, C, D, E, G} mapped across all 6 open-string tunings for frets 0-24) and
  cross-checked against the pentatonicbox.com data fret-by-fret. All frets and all
  root positions matched exactly, including the Box 3 string-2 stretch.
- **General web search** (queries for "5 CAGED minor pentatonic box shapes," "box 1
  through box 5 fret numbers," etc.) surfaced consistent secondary confirmation of
  the box starting frets (5, 7/8, 9/10, 12, 15) from multiple lesson-site summaries
  (GuitarHabits, OnlineGuitarBooks, general aggregated search results) but none of
  those pages exposed raw per-string numeric data in fetchable text (diagrams were
  images); they were used only as corroboration of box ranges and shape-name
  ordering, not as a primary numeric source.
- **Box-numbering convention discrepancy**: identified during research (see
  "Numbering convention" above) — some sources number boxes by strict ascending neck
  position for a given root rather than by CAGED shape identity, which reorders the
  5 shapes differently per key. This doc explicitly recommends and uses the CAGED
  shape-order convention (Box 1 = E-shape) for the reasons given above.
