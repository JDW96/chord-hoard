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
import { tintClass, legendCaption } from "./function-tint.js";
import { createWordBanner } from "./words.js";
import { isPinned, pin, pinButton } from "./pins.js";
import { playabilityRow } from "./playability.js";
import { wheelSVG, captionFor } from "./circle-of-fifths.js";
import { state, renderIn, ratingIn } from "./app.js";
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
  const performLink = el("a", { className: "perform-btn" }, "Performance mode");
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
        el("div", { className: "detail-actions" }, pinBtn, performLink)
      ),
      body
    )
  );

  draw();
  // draw() rebuilds the whole body (a key change swaps out the chord set
  // under any in-flight playback), so every redraw stops it rather than
  // trying to keep old DOM-bound callbacks alive across a rebuild; leaving
  // the route entirely does the same.
  window.addEventListener(
    "hashchange",
    () => {
      audioPlayer.stopPlayback();
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

    // ---- Title + badges -------------------------------------------------
    const badge = el(
      "button",
      {
        type: "button",
        className: "badge badge-btn " + levelClass(rating.level),
        attrs: {
          title: "Tap to see the level of each chord",
          "aria-pressed": String(showPerChord),
        },
        on: {
          click: () => {
            showPerChord = !showPerChord;
            draw();
          },
        },
      },
      rating.level
    );

    body.appendChild(
      el(
        "header",
        { className: "detail-head" },
        el("h2", { className: "detail-name" }, entry.name),
        el(
          "div",
          { className: "detail-meta" },
          el("span", { className: "chip static" }, keyLabel(entry, tonic)),
          el("span", { className: "chip static" }, entry.timeSig),
          el("span", { className: "chip static" }, `${entry.bars} bars`),
          el("span", { className: "chip static" }, capitalise(entry.tempo)),
          badge
        ),
        el(
          "div",
          { className: "card-moods" },
          entry.moods.map((m) => el("span", { className: "mood-tag" }, m)),
          entry.genres.map((g) => el("span", { className: "mood-tag genre" }, g))
        )
      )
    );

    // ---- Big chord-by-chord strip ---------------------------------------
    const strip = el("div", { className: "chord-strip" });
    rendered.chords.forEach((chord, i) => {
      const cls = tintClass(chord.numeral, tonic, entry.mode);
      strip.appendChild(
        el(
          "div",
          { className: "chord-block" },
          el("div", { className: "chord-symbol " + cls }, prettySymbol(chord.symbol)),
          el(
            "div",
            { className: "chord-sub" },
            el("span", { className: "chord-numeral " + cls }, chord.display),
            el("span", { className: "chord-beats" }, `${chord.beats} beats`)
          ),
          showPerChord
            ? el(
                "span",
                { className: "badge small " + levelClass(perChordLevel.get(i)) },
                perChordLevel.get(i)
              )
            : null
        )
      );
    });

    // ---- Audio transport (roadmap 1.1) ------------------------------------
    // Play/stop, BPM stepper, loop/count-in/metronome toggles. State
    // (bpm/loopOn/countInOn/metronomeOn) lives at render() scope so it
    // survives a redraw; the play button and highlight wiring are rebuilt
    // fresh each draw() (which always stops any prior playback first, see
    // above), so they only ever reference this draw's own chord strip.
    const countInLabel = el("span", { className: "audio-count-in" });

    function highlightSounding(index) {
      strip.querySelectorAll(".chord-block").forEach((node, i) => {
        node.classList.toggle("sounding", i === index);
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
        className: "audio-play-btn",
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

    const bpmValue = el("span", { className: "bpm-value" }, `${bpm} BPM`);
    const bpmStepper = el(
      "div",
      { className: "bpm-stepper" },
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
          className: "audio-toggle" + (get() ? " active" : ""),
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

    body.appendChild(
      el(
        "div",
        { className: "audio-transport" },
        playBtn,
        bpmStepper,
        audioToggle("Loop", () => loopOn, (v) => (loopOn = v)),
        audioToggle("Count-in", () => countInOn, (v) => (countInOn = v)),
        audioToggle("Metronome", () => metronomeOn, (v) => (metronomeOn = v)),
        countInLabel
      )
    );

    body.appendChild(strip);
    wordBanner = createWordBanner();
    body.appendChild(wordBanner.node);
    body.appendChild(legendCaption());

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

    body.appendChild(
      el(
        "div",
        { className: "key-picker" },
        el(
          "h3",
          {},
          "Key",
          tonic !== entry.homeKey
            ? el("span", { className: "home-note" }, ` · home key is ${prettyNote(entry.homeKey)}`)
            : el("span", { className: "home-note" }, " · this is the home key")
        ),
        wheelHost,
        el("p", { className: "wheel-caption" }, captionFor(tonic, family)),
        el(
          "p",
          { className: "wheel-hint" },
          "Outer ring is major, inner ring is its relative minor. Tap a key to jump there."
        ),
        capoLine
      )
    );

    // ---- Diagrams strip ---------------------------------------------------
    const diagrams = el("div", { className: "diagram-strip" });
    body.appendChild(
      el("div", { className: "diagrams" }, el("h3", {}, "Chord shapes"), diagrams)
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
    body.appendChild(
      el(
        "p",
        { className: "solo-scale-line" },
        el("strong", {}, solo.score < 0.15 ? "Closest fit: " : "Solo with: "),
        el("a", { href: soloScaleHref(solo) }, `${prettyNote(solo.tonic)} ${SOLO_SCALE_LABEL[solo.scaleKey]}`),
        " · " + soloReasonText
      )
    );

    // ---- Notes -------------------------------------------------------------
    if (entry.notes) {
      body.appendChild(
        el("div", { className: "notes" }, el("h3", {}, "From the bandstand"), el("p", {}, entry.notes))
      );
    }

    // ---- Songs ------------------------------------------------------------
    if (entry.songs && entry.songs.length) {
      body.appendChild(
        el(
          "div",
          { className: "songs" },
          el("h3", {}, "As heard in"),
          el(
            "ul",
            {},
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
