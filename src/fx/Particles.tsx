import { useEffect, useRef } from "react";
import type { Ambient } from "@/core/spire/themes";
import { useSettings } from "@/store/settings";

/**
 * Ambient particles on a canvas: leaves, rain (with lightning), snow, sand, embers, sparks,
 * stars, wisps... Cheap enough for phones; `reducedFx` thins them out.
 */

interface P {
  x: number; y: number; vx: number; vy: number; s: number; r: number; vr: number; a: number; life: number; max: number; c: string; seed: number;
}

interface Spec {
  count: number;
  spawn: (w: number, h: number, initial: boolean) => P;
  step?: (p: P, dt: number, t: number, w: number, h: number) => void;
  draw: (ctx: CanvasRenderingContext2D, p: P, t: number) => void;
  additive?: boolean;
  /** Extra full-screen effect each frame (lightning, aurora...). */
  overlay?: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, state: { flash: number }) => void;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];

function base(over: Partial<P>): P {
  return { x: 0, y: 0, vx: 0, vy: 0, s: 1, r: 0, vr: 0, a: 1, life: 0, max: Infinity, c: "#fff", seed: Math.random() * 1000, ...over };
}

const fallFrom = (w: number, h: number, initial: boolean) => ({ x: rnd(-0.1 * w, 1.1 * w), y: initial ? rnd(-h * 0.1, h) : rnd(-0.2 * h, -10) });
const riseFrom = (w: number, h: number, initial: boolean) => ({ x: rnd(0, w), y: initial ? rnd(0, h) : h + rnd(5, 40) });

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const wrapFall = (p: P, w: number, h: number) => p.y > h + 30 || p.x < -60 || p.x > w + 60;

const SPECS: Record<Ambient, () => Spec> = {
  leaves: () => ({
    count: 26,
    spawn: (w, h, i) => base({ ...fallFrom(w, h, i), vx: rnd(10, 30), vy: rnd(25, 55), s: rnd(5, 10), r: rnd(0, 6), vr: rnd(-2, 2), c: pick(["#6fb94a", "#9ccc3f", "#e0a03a", "#c96b2c", "#4f9a3a"]) }),
    step: (p, dt, t) => { p.x += Math.sin(t * 1.3 + p.seed) * 22 * dt; p.r += p.vr * dt; },
    draw: (ctx, p) => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.abs(Math.sin(p.r * 1.7)) * 0.7 + 0.3);
      ctx.fillStyle = p.c; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-p.s, 0); ctx.lineTo(p.s, 0); ctx.stroke();
      ctx.restore();
    },
  }),
  petals: () => ({
    count: 30,
    spawn: (w, h, i) => base({ ...fallFrom(w, h, i), vx: rnd(15, 40), vy: rnd(20, 45), s: rnd(3, 6), r: rnd(0, 6), vr: rnd(-3, 3), c: pick(["#ffc4dd", "#ffb0cf", "#ffe1ec", "#f7a1c4"]) }),
    step: (p, dt, t) => { p.x += Math.sin(t * 2 + p.seed) * 18 * dt; p.r += p.vr * dt; },
    draw: (ctx, p) => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = 0.9; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    },
  }),
  feathers: () => ({
    count: 14,
    spawn: (w, h, i) => base({ x: i ? rnd(0, w) : -20, y: rnd(0, h * 0.8), vx: rnd(40, 90), vy: rnd(5, 20), s: rnd(7, 12), r: rnd(0, 6), vr: rnd(-1, 1), c: "#ffffff" }),
    step: (p, dt, t) => { p.y += Math.sin(t * 1.6 + p.seed) * 30 * dt; p.r = Math.sin(t + p.seed) * 0.8; },
    draw: (ctx, p) => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = 0.85;
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(150,170,200,0.7)"; ctx.beginPath(); ctx.moveTo(-p.s * 1.2, 0); ctx.lineTo(p.s, 0); ctx.stroke(); ctx.restore();
    },
    overlay: (ctx, w, h, t) => {
      // Wind streaks
      ctx.globalAlpha = 0.12; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const y = ((i * 97 + t * 30) % h);
        const x = ((t * 260 + i * 211) % (w + 300)) - 150;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 60, y - 8, x + 140, y); ctx.stroke();
      }
    },
  }),
  rain: () => ({
    count: 110,
    spawn: (w, h, i) => base({ ...fallFrom(w, h, i), vx: -90, vy: rnd(650, 850), s: rnd(10, 18), a: rnd(0.25, 0.5) }),
    draw: (ctx, p) => {
      ctx.globalAlpha = p.a; ctx.strokeStyle = "#bcd7ff"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 0.02, p.y - p.s); ctx.stroke();
    },
  }),
  storm: () => ({
    count: 220,
    spawn: (w, h, i) => base({ ...fallFrom(w, h, i), vx: -220, vy: rnd(900, 1150), s: rnd(14, 24), a: rnd(0.3, 0.6) }),
    draw: (ctx, p) => {
      ctx.globalAlpha = p.a; ctx.strokeStyle = "#cfe2ff"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 0.02, p.y - p.s); ctx.stroke();
    },
    overlay: (ctx, w, h, _t, st) => {
      if (st.flash <= 0 && Math.random() < 0.0035) st.flash = 1;
      if (st.flash > 0) {
        ctx.globalAlpha = st.flash * 0.55; ctx.fillStyle = "#e8f0ff"; ctx.fillRect(0, 0, w, h);
        st.flash -= 0.06;
      }
    },
  }),
  snow: () => ({
    count: 70,
    spawn: (w, h, i) => base({ ...fallFrom(w, h, i), vx: rnd(-10, 10), vy: rnd(25, 60), s: rnd(1.5, 3.8), a: rnd(0.5, 0.95) }),
    step: (p, dt, t) => { p.x += Math.sin(t + p.seed) * 14 * dt; },
    draw: (ctx, p) => { ctx.globalAlpha = p.a; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); },
  }),
  blizzard: () => ({
    count: 170,
    spawn: (w, h, i) => base({ ...fallFrom(w, h, i), vx: rnd(-260, -160), vy: rnd(140, 240), s: rnd(1.2, 3.4), a: rnd(0.5, 0.95) }),
    draw: (ctx, p) => { ctx.globalAlpha = p.a; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); },
    overlay: (ctx, w, h, t) => { ctx.globalAlpha = 0.1 + Math.sin(t * 0.7) * 0.05; ctx.fillStyle = "#eaf2ff"; ctx.fillRect(0, 0, w, h); },
  }),
  sand: () => ({
    count: 120,
    spawn: (w, h, i) => base({ x: i ? rnd(0, w) : w + rnd(5, 80), y: rnd(0, h), vx: rnd(-700, -420), vy: rnd(10, 60), s: rnd(6, 22), a: rnd(0.2, 0.55), c: pick(["#e7c88a", "#d6ad66", "#f1d9a6"]) }),
    draw: (ctx, p) => { ctx.globalAlpha = p.a; ctx.strokeStyle = p.c; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.s, p.y - p.s * 0.08); ctx.stroke(); },
    overlay: (ctx, w, h, t) => { ctx.globalAlpha = 0.16 + Math.sin(t * 0.9) * 0.05; ctx.fillStyle = "#c9a464"; ctx.fillRect(0, 0, w, h); },
  }),
  embers: () => ({
    count: 55,
    additive: true,
    spawn: (w, h, i) => base({ ...riseFrom(w, h, i), vx: rnd(-15, 15), vy: rnd(-70, -30), s: rnd(1.5, 3.5), max: rnd(3, 7), c: pick(["#ffb347", "#ff7b2a", "#ffd36b"]) }),
    step: (p, dt, t) => { p.x += Math.sin(t * 3 + p.seed) * 20 * dt; p.life += dt; },
    draw: (ctx, p, t) => { glowDot(ctx, p.x, p.y, p.s * 4, p.c, Math.max(0, 1 - p.life / p.max) * (0.7 + 0.3 * Math.sin(t * 12 + p.seed))); },
  }),
  sparks: () => ({
    count: 18,
    additive: true,
    spawn: (w, h) => base({ x: rnd(0, w), y: rnd(0, h), s: rnd(10, 30), max: rnd(0.12, 0.35), r: rnd(0, Math.PI * 2), c: pick(["#fff7a8", "#ffe35a", "#a8e8ff"]) }),
    step: (p, dt) => { p.life += dt; },
    draw: (ctx, p) => {
      const k = 1 - p.life / p.max;
      if (k <= 0) return;
      ctx.globalAlpha = k; ctx.strokeStyle = p.c; ctx.lineWidth = 2; ctx.shadowColor = p.c; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      let x = p.x, y = p.y;
      for (let i = 0; i < 4; i++) { x += Math.cos(p.r) * p.s / 4 + rnd(-6, 6); y += Math.sin(p.r) * p.s / 4 + rnd(-6, 6); ctx.lineTo(x, y); }
      ctx.stroke(); ctx.shadowBlur = 0;
    },
  }),
  dust: () => ({
    count: 40,
    additive: true,
    spawn: (w, h) => base({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-6, 6), vy: rnd(-8, 4), s: rnd(1, 2.4), c: "#ffe9b8", a: rnd(0.2, 0.6) }),
    step: (p, dt, t) => { p.x += Math.sin(t * 0.5 + p.seed) * 5 * dt; },
    draw: (ctx, p, t) => glowDot(ctx, p.x, p.y, p.s * 3, p.c, p.a * (0.6 + 0.4 * Math.sin(t + p.seed))),
  }),
  motes: () => ({
    count: 34,
    additive: true,
    spawn: (w, h, i) => base({ ...riseFrom(w, h, i), vx: rnd(-6, 6), vy: rnd(-22, -10), s: rnd(1.5, 3), c: "#ffd779", a: rnd(0.4, 0.9) }),
    step: (p, dt, t) => { p.x += Math.sin(t * 0.8 + p.seed) * 10 * dt; },
    draw: (ctx, p, t) => glowDot(ctx, p.x, p.y, p.s * 4, p.c, p.a * (0.6 + 0.4 * Math.sin(t * 2 + p.seed))),
  }),
  sparkles: () => ({
    count: 30,
    additive: true,
    spawn: (w, h) => base({ x: rnd(0, w), y: rnd(0, h), s: rnd(2, 5), max: rnd(1.2, 3), c: pick(["#ff9be0", "#c79bff", "#9bd6ff"]) }),
    step: (p, dt) => { p.life += dt; p.y -= 6 * dt; },
    draw: (ctx, p) => {
      const k = Math.sin((p.life / p.max) * Math.PI);
      if (k <= 0) return;
      ctx.globalAlpha = k; ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.moveTo(0, 0); ctx.quadraticCurveTo(p.s * 0.3, p.s * 0.3, 0, p.s * 2.2 * k); ctx.quadraticCurveTo(-p.s * 0.3, p.s * 0.3, 0, 0); }
      ctx.fill(); ctx.restore();
    },
  }),
  stars: () => ({
    count: 90,
    additive: true,
    spawn: (w, h) => base({ x: rnd(0, w), y: rnd(0, h), vx: -3, s: rnd(0.6, 1.8), a: rnd(0.3, 1), c: pick(["#ffffff", "#cfe0ff", "#ffe8c9"]) }),
    draw: (ctx, p, t) => { ctx.globalAlpha = p.a * (0.5 + 0.5 * Math.sin(t * 2 + p.seed)); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); },
    overlay: (ctx, w, h, t) => {
      // An occasional shooting star
      const cycle = (t % 7) / 7;
      if (cycle < 0.12) {
        const k = cycle / 0.12;
        const x = w * (0.2 + 0.6 * ((Math.floor(t / 7) * 0.37) % 1)) + k * 260;
        const y = h * 0.15 + k * 120;
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 70, y - 32); ctx.stroke();
      }
    },
  }),
  wisps: () => ({
    count: 14,
    additive: true,
    spawn: (w, h, i) => base({ ...riseFrom(w, h, i), vx: rnd(-10, 10), vy: rnd(-25, -10), s: rnd(8, 16), c: pick(["#9a6bff", "#6fc3ff", "#c58bff"]) }),
    step: (p, dt, t) => { p.x += Math.sin(t * 1.2 + p.seed) * 25 * dt; },
    draw: (ctx, p, t) => { glowDot(ctx, p.x, p.y, p.s * 2.4, p.c, 0.45 + 0.25 * Math.sin(t * 3 + p.seed)); glowDot(ctx, p.x, p.y, p.s * 0.7, "#ffffff", 0.5); },
  }),
  shadows: () => ({
    count: 16,
    spawn: (w, h, i) => base({ ...riseFrom(w, h, i), vx: rnd(-8, 8), vy: rnd(-30, -12), s: rnd(20, 50), c: "#0a0612" }),
    step: (p, dt, t) => { p.x += Math.sin(t + p.seed) * 15 * dt; },
    draw: (ctx, p) => glowDot(ctx, p.x, p.y, p.s, "rgba(20,8,35,0.9)", 0.5),
    overlay: (ctx, w, h, t) => glowDot(ctx, w * (0.5 + 0.3 * Math.sin(t * 0.2)), h * 0.3, w * 0.25, "rgba(160,40,90,0.4)", 0.35),
  }),
  smoke: () => ({
    count: 14,
    spawn: (w, h, i) => base({ x: rnd(0, w), y: i ? rnd(0, h) : h + 60, vx: rnd(-10, 10), vy: rnd(-18, -6), s: rnd(50, 110), c: "rgba(70,20,40,0.6)" }),
    draw: (ctx, p) => glowDot(ctx, p.x, p.y, p.s, p.c, 0.35),
    overlay: (ctx, w, h, t) => {
      // Red alarm light sweeping
      ctx.globalAlpha = 0.12 + 0.08 * Math.sin(t * 2.2);
      ctx.fillStyle = "#ff2a3a"; ctx.fillRect(0, 0, w, h * 0.06);
    },
  }),
  spores: () => ({
    count: 36,
    additive: true,
    spawn: (w, h, i) => base({ ...riseFrom(w, h, i), vx: rnd(-8, 8), vy: rnd(-26, -10), s: rnd(2, 6), c: pick(["#c46bff", "#9d4dde", "#7bd17b"]) }),
    step: (p, dt, t) => { p.x += Math.sin(t + p.seed) * 12 * dt; },
    draw: (ctx, p) => { ctx.globalAlpha = 0.55; ctx.strokeStyle = p.c; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.stroke(); },
    overlay: (ctx, w, h) => glowDot(ctx, w / 2, h, w * 0.8, "rgba(120,40,160,0.35)", 0.6),
  }),
  steam: () => ({
    count: 22,
    spawn: (w, h, i) => base({ ...riseFrom(w, h, i), vx: rnd(-6, 6), vy: rnd(-40, -20), s: rnd(25, 60), c: "rgba(230,230,240,0.5)" }),
    draw: (ctx, p) => glowDot(ctx, p.x, p.y, p.s, p.c, 0.25),
    overlay: (ctx, w, h, t) => glowDot(ctx, w * 0.8, h * 0.85, w * 0.3, "rgba(255,140,40,0.5)", 0.4 + 0.15 * Math.sin(t * 5)),
  }),
  confetti: () => ({
    count: 40,
    spawn: (w, h, i) => base({ ...fallFrom(w, h, i), vx: rnd(-20, 20), vy: rnd(40, 80), s: rnd(3, 6), r: rnd(0, 6), vr: rnd(-6, 6), c: pick(["#ff5a5a", "#ffd25a", "#5ad1ff", "#7dff8a", "#ff8ae6"]) }),
    step: (p, dt) => { p.r += p.vr * dt; },
    draw: (ctx, p) => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = 0.85; ctx.fillStyle = p.c; ctx.fillRect(-p.s, -p.s * 0.4 * Math.abs(Math.cos(p.r * 2)), p.s * 2, p.s * 0.8 * Math.abs(Math.cos(p.r * 2)) + 0.5); ctx.restore(); },
  }),
  mist: () => ({
    count: 10,
    spawn: (w, h, i) => base({ x: i ? rnd(0, w) : -200, y: rnd(h * 0.3, h), vx: rnd(8, 20), s: rnd(120, 220), c: "rgba(200,230,240,0.5)" }),
    draw: (ctx, p) => glowDot(ctx, p.x, p.y, p.s, p.c, 0.28),
  }),
  aurora: () => ({
    count: 40,
    spawn: (w, h, i) => base({ ...fallFrom(w, h, i), vx: rnd(-20, -5), vy: rnd(30, 55), s: rnd(1.2, 2.6), a: rnd(0.4, 0.8) }),
    draw: (ctx, p) => { ctx.globalAlpha = p.a; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); },
    overlay: (ctx, w, h, t) => {
      for (let band = 0; band < 2; band++) {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, "transparent");
        g.addColorStop(0.5, band ? "rgba(120,255,200,0.6)" : "rgba(140,120,255,0.55)");
        g.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = g;
        ctx.beginPath();
        const y0 = h * (0.12 + band * 0.08);
        ctx.moveTo(0, y0);
        for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y0 + Math.sin(x * 0.01 + t * (0.6 + band * 0.3)) * 22);
        ctx.lineTo(w, y0 + 70); ctx.lineTo(0, y0 + 70); ctx.closePath(); ctx.fill();
      }
    },
  }),
};

export function Particles({ ambient, className = "", density = 1 }: { ambient: Ambient | null; className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useSettings((s) => s.reducedFx);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !ambient) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const spec = SPECS[ambient]();
    let w = 0, h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const areaScale = Math.min(1.6, Math.max(0.5, (w * h) / (1280 * 720)));
    const count = Math.round(spec.count * areaScale * density * (reduced ? 0.35 : 1));
    const ps: P[] = Array.from({ length: count }, () => spec.spawn(w, h, true));
    const state = { flash: 0 };
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = spec.additive ? "lighter" : "source-over";
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        spec.step?.(p, dt, t, w, h);
        if (wrapFall(p, w, h) || p.y < -80 || p.life > p.max) ps[i] = spec.spawn(w, h, false);
        else spec.draw(ctx, p, t);
      }
      ctx.globalCompositeOperation = "source-over";
      spec.overlay?.(ctx, w, h, t, state);
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [ambient, reduced, density]);

  if (!ambient) return null;
  return <canvas ref={ref} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
