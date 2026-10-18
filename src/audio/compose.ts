/**
 * Helpers that write the repetitive parts of a score (bass, pads, arpeggios, drums) as MML from
 * a chord chart, so tracks only hand-write their melodies.
 * A chord is written "a3 c4 e4" (notes with octaves); the first note is the root.
 */

interface Note {
  letter: string;
  octave: number;
}

function parseNote(n: string): Note {
  const m = /^([a-g][+#-]?)(\d)$/.exec(n.trim());
  if (!m) throw new Error(`bad note ${n}`);
  return { letter: m[1], octave: Number(m[2]) };
}

const notesOf = (chord: string) => chord.trim().split(/\s+/).map(parseNote);
const n = (x: Note, len: string) => `o${x.octave}${x.letter}${len}`;

/** One chord per bar (4 beats) unless `beats` says otherwise. */
export type Chart = (string | [string, number])[];

function each(chart: Chart, fn: (chord: Note[], beats: number) => string): string {
  return chart.map((c) => (Array.isArray(c) ? fn(notesOf(c[0]), c[1]) : fn(notesOf(c), 4))).join(" ");
}

const eighths = (beats: number) => Math.round(beats * 2);

/** Bass: "oct" alternates root and octave in eighths; "pump" root eighths with octave pops; "half" root half notes; "walk" root-fifth quarters. */
export function bass(chart: Chart, style: "oct" | "pump" | "half" | "walk" | "gallop" = "oct", octave = 2): string {
  return each(chart, (c, beats) => {
    const r = { ...c[0], octave };
    const hi = { ...r, octave: octave + 1 };
    const out: string[] = [];
    if (style === "oct") for (let i = 0; i < eighths(beats); i++) out.push(n(i % 2 ? hi : r, "8"));
    else if (style === "pump") for (let i = 0; i < eighths(beats); i++) out.push(n(i % 4 === 2 || i % 8 === 7 ? hi : r, "8"));
    else if (style === "half") for (let i = 0; i < beats / 2; i++) out.push(n(r, "2"));
    else if (style === "gallop") for (let i = 0; i < beats; i++) out.push(n(r, "8"), n(r, "16"), n(hi, "16"));
    else {
      const fifth = c[2] ? { ...c[2], octave } : hi;
      for (let i = 0; i < beats; i++) out.push(n(i % 2 ? fifth : r, "4"));
    }
    return out.join(" ");
  });
}

/** Sustained chords. */
export function pad(chart: Chart): string {
  return each(chart, (c, beats) => {
    const len = beats === 4 ? "1" : beats === 2 ? "2" : beats === 1 ? "4" : beats === 3 ? "2." : "1";
    return `{${c.map((x) => `o${x.octave}${x.letter}`).join("")}}${len}`;
  });
}

/** Chord stabs on a rhythm, written with "x" (hit) and "." (rest) per eighth. */
export function stabs(chart: Chart, rhythm = "x..x..x."): string {
  return each(chart, (c, beats) => {
    const chord = `{${c.map((x) => `o${x.octave}${x.letter}`).join("")}}`;
    const out: string[] = [];
    for (let i = 0; i < eighths(beats); i++) out.push(rhythm[i % rhythm.length] === "x" ? `${chord}8` : "r8");
    return out.join(" ");
  });
}

/** Arpeggio in sixteenths (or eighths) cycling up and down the chord, an octave above. */
export function arp(chart: Chart, step: "16" | "8" = "16", shape: "up" | "updown" = "updown"): string {
  return each(chart, (c, beats) => {
    const tones = [...c, { ...c[0], octave: c[0].octave + 1 }];
    const seq = shape === "up" ? tones : [...tones, ...tones.slice(1, -1).reverse()];
    const count = step === "16" ? beats * 4 : beats * 2;
    const out: string[] = [];
    for (let i = 0; i < count; i++) out.push(n(seq[i % seq.length], step));
    return out.join(" ");
  });
}

/** Drum bars. Styles are 8-eighth patterns; every `fillEvery` bars ends with a tom fill. */
export function drums(bars: number, style: "rock" | "drive" | "half" | "light" | "march", fillEvery = 8, crashFirst = true): string {
  const patterns = {
    rock: "k8 h8 s8 h8 k8 k8 s8 h8",
    drive: "k8 h8 s8 k8 k8 h8 s8 h8",
    half: "k8 h8 h8 h8 s8 h8 h8 h8",
    light: "k8 h8 p8 h8 k8 h8 p8 h8",
    march: "s16 s16 s8 s8 s8 s16 s16 s8 s8 s8",
  } as const;
  const fill = style === "light" ? "k8 h8 p8 h8 p16 p16 p16 p16 p8 h8" : "k8 h8 s8 h8 s16 s16 j16 j16 m16 m16 n16 n16";
  const out: string[] = [];
  for (let b = 0; b < bars; b++) {
    let bar: string = fillEvery && (b + 1) % fillEvery === 0 ? fill : patterns[style];
    if (crashFirst && b % 8 === 0) bar = bar.replace(/^k8/, "x8");
    out.push(bar);
  }
  return out.join(" ");
}

/** Sixteenth hats, for drive. */
export function hats(bars: number, accent = true): string {
  return Array.from({ length: bars }, () => (accent ? "v9 h16 v5 h16 h16 h16 v9 h16 v5 h16 h16 h16 v9 h16 v5 h16 h16 h16 v9 h16 v5 h16 h16 h16" : "[h16]16")).join(" ");
}

export const rest = (bars: number) => Array.from({ length: bars }, () => "r1").join(" ");
