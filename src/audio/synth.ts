import type { AudioGraph } from "./engine";

/**
 * Instruments built from oscillators and noise, voiced after the NDS-era sound: pulse leads with
 * delayed vibrato, detuned brass, string pads, punchy bass and drums.
 */

export type Instrument =
  | "lead" | "lead2" | "brass" | "strings" | "bass" | "synthbass" | "pluck" | "bell" | "piano" | "pad" | "flute"
  | "kick" | "snare" | "hat" | "ohat" | "crash" | "tom" | "timpani" | "clap";

/** Parts written with drum letters (timpani is pitched, so it is not one). */
export const DRUMS = new Set<Instrument>(["kick", "snare", "hat", "ohat", "crash", "tom", "clap"]);

const REVERB_SEND: Partial<Record<Instrument, number>> = {
  lead: 0.35, lead2: 0.3, brass: 0.45, strings: 0.6, bell: 0.6, piano: 0.45, pad: 0.7, flute: 0.5, pluck: 0.3,
  snare: 0.3, crash: 0.4, tom: 0.3, timpani: 0.5, clap: 0.3, bass: 0.05, synthbass: 0.05,
};

export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function env(g: GainNode, t: number, dur: number, peak: number, a: number, d: number, s: number, r: number) {
  const p = g.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(peak * s, t + a, d / 3);
  const end = t + Math.max(dur, a + 0.01);
  p.setValueAtTime(peak * s, end);
  p.setTargetAtTime(0.0001, end, r / 4);
  return end + r * 1.5;
}

function osc(ctx: AudioContext, type: OscillatorType | PeriodicWave, freq: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  if (type instanceof PeriodicWave) o.setPeriodicWave(type);
  else o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  return o;
}

function vibrato(ctx: AudioContext, target: AudioParam[], t: number, delay: number, depthCents: number, rate: number, stop: number) {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(0, t + delay);
  depth.gain.linearRampToValueAtTime(depthCents, t + delay + 0.25);
  lfo.connect(depth);
  for (const p of target) depth.connect(p);
  lfo.start(t);
  lfo.stop(stop);
}

function noiseSource(g: AudioGraph, t: number, stop: number): AudioBufferSourceNode {
  const src = g.ctx.createBufferSource();
  src.buffer = g.noise;
  src.loop = true;
  src.start(t, Math.random() * 1.5);
  src.stop(stop);
  return src;
}

/** Schedules one note. `vel` 0–1. `pan` -1..1. */
export function playNote(g: AudioGraph, dest: AudioNode, inst: Instrument, t: number, dur: number, midi: number, vel: number, pan = 0): void {
  const { ctx } = g;
  const out = ctx.createGain();
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  out.connect(panner).connect(dest);
  const send = REVERB_SEND[inst];
  if (send) {
    const s = ctx.createGain();
    s.gain.value = send;
    out.connect(s).connect(g.reverb);
  }
  const f = midiToFreq(midi);
  let stop: number;

  switch (inst) {
    case "lead": {
      const a = osc(ctx, g.pulse["25"], f);
      const b = osc(ctx, g.pulse["50"], f, -7);
      const mix = ctx.createGain();
      mix.gain.value = 0.5;
      a.connect(mix);
      b.connect(mix);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 5200;
      mix.connect(lp).connect(out);
      stop = env(out, t, dur, 0.16 * vel, 0.006, 0.12, 0.75, 0.09);
      vibrato(ctx, [a.detune, b.detune], t, 0.16, 9, 5.6, stop);
      a.start(t); b.start(t); a.stop(stop); b.stop(stop);
      break;
    }
    case "lead2": {
      const a = osc(ctx, g.pulse["12"], f);
      a.connect(out);
      stop = env(out, t, dur, 0.1 * vel, 0.005, 0.1, 0.7, 0.07);
      vibrato(ctx, [a.detune], t, 0.2, 7, 5.4, stop);
      a.start(t); a.stop(stop);
      break;
    }
    case "flute": {
      const a = osc(ctx, "triangle", f);
      const b = osc(ctx, "sine", f * 2);
      const bg = ctx.createGain();
      bg.gain.value = 0.15;
      b.connect(bg).connect(out);
      a.connect(out);
      stop = env(out, t, dur, 0.22 * vel, 0.04, 0.2, 0.85, 0.12);
      vibrato(ctx, [a.detune, b.detune], t, 0.22, 10, 5, stop);
      a.start(t); b.start(t); a.stop(stop); b.stop(stop);
      break;
    }
    case "brass": {
      const a = osc(ctx, "sawtooth", f, -8);
      const b = osc(ctx, "sawtooth", f, 8);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 2;
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.linearRampToValueAtTime(2800 + 1200 * vel, t + 0.05);
      lp.frequency.setTargetAtTime(1500, t + 0.06, 0.15);
      a.connect(lp);
      b.connect(lp);
      lp.connect(out);
      stop = env(out, t, dur, 0.11 * vel, 0.03, 0.2, 0.7, 0.12);
      vibrato(ctx, [a.detune, b.detune], t, 0.3, 6, 5, stop);
      a.start(t); b.start(t); a.stop(stop); b.stop(stop);
      break;
    }
    case "strings": {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2400;
      lp.connect(out);
      const oscs = [-12, 0, 11].map((d) => osc(ctx, "sawtooth", f, d));
      for (const o of oscs) o.connect(lp);
      stop = env(out, t, dur, 0.06 * vel, 0.14, 0.4, 0.85, 0.4);
      vibrato(ctx, oscs.map((o) => o.detune), t, 0.2, 5, 5.2, stop);
      for (const o of oscs) { o.start(t); o.stop(stop); }
      break;
    }
    case "pad": {
      const a = osc(ctx, "triangle", f);
      const b = osc(ctx, "sine", f, 6);
      a.connect(out);
      b.connect(out);
      stop = env(out, t, dur, 0.1 * vel, 0.3, 0.5, 0.9, 0.6);
      a.start(t); b.start(t); a.stop(stop); b.stop(stop);
      break;
    }
    case "bass": {
      const a = osc(ctx, "triangle", f);
      const b = osc(ctx, g.pulse["25"], f);
      const bg = ctx.createGain();
      bg.gain.value = 0.25;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1400;
      b.connect(bg).connect(lp);
      a.connect(lp);
      lp.connect(out);
      stop = env(out, t, dur * 0.92, 0.32 * vel, 0.004, 0.15, 0.7, 0.05);
      a.start(t); b.start(t); a.stop(stop); b.stop(stop);
      break;
    }
    case "synthbass": {
      const a = osc(ctx, "sawtooth", f);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 6;
      lp.frequency.setValueAtTime(2200, t);
      lp.frequency.setTargetAtTime(300, t, 0.08);
      a.connect(lp).connect(out);
      stop = env(out, t, dur * 0.9, 0.2 * vel, 0.003, 0.1, 0.6, 0.04);
      a.start(t); a.stop(stop);
      break;
    }
    case "pluck": {
      const a = osc(ctx, g.pulse["12"], f);
      a.connect(out);
      stop = env(out, t, Math.min(dur, 0.12), 0.09 * vel, 0.002, 0.08, 0.2, 0.08);
      a.start(t); a.stop(stop);
      break;
    }
    case "bell": {
      const a = osc(ctx, "sine", f);
      const b = osc(ctx, "sine", f * 2.76);
      const c = osc(ctx, "sine", f * 5.4);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.35, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.15, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      b.connect(bg).connect(out);
      c.connect(cg).connect(out);
      a.connect(out);
      stop = env(out, t, dur, 0.17 * vel, 0.002, 0.6, 0.3, 0.6);
      for (const o of [a, b, c]) { o.start(t); o.stop(stop); }
      break;
    }
    case "piano": {
      const a = osc(ctx, "triangle", f);
      const b = osc(ctx, "sine", f * 2, 3);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.4, t);
      bg.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      b.connect(bg).connect(out);
      a.connect(out);
      stop = env(out, t, dur, 0.2 * vel, 0.003, 0.9, 0.25, 0.3);
      a.start(t); b.start(t); a.stop(stop); b.stop(stop);
      break;
    }
    case "kick": {
      const a = osc(ctx, "sine", 150);
      a.frequency.setValueAtTime(160, t);
      a.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      a.connect(out);
      out.gain.setValueAtTime(0.9 * vel, t);
      out.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      stop = t + 0.3;
      a.start(t); a.stop(stop);
      break;
    }
    case "snare": {
      stop = t + 0.22;
      const n = noiseSource(g, t, stop);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2200;
      bp.Q.value = 0.7;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.5 * vel, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.connect(bp).connect(ng).connect(out);
      const body = osc(ctx, "triangle", 190);
      body.frequency.exponentialRampToValueAtTime(120, t + 0.08);
      const bgn = ctx.createGain();
      bgn.gain.setValueAtTime(0.35 * vel, t);
      bgn.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      body.connect(bgn).connect(out);
      body.start(t); body.stop(stop);
      break;
    }
    case "clap": {
      stop = t + 0.25;
      const n = noiseSource(g, t, stop);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0, t);
      for (let i = 0; i < 3; i++) {
        ng.gain.setValueAtTime(0.45 * vel, t + i * 0.012);
        ng.gain.exponentialRampToValueAtTime(0.05, t + i * 0.012 + 0.01);
      }
      ng.gain.setValueAtTime(0.35 * vel, t + 0.036);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      n.connect(bp).connect(ng).connect(out);
      break;
    }
    case "hat":
    case "ohat": {
      const len = inst === "hat" ? 0.05 : 0.22;
      stop = t + len + 0.02;
      const n = noiseSource(g, t, stop);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 7500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.16 * vel, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + len);
      n.connect(hp).connect(ng).connect(out);
      break;
    }
    case "crash": {
      stop = t + 1.6;
      const n = noiseSource(g, t, stop);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 4500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.22 * vel, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      n.connect(hp).connect(ng).connect(out);
      break;
    }
    case "tom":
    case "timpani": {
      const base = inst === "tom" ? f : f;
      const a = osc(ctx, "sine", base * 1.5);
      a.frequency.setValueAtTime(base * 1.5, t);
      a.frequency.exponentialRampToValueAtTime(base, t + 0.08);
      const len = inst === "tom" ? 0.3 : 0.9;
      out.gain.setValueAtTime((inst === "tom" ? 0.5 : 0.6) * vel, t);
      out.gain.exponentialRampToValueAtTime(0.001, t + len);
      a.connect(out);
      stop = t + len + 0.05;
      a.start(t); a.stop(stop);
      if (inst === "timpani") {
        const n = noiseSource(g, t, t + 0.1);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 900;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.2 * vel, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        n.connect(lp).connect(ng).connect(out);
      }
      break;
    }
    default:
      stop = t + dur;
  }
  // Let the graph collect the nodes once silent.
  setTimeout(() => out.disconnect(), Math.max(0, (stop - ctx.currentTime) * 1000 + 200));
}
