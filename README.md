# Chord Hoard

A searchable hoard of chord progressions for songwriters and improvising musicians.
Offline-first, mobile-first, no build step — just open `index.html` (UI arrives in
phase 2).

- **Spec & project rules:** see `CLAUDE.md` (single source of truth)
- **Data format:** `data/schema.md`
- **Checks:** `node tools/test-engine.js && node tools/validate.js` — must be green
  before any commit

## Status

Phase 2 complete: the full UI on top of the phase-1 engine — browse/search/filter
with cards, progression detail with transpose + capo and guitar/piano diagrams
(318 gate-validated guitar voicings), a chord library (any root × 15 qualities,
with "where next?" suggestions), a scale library (6 modes with diatonic chords and
borrowed favourites), and a full-screen performance mode with Screen Wake Lock.

Next: phase 3 — growing the library to ~300 progressions in themed batches.
