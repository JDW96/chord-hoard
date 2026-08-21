// songs-store.js — storage for saved songs (phase 4, backlog item 0.1).
// Pure storage, no app.js import, mirroring built.js so app.js (or anything
// else) can read it without a circular import.
//
// chordhoard.songs is an array of:
//   { id, name, tonic, sections: [{ label, progId, tonicOverride }] }
// Sections reference progressions by id only (never realized chords), so
// built-* ids from the dynamic builder work here for free and nothing goes
// stale when a referenced progression's data changes. Because the key is
// chordhoard.*, songs ride along in backup export/import automatically.

import { storageGet, storageSet } from "./util.js";

const KEY = "chordhoard.songs";

function validSection(s) {
  return s && typeof s === "object" && typeof s.label === "string" && typeof s.progId === "string";
}

function validSong(s) {
  return (
    s &&
    typeof s === "object" &&
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.tonic === "string" &&
    Array.isArray(s.sections) &&
    s.sections.every(validSection)
  );
}

/** All saved songs (a fresh array; never the stored one). */
export function songEntries() {
  const raw = storageGet(KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(validSong);
}

export function songById(id) {
  return songEntries().find((s) => s.id === id) || null;
}

/** Upsert by id: replaces an existing song with the same id, else appends. */
export function saveSong(song) {
  const all = songEntries();
  const i = all.findIndex((s) => s.id === song.id);
  if (i >= 0) all[i] = song;
  else all.push(song);
  storageSet(KEY, all);
}

export function deleteSong(id) {
  storageSet(KEY, songEntries().filter((s) => s.id !== id));
}

/** A unique, stable id for a newly saved song. */
export function newSongId() {
  return "song-" + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36);
}
