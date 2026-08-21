// song.js — pure engine support for the song builder (#/songs). No DOM, no
// storage: js/ui/songs-store.js owns chordhoard.songs and js/ui/songs.js
// owns the view. This module only knows how to (a) rank candidate
// progressions for the next section of a song being assembled, and (b)
// realize a saved song's sections, tolerating a deleted/missing progId
// instead of throwing.

import { parseNote, pitchClass } from "./theory.js";
import { render } from "./progression.js";

const MINOR_ISH = new Set(["minor", "dorian", "phrygian"]);

function familyOf(mode) {
  return MINOR_ISH.has(mode) ? "minor" : "major";
}

function avgBeatsPerChord(entry) {
  const total = entry.numerals.reduce((sum, n) => sum + n.beats, 0);
  return total / entry.numerals.length;
}

/**
 * How a candidate entry's home key relates to the song's own tonic:
 * "same" (same pitch class), "relative" (the relative major/minor of it,
 * regardless of which direction), or "none". Symmetric by construction —
 * it doesn't need to know whether the song itself reads as major or minor.
 */
export function keyRelation(entry, songTonic) {
  const tonicPc = pitchClass(parseNote(songTonic));
  const entryPc = pitchClass(parseNote(entry.homeKey));
  if (entryPc === tonicPc) return "same";
  const diff = ((entryPc - tonicPc) % 12 + 12) % 12;
  const family = familyOf(entry.mode);
  // Relative minor sits a minor third below a major tonic (diff 9 going up
  // mod 12); relative major sits a minor third above a minor tonic (diff 3).
  // Checking both against the candidate's own family covers whichever way
  // the song's tonic was meant, without the song needing a stored mode.
  if (family === "minor" && diff === 9) return "relative";
  if (family === "major" && diff === 3) return "relative";
  return "none";
}

/**
 * Score one candidate entry for the next empty section slot. Higher is
 * better. Exported separately from sectionSuggestions so fixed fixtures can
 * assert ordering without depending on the exact numbers.
 *
 * @param {Object} entry              candidate progression entry
 * @param {Array} currentSections     sections already chosen, in order:
 *                                    [{ label, progId, tonicOverride }]
 * @param {string} songTonic          the song's own tonic, e.g. "G"
 * @param {Map} entriesById           id → entry, for resolving currentSections
 */
export function scoreCandidate(entry, currentSections, songTonic, entriesById) {
  let score = 0;

  const chosenMoods = new Set();
  const modeCounts = new Map();
  let lastEntry = null;
  for (const sec of currentSections) {
    const e = entriesById.get(sec.progId);
    if (!e) continue;
    for (const m of e.moods || []) chosenMoods.add(m);
    modeCounts.set(e.mode, (modeCounts.get(e.mode) || 0) + 1);
    lastEntry = e; // sections are ordered; the last one chosen wins
  }

  // Shared mood tags: the user-facing continuity signal, weighted highest.
  let moodHits = 0;
  for (const m of entry.moods || []) if (chosenMoods.has(m)) moodHits += 1;
  score += moodHits * 4;

  // Mode continuity with whatever mode dominates the sections so far.
  if (modeCounts.size) {
    let bestMode = null;
    let bestCount = -1;
    for (const [m, count] of modeCounts) {
      if (count > bestCount) {
        bestMode = m;
        bestCount = count;
      }
    }
    if (entry.mode === bestMode) score += 2;
  }

  // Key relationship to the song's own tonic: staying in one key (or its
  // relative pair) is the common case for a real song.
  const relation = keyRelation(entry, songTonic);
  if (relation === "same") score += 5;
  else if (relation === "relative") score += 3;

  // Contrast against the most recently chosen section: cheap proxies for
  // lift (a different opening chord, a quicker average pace), not a claim
  // about actual musical tension.
  if (lastEntry) {
    const firstHere = entry.numerals[0] && entry.numerals[0].numeral;
    const firstThere = lastEntry.numerals[0] && lastEntry.numerals[0].numeral;
    if (firstHere && firstThere && firstHere !== firstThere) score += 1;
    if (avgBeatsPerChord(entry) < avgBeatsPerChord(lastEntry)) score += 1;
  }

  return score;
}

/**
 * Ranked candidate entries for the next section, best first. Already-used
 * progIds (elsewhere in the song) are excluded. Ties break on id so results
 * are stable and testable.
 */
export function sectionSuggestions(entries, currentSections, songTonic) {
  const entriesById = new Map(entries.map((e) => [e.id, e]));
  const usedIds = new Set(currentSections.map((s) => s.progId).filter(Boolean));
  return entries
    .filter((e) => !usedIds.has(e.id))
    .map((e) => ({ entry: e, score: scoreCandidate(e, currentSections, songTonic, entriesById) }))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .map((x) => x.entry);
}

/**
 * The tonic to actually render a section in: its explicit override, or the
 * song's own tonic re-spelled onto the section's entry's own mode family
 * (a minor-family entry needs "C#" where the song might be entered as "Db",
 * for example — same pattern perform.js already uses for the capo route's
 * /<tonic> segment).
 */
export function sectionTonic(song, entry, section, tonicsFor) {
  if (section.tonicOverride) return section.tonicOverride;
  const pc = pitchClass(parseNote(song.tonic));
  const match = tonicsFor(entry).find((t) => pitchClass(parseNote(t)) === pc);
  return match || entry.homeKey;
}

/**
 * Realize every section of a saved song against its progression + tonic.
 * A section whose progId no longer resolves (a deleted built-* entry)
 * comes back as { missing: true } instead of throwing, so a UI can render a
 * friendly placeholder and still let the user skip past it.
 */
export function renderSong(song, entriesById, tonicsFor) {
  return song.sections.map((section) => {
    const entry = entriesById.get(section.progId);
    if (!entry) return { section, missing: true };
    const tonic = sectionTonic(song, entry, section, tonicsFor);
    return { section, missing: false, entry, tonic, rendered: render(entry, tonic) };
  });
}
