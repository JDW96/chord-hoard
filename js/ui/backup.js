// backup.js — JSON export/import of everything the app remembers (phase 4).
//
// Every piece of personal state lives under a chordhoard.* localStorage key
// (pins, key choices, voicing picks, playability, settings). Export gathers
// ALL of them by prefix rather than from a hand-kept list, so a new key added
// elsewhere is in the backup automatically. Import writes back only keys with
// the same prefix, so a doctored file can't touch anything else in storage.

import { storageSet } from "./util.js";

const PREFIX = "chordhoard.";
const FORMAT = "chord-hoard-backup";

/** Collect every chordhoard.* key into a plain export object. */
export function exportData() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        /* an unparseable value is dropped rather than corrupting the file */
      }
    }
  } catch {
    /* storage unavailable — export what we have (nothing) */
  }
  return {
    format: FORMAT,
    version: 1,
    exported: new Date().toISOString(),
    data,
  };
}

/** Trigger a download of the backup as a dated JSON file. */
export function downloadBackup() {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(exportData(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chord-hoard-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Restore from a backup file. Resolves with the number of keys written;
 * rejects with a human-readable Error for anything that isn't a backup.
 * Existing chordhoard.* values for the same keys are overwritten; keys not
 * present in the file are left alone.
 */
export async function importBackup(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't JSON — is it really a Chord Hoard backup?");
  }
  if (!parsed || parsed.format !== FORMAT || typeof parsed.data !== "object" || parsed.data === null) {
    throw new Error("That file doesn't look like a Chord Hoard backup.");
  }
  let written = 0;
  for (const [key, value] of Object.entries(parsed.data)) {
    if (!key.startsWith(PREFIX)) continue; // only our namespace, ever
    storageSet(key, value);
    written += 1;
  }
  return written;
}
