// setlists-store.js — storage for setlists (roadmap 2.2). Pure storage, no
// app.js import, mirroring songs-store.js so app.js (or anything else) can
// read it without a circular import.
//
// chordhoard.setlists is an array of:
//   { id, name, items: [{ kind: "prog" | "song", refId, tonic }] }
// Items reference a hoard progression or a saved song by id only, same
// discipline as songs referencing progressions — never realized chords.
// `tonic` only means something for a "prog" item (the key to play it in);
// a "song" item plays through the song's own sections at their own keys, so
// its `tonic` is carried for shape-consistency but ignored. Because the key
// is chordhoard.*, setlists ride along in backup export/import automatically.

import { storageGet, storageSet } from "./util.js";

const KEY = "chordhoard.setlists";

function validItem(it) {
  return (
    it &&
    typeof it === "object" &&
    (it.kind === "prog" || it.kind === "song") &&
    typeof it.refId === "string"
  );
}

function validSetlist(s) {
  return (
    s &&
    typeof s === "object" &&
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    Array.isArray(s.items) &&
    s.items.every(validItem)
  );
}

/** All saved setlists (a fresh array; never the stored one). */
export function setlistEntries() {
  const raw = storageGet(KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(validSetlist);
}

export function setlistById(id) {
  return setlistEntries().find((s) => s.id === id) || null;
}

/** Upsert by id: replaces an existing setlist with the same id, else appends. */
export function saveSetlist(setlist) {
  const all = setlistEntries();
  const i = all.findIndex((s) => s.id === setlist.id);
  if (i >= 0) all[i] = setlist;
  else all.push(setlist);
  storageSet(KEY, all);
}

export function deleteSetlist(id) {
  storageSet(KEY, setlistEntries().filter((s) => s.id !== id));
}

/** A unique, stable id for a newly saved setlist. */
export function newSetlistId() {
  return "setlist-" + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36);
}
