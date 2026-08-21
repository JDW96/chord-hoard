// roulette.js — Improv roulette (roadmap 2.1): "something villainous in 3/4,
// now". A "Surprise me" tap on the Hoard draws a random entry from whatever
// is currently filtered and jumps straight into performance mode; a reroll
// inside performance mode draws again from that SAME set without leaving.
//
// The pool is ephemeral module-scoped state, not persisted — like the
// performance view's capo toggle, it only needs to survive the hash change
// from Hoard into Performance mode, never localStorage.

let pool = []; // ids of the filtered set the current pool was drawn from

/** Record the filtered id set a "Surprise me" tap was drawn from. */
export function setPool(ids) {
  pool = Array.isArray(ids) ? ids.slice() : [];
}

/** True when `id` came from a pool worth rerolling (more than one member). */
export function isActivePool(id) {
  return pool.length > 1 && pool.includes(id);
}

/**
 * A random id from the current pool, excluding `excludeId` whenever the pool
 * has more than one member (never repeat the entry you're already on). Null
 * if the pool is empty.
 */
export function pickFrom(excludeId) {
  if (!pool.length) return null;
  const candidates = pool.length > 1 ? pool.filter((id) => id !== excludeId) : pool;
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
