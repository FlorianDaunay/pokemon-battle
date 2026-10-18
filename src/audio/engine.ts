/**
 * Shared WebAudio graph: master → compressor → speakers, with a music bus (plus a reverb send
 * for that big-hall feel) and an SFX bus. The context starts on the first user gesture.
 */

export interface AudioGraph {
  ctx: AudioContext;
  music: GainNode;
  sfx: GainNode;
  reverb: GainNode;
  noise: AudioBuffer;
  pulse: Record<string, PeriodicWave>;
}

let graph: AudioGraph | null = null;
let volumes = { music: 0.6, sfx: 0.8 };
const listeners = new Set<(g: AudioGraph) => void>();

function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 64;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

export function getGraph(): AudioGraph | null {
  return graph;
}

/** Creates/resumes the context. Call from a user gesture (click, key, touch). */
export function unlockAudio(): AudioGraph | null {
  if (typeof window === "undefined") return null;
  if (!graph) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx({ latencyHint: "interactive" });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);

    const music = ctx.createGain();
    const sfx = ctx.createGain();
    music.connect(master);
    sfx.connect(master);

    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx, 2.4, 3.2);
    const reverb = ctx.createGain();
    reverb.gain.value = 0.28;
    reverb.connect(conv).connect(music);

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    graph = {
      ctx, music, sfx, reverb, noise,
      pulse: { "12": pulseWave(ctx, 0.125), "25": pulseWave(ctx, 0.25), "50": pulseWave(ctx, 0.5) },
    };
    applyVolumes();
    for (const l of listeners) l(graph);
  }
  if (graph.ctx.state === "suspended") void graph.ctx.resume();
  return graph;
}

export function onAudioReady(fn: (g: AudioGraph) => void): () => void {
  listeners.add(fn);
  if (graph) fn(graph);
  return () => listeners.delete(fn);
}

function applyVolumes() {
  if (!graph) return;
  const t = graph.ctx.currentTime;
  // Perceptual curve: sliders feel linear.
  graph.music.gain.setTargetAtTime(Math.pow(volumes.music, 1.6) * 0.55, t, 0.05);
  graph.sfx.gain.setTargetAtTime(Math.pow(volumes.sfx, 1.6) * 0.8, t, 0.05);
}

export function setVolumes(music: number, sfx: number) {
  volumes = { music, sfx };
  applyVolumes();
}
