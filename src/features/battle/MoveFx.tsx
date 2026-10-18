import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { TYPE_COLORS } from "@/core/dex";

/**
 * Move animations drawn on a canvas over the battle scene: projectiles, bolts, impacts and auras
 * tinted by the move's type.
 */

export interface FxPoint {
  x: number;
  y: number;
}

export interface FxRequest {
  kind: "projectile" | "impact" | "aura" | "bolt" | "rain" | "slash";
  type: string;
  from: FxPoint;
  to: FxPoint;
  big?: boolean;
}

export interface MoveFxHandle {
  play: (r: FxRequest) => Promise<void>;
}

type Shape = "orb" | "shard" | "leaf" | "bubble" | "ring" | "rock" | "star" | "wisp";
const SHAPE: Record<string, Shape> = {
  Fire: "orb", Water: "bubble", Grass: "leaf", Ice: "shard", Psychic: "ring", Ghost: "wisp", Rock: "rock", Ground: "rock",
  Poison: "bubble", Bug: "leaf", Dragon: "orb", Dark: "wisp", Steel: "shard", Fighting: "star", Normal: "star", Flying: "shard", Electric: "star",
};

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; s: number; r: number; shape: Shape; color: string; }

interface Anim {
  start: number;
  dur: number;
  req: FxRequest;
  parts: Particle[];
  done: () => void;
  burst: boolean;
}

function drawShape(ctx: CanvasRenderingContext2D, p: Particle, alpha: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.r);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  switch (p.shape) {
    case "orb": {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.s * 2);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.35, p.color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(-p.s * 2, -p.s * 2, p.s * 4, p.s * 4);
      break;
    }
    case "bubble":
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, p.s, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = alpha * 0.25; ctx.fill();
      break;
    case "leaf":
      ctx.beginPath(); ctx.ellipse(0, 0, p.s * 1.4, p.s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case "shard":
      ctx.beginPath(); ctx.moveTo(0, -p.s * 1.6); ctx.lineTo(p.s * 0.5, 0); ctx.lineTo(0, p.s * 1.6); ctx.lineTo(-p.s * 0.5, 0); ctx.closePath(); ctx.fill();
      break;
    case "ring":
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, p.s * 1.5, 0, Math.PI * 2); ctx.stroke();
      break;
    case "rock":
      ctx.beginPath(); ctx.moveTo(-p.s, -p.s * 0.6); ctx.lineTo(p.s * 0.4, -p.s); ctx.lineTo(p.s, p.s * 0.3); ctx.lineTo(-p.s * 0.2, p.s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke();
      break;
    case "wisp": {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.s * 2.4);
      g.addColorStop(0, p.color);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(-p.s * 2.4, -p.s * 2.4, p.s * 4.8, p.s * 4.8);
      break;
    }
    case "star":
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 ? p.s * 0.45 : p.s * 1.4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      break;
  }
  ctx.restore();
}

function burst(at: FxPoint, type: string, count: number, speed: number): Particle[] {
  const color = TYPE_COLORS[type] ?? "#fff";
  const shape = SHAPE[type] ?? "star";
  return Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random());
    return { x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.35 + Math.random() * 0.35, s: 3 + Math.random() * 5, r: Math.random() * 6, shape, color: Math.random() < 0.3 ? "#ffffff" : color };
  });
}

export const MoveFx = forwardRef<MoveFxHandle>(function MoveFx(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anims = useRef<Anim[]>([]);
  const raf = useRef(0);

  useImperativeHandle(ref, () => ({
    play: (req) =>
      new Promise<void>((resolve) => {
        const dur = req.kind === "projectile" ? 420 : req.kind === "bolt" ? 380 : req.kind === "aura" ? 650 : req.kind === "rain" ? 600 : 300;
        const parts: Particle[] = [];
        if (req.kind === "aura") {
          const color = TYPE_COLORS[req.type] ?? "#fff";
          for (let i = 0; i < 26; i++) parts.push({ x: req.from.x + (Math.random() - 0.5) * 90, y: req.from.y + 30 - Math.random() * 30, vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 90, life: -Math.random() * 0.3, max: 0.7, s: 2 + Math.random() * 3, r: 0, shape: "orb", color });
        }
        if (req.kind === "impact" || req.kind === "slash") parts.push(...burst(req.to, req.type, req.big ? 30 : 18, req.big ? 320 : 220));
        if (req.kind === "rain") {
          const color = TYPE_COLORS[req.type] ?? "#fff";
          for (let i = 0; i < 18; i++) parts.push({ x: req.to.x + (Math.random() - 0.5) * 140, y: req.to.y - 200 - Math.random() * 120, vx: 0, vy: 520, life: -Math.random() * 0.25, max: 0.5, s: 4 + Math.random() * 5, r: Math.random(), shape: SHAPE[req.type] ?? "rock", color });
        }
        // Never let an animation hold up the battle.
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        setTimeout(done, dur + 1500);
        anims.current.push({ start: performance.now(), dur, req, parts, done, burst: false });
        if (!raf.current) raf.current = requestAnimationFrame(loop);
      }),
  }));

  const loop = (now: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      raf.current = 0;
      for (const a of anims.current) a.done();
      anims.current = [];
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    const dt = 1 / 60;
    for (const a of anims.current) {
      const k = Math.min(1, (now - a.start) / a.dur);
      const { req } = a;
      const color = TYPE_COLORS[req.type] ?? "#fff";
      if (req.kind === "projectile") {
        const x = req.from.x + (req.to.x - req.from.x) * k;
        const y = req.from.y + (req.to.y - req.from.y) * k - Math.sin(k * Math.PI) * 30;
        if (k < 1) a.parts.push({ x, y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0, max: 0.25, s: 4 + Math.random() * 3, r: Math.random() * 6, shape: SHAPE[req.type] ?? "orb", color });
        if (k < 1) drawShape(ctx, { x, y, vx: 0, vy: 0, life: 0, max: 1, s: req.big ? 14 : 10, r: k * 8, shape: "orb", color }, 1);
        if (k >= 1 && !a.burst) { a.burst = true; a.parts.push(...burst(req.to, req.type, req.big ? 28 : 16, 260)); }
      } else if (req.kind === "bolt") {
        ctx.strokeStyle = "#fff8b0";
        ctx.lineWidth = req.big ? 5 : 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.globalAlpha = 1 - k * 0.6;
        ctx.beginPath();
        let x = req.to.x + (Math.random() - 0.5) * 30;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < req.to.y) { y += 24; x += (Math.random() - 0.5) * 40; ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (k > 0.6 && !a.burst) { a.burst = true; a.parts.push(...burst(req.to, req.type, 20, 260)); }
      } else if (req.kind === "slash") {
        ctx.strokeStyle = "#ffffff";
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 4;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(req.to.x - 50 + i * 16, req.to.y - 50);
          ctx.lineTo(req.to.x - 50 + i * 16 + 100 * Math.min(1, k * 2), req.to.y - 50 + 100 * Math.min(1, k * 2));
          ctx.stroke();
        }
      }
      if (req.kind === "impact" && k < 0.5) {
        ctx.globalAlpha = 1 - k * 2;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(req.to.x, req.to.y, 20 + k * 120, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const p of a.parts) {
        p.life += dt;
        if (p.life < 0) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy = p.vy * 0.94 + (p.shape === "rock" ? 12 : 0);
        p.r += 0.1;
        drawShape(ctx, p, Math.max(0, 1 - p.life / p.max));
      }
      a.parts = a.parts.filter((p) => p.life < p.max);
      if (k >= 1 && !a.parts.length) a.done();
    }
    ctx.globalAlpha = 1;
    anims.current = anims.current.filter((a) => !(Math.min(1, (now - a.start) / a.dur) >= 1 && !a.parts.length));
    raf.current = anims.current.length ? requestAnimationFrame(loop) : 0;
    if (!anims.current.length) ctx.clearRect(0, 0, w, h);
  };

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" />;
});
