// detail.js — progression detail view (#/prog/<id>) and the minimal
// performance-mode placeholder (#/perform/<id>).
//
// Key selection is remembered per progression in localStorage under
// "chordhoard.keychoice" as an object of id → tonic.

import * as capo from "../engine/capo.js";
import { parseNote, pitchClass } from "../engine/theory.js";
import { recommend } from "../engine/solo-scales.js";
import { bpmForTempo } from "../engine/audio-notes.js";
import * as audioPlayer from "./audio-player.js";
import { voicingsFor, guitarChordSVG, pianoChordSVG } from "./diagrams.js";
import { chosenVoicingIndex, nextVoicingIndex } from "./voicing-choice.js";
import { openDiagramPopup } from "./diagram-popup.js";
import { chordHref } from "./chord-link.js";
import { tintClass } from "./function-tint.js";
import { createWordBanner } from "./words.js";
import { isPinned, pin, pinButton } from "./pins.js";
import { playabilityRow } from "./playability.js";
import { wheelSVG, captionFor } from "./circle-of-fifths.js";
import { state, renderIn, ratingIn } from "./app.js";
import { beatDots, metaLine, lower, metaLevel } from "./symbols.js";
import {
  el,
  clear,
  prettySymbol,
  prettyNote,
  capitalise,
  levelClass,
  getGuitarData,
} from "./util.js";

// The 12 supported tonics per mode family (CLAUDE.md's locked spelling
// choices — the engine doesn't export these lists, so they live here, once,
// and the chord/scale libraries and performance mode import them from here).
export const MAJOR_FAMILY_TONICS = ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"];
export const MINOR_FAMILY_TONICS = ["A", "E", "B", "F#", "C#", "G#", "D", "G", "C", "F", "Bb", "Eb"];
const MAJOR_FAMILY_MODES = new Set(["major", "mixolydian", "lydian"]);

const KEYCHOICE_KEY = "chordhoard.keychoice";

// Soloing scale line (roadmap 0.3): recommend() only knows about pentatonic
// keys and pitch classes, not the Scales tab's #/scales/<tonic>/<mode>
// routing, so the mapping from a recommendation to a deep link and its
// display words lives here, in the UI layer.
const SOLO_SCALE_LABEL = {
  majorPentatonic: "major pentatonic",
  minorPentatonic: "minor pentatonic",
  blues: "blues",
};
// Which Scales tab mode shows this scale family's own "Soloing" section —
// blues is built on the minor pentatonic, so it links there too.
const SOLO_SCALE_FAMILY_MODE = {
  majorPentatonic: "major",
  minorPentatonic: "minor",
  blues: "minor",
};

function soloScaleHref(rec) {
  const modeId = SOLO_SCALE_FAMILY_MODE[rec.scaleKey];
  const tonics = modeId === "major" ? MAJOR_FAMILY_TONICS : MINOR_FAMILY_TONICS;
  const pc = pitchClass(parseNote(rec.tonic));
  const snapped = tonics.find((t) => pitchClass(parseNote(t)) === pc) || tonics[0];
  return "#/scales/" + encodeURIComponent(snapped) + "/" + modeId;
}

export function isMajorFamily(entry) {
  return MAJOR_FAMILY_MODES.has(entry.mode);
}

export function tonicsFor(entry) {
  return isMajorFamily(entry) ? MAJOR_FAMILY_TONICS : MINOR_FAMILY_TONICS;
}

function loadKeyChoices() {
  try {
    return JSON.parse(localStorage.getItem(KEYCHOICE_KEY)) || {};
  } catch {
    return {};
  }
}

export function chosenTonic(entry) {
  const choices = loadKeyChoices();
  const tonic = choices[entry.id];
  return tonicsFor(entry).includes(tonic) ? tonic : entry.homeKey;
}

function rememberTonic(entry, tonic) {
  const choices = loadKeyChoices();
  if (tonic === entry.homeKey) delete choices[entry.id];
  else choices[entry.id] = tonic;
  try {
    localStorage.setItem(KEYCHOICE_KEY, JSON.stringify(choices));
  } catch {
    /* fine — the choice just won't stick */
  }
}

function keyLabel(entry, tonic) {
  return prettyNote(tonic) + " " + entry.mode;
}

/**
 * Size the chart's chord symbols to fit their bars (STYLEGUIDE §5.3).
 *
 * Bars are equal-width flex cells, so a six-character symbol (A♭add9,
 * B♭maj7) at the designed 40px rendered around 142px inside a 68px bar and
 * spilled over its neighbours' barlines — that is the "too big" Jack saw.
 *
 * ONE size is applied to every bar, computed from whichever symbol is
 * tightest, rather than shrinking each symbol independently. Per-symbol
 * fitting does fix the overflow, but it puts a 16px chord next to a 40px one
 * and the chart stops reading as a chart — the even type is most of what
 * makes a row of bars look engraved rather than accidental.
 *
 * Measured rather than derived from character count on purpose: accidentals
 * fall back to a different typeface (Newsreader has no ♭/♯), so counting
 * characters would mis-predict the real width. Measuring gets that for free.
 *
 * Below MIN_CHART_FS the chart stops shrinking and scrolls instead — past
 * that point the type is doing more harm than the scroll is.
 */
const MIN_CHART_FS = 20;

function fitChartSymbols(chart) {
  const symbols = [...chart.querySelectorAll(".chart-symbol")];
  if (!symbols.length) return;
  for (const s of symbols) s.style.removeProperty("font-size");

  const base = parseFloat(getComputedStyle(symbols[0]).fontSize);
  if (!base) return;

  let ratio = 1;
  for (const symbol of symbols) {
    const bar = symbol.closest(".chart-bar");
    const available = bar.clientWidth - 10;
    const width = symbol.getBoundingClientRect().width;
    if (available <= 0 || !width) continue;
    ratio = Math.min(ratio, available / width);
  }
  if (ratio >= 1) return;

  const size = Math.max(MIN_CHART_FS, Math.floor(base * ratio));
  for (const s of symbols) s.style.fontSize = size + "px";

  // A long progression (a 12-bar blues runs to nine bars) still cannot fit a
  // phone at readable type, so the chart scrolls — and the scrollbar is
  // hidden, which would leave that completely undiscoverable. Flag it so CSS
  // can fade the right edge, the one hint that there is more chart to see.
  chart.classList.toggle("scrollable", chart.scrollWidth > chart.clientWidth + 1);
}

// ---------------------------------------------------------------------------
// Fold rows (STYLEGUIDE §5.4)
//
// Everything below the transport collapses to a hairline row: a label, a
// meta summary of what's inside, and a chevron. Built on <details>/<summary>
// rather than a div with aria-expanded bookkeeping, so the open/close
// behaviour, keyboard handling and screen-reader announcement all come from
// the platform — and so the browser's own find-in-page can open a closed
// fold to reveal a match.
// ---------------------------------------------------------------------------

/**
 * @param {string} label     the row's name ("Key & capo")
 * @param {Node|string} summary  what's inside, in the meta voice
 * @param {Node|Node[]} body     revealed content
 * @param {boolean} [open]   start expanded (the prose row does)
 */
function fold(label, summary, body, open = false) {
  const summaryNode =
    typeof summary === "string" ? metaLine([summary]) : summary;
  return el(
    "details",
    { className: "fold", attrs: open ? { open: "" } : {} },
    el(
      "summary",
      {},
      el("span", { className: "fold-label" }, label),
      el(
        "span",
        { className: "fold-summary" },
        summaryNode,
        el("span", { className: "fold-chevron", attrs: { "aria-hidden": "true" } }, "›")
      )
    ),
    el("div", { className: "fold-body" }, body)
  );
}

// ---------------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------------

export function render(container, params) {
  const id = decodeURIComponent(params[0] || "");
  const entry = state.byId.get(id);
  if (!entry) {
    container.appendChild(notFound(id));
    return;
  }

  let tonic = chosenTonic(entry);
  let showPerChord = false;
  // Audio transport state (roadmap 1.1) — persists across redraws within
  // this view visit (key changes, badge toggle), ephemeral like the
  // performance view's capo toggle: resets on re-entry, not stored.
  let bpm = bpmForTempo(entry.tempo);
  let loopOn = false;
  let countInOn = false;
  let metronomeOn = false;
  // The word banner (roadmap 2.4) is rebuilt with the rest of the body on
  // every draw(), so the old one's toggle subscription goes with it.
  let wordBanner = null;

  const body = el("div", { className: "detail-body" });
  // The href gains the current tonic in draw(), so the chosen key survives
  // a refresh inside performance mode (#/perform/<id>/<tonic>).
  // It lives at the BOTTOM of the page now as a full-width dark bar (§5.4)
  // rather than as a small button in the top bar: it's the end of the
  // read-then-play journey, not a piece of chrome.
  const performLink = el("a", { className: "perform-cta" }, "Performance mode  →");
  // Pins record the key currently on screen; see chooseTonic() for how the
  // recorded key follows later key changes while pinned.
  const pinBtn = pinButton(entry, () => tonic);

  container.appendChild(
    el(
      "section",
      { className: "detail" },
      el(
        "div",
        { className: "detail-topbar" },
        el("a", { className: "back-link", href: "#/hoard" }, "‹ Hoard"),
        el("div", { className: "detail-actions" }, pinBtn)
      ),
      body
    )
  );

  draw();
  // draw() rebuilds the whole body (a key change swaps out the chord set
  // under any in-flight playback), so every redraw stops it rather than
  // trying to keep old DOM-bound callbacks alive across a rebuild; leaving
  // the route entirely does the same.
  // Rotating the phone changes every bar's width, so the chart symbols need
  // re-fitting. Torn down with the rest of the view's listeners.
  function onResize() {
    const chart = body.querySelector(".chart");
    if (chart) fitChartSymbols(chart);
  }
  window.addEventListener("resize", onResize);

  window.addEventListener(
    "hashchange",
    () => {
      audioPlayer.stopPlayback();
      window.removeEventListener("resize", onResize);
      if (wordBanner) wordBanner.dispose();
    },
    { once: true }
  );

  function draw() {
    audioPlayer.stopPlayback();
    if (wordBanner) wordBanner.dispose();
    wordBanner = null;
    clear(body);
    performLink.href =
      "#/perform/" + encodeURIComponent(entry.id) + "/" + encodeURIComponent(tonic);
    const rendered = renderIn(entry, tonic);
    const rating = ratingIn(entry, tonic, state.instrument);
    const perChordLevel = new Map(rendered.chords.map((c, i) => [i, rating.perChord[i].level]));

    // ---- Title + meta line ------------------------------------------------
    // The badge survives as the one labelled level on the whole app (§4) —
    // this is the screen where reading "G1" beats counting bars — and it is
    // still the toggle for the per-chord breakdown.
    const badge = el(
      "button",
      {
        type: "button",
        className: "meta-level-btn",
        attrs: {
          title: "Tap to see the level of each chord",
          "aria-pressed": String(showPerChord),
          "aria-label": `Complexity ${rating.level}. Tap to see the level of each chord`,
        },
        on: {
          click: () => {
            showPerChord = !showPerChord;
            draw();
          },
        },
      },
      metaLevel(rating.level)
    );

    body.appendChild(
      el(
        "header",
        { className: "detail-head-new" },
        el("h2", { className: "detail-title" }, entry.name),
        metaLine([
          keyLabel(entry, tonic),
          entry.timeSig,
          `${entry.bars} bars`,
          entry.tempo,
          badge,
          entry.moods.length ? lower(entry.moods.join(", ")) : null,
        ])
      )
    );

    // ---- Lyric words, ABOVE the chart (§5.4) ------------------------------
    // The chart is what you play; the words are what you sing over it, so
    // they sit in reading order above rather than tacked on underneath.
    wordBanner = createWordBanner({ className: "detail-words" });
    body.appendChild(wordBanner.node);

    // ---- Chart hero (§5.3) -------------------------------------------------
    // One cell per chord between two strong rules, beat dots under each.
    // Cells are per CHORD rather than per BAR: a chord may span two bars or
    // half of one, and the dots already carry the duration, so grouping by
    // bar would add engraving complexity without adding information.
    //
    // Barlines and the end repeat are CSS borders, never "|" and "‖"
    // characters — Newsreader has no U+2016, so a typed barline would
    // silently fall back to another face at a different weight (see the
    // @font-face banner in css/app.css).
    const strip = el("div", { className: "chart" });
    rendered.chords.forEach((chord, i) => {
      const cls = tintClass(chord.numeral, tonic, entry.mode);
      strip.appendChild(
        el(
          "div",
          { className: "chart-bar" },
          el("div", { className: "chart-symbol " + cls }, prettySymbol(chord.symbol)),
          // Neutral until something is playing; playback fills them in the
          // chord's own function colour.
          beatDots(chord.beats),
          // CLAUDE.md is explicit that the app always shows numerals AND
          // named chords, so the numeral rides under the dots rather than
          // being dropped for a tidier chart.
          el("div", { className: "chart-numeral " + cls }, chord.display),
          showPerChord
            ? metaLine([metaLevel(perChordLevel.get(i))], { className: "chart-level" })
            : null
        )
      );
    });
    // End repeat: thin rule, thick rule, two dots — drawn, not typed.
    strip.appendChild(
      el(
        "div",
        { className: "chart-repeat", attrs: { "aria-label": "Repeat", role: "img" } },
        el(
          "span",
          { className: "chart-repeat-dots", attrs: { "aria-hidden": "true" } },
          el("span", {}),
          el("span", {})
        ),
        el("span", { className: "chart-repeat-thin", attrs: { "aria-hidden": "true" } }),
        el("span", { className: "chart-repeat-thick", attrs: { "aria-hidden": "true" } })
      )
    );

    // ---- Audio transport (roadmap 1.1) ------------------------------------
    // Play/stop, BPM stepper, loop/count-in/metronome toggles. State
    // (bpm/loopOn/countInOn/metronomeOn) lives at render() scope so it
    // survives a redraw; the play button and highlight wiring are rebuilt
    // fresh each draw() (which always stops any prior playback first, see
    // above), so they only ever reference this draw's own chord strip.
    const countInLabel = el("span", { className: "audio-count-in meta" });

    // The sounding chord's beat dots fill in its own function tint (§5.3).
    // Looked up live rather than cached, so a redraw can't leave this
    // pointing at detached nodes.
    function highlightSounding(index) {
      strip.querySelectorAll(".chart-bar").forEach((node, i) => {
        const on = i === index;
        node.classList.toggle("sounding", on);
        const dots = node.querySelector(".beat-dots");
        if (!dots) return;
        // Borrow the symbol's tint class so --beat-on (currentColor) picks
        // up the harmonic function without this needing to know the colour.
        const tint = node.querySelector(".chart-symbol").className.match(/fn-\S+/);
        dots.classList.toggle(tint ? tint[0] : "fn-tonic", on);
        dots.querySelectorAll(".beat-dot").forEach((d) => d.classList.toggle("on", on));
      });
    }

    function resetAudioUI() {
      playBtn.textContent = "▶";
      playBtn.classList.remove("active");
      playBtn.setAttribute("aria-label", "Play");
      playBtn.setAttribute("aria-pressed", "false");
      countInLabel.textContent = "";
      highlightSounding(null);
    }

    const playBtn = el(
      "button",
      {
        type: "button",
        className: "play-circle audio-play-btn",
        attrs: { "aria-label": "Play", "aria-pressed": "false" },
        on: {
          click: () => {
            if (audioPlayer.isPlaying()) {
              audioPlayer.stopPlayback();
              return;
            }
            playBtn.textContent = "■";
            playBtn.classList.add("active");
            playBtn.setAttribute("aria-label", "Stop");
            playBtn.setAttribute("aria-pressed", "true");
            audioPlayer.playProgression(rendered.chords, {
              bpm,
              timeSig: entry.timeSig,
              loop: loopOn,
              countIn: countInOn,
              metronome: metronomeOn,
              onChordChange: highlightSounding,
              onCountIn: (beatsLeft) => {
                countInLabel.textContent = beatsLeft ? String(beatsLeft) : "";
              },
              // A fresh set of words each time round, never on chord change:
              // at 104bpm a chord goes by faster than anyone can finish a
              // sung line (roadmap 2.4). With Loop off this never fires,
              // which is the intended behaviour on this view.
              onLoop: () => {
                if (wordBanner) wordBanner.reroll();
              },
              onStop: resetAudioUI,
            });
          },
        },
      },
      "▶"
    );

    const bpmValue = el("span", { className: "stepper-value bpm-value" }, `${bpm} BPM`);
    const bpmStepper = el(
      "div",
      { className: "stepper bpm-stepper" },
      el(
        "button",
        {
          type: "button",
          className: "bpm-btn",
          attrs: { "aria-label": "Slower" },
          on: {
            click: () => {
              bpm = Math.max(40, bpm - 4);
              bpmValue.textContent = `${bpm} BPM`;
            },
          },
        },
        "−"
      ),
      bpmValue,
      el(
        "button",
        {
          type: "button",
          className: "bpm-btn",
          attrs: { "aria-label": "Faster" },
          on: {
            click: () => {
              bpm = Math.min(220, bpm + 4);
              bpmValue.textContent = `${bpm} BPM`;
            },
          },
        },
        "+"
      )
    );

    function audioToggle(label, get, set) {
      const btn = el(
        "button",
        {
          type: "button",
          className: "pill audio-toggle" + (get() ? " active" : ""),
          attrs: { "aria-pressed": String(get()) },
          on: {
            click: () => {
              set(!get());
              btn.classList.toggle("active", get());
              btn.setAttribute("aria-pressed", String(get()));
            },
          },
        },
        label
      );
      return btn;
    }

    // Chart first, transport under it — the chart is the hero of this view
    // and the controls act on it, so they read top to bottom in that order.
    body.appendChild(strip);
    body.appendChild(
      el(
        "div",
        { className: "detail-transport" },
        playBtn,
        bpmStepper,
        audioToggle("Loop", () => loopOn, (v) => (loopOn = v)),
        audioToggle("Count-in", () => countInOn, (v) => (countInOn = v)),
        audioToggle("Click", () => metronomeOn, (v) => (metronomeOn = v)),
        countInLabel
      )
    );

    // ---- Key selector ----------------------------------------------------
    // The wheel IS the key selector now (backlog item 3 follow-up, agreed
    // with Jack 2026-08-15): it covers exactly the same 12 tonics as the
    // flat button row used to, so the row was removed rather than kept
    // alongside it.
    function chooseTonic(t) {
      tonic = t;
      rememberTonic(entry, t);
      // A pin means "this progression, in my key" — so if it's pinned, the
      // pin's recorded key follows the choice rather than going stale.
      if (isPinned(entry.id)) pin(entry.id, t);
      draw();
    }

    const family = isMajorFamily(entry) ? "major" : "minor";
    const wheelHost = el("div", { className: "wheel-svg" });
    wheelHost.innerHTML = wheelSVG({ family, activeTonic: tonic, homeTonic: entry.homeKey });
    wheelHost.addEventListener("click", (ev) => {
      const w = ev.target.closest("[data-tonic]");
      if (w) chooseTonic(w.getAttribute("data-tonic"));
    });
    wheelHost.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const w = ev.target.closest("[data-tonic]");
      if (w) {
        ev.preventDefault();
        chooseTonic(w.getAttribute("data-tonic"));
      }
    });

    // Capo status (guitar only) now lives here, grouped with the key it's
    // actually about, and always renders one line or the other — it used
    // to appear only when a capo was worth suggesting, which meant tapping
    // a wedge could change this block's height and shove the wheel around
    // mid-tap. A constant-height line fixes that at the root rather than
    // just moving the jump somewhere less noticeable.
    let capoLine = null;
    if (state.instrument === "guitar") {
      const hint = capo.suggest(rendered.chords, tonic, !isMajorFamily(entry));
      capoLine = hint
        ? el(
            "p",
            { className: "capo-hint" },
            el("strong", {}, `Capo ${hint.capo} — play as ${hint.playAs}`),
            " · " + hint.note
          )
        : el(
            "p",
            { className: "capo-hint capo-hint-none" },
            el("strong", {}, "No capo needed"),
            ` · ${prettyNote(tonic)} is already open-friendly on guitar.`
          );
    }

    // Fold 1 — Key & capo. Summary reads "C · HOME · NO CAPO" so the two
    // facts you'd open it for are already answered on the closed row.
    const capoSummary =
      state.instrument !== "guitar"
        ? null
        : capo.suggest(rendered.chords, tonic, !isMajorFamily(entry))
          ? `Capo ${capo.suggest(rendered.chords, tonic, !isMajorFamily(entry)).capo}`
          : "No capo";
    body.appendChild(
      fold(
        "Key & capo",
        metaLine([
          prettyNote(tonic),
          tonic === entry.homeKey ? "home" : `home ${prettyNote(entry.homeKey)}`,
          capoSummary,
        ]),
        el(
          "div",
          { className: "key-picker" },
          wheelHost,
          el("p", { className: "wheel-caption" }, captionFor(tonic, family)),
          el(
            "p",
            { className: "wheel-hint" },
            "Outer ring is major, inner ring is its relative minor. Tap a key to jump there."
          ),
          capoLine
        )
      )
    );

    // ---- Diagrams strip ---------------------------------------------------
    const diagrams = el("div", { className: "diagram-strip" });
    body.appendChild(
      fold(
        "Chord shapes",
        metaLine([rendered.distinctChords.map((c) => prettySymbol(c.symbol)).join("  ")]),
        el("div", { className: "diagrams" }, diagrams)
      )
    );
    fillDiagrams(diagrams, rendered);

    // ---- Solo scale (roadmap 0.3) ------------------------------------------
    // Computed fresh every render, never stored — see solo-scales.js's own
    // notes on why. Follows the currently chosen tonic (not always the home
    // key), same as the capo hint and diagrams below.
    const solo = recommend(entry, tonic);
    const soloReasonText =
      solo.reason === "home"
        ? "matches this progression's own key."
        : "the relative of this progression's key, same notes with a different note as home.";
    const soloName = `${prettyNote(solo.tonic)} ${SOLO_SCALE_LABEL[solo.scaleKey]}`;
    body.appendChild(
      fold(
        solo.score < 0.15 ? "Closest fit" : "Solo with",
        metaLine([soloName]),
        el(
          "p",
          { className: "solo-scale-line" },
          el("a", { href: soloScaleHref(solo) }, soloName),
          " · " + soloReasonText
        )
      )
    );

    // ---- Songs ------------------------------------------------------------
    // Only a row when there's something in it: 247 of the 349 entries ship
    // no verified songs, and an empty fold on all of them would be noise.
    if (entry.songs && entry.songs.length) {
      const n = entry.songs.length;
      body.appendChild(
        fold(
          "As heard in",
          metaLine([`${n} ${n === 1 ? "song" : "songs"}`]),
          el(
            "ul",
            { className: "songs-list" },
            entry.songs.map((song) =>
              el(
                "li",
                {},
                el("strong", {}, song.title),
                ` — ${song.artist} (${prettyNote(song.key)}, ${song.section})`
              )
            )
          )
        )
      );
    }

    // ---- Notes -------------------------------------------------------------
    // Open by default: it's prose written to be read, not a reference table
    // you go looking for, and it's the last thing before the CTA.
    if (entry.notes) {
      body.appendChild(
        fold(
          "From the bandstand",
          metaLine([]),
          el("p", { className: "bandstand" }, entry.notes),
          true
        )
      );
    }

    // ---- Performance mode CTA (§5.4) ---------------------------------------
    // Sticky (see .perform-cta), so it floats above the folds rather than
    // needing a scroll to the bottom of the page to reach.
    body.appendChild(performLink);

    // Bar widths only exist once the chart is in the document, so the fit
    // runs here rather than while building. Once now, and again after the
    // font settles, because a fallback-metrics first paint would measure the
    // wrong width for any symbol containing an accidental.
    fitChartSymbols(strip);
    requestAnimationFrame(() => fitChartSymbols(strip));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => fitChartSymbols(strip));
    }
  }
}

function notFound(id) {
  return el(
    "section",
    { className: "coming-soon" },
    el("h2", {}, "That one's not in the hoard"),
    el("p", {}, `We couldn't find a progression called "${id}". It may have been renamed or removed.`),
    el("p", {}, el("a", { href: "#/hoard" }, "Back to the hoard"))
  );
}

// ---------------------------------------------------------------------------
// Diagrams — js/ui/diagrams.js renders SVG strings; the SVG builders escape
// their own text, so titles are passed RAW (escaping here would double up).
// Guitar shape data loads lazily via util.getGuitarData().
//
// Guitar cells (backlog items 4 + 14): tapping the shape itself cycles to the
// next voicing on file when there's more than one, remembering the choice
// (voicing-choice.js) — that supersedes the plain "tap for popup" item 4
// originally asked for. A small ⤢ button is the popup trigger instead, so
// the full-size view (with a way through to the Chords tab, and its own
// "try another shape" control) is always reachable even when the main tap
// is busy cycling. Piano cells have nothing to cycle, so the whole cell just
// opens the popup.
// ---------------------------------------------------------------------------

async function fillDiagrams(host, rendered) {
  const instrument = state.instrument;

  if (instrument === "guitar") {
    let guitarData;
    try {
      guitarData = await getGuitarData();
    } catch {
      host.appendChild(
        el(
          "div",
          { className: "diagram-placeholder" },
          el("p", {}, "Guitar shapes wouldn't load"),
          el("p", { className: "muted" }, "Check the connection and come back — the chords play fine without them.")
        )
      );
      return;
    }
    let anyAlternates = false;
    for (const chord of rendered.distinctChords) {
      const voicings = voicingsFor(chord, guitarData);
      if (voicings && voicings.length > 1) anyAlternates = true;
      host.appendChild(voicings && voicings.length ? guitarCell(chord, voicings) : missingCell(chord));
    }
    if (anyAlternates) {
      host.parentElement.insertBefore(
        el(
          "p",
          { className: "diagram-hint" },
          "Tap a shape to try another voicing. Tap ⤢ to see it full size."
        ),
        host
      );
    }
  } else {
    for (const chord of rendered.distinctChords) {
      host.appendChild(pianoCell(chord));
    }
  }
}

function missingCell(chord) {
  const cell = el("figure", { className: "diagram-cell" });
  cell.appendChild(el("div", { className: "diagram-missing" }, "No shape on file"));
  cell.appendChild(el("figcaption", {}, prettySymbol(chord.symbol)));
  return cell;
}

function guitarCell(chord, voicings) {
  let index = chosenVoicingIndex(chord, voicings);
  let popupRefresh = null;

  const label = () =>
    voicings.length > 1
      ? `${prettySymbol(chord.symbol)} — shape ${index + 1} of ${voicings.length}`
      : prettySymbol(chord.symbol);

  const svgHost = el("div", { className: "diagram-svg" });
  const caption = el("figcaption", {}, label());

  function draw() {
    svgHost.innerHTML = guitarChordSVG(voicings[index], { title: prettySymbol(chord.symbol) });
    caption.textContent = label();
    if (popupRefresh) popupRefresh();
  }

  function cycle() {
    if (voicings.length < 2) return;
    index = nextVoicingIndex(chord, voicings, index);
    draw();
  }

  function openPopup() {
    openDiagramPopup({
      title: prettySymbol(chord.symbol),
      chordsHref: chordHref(chord),
      build(body, refresh) {
        popupRefresh = refresh;
        const big = el("div", { className: "diagram-svg diagram-popup-svg" });
        big.innerHTML = guitarChordSVG(voicings[index], { title: prettySymbol(chord.symbol) });
        body.appendChild(big);
        body.appendChild(el("p", { className: "diagram-popup-caption" }, label()));
        if (voicings.length > 1) {
          body.appendChild(
            el(
              "button",
              { type: "button", className: "diagram-popup-cycle", on: { click: cycle } },
              "Try another shape"
            )
          );
        }
        // Playability mark (phase 4) — feeds the Hoard's playability filter.
        body.appendChild(playabilityRow(chord.symbol, "guitar"));
      },
    });
  }

  draw();

  const cell = el(
    "figure",
    { className: "diagram-cell" },
    el(
      "button",
      {
        type: "button",
        className: "diagram-tap",
        attrs: {
          "aria-label":
            voicings.length > 1
              ? `${prettySymbol(chord.symbol)}, shape ${index + 1} of ${voicings.length}. Tap to try another shape.`
              : prettySymbol(chord.symbol),
        },
        on: { click: () => (voicings.length > 1 ? cycle() : openPopup()) },
      },
      svgHost
    ),
    caption,
    el(
      "button",
      {
        type: "button",
        className: "diagram-expand",
        attrs: { "aria-label": `View ${prettySymbol(chord.symbol)} full size` },
        on: { click: openPopup },
      },
      "⤢"
    )
  );
  return cell;
}

function pianoCell(chord) {
  const svg = pianoChordSVG(chord);

  function openPopup() {
    openDiagramPopup({
      title: prettySymbol(chord.symbol),
      chordsHref: chordHref(chord),
      build(body) {
        const big = el("div", { className: "diagram-svg diagram-popup-svg" });
        big.innerHTML = svg;
        body.appendChild(big);
        // Playability mark (phase 4) — feeds the Hoard's playability filter.
        body.appendChild(playabilityRow(chord.symbol, "piano"));
      },
    });
  }

  const svgHost = el("div", { className: "diagram-svg" });
  svgHost.innerHTML = svg;

  return el(
    "figure",
    { className: "diagram-cell piano" },
    el(
      "button",
      {
        type: "button",
        className: "diagram-tap",
        attrs: { "aria-label": `View ${prettySymbol(chord.symbol)} full size` },
        on: { click: openPopup },
      },
      svgHost
    ),
    el("figcaption", {}, prettySymbol(chord.symbol))
  );
}

// Performance mode lives in js/ui/perform.js (real full-screen view, wave 2).
