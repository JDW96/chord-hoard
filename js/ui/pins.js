// pins.js — favourites ("pin it to your hoard"), phase 4.
//
// chordhoard.pins is an object of progression id → tonic: the key the entry
// was pinned in, so a pin remembers not just WHAT you liked but where you
// play it. Ids are stable forever (CLAUDE.md), so pins survive renames.
// If a pinned entry's key choice changes in the detail view, the pin's key
// follows it — the pin always means "this progression, in my key".

import { storageGet, storageSet } from "./util.js";

const PINS_KEY = "chordhoard.pins";

/** The whole pin map, id → tonic. */
export function allPins() {
  const raw = storageGet(PINS_KEY, {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

export function isPinned(id) {
  return Object.prototype.hasOwnProperty.call(allPins(), id);
}

/** The tonic an entry was pinned in, or null if not pinned. */
export function pinnedTonic(id) {
  const pins = allPins();
  return Object.prototype.hasOwnProperty.call(pins, id) ? pins[id] : null;
}

export function pin(id, tonic) {
  const pins = allPins();
  pins[id] = tonic;
  storageSet(PINS_KEY, pins);
}

export function unpin(id) {
  const pins = allPins();
  delete pins[id];
  storageSet(PINS_KEY, pins);
}

/** Toggle a pin; returns true if the entry is pinned afterwards. */
export function togglePin(id, tonic) {
  if (isPinned(id)) {
    unpin(id);
    return false;
  }
  pin(id, tonic);
  return true;
}

// ---------------------------------------------------------------------------
// Shared pin button — the same affordance on Hoard cards and the detail view,
// so it can never drift into two designs. Pure DOM helper, no view state.
// ---------------------------------------------------------------------------

// Material push-pin outline; filled via CSS currentColor when pinned.
const PIN_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>';

/**
 * Build a pin toggle button.
 * @param {Object} entry     progression entry (id is what gets pinned)
 * @param {() => string} getTonic  called at tap time for the key to record
 * @param {(pinned: boolean) => void} [onChange]  after every toggle
 */
export function pinButton(entry, getTonic, onChange) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pin-btn";
  btn.innerHTML = PIN_ICON;

  function reflect() {
    const pinned = isPinned(entry.id);
    btn.classList.toggle("pinned", pinned);
    btn.setAttribute("aria-pressed", String(pinned));
    btn.setAttribute(
      "aria-label",
      pinned ? "Unpin from your hoard" : "Pin to your hoard"
    );
    btn.title = pinned ? "Pinned. Tap to unpin" : "Pin to your hoard";
  }

  btn.addEventListener("click", (ev) => {
    // Cards are links; the pin must not navigate.
    ev.preventDefault();
    ev.stopPropagation();
    const pinned = togglePin(entry.id, getTonic());
    reflect();
    if (onChange) onChange(pinned);
  });

  reflect();
  return btn;
}
