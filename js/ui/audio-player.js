// audio-player.js — the ONE file allowed to own an AudioContext (roadmap
// tier 1.1). Pitch/timing maths live in the pure, testable
// js/engine/audio-notes.js; everything here is side effects — synth nodes,
// the lookahead scheduler, and callbacks the caller uses to drive the DOM.
//
// Autoplay policy: the context is created (or resumed) lazily, inside
// playChord()/playProgression(), which callers only ever invoke from a
// click handler — so it always happens inside a user gesture.

import { voiceChord, buildSchedule } from "../engine/audio-notes.js";
import { beatsPerBar } from "../engine/progression.js";

const LOOKAHEAD_MS = 25; // scheduler tick
const SCHEDULE_AHEAD_SEC = 0.1; // how far into the AudioContext clock we schedule per tick
const LEAD_IN_SEC = 0.08; // first note starts slightly after "now" so it never misses
const FADE_OUT_SEC = 0.03; // Stop cuts the sound over this, short enough to feel instant

let ctx = null;
let filter = null;
let compressor = null;
let master = null;

function ensureContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctor();
    // Shared chain: per-voice envelopes → one lowpass filter (keeps the
    // triangle/sine mix from sounding harsh) → compressor (stops chord
    // stacks clipping) → master gain → destination.
    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 5000;
    compressor = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.85;
    filter.connect(compressor);
    compressor.connect(master);
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** True if this browser can play audio at all (feature-detect, not gesture-detect). */
export function isAvailable() {
  return typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);
}

// One oscillator pair per note: a triangle plus a sine an octave below at
// low gain, which reads as a passable keyboard-ish tone without samples.
//
// `out` is where the voice lands: a per-playback bus for the transport (so
// Stop can cut everything already committed to the AudioContext), or the
// shared filter for a one-off audition. `voices` collects the oscillators
// for the same reason — a note handed to the context is otherwise unstoppable
// and will sound for its whole scheduled duration.
function scheduleTone(freq, startTime, duration, peakGain, out = filter, voices = null) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = freq / 2;
  const subGain = ctx.createGain();
  subGain.gain.value = 0.3;

  const env = ctx.createGain();
  const attackEnd = startTime + Math.min(0.02, duration * 0.3);
  const releaseStart = Math.max(attackEnd, startTime + duration - 0.08);
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(peakGain, attackEnd);
  env.gain.setValueAtTime(peakGain, releaseStart);
  env.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(env);
  sub.connect(subGain);
  subGain.connect(env);
  env.connect(out);

  const stopTime = startTime + duration + 0.05;
  osc.start(startTime);
  osc.stop(stopTime);
  sub.start(startTime);
  sub.stop(stopTime);
  if (voices) {
    voices.add(osc);
    voices.add(sub);
    osc.onended = () => voices.delete(osc);
    sub.onended = () => voices.delete(sub);
  }
}

function scheduleChordAudio(realized, startTime, duration, out = filter, voices = null) {
  const voiced = voiceChord(realized);
  const voiceCount = voiced.tones.length + 1; // + bass
  const gainPer = 0.9 / voiceCount;
  scheduleTone(voiced.bass.freq, startTime, duration, gainPer * 1.1, out, voices);
  for (const tone of voiced.tones) {
    scheduleTone(tone.freq, startTime, duration, gainPer, out, voices);
  }
}

// A short filtered blip, accented (higher, louder) on beat 1.
function scheduleClick(time, accent, out = filter, voices = null) {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = accent ? 1600 : 1000;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(accent ? 0.45 : 0.28, time + 0.002);
  env.gain.linearRampToValueAtTime(0, time + 0.045);
  osc.connect(env);
  env.connect(out);
  osc.start(time);
  osc.stop(time + 0.05);
  if (voices) {
    voices.add(osc);
    osc.onended = () => voices.delete(osc);
  }
}

// ---------------------------------------------------------------------------
// One-off audition: play a single realized chord right now (chord library,
// dynamic builder — roadmap 1.2). Independent of the transport below.
// ---------------------------------------------------------------------------

/** Play one realized chord (chords.realize output) for `duration` seconds. */
export function playChord(realized, { duration = 1.1 } = {}) {
  const c = ensureContext();
  scheduleChordAudio(realized, c.currentTime + LEAD_IN_SEC, duration);
}

// ---------------------------------------------------------------------------
// Progression / song-section transport — play/stop, loop, count-in, metronome.
// Only one playback runs at a time; starting a new one stops the last.
// ---------------------------------------------------------------------------

let current = null; // active playback controller, or null

export function isPlaying() {
  return !!current;
}

/** Stop any active playback. Safe to call when nothing is playing. */
export function stopPlayback() {
  if (current) current.stop();
}

/**
 * Play a rendered chord list (progression.render(entry, tonic).chords).
 *
 * opts: { bpm, timeSig, loop, countIn, metronome, muted, onChordChange(index|null),
 * onCountIn(beatsLeft|null), onLoop(), onStop() }.
 *
 * `onLoop` fires at each loop boundary (roadmap 2.4, which rotates the lyric
 * prompt words there). It is deliberately a real event raised where the
 * scheduler actually resets its cursors, rather than something a caller
 * infers by watching onChordChange for index 0 — that breaks on
 * single-chord progressions, where the index is always 0.
 *
 * `muted` (roadmap 2.3, auto-advance) keeps the AudioContext clock driving
 * the schedule — so timing is still sample-accurate and immune to a
 * backgrounded tab — but skips every actual tone/click, for a silent
 * tempo-driven highlight walk rather than a second, parallel scheduler.
 *
 * Uses the standard lookahead-timer pattern: a ~25ms setInterval schedules
 * whatever audio falls in the next ~100ms of AudioContext time. The audio
 * itself sits on the AudioContext clock (sample accurate, immune to a
 * backgrounded tab); only the paired DOM highlight callback rides a
 * setTimeout aligned to that clock, so it can drift by a few ms — fine for
 * a highlight, not something driving the sound.
 */
export function playProgression(chords, opts = {}) {
  stopPlayback();
  if (!chords || !chords.length) return { stop() {} };

  const c = ensureContext();
  const {
    bpm = 104,
    timeSig = "4/4",
    loop = false,
    countIn = false,
    metronome = false,
    muted = false,
    onChordChange = () => {},
    onCountIn = () => {},
    onLoop = () => {},
    onStop = () => {},
  } = opts;

  // Everything this playback sounds goes through its own gain node, and every
  // oscillator is kept in `voices`. Stop then has something to cut: a note is
  // committed to the AudioContext the moment it is scheduled, so without this
  // a Stop mid-chord kept sounding for the rest of that chord (nine seconds on
  // a slow six-beat bar) and a Stop during the count-in let the whole bar of
  // clicks play out — the button said stopped while the music carried on.
  const bus = c.createGain();
  bus.gain.value = 1;
  bus.connect(filter);
  const voices = new Set();

  const barBeats = beatsPerBar(timeSig);
  const schedule = buildSchedule(chords, bpm);
  const loopLength = schedule.totalSec;
  const totalBeats = chords.reduce((sum, ch) => sum + ch.beats, 0);

  const clickEvents = [];
  if (metronome) {
    for (let b = 0; b < totalBeats; b += 1) {
      clickEvents.push({ atSec: b * schedule.secPerBeat, accent: b % barBeats === 0 });
    }
  }

  const countInBeats = countIn ? barBeats : 0;
  const countInSec = countInBeats * schedule.secPerBeat;
  const anchorTime = c.currentTime + LEAD_IN_SEC;
  const loopStartTime = anchorTime + countInSec;

  let stopped = false;
  const timeouts = new Set();
  function domAt(absTime, fn) {
    const delay = Math.max(0, (absTime - c.currentTime) * 1000);
    const id = setTimeout(() => {
      timeouts.delete(id);
      if (!stopped) fn();
    }, delay);
    timeouts.add(id);
  }

  // Count-in clicks always sound when requested, regardless of the
  // metronome toggle — a silent count-in would defeat its purpose.
  for (let b = 0; b < countInBeats; b += 1) {
    const t = anchorTime + b * schedule.secPerBeat;
    if (!muted) scheduleClick(t, b === 0, bus, voices);
    domAt(t, () => onCountIn(countInBeats - b));
  }
  if (countInBeats > 0) domAt(loopStartTime, () => onCountIn(null));

  let iteration = 0;
  let chordCursor = 0;
  let clickCursor = 0;
  let intervalId = null;

  // Cut the sound: a short ramp on the bus so it does not click, then stop
  // every oscillator (silent already, but they would otherwise run on to
  // their scheduled end times burning battery) and drop the bus out of the
  // chain. The disconnect timer is deliberately NOT in `timeouts` — that set
  // is cleared by finish() itself.
  function silence() {
    const now = c.currentTime;
    try {
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0, now + FADE_OUT_SEC);
    } catch {
      /* a param this browser will not let us touch mid-ramp; the disconnect below still silences it */
    }
    voices.forEach((osc) => {
      try {
        osc.stop(now + FADE_OUT_SEC);
      } catch {
        /* already stopped */
      }
    });
    voices.clear();
    setTimeout(() => {
      try {
        bus.disconnect();
      } catch {
        /* already gone */
      }
    }, (FADE_OUT_SEC + 0.05) * 1000);
  }

  function finish() {
    if (stopped) return;
    stopped = true;
    clearInterval(intervalId);
    timeouts.forEach(clearTimeout);
    timeouts.clear();
    silence();
    current = null;
    onStop();
  }

  function tick() {
    if (stopped) return;
    const horizon = c.currentTime + SCHEDULE_AHEAD_SEC;
    for (;;) {
      const iterStart = loopStartTime + iteration * loopLength;
      const nextChord = chordCursor < schedule.events.length ? schedule.events[chordCursor] : null;
      const nextClick = clickCursor < clickEvents.length ? clickEvents[clickCursor] : null;
      const nextChordTime = nextChord ? iterStart + nextChord.startSec : Infinity;
      const nextClickTime = nextClick ? iterStart + nextClick.atSec : Infinity;
      const nextTime = Math.min(nextChordTime, nextClickTime);
      if (nextTime === Infinity || nextTime > horizon) return;

      if (nextChordTime <= nextClickTime) {
        const ev = nextChord;
        if (!muted) scheduleChordAudio(ev.chord, nextChordTime, ev.durationSec, bus, voices);
        domAt(nextChordTime, () => onChordChange(ev.index));
        chordCursor += 1;
      } else {
        if (!muted) scheduleClick(nextClickTime, nextClick.accent, bus, voices);
        clickCursor += 1;
      }

      if (chordCursor >= schedule.events.length && clickCursor >= clickEvents.length) {
        if (loop) {
          const boundary = iterStart + loopLength;
          iteration += 1;
          chordCursor = 0;
          clickCursor = 0;
          domAt(boundary, () => onLoop());
        } else {
          const endTime = iterStart + loopLength;
          domAt(endTime, () => {
            onChordChange(null);
            finish();
          });
          return;
        }
      }
    }
  }

  intervalId = setInterval(tick, LOOKAHEAD_MS);
  tick();

  current = {
    stop() {
      finish();
    },
  };
  return current;
}
