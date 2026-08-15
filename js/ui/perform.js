// perform.js — Performance Mode (#/perform/<id> and #/perform/<id>/<tonic>).
//
// Full-viewport takeover: the shell hides its header and tab bar via
// body[data-route="perform"] (see app.css), and this view pins itself to the
// viewport. The whole progression must FIT — zero scrolling, portrait or
// landscape — so we lay chords in a grid whose column count follows the
// orientation and chord count, then shrink a single font-size variable until
// nothing overflows. Everything but the chord symbols is deliberately dim.
//
// Screen Wake Lock: requested on entry, re-acquired when the tab becomes
// visible again, released on exit. Where unsupported (or refused) we degrade
// silently — a tiny indicator only appears when the lock is actually held.

import { parseNote, pitchClass } from "../engine/theory.js";
import * as capo from "../engine/capo.js";
import { state, renderIn } from "./app.js";
import { chosenTonic, tonicsFor, isMajorFamily } from "./detail.js";
import { el, clear, prettySymbol, prettyNote } from "./util.js";

/** "Am"/"Em"/"Dm" → "A"/"E"/"D" — capo.suggest()'s playAs already carries the
    minor-family "m", but progression.render() only wants the tonic letter
    (the entry's own mode supplies the rest). */
function playedTonicFor(hint) {
  return hint.playAs.endsWith("m") ? hint.playAs.slice(0, -1) : hint.playAs;
}

export function render(container, params) {
  const id = decodeURIComponent(params[0] || "");
  const entry = state.byId.get(id);
  if (!entry) {
    container.appendChild(
      el(
        "section",
        { className: "coming-soon" },
        el("h2", {}, "That one's not in the hoard"),
        el("p", {}, `We couldn't find a progression called "${id}".`),
        el("p", {}, el("a", { href: "#/hoard" }, "Back to the hoard"))
      )
    );
    return;
  }

  // Key: the /<tonic> route segment wins (so a shared or refreshed URL keeps
  // its key), falling back to the remembered chordhoard.keychoice.
  let tonic = chosenTonic(entry);
  if (params[1]) {
    const wanted = decodeURIComponent(params[1]);
    try {
      const pc = pitchClass(parseNote(wanted));
      const match = tonicsFor(entry).find((t) => pitchClass(parseNote(t)) === pc);
      if (match) tonic = match;
    } catch {
      /* unparseable tonic in the URL → remembered/home key */
    }
  }

  const rendered = renderIn(entry, tonic);
  const chords = rendered.chords;

  // ---- Capo mode (backlog item 5): a toggle that swaps the big symbols for
  // the shapes you'd actually play under the suggested capo, keeping the
  // real sounding chord as small print alongside — for sight-reading while
  // capoed up, rather than having to do the transposition in your head.
  // Ephemeral (resets on re-entry), like the detail view's per-chord toggle.
  let hint = null;
  let playedChords = null;
  if (state.instrument === "guitar") {
    hint = capo.suggest(chords, tonic, !isMajorFamily(entry));
    if (hint) playedChords = renderIn(entry, playedTonicFor(hint)).chords;
  }
  let capoMode = false;

  // ---- Corner strip: exit, key + time signature + capo, wake indicator ----
  const wakeDot = el(
    "span",
    {
      className: "wake-dot",
      attrs: { title: "Screen staying awake", "aria-hidden": "true" },
    },
    "●"
  );
  wakeDot.style.display = "none";

  function infoText() {
    const base = `${prettyNote(tonic)} ${entry.mode} · ${entry.timeSig}`;
    if (!hint) return base;
    if (capoMode) {
      return `Capo ${hint.capo} · playing as ${hint.playAs} · sounds ${prettyNote(tonic)} ${entry.mode}`;
    }
    return `${base} · capo ${hint.capo} (as ${hint.playAs})`;
  }

  const infoSpan = el("span", { className: "perform-strip-info" }, infoText());

  const capoBtn = hint
    ? el(
        "button",
        {
          type: "button",
          className: "perform-capo-toggle",
          attrs: {
            "aria-pressed": String(capoMode),
            title: "Show the shapes to play under the capo instead of the sounding chords",
          },
          on: {
            click: () => {
              capoMode = !capoMode;
              capoBtn.classList.toggle("active", capoMode);
              capoBtn.setAttribute("aria-pressed", String(capoMode));
              infoSpan.textContent = infoText();
              buildGrid();
              layout();
            },
          },
        },
        "Capo mode"
      )
    : null;

  const strip = el(
    "div",
    { className: "perform-strip" },
    el(
      "a",
      {
        className: "perform-exit",
        href: "#/prog/" + encodeURIComponent(entry.id),
        attrs: { "aria-label": "Exit performance mode" },
      },
      "✕"
    ),
    capoBtn,
    infoSpan,
    wakeDot
  );

  // ---- Chord grid ----------------------------------------------------------
  const grid = el("div", { className: "perform-grid" });

  function buildGrid() {
    clear(grid);
    chords.forEach((chord, i) => {
      const playedChord = playedChords ? playedChords[i] : null;
      const big = capoMode && playedChord ? playedChord : chord;
      grid.appendChild(
        el(
          "div",
          { className: "perform-cell" },
          el("div", { className: "perform-symbol" }, prettySymbol(big.symbol)),
          el(
            "div",
            { className: "perform-sub" },
            el("span", { className: "perform-numeral" }, chord.display),
            el("span", { className: "perform-beats" }, `${chord.beats}`),
            capoMode && playedChord
              ? el("span", { className: "perform-sounds" }, `sounds ${prettySymbol(chord.symbol)}`)
              : null
          )
        )
      );
    });
  }
  buildGrid();

  const root = el("section", { className: "perform-full" }, strip, grid);
  container.appendChild(root);

  // ---- Fit-to-viewport ------------------------------------------------------
  function layout() {
    const shown = capoMode && playedChords ? playedChords : chords;
    const longest = Math.max(...shown.map((c) => prettySymbol(c.symbol).length));
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (!w || !h) return;
    const n = chords.length;
    const portrait = h >= w;
    // Portrait stacks (4 chords → 2×2); landscape spreads (4 chords → 1×4).
    let cols;
    if (portrait) cols = n <= 3 ? 1 : n <= 8 ? 2 : 3;
    else {
      const rows = n <= 4 ? 1 : n <= 8 ? 2 : 3;
      cols = Math.ceil(n / rows);
    }
    const rows = Math.ceil(n / cols);
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    // First guess from cell geometry, then shrink until nothing overflows.
    const cellW = w / cols;
    const cellH = (h - strip.offsetHeight) / rows;
    let fs = Math.min(cellH * 0.42, (cellW * 1.55) / Math.max(2, longest));
    fs = Math.max(14, fs);
    root.style.setProperty("--perform-fs", fs + "px");
    for (let i = 0; i < 12; i += 1) {
      const overflowing =
        grid.scrollHeight > grid.clientHeight + 1 ||
        grid.scrollWidth > grid.clientWidth + 1 ||
        root.scrollHeight > root.clientHeight + 1;
      if (!overflowing) break;
      fs *= 0.9;
      root.style.setProperty("--perform-fs", fs + "px");
    }
  }

  // ---- Screen Wake Lock -------------------------------------------------------
  let wakeLock = null;
  let alive = true;

  async function acquireWakeLock() {
    if (!alive || !("wakeLock" in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeDot.style.display = "";
      wakeLock.addEventListener("release", () => {
        wakeDot.style.display = "none";
      });
    } catch {
      wakeDot.style.display = "none"; // refused or unsupported — play on
    }
  }

  function onVisibility() {
    if (document.visibilityState === "visible") acquireWakeLock();
  }

  function cleanup() {
    alive = false;
    window.removeEventListener("hashchange", cleanup);
    window.removeEventListener("resize", layout);
    document.removeEventListener("visibilitychange", onVisibility);
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  window.addEventListener("hashchange", cleanup);
  window.addEventListener("resize", layout);
  document.addEventListener("visibilitychange", onVisibility);

  layout();
  // Fonts and layout settle a tick later; measure once more to be sure.
  requestAnimationFrame(layout);
  acquireWakeLock();
}
