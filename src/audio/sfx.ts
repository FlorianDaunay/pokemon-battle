import { getGraph } from "./engine";
import type { AudioGraph } from "./engine";
import { playNote } from "./synth";
import { music } from "./sequencer";
import * as T from "./tracks";
import { spriteNum } from "@/core/dex";

/** One-shot sound effects, synthesised, plus Pokémon cries fetched from PokeAPI. */

export type Sfx =
  | "select" | "confirm" | "back" | "error" | "hit" | "hitSuper" | "hitWeak" | "faint" | "throw" | "shake" | "click"
  | "caught" | "statUp" | "statDown" | "heal" | "door" | "coin" | "sparkle" | "status" | "run" | "exp" | "evolveFlash" | "thunder";

function blip(g: AudioGraph, freq: number, dur: number, type: OscillatorType, vol: number, slide?: number, delay = 0) {
  const t = g.ctx.currentTime + delay;
  const o = g.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const gain = g.ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gain).connect(g.sfx);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(g: AudioGraph, dur: number, filter: BiquadFilterType, freq: number, vol: number, delay = 0, sweepTo?: number) {
  const t = g.ctx.currentTime + delay;
  const src = g.ctx.createBufferSource();
  src.buffer = g.noise;
  const f = g.ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const gain = g.ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(gain).connect(g.sfx);
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

export function sfx(name: Sfx): void {
  const g = getGraph();
  if (!g) return;
  const now = g.ctx.currentTime;
  switch (name) {
    case "select": blip(g, 1200, 0.05, "square", 0.08); break;
    case "confirm": blip(g, 880, 0.06, "square", 0.08); blip(g, 1320, 0.08, "square", 0.08, undefined, 0.06); break;
    case "back": blip(g, 660, 0.06, "square", 0.07); blip(g, 440, 0.08, "square", 0.07, undefined, 0.05); break;
    case "error": blip(g, 200, 0.18, "square", 0.08); break;
    case "hit": noise(g, 0.18, "lowpass", 2500, 0.5, 0, 300); blip(g, 180, 0.12, "triangle", 0.4, 60); break;
    case "hitSuper": noise(g, 0.3, "lowpass", 4000, 0.6, 0, 200); blip(g, 220, 0.2, "square", 0.25, 50); noise(g, 0.15, "highpass", 3000, 0.25, 0.08); break;
    case "hitWeak": noise(g, 0.12, "bandpass", 1200, 0.35); blip(g, 300, 0.08, "triangle", 0.2, 150); break;
    case "faint": blip(g, 700, 0.6, "square", 0.12, 80); noise(g, 0.6, "lowpass", 1200, 0.15, 0.1, 100); break;
    case "throw": noise(g, 0.35, "bandpass", 600, 0.3, 0, 2400); break;
    case "shake": blip(g, 320, 0.05, "square", 0.15); blip(g, 260, 0.06, "square", 0.12, undefined, 0.08); break;
    case "click": blip(g, 1800, 0.03, "square", 0.15); noise(g, 0.05, "highpass", 5000, 0.2); break;
    case "caught": for (let i = 0; i < 3; i++) blip(g, [1047, 1319, 1568][i], 0.12, "square", 0.1, undefined, i * 0.07); break;
    case "statUp": for (let i = 0; i < 6; i++) blip(g, 400 * Math.pow(1.19, i), 0.07, "square", 0.07, undefined, i * 0.05); break;
    case "statDown": for (let i = 0; i < 6; i++) blip(g, 900 / Math.pow(1.19, i), 0.07, "square", 0.07, undefined, i * 0.05); break;
    case "heal": for (let i = 0; i < 8; i++) blip(g, 600 + i * 120, 0.09, "sine", 0.1, undefined, i * 0.045); break;
    case "door": noise(g, 0.5, "lowpass", 300, 0.4, 0, 1200); blip(g, 90, 0.4, "sine", 0.3, 60); break;
    case "coin": blip(g, 1976, 0.06, "square", 0.08); blip(g, 2637, 0.25, "square", 0.08, undefined, 0.06); break;
    case "sparkle": for (let i = 0; i < 5; i++) playNote(g, g.sfx, "bell", now + i * 0.06, 0.2, 84 + [0, 4, 7, 12, 16][i], 0.8); break;
    case "status": blip(g, 500, 0.25, "sawtooth", 0.06, 250); blip(g, 520, 0.25, "sawtooth", 0.06, 260, 0.12); break;
    case "run": noise(g, 0.4, "bandpass", 800, 0.25, 0, 3000); break;
    case "exp": blip(g, 900, 0.5, "sine", 0.05, 1800); break;
    case "evolveFlash": noise(g, 1, "highpass", 2000, 0.25, 0, 8000); for (let i = 0; i < 4; i++) playNote(g, g.sfx, "bell", now + i * 0.1, 0.4, 72 + i * 5, 0.7); break;
    case "thunder": noise(g, 1.2, "lowpass", 800, 0.5, 0, 80); break;
  }
}

/** Damage sound picked from effectiveness. */
export function hitSfx(kind?: "super" | "resisted" | "immune") {
  sfx(kind === "super" ? "hitSuper" : kind === "resisted" ? "hitWeak" : "hit");
}

const cryCache = new Map<number, Promise<AudioBuffer | null>>();

/** Plays a Pokémon's cry (PokeAPI legacy cries, Gen 1–5 style). Fails silently offline. */
export function cry(species: string, opts: { pitch?: number; volume?: number } = {}): void {
  const g = getGraph();
  if (!g) return;
  const num = spriteNum(species);
  let p = cryCache.get(num);
  if (!p) {
    const base = num > 10000 ? `latest/${num}` : `legacy/${num}`;
    p = fetch(`https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/${base}.ogg`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("no cry"))))
      .then((buf) => g.ctx.decodeAudioData(buf))
      .catch(() => null);
    cryCache.set(num, p);
  }
  void p.then((buf) => {
    if (!buf) return;
    const src = g.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.pitch ?? 1;
    const gain = g.ctx.createGain();
    gain.gain.value = 0.5 * (opts.volume ?? 1);
    src.connect(gain).connect(g.sfx);
    src.start();
  });
}

function overlay(notes: [number, number][]) {
  const g = getGraph();
  if (!g) return;
  const t = g.ctx.currentTime;
  for (const [midi, at] of notes) {
    playNote(g, g.sfx, "lead", t + at, 0.12, midi, 0.9);
    playNote(g, g.sfx, "bell", t + at, 0.3, midi + 12, 0.5);
  }
}

export const jingles = {
  heal: () => music.jingle(T.jingleHeal),
  item: () => music.jingle(T.jingleItem),
  // Short ones play over the music instead of interrupting it.
  level: () => overlay([[72, 0], [76, 0.07], [79, 0.14], [84, 0.21], [88, 0.3]]),
  caught: () => music.jingle(T.jingleCaught),
  floor: () => music.jingle(T.jingleFloor),
  blackout: () => music.jingle(T.jingleBlackout),
  evolve: () => music.jingle(T.jingleEvolve),
  achievement: () => overlay([[84, 0], [88, 0.06], [91, 0.12], [96, 0.18], [91, 0.3], [96, 0.38]]),
};
