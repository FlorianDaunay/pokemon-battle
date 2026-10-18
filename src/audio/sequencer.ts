import { getGraph, onAudioReady } from "./engine";
import type { AudioGraph } from "./engine";
import { DRUMS, playNote } from "./synth";
import type { Instrument } from "./synth";

/**
 * Music is written in a small MML dialect and scheduled ahead of time on the audio clock.
 *   o4 < >     octave set / down / up      l8   default length (8 = eighth note)
 *   c d e f g a b, + # sharp, - flat, length digits, "." dotted, "&" tie   r = rest
 *   {ceg}4     chord                         v12  velocity (0–15)
 *   [ ... ]3   repeat                         |    loop point (everything after it loops)
 * Drum parts use k (kick) s (snare) h (hat) o (open hat) x (crash) p (clap) j m n (toms high/mid/low).
 */

export interface Part {
  inst: Instrument;
  mml: string;
  vol?: number;
  pan?: number;
}

export interface Track {
  bpm: number;
  parts: Part[];
  /** Jingles play once. */
  loop?: boolean;
}

interface NoteEvent {
  beat: number;
  len: number;
  midi: number;
  vel: number;
}

interface ParsedPart {
  inst: Instrument;
  vol: number;
  pan: number;
  intro: NoteEvent[];
  body: NoteEvent[];
  introLen: number;
  bodyLen: number;
}

const NOTE_OFFSETS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const DRUM_MAP: Record<string, number> = { k: 36, s: 38, h: 42, o: 46, x: 49, p: 39, j: 50, m: 45, n: 41 };
const DRUM_INST: Record<number, Instrument> = { 36: "kick", 38: "snare", 42: "hat", 46: "ohat", 49: "crash", 39: "clap", 50: "tom", 45: "tom", 41: "tom" };
const TOM_PITCH: Record<number, number> = { 50: 57, 45: 50, 41: 45 };

function expandRepeats(src: string): string {
  let s = src;
  const re = /\[([^[\]]*)\](\d*)/;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) s = s.slice(0, m.index) + m[1].repeat(Number(m[2] || 2)) + s.slice(m.index + m[0].length);
  return s;
}

export function parseMml(src: string, drum: boolean): { intro: NoteEvent[]; body: NoteEvent[]; introLen: number; bodyLen: number } {
  const s = expandRepeats(src.replace(/;[^\n]*/g, "")).replace(/\s+/g, "");
  let i = 0;
  let octave = 4;
  let deflen = 4;
  let vel = 12;
  let beat = 0;
  let loopAt = -1;
  let loopIndex = -1;
  const events: NoteEvent[] = [];
  let last: NoteEvent[] = [];

  const readNum = (): number | null => {
    const m = /^\d+/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const readLen = (): number => {
    const n = readNum();
    let len = 4 / (n ?? deflen);
    let dot = len / 2;
    while (s[i] === ".") {
      len += dot;
      dot /= 2;
      i++;
    }
    return len;
  };
  const readPitch = (letter: string): number => {
    let pitch = (octave + 1) * 12 + NOTE_OFFSETS[letter];
    while (s[i] === "+" || s[i] === "#" || s[i] === "-") {
      pitch += s[i] === "-" ? -1 : 1;
      i++;
    }
    return pitch;
  };

  while (i < s.length) {
    const c = s[i++].toLowerCase();
    if (c === "|") {
      loopAt = beat;
      loopIndex = events.length;
    } else if (c === "o") octave = readNum() ?? octave;
    else if (c === "<") octave--;
    else if (c === ">") octave++;
    else if (c === "l") deflen = readNum() ?? deflen;
    else if (c === "v") vel = readNum() ?? vel;
    else if (c === "r") beat += readLen();
    else if (c === "&") {
      // Tie: extend the previous note(s) by the next length.
      const nextLetter = s[i]?.toLowerCase();
      if (nextLetter && (NOTE_OFFSETS[nextLetter] !== undefined || nextLetter === "{")) {
        if (nextLetter === "{") {
          while (i < s.length && s[i] !== "}") i++;
          i++;
        } else {
          i++;
          while (s[i] === "+" || s[i] === "#" || s[i] === "-") i++;
        }
      }
      const add = readLen();
      for (const e of last) e.len += add;
      beat += add;
    } else if (c === "{") {
      const pitches: number[] = [];
      while (i < s.length && s[i] !== "}") {
        const ch = s[i++].toLowerCase();
        if (ch === "<") octave--;
        else if (ch === ">") octave++;
        else if (ch === "o") octave = readNum() ?? octave;
        else if (NOTE_OFFSETS[ch] !== undefined) pitches.push(readPitch(ch));
      }
      i++;
      const len = readLen();
      last = pitches.map((midi) => ({ beat, len, midi, vel: vel / 15 }));
      events.push(...last);
      beat += len;
    } else if (drum && DRUM_MAP[c] !== undefined) {
      const len = readLen();
      last = [{ beat, len, midi: DRUM_MAP[c], vel: vel / 15 }];
      events.push(...last);
      beat += len;
    } else if (!drum && NOTE_OFFSETS[c] !== undefined) {
      const midi = readPitch(c);
      const len = readLen();
      last = [{ beat, len, midi, vel: vel / 15 }];
      events.push(...last);
      beat += len;
    }
  }
  if (loopAt < 0) return { intro: [], body: events, introLen: 0, bodyLen: beat };
  return {
    intro: events.slice(0, loopIndex),
    body: events.slice(loopIndex).map((e) => ({ ...e, beat: e.beat - loopAt })),
    introLen: loopAt,
    bodyLen: beat - loopAt,
  };
}

const parsedCache = new WeakMap<Track, ParsedPart[]>();
function parseTrack(track: Track): ParsedPart[] {
  const cached = parsedCache.get(track);
  if (cached) return cached;
  const out = track.parts.map((p) => ({ inst: p.inst, vol: p.vol ?? 1, pan: p.pan ?? 0, ...parseMml(p.mml, DRUMS.has(p.inst)) }));
  parsedCache.set(track, out);
  return out;
}

class Playback {
  private gain: GainNode;
  private start: number;
  private spb: number;
  private parts: ParsedPart[];
  private introLen: number;
  private bodyLen: number;
  private cursor: { intro: number; body: number; loop: number }[];
  private timer: number;
  private stopped = false;

  constructor(private g: AudioGraph, private track: Track, fadeIn: number) {
    this.gain = g.ctx.createGain();
    this.gain.connect(g.music);
    const t = g.ctx.currentTime;
    this.gain.gain.setValueAtTime(fadeIn > 0 ? 0.0001 : 1, t);
    if (fadeIn > 0) this.gain.gain.exponentialRampToValueAtTime(1, t + fadeIn);
    this.spb = 60 / track.bpm;
    this.parts = parseTrack(track);
    this.introLen = Math.max(0, ...this.parts.map((p) => p.introLen));
    this.bodyLen = Math.max(0.25, ...this.parts.map((p) => p.bodyLen));
    this.cursor = this.parts.map(() => ({ intro: 0, body: 0, loop: 0 }));
    this.start = t + 0.08;
    this.timer = window.setInterval(() => this.tick(), 25);
    this.tick();
  }

  private tick() {
    if (this.stopped) return;
    const horizon = this.g.ctx.currentTime + 0.3;
    this.parts.forEach((p, pi) => {
      const c = this.cursor[pi];
      while (c.intro < p.intro.length) {
        const e = p.intro[c.intro];
        const time = this.start + e.beat * this.spb;
        if (time > horizon) return;
        this.schedule(p, e, time);
        c.intro++;
      }
      for (;;) {
        if (c.body >= p.body.length) {
          if (this.track.loop === false) return;
          c.body = 0;
          c.loop++;
          if (!p.body.length) return;
        }
        const e = p.body[c.body];
        const beat = this.introLen + c.loop * this.bodyLen + e.beat;
        const time = this.start + beat * this.spb;
        if (time > horizon) return;
        this.schedule(p, e, time);
        c.body++;
      }
    });
  }

  private schedule(p: ParsedPart, e: NoteEvent, time: number) {
    if (time < this.g.ctx.currentTime - 0.05) return;
    const drum = DRUMS.has(p.inst);
    const inst = drum ? DRUM_INST[e.midi] ?? p.inst : p.inst;
    const midi = drum && inst === "tom" ? TOM_PITCH[e.midi] ?? 50 : e.midi;
    playNote(this.g, this.gain, inst, time, e.len * this.spb, midi, e.vel * p.vol, p.pan);
  }

  /** Seconds until a one-shot track ends. */
  get duration(): number {
    return (this.introLen + this.bodyLen) * this.spb;
  }

  stop(fade: number) {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.timer);
    const t = this.g.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, fade));
    setTimeout(() => this.gain.disconnect(), (fade + 2.5) * 1000);
  }
}

/** One music channel: switching tracks crossfades; jingles pause the music and resume it after. */
class MusicPlayer {
  private current: Playback | null = null;
  private currentId: string | null = null;
  private wanted: { id: string; track: Track } | null = null;
  private jingleTimer: number | null = null;

  constructor() {
    onAudioReady(() => {
      if (this.wanted && !this.current) this.startWanted(0.6);
    });
  }

  play(id: string, track: Track, fade = 0.6) {
    if (this.currentId === id && this.current) return;
    this.wanted = { id, track };
    if (this.jingleTimer !== null) return; // resumes after the jingle
    this.current?.stop(fade);
    this.current = null;
    this.currentId = null;
    this.startWanted(0.05);
  }

  private startWanted(fadeIn: number) {
    const g = getGraph();
    if (!g || !this.wanted) return;
    this.current = new Playback(g, this.wanted.track, fadeIn);
    this.currentId = this.wanted.id;
  }

  stop(fade = 0.8) {
    this.wanted = null;
    this.current?.stop(fade);
    this.current = null;
    this.currentId = null;
  }

  /** Plays a one-shot over silence, then brings the music back. */
  jingle(track: Track, onEnd?: () => void) {
    const g = getGraph();
    if (!g) {
      onEnd?.();
      return;
    }
    this.current?.stop(0.15);
    this.current = null;
    this.currentId = null;
    if (this.jingleTimer !== null) clearTimeout(this.jingleTimer);
    const pb = new Playback(g, { ...track, loop: false }, 0);
    this.jingleTimer = window.setTimeout(() => {
      this.jingleTimer = null;
      pb.stop(0.3);
      if (this.wanted) this.startWanted(0.8);
      onEnd?.();
    }, pb.duration * 1000 + 250);
  }
}

export const music = new MusicPlayer();
