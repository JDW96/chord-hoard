// numeral.js — Roman numeral parsing for Chord Hoard.
//
// Grammar (see CLAUDE.md — this is the contract between data and engine):
//
//   numeral    := accidental? degree suffix* bass?
//   accidental := "b" | "#"              (relative to the tonic's MAJOR scale)
//   degree     := I..VII (major triad) | i..vii (minor triad)
//   suffix     := sus2 | sus4 | 7 | maj7 | 6 | add9 | dim | aug | 5
//   bass       := "/" digit 1–7
//
// Combination rules: at most ONE of {sus2, sus4, dim, aug, 5}; at most ONE of
// {7, maj7, 6, add9}; the only cross-group combination allowed is sus + 7
// (e.g. V7sus4). By convention (enforced here, since the parser is strict):
// dim goes on lowercase degrees, aug and maj7 on uppercase.

// Roman degree tables, longest first so "VII" is not read as "V" + junk.
const UPPER_DEGREES = ["VII", "VI", "IV", "V", "III", "II", "I"];
const LOWER_DEGREES = ["vii", "vi", "iv", "v", "iii", "ii", "i"];
const DEGREE_VALUE = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 };

// Suffix tokens, longest first so "sus2" is not read as "s"+"us2" etc., and
// "maj7" is matched before "7", "add9" before nothing shorter.
const SUFFIX_TOKENS = ["sus2", "sus4", "maj7", "add9", "dim", "aug", "7", "6", "5"];

const QUALITY_GROUP = new Set(["sus2", "sus4", "dim", "aug", "5"]);
const EXTENSION_GROUP = new Set(["7", "maj7", "6", "add9"]);

/**
 * Parse a Roman numeral string into
 *   { accidental: -1|0|1, degree: 1..7, upper: boolean, suffixes: string[], bass: 1..7|null }
 * Throws a descriptive Error on anything outside the grammar.
 */
export function parse(str) {
  if (typeof str !== "string" || str.length === 0) {
    throw new Error(`Empty or non-string numeral: ${JSON.stringify(str)}`);
  }
  let rest = str;

  // Leading accidental (b/#) applies to the degree.
  let accidental = 0;
  if (rest[0] === "b") {
    accidental = -1;
    rest = rest.slice(1);
  } else if (rest[0] === "#") {
    accidental = 1;
    rest = rest.slice(1);
  }

  // Degree — uppercase and lowercase must not be mixed ("Vi" is invalid).
  let degree = 0;
  let upper = null;
  for (const d of UPPER_DEGREES) {
    if (rest.startsWith(d)) {
      degree = DEGREE_VALUE[d.toLowerCase()];
      upper = true;
      rest = rest.slice(d.length);
      break;
    }
  }
  if (upper === null) {
    for (const d of LOWER_DEGREES) {
      if (rest.startsWith(d)) {
        degree = DEGREE_VALUE[d];
        upper = false;
        rest = rest.slice(d.length);
        break;
      }
    }
  }
  if (upper === null) {
    throw new Error(`"${str}": expected a Roman degree I–VII or i–vii`);
  }
  // Guard against over-long romans like "VIII"/"iiii": whatever is left must
  // now parse cleanly as suffixes/bass, and a leftover I/i will not.

  // Suffixes.
  const suffixes = [];
  outer: while (rest.length > 0 && rest[0] !== "/") {
    for (const s of SUFFIX_TOKENS) {
      if (rest.startsWith(s)) {
        suffixes.push(s);
        rest = rest.slice(s.length);
        continue outer;
      }
    }
    throw new Error(`"${str}": unrecognised suffix at "${rest}"`);
  }

  // Combination rules.
  const qualitySuffixes = suffixes.filter((s) => QUALITY_GROUP.has(s));
  const extensionSuffixes = suffixes.filter((s) => EXTENSION_GROUP.has(s));
  if (new Set(suffixes).size !== suffixes.length) {
    throw new Error(`"${str}": repeated suffix`);
  }
  if (qualitySuffixes.length > 1) {
    throw new Error(
      `"${str}": at most one of sus2/sus4/dim/aug/5 (got ${qualitySuffixes.join(", ")})`
    );
  }
  if (extensionSuffixes.length > 1) {
    throw new Error(
      `"${str}": at most one of 7/maj7/6/add9 (got ${extensionSuffixes.join(", ")})`
    );
  }
  if (qualitySuffixes.length === 1 && extensionSuffixes.length === 1) {
    // Only sus + 7 may cross the groups (V7sus4).
    const q = qualitySuffixes[0];
    const e = extensionSuffixes[0];
    if (!((q === "sus2" || q === "sus4") && e === "7")) {
      throw new Error(`"${str}": "${q}" cannot combine with "${e}" (only sus + 7 is allowed)`);
    }
  }
  // Case conventions from CLAUDE.md, enforced for strictness.
  if (suffixes.includes("dim") && upper) {
    throw new Error(`"${str}": dim belongs on a lowercase degree (e.g. viidim)`);
  }
  if (suffixes.includes("aug") && !upper) {
    throw new Error(`"${str}": aug belongs on an uppercase degree (e.g. bIIIaug)`);
  }
  if (suffixes.includes("maj7") && !upper) {
    throw new Error(`"${str}": maj7 belongs on an uppercase degree (e.g. IVmaj7)`);
  }

  // Bass.
  let bass = null;
  if (rest.length > 0) {
    if (rest[0] !== "/") {
      throw new Error(`"${str}": unexpected trailing text "${rest}"`);
    }
    const digit = rest.slice(1);
    if (!/^[1-7]$/.test(digit)) {
      throw new Error(`"${str}": bass must be /1–/7, got "/${digit}"`);
    }
    bass = Number(digit);
  }

  return { accidental, degree, upper, suffixes, bass };
}

const ROMANS = ["i", "ii", "iii", "iv", "v", "vi", "vii"];

// Canonical suffix order for format(): extension before sus (matches the
// spec's own example "V7sus4"), single-group suffixes on their own.
function orderedSuffixes(suffixes) {
  const ext = suffixes.find((s) => EXTENSION_GROUP.has(s));
  const qual = suffixes.find((s) => QUALITY_GROUP.has(s));
  const out = [];
  if (qual === "dim" || qual === "aug" || qual === "5") out.push(qual);
  if (ext) out.push(ext);
  if (qual === "sus2" || qual === "sus4") out.push(qual);
  return out;
}

/** Format a parsed numeral back to its canonical string form. */
export function format(parsed) {
  const acc = parsed.accidental === -1 ? "b" : parsed.accidental === 1 ? "#" : "";
  const roman = ROMANS[parsed.degree - 1];
  const degree = parsed.upper ? roman.toUpperCase() : roman;
  const bass = parsed.bass ? `/${parsed.bass}` : "";
  return acc + degree + orderedSuffixes(parsed.suffixes).join("") + bass;
}

/**
 * Display formatter: pretty Unicode form for the UI.
 * "viidim" → "vii°", "bVI" → "♭VI", "IIIaug" → "III+", "#iv" → "♯iv".
 */
export function formatDisplay(parsedOrString) {
  const parsed =
    typeof parsedOrString === "string" ? parse(parsedOrString) : parsedOrString;
  const acc = parsed.accidental === -1 ? "♭" : parsed.accidental === 1 ? "♯" : "";
  const roman = ROMANS[parsed.degree - 1];
  const degree = parsed.upper ? roman.toUpperCase() : roman;
  const suffixText = orderedSuffixes(parsed.suffixes)
    .map((s) => (s === "dim" ? "°" : s === "aug" ? "+" : s))
    .join("");
  const bass = parsed.bass ? `/${parsed.bass}` : "";
  return acc + degree + suffixText + bass;
}
