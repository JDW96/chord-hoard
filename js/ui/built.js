// built.js — storage for progressions saved from the dynamic builder
// (phase 4). Pure storage, no app.js import, so app.js can read it during
// its own load without a cycle.
//
// chordhoard.built is an array of full progression entries in the standard
// schema (ids "built-*", stable once saved, so pins on them survive). They
// are registered into the app's entry list under the derived collection
// "built" ("My progressions"), which makes the detail view, transpose, capo,
// complexity, performance mode and pins all work on them for free. Because
// the key is chordhoard.*, saved progressions ride along in backup
// export/import automatically.

import { storageGet, storageSet } from "./util.js";

const KEY = "chordhoard.built";

/** All saved built entries (a fresh array; never the stored one). */
export function builtEntries() {
  const raw = storageGet(KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e === "object" && typeof e.id === "string");
}

export function saveBuilt(entry) {
  const all = builtEntries();
  all.push(entry);
  storageSet(KEY, all);
}

export function deleteBuilt(id) {
  storageSet(KEY, builtEntries().filter((e) => e.id !== id));
}

/** A unique, stable id for a newly saved progression. */
export function newBuiltId() {
  return "built-" + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36);
}
