# Phase 2.5 copy sheet: backlog items 8 + 12

Status: **draft 3, for review.** Nothing has been changed in the app yet.

Covers the Chords tab "Where next?" panel (item 8) and the Scales tab copy (item 12).
Out of scope: progression names and `notes` (item 2, phase 3 prep), and the rest of the
app's microcopy.

Since draft 2: labels settled, every Theory cell rewritten harder and shorter, cards
added, cadence names sourced, and five theory errors caught in review and fixed. Those
five are listed in section 11 so you can see what was wrong.

---

## 1. Your question about keys and function

You are right that C major does a different job in C than in G, and the table handles it
because it is keyed by **numeral, not chord name**. C in C is the `I` row; C in G is the
`IV` row. Two rows, two explanations. The chord name never enters the table.

Both panels already work in numerals. The Chords tab treats whatever chord you have
selected as home, so it only ever needs the `I`/`i` view. The Scales tab knows its tonic,
so every chord on it already has a numeral. Same lookup serves both.

Where you are right in a way I had not handled: **mode** changes the story even when the
numeral is identical. `IV` in lydian is not doing what `IV` in major does, because
lydian's four is already sharpened. Five cases:

| Mode | Numeral | Why the base text fails |
|---|---|---|
| lydian | IV | Cancels the ♯4 that defines the mode |
| mixolydian | V | The leading note is flat in this mode, so V borrows it back |
| dorian | IV | Diatonic here, so nothing is being raised or borrowed |
| dorian | bVI | Not diatonic here, unlike in natural minor |
| phrygian | V | Needs two alterations, not one, and phrygian dominant is the better label |

So: **base table keyed by family + numeral, plus a five-entry override map keyed by
mode + numeral.** The override wins when present.

One thing comes out of the copy entirely: whether a chord is **in the scale or outside
it**. The app already holds each mode's diatonic numerals, so it can work that out and
print a tag on the card. Writing that status into the sentence is what made the old
Scales copy contradict itself.

---

## 2. The skeleton

| Label | Holds | Target |
|---|---|---|
| **Tension** | how much, and what kind | a phrase, no verb |
| **Theory** | function, which note does the work, what that does to the ear | 1–3 short sentences |
| **Next** | usual destinations, named where a name exists | short |

**Theory** rather than "Uses". The column answers what the chord *is* in the key, and
"Uses" would promise advice on when to reach for it that the sentence does not deliver.

```
  IV  ·  F                                    in scale
  Tension   low
  Theory    Subdominant. The tonic note is still in the chord.
            Moving here costs nothing.
  Next      I (plagal cadence), or V
```

Cadence names sit in the **Next** column, because a name describes a motion between
chords, not a chord. Every name below is checked against a source in section 10, and the
one informal name is marked as such.

---

## 3. Major-family table

Home is a major-ish chord. Used by the Chords tab, and by major, mixolydian and lydian on
the Scales tab. Ordered commonest first.

| Numeral | Tension | Theory | Next |
|---|---|---|---|
| **IV** | low | Subdominant. The tonic note is still in the chord. Moving here costs nothing. | I (plagal cadence, or Amen cadence), or V |
| **V** | high | Dominant. Contains the leading note, a semitone under the tonic. That semitone does the work. | I (perfect cadence). Going to vi instead is the interrupted cadence |
| **V7** | higher | The fourth degree added on top makes a tritone with the leading note. Both close inwards, onto the root and third of I. | I (perfect cadence) |
| **vi** | none, though the centre shifts | Relative minor. Two of its three notes are in I. The mood travels further than the harmony does. | IV or ii. Arriving here from V is the interrupted cadence |
| **ii** | moderate | Supertonic, a third below IV and sharing two of its notes. Predominant: the lower root turns that same material into a run-up. | V, then I (the ii–V–I turnaround) |
| **iii** | faint | Mediant. Shares two notes with I and two with V. It commits to neither. Best as a passing chord under a falling melody. | vi or IV |
| **V7sus4** | held | The fourth replaces the third. With the leading note gone there is tension and no direction, until the fourth falls. | V7, then I |
| **viidim** | unstable | Leading-tone diminished: V7 with the root removed. Dominant function, less weight underneath. | I |
| **iv** | a drop of a semitone | Minor subdominant, borrowed from the parallel minor. The flat sixth falls onto the fifth of I. | I (minor plagal cadence) |
| **bVII** | mild | Subtonic major, from mixolydian. Built on the flat seventh, so the key's leading note is absent and nothing points home. | IV then I, or straight to I. From iv, with a seventh on it, that is the backdoor cadence |
| **bVI** | no pull home | Flat submediant, borrowed from the parallel minor. Two of its three notes are outside the key, and none of them leads anywhere. | bVII then I (informally the Mario cadence), or V |
| **II** | bright, and outside the key | Secondary dominant, V of V. The fourth degree is raised into a leading note aimed at V. | V, then I |
| **III** | bright, wrong-footing | Secondary dominant, V of vi. The fifth degree is raised to point at vi. | vi. Land hard on it |
| **VI** | outside the key | Secondary dominant, V of ii. Raises the tonic note itself, the one degree a key otherwise never touches. | ii, then V |
| **I7** | restless | Dominant seventh built on home. The flat seventh recasts I as the V of IV. | IV. The move the 12-bar is built on |
| **bIII** | a sideways jolt | Flat mediant, borrowed from the parallel minor. Only the fifth of I survives the change. | bVI or IV, then I |

---

## 4. Minor-family table

Home is a minor-ish chord. Used by the Chords tab, and by minor, dorian and phrygian on
the Scales tab. Ordered commonest first.

| Numeral | Tension | Theory | Next |
|---|---|---|---|
| **iv** | low | Subdominant minor. No leading note, and nothing outside the mode. It can sit for bars without resolving. | i (plagal cadence), or V |
| **V** | the highest in minor | Major dominant, from harmonic minor. The seventh degree is raised a semitone to make a leading note. That raise is the only difference from v. | i (perfect cadence) |
| **bVII** | low, lifting | Subtonic major, built on the flat seventh. Nothing in it is aimed at the tonic. | i, or up through bVI. In i–bVII–bVI–V it is the Andalusian cadence |
| **bVI** | no pull home | Flat submediant. Its root sits a semitone above the fifth degree, which lets V land on it in place of i. | bVII then i, or V. Arriving from V is the interrupted cadence |
| **bIII** | none, this is release | Relative major, same seven notes. Two of them are already in i, so the brightness arrives without a jolt. Leads out of a minor verse. | bVII or bVI, then i |
| **v** | soft, unresolved | Minor dominant, the five natural minor gives you. The flat seventh in it sits a whole tone under the tonic, too far to pull. The chord falls home under its own weight. | i, or bVII |
| **V7** | higher | The fourth degree added on top makes a tritone with the leading note. Both close inwards, onto the root and third of i. | i |
| **IV** | brighter than expected | Major subdominant. Its major third is the raised sixth degree, the single note separating dorian from natural minor. | i, or v |
| **iidim** | unstable | Supertonic diminished. Predominant. The flat sixth in it presses down onto the fifth degree. | V, then i |
| **viidim** | unstable | Leading-tone diminished, from harmonic minor. V7 with the root removed. | i |
| **bII** | a semitone over home | The Neapolitan. Predominant, normally played in first inversion with the fourth degree in the bass. | V, then i |

---

## 5. Mode overrides

Five cells, replacing the base Theory and Next when the Scales tab is in that mode.

| Mode | Numeral | Theory | Next |
|---|---|---|---|
| lydian | **IV** | Cancels the ♯4 the mode is built on. Home stops floating and behaves like plain major for a bar. | I, or V |
| mixolydian | **V** | Borrows back the leading note, the one degree mixolydian gives up. One proper cadence, then the mode resumes. | I (perfect cadence) |
| dorian | **IV** | In the scale here, not borrowed: dorian's raised sixth degree is this chord's major third. | i, or bVII |
| dorian | **bVI** | Borrowed from natural minor. Restores the flat sixth, so dorian's defining degree is absent while it sounds. | bVII, or i |
| phrygian | **V** | Major V, from the phrygian dominant scale. Two degrees have to be raised to build it, against one for a borrowed V elsewhere. | i. It closes the Andalusian cadence, i–bVII–bVI–V |

---

## 6. Cards added, and the ones still missing

Added since draft 1, all common enough to earn a row: major **V7, V7sus4, II, VI,
viidim, I7, iii**; minor **v, V7, iidim**.

Left out, and why:

| Chord | Why not |
|---|---|
| **Isus4**, **Isus2** | A suspension over home, not a move away from it. The phase 4 builder is the right home for these |
| **I/3**, **V/7**, other slash chords | Bass-line moves. One card naming the descending-bass technique would serve you better than a row per inversion, and it needs its own panel |
| **bII** in major | Real, but rare outside classical repertoire. It is in the minor table, where you will actually meet it |
| **bVII7**, **bVI7**, other altered borrowings | The grammar allows them. Jazz vocabulary, and they would sit oddly beside the open chords |
| **iidim** in major | The supertonic is only diminished in minor. Nothing to add |

That is 16 major rows and 11 minor. Too many for a 360px screen at once, so **Where
next?** shows the first eight for the family and reveals the rest on tap. Both tables are
in that order already.

---

## 7. Chords tab: surrounding copy

| Where | Now | Proposed |
|---|---|---|
| Panel heading | Where next? | Where next? (keep) |
| Lead line | Call C home (that's I) and these are the classic places to go. Tap one to follow it. | C is home (I). These are the chords it usually moves to. Tap one. |
| No guitar shape | No guitar shape on file for this one — the piano diagram above has all the notes. | No guitar shape on file. Every note is on the piano diagram above. |

---

## 8. Scales tab: headings and leads

| Where | Now | Proposed |
|---|---|---|
| Diatonic heading | The chords that live here | Chords in this scale |
| Diatonic lead | Seven degrees, seven chords — all built from just these notes. Tap any of them to open it in the chord library. | Seven chords built from these seven notes. Tap one to open it. |
| Visitors heading | Frequent visitors | Borrowed chords |
| Visitors lead | Not from round here, but they drop by so often you should know them — borrowed chords that love this mode. | From outside the scale, but common in it anyway. Borrowing them is called modal interchange. |
| Guitar tip (major) | C major shares every note with A minor — same fingerings, brighter home base. | A minor is C major's relative minor: the same seven notes, the same fingerings, a different home note. |
| Guitar tip (modes) | E dorian = D major fingerings, start on E. Same notes, different home. | E dorian is D major's fingerings started on E. |

**"Borrowed chords" over "Chords out of scale".** Two reasons. It is the term you would
type into a search box, and the lead now hands you "modal interchange" as the second one.
And once every card carries a computed in-scale / out-of-scale tag, a heading saying "out
of scale" labels something the card already tells you. If you want the plainer heading
anyway, "Chords out of scale" is accurate and I will swap it.

---

## 9. What changes in the code once this is signed off

1. New `js/ui/chord-copy.js`: two family tables, five mode overrides, and a lookup taking
   (family, numeral, mode).
2. `js/ui/chords-lib.js`: `MAJOR_DESTS` / `MINOR_DESTS` deleted, cards render three
   labelled lines, panel shows eight with a reveal for the rest.
3. `js/ui/scales-lib.js`: `VISITORS` becomes a per-mode list of numerals, text from the
   shared lookup. Headings and leads updated. In-scale tag computed from `mode.numerals`.
4. `css/app.css`: label style, and both card types sized for three lines at 360px.
5. `sw.js`: bump `CACHE_VERSION`.

No engine or data change, so `validate.js` and `test-engine.js` stay green. All three
tool scripts run before you get the upload list.

---

## 10. Sources for the named cadences

| Name | Movement | Checked against |
|---|---|---|
| Perfect (US: authentic) | V–I | Music Theory Academy |
| Plagal, or Amen | IV–I | Music Theory Academy, Wikipedia |
| Minor plagal | iv–I | Wikipedia |
| Imperfect (US: half) | ends on V | Music Theory Academy |
| Interrupted (US: deceptive) | V–vi, or V–bVI in minor | Music Theory Academy |
| Backdoor | iv–bVII7–I | Wikipedia |
| Andalusian | i–bVII–bVI–V | Wikipedia |
| Neapolitan sixth | bII in first inversion, into V | University of Minnesota Open Textbooks |
| ii–V–I turnaround | ii–V–I | Wikipedia |
| Mario cadence *(informal)* | bVI–bVII–I | Wyzant tutor consensus, marked informal in the copy |

UK names throughout, American name in brackets on first use in the app. I dropped
"double plagal" for bVII–IV–I: it is used in rock musicology, but I could not verify it
against a reference source, so that row names no cadence.

---

## 11. Errors caught in review

Draft 2 went through a theory check against concrete notes in C major and A minor. Five
things were wrong. Recording them because two are the kind of mistake that would have
looked authoritative and taught you something false.

1. **minor bVI** said it stands in for V. It stands in for **i**: V lands on bVI instead
   of home, which is the interrupted cadence. Fixed.
2. **minor bVI** was labelled the Mario cadence. That name needs a major arrival
   (bVI–bVII–I). Removed from the minor table, kept in the major one.
3. **major bVII** named the backdoor cadence off a plain triad. The backdoor needs the
   seventh (iv–bVII7–I). The row now says so.
4. **minor v** called G "its flat seventh" in A minor. G is the chord's third and the
   *key's* flat seventh. Reworded.
5. **minor iidim** had the same fault: F is the chord's fifth and the key's flat sixth.
   Reworded.

Everything else checked out, including all four secondary dominants, both tritone
resolutions, every shared-note count, and phrygian's V needing two raised degrees rather
than one.
