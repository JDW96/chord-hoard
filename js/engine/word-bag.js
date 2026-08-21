// word-bag.js — the shuffle bag behind the random word generator (roadmap
// 2.4). Pure and DOM-free: the UI fetches data/words.json and passes the
// parsed tiers in, exactly as solo-scales.js takes data/solo-shapes.json.
//
// Why a bag rather than Math.random() per draw: Jack's requirement is no
// repeats even across sessions, and drawing at random from 2000 words fails
// that fast — four words per progression means about 100 words drawn after
// 25 progressions, where collisions in a 500-word tier are already likely.
//
// So each tier gets a { seed, cursor } pair. The seed defines a deterministic
// shuffle of that tier (recomputed from the seed every session, which is why
// the PRNG has to be seeded rather than the platform's), and the cursor walks
// through it. Only when a tier is exhausted does it reseed. Every word in a
// tier is therefore seen before any of them comes round again, and that
// promise survives a reload because two numbers per tier are all that has to
// be stored.

export const TIER_KEYS = ["1", "2", "3", "4"];

/** Largest seed + 1. Seeds are unsigned 32-bit, which is what mulberry32 eats. */
export const SEED_RANGE = 2 ** 32;

/**
 * mulberry32 — a small, fast, well-distributed seeded PRNG. Five lines and
 * no dependencies, and (the point) deterministic: the same seed always
 * yields the same sequence, so "the shuffle is correct" is testable rather
 * than a thing we hope about.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The deterministic draw order for `count` items under `seed`: a
 * Fisher-Yates shuffle of 0…count-1, driven by mulberry32. Returns a fresh
 * array, so callers can't corrupt a cached order.
 */
export function shuffleOrder(count, seed) {
  const order = Array.from({ length: count }, (_, i) => i);
  const rand = mulberry32(seed);
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

function isBag(bag) {
  return (
    bag &&
    typeof bag === "object" &&
    Number.isInteger(bag.seed) &&
    bag.seed >= 0 &&
    Number.isInteger(bag.cursor) &&
    bag.cursor >= 0
  );
}

/** A fresh set of bags for `version`, one seed per tier from `seedFn`. */
export function freshBags(version, seedFn) {
  const bags = {};
  for (const tier of TIER_KEYS) bags[tier] = { seed: seedFn() >>> 0, cursor: 0 };
  return { version, bags };
}

/**
 * Take whatever was in storage and return usable bags for `version`.
 *
 * A version bump resets them rather than leaving a cursor pointing into a
 * list that changed underneath it — the words at those positions are not
 * the words the cursor was walking any more, so continuing would quietly
 * break the no-repeat guarantee rather than just reordering things.
 * Anything malformed (hand-edited storage, a half-written import) resets the
 * same way, and a cursor past the end of its tier — the list shrank — is
 * pulled back to a fresh shuffle of that one tier.
 */
export function normaliseBags(stored, version, tierSizes, seedFn) {
  if (!stored || typeof stored !== "object" || stored.version !== version) {
    return freshBags(version, seedFn);
  }
  const bags = {};
  for (const tier of TIER_KEYS) {
    const bag = stored.bags && stored.bags[tier];
    const size = tierSizes[tier] || 0;
    bags[tier] = isBag(bag) && bag.cursor < size ? { seed: bag.seed, cursor: bag.cursor } : { seed: seedFn() >>> 0, cursor: 0 };
  }
  return { version, bags };
}

/**
 * Draw one word from each tier, in tier order 1 to 4 — the banner shows them
 * in that order, so the plain-to-rare gradient reads left to right.
 *
 * Returns `{ words, next }` — `next` being the bag state to persist — and
 * never mutates its input: the caller decides when to write, which keeps
 * this testable and keeps storage writes in the UI layer where the rest of
 * them live.
 */
export function drawSet(bagState, tiers, seedFn) {
  const words = [];
  const bags = {};
  for (const tier of TIER_KEYS) {
    const list = (tiers && tiers[tier]) || [];
    const bag = (bagState && bagState.bags && bagState.bags[tier]) || { seed: seedFn() >>> 0, cursor: 0 };
    if (!list.length) {
      bags[tier] = bag;
      continue;
    }
    const order = shuffleOrder(list.length, bag.seed);
    const index = order[bag.cursor % list.length];
    words.push(list[index]);
    const nextCursor = bag.cursor + 1;
    // Exhausted: reshuffle under a new seed and start again. Every word in
    // the tier has now been shown exactly once since the last reseed.
    bags[tier] =
      nextCursor >= list.length
        ? { seed: seedFn() >>> 0, cursor: 0 }
        : { seed: bag.seed, cursor: nextCursor };
  }
  return { words, next: { version: bagState ? bagState.version : undefined, bags } };
}
