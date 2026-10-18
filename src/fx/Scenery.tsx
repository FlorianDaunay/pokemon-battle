import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Biome } from "@/core/spire/themes";
import { Rng } from "@/core/rng";

/**
 * Painted backdrops per biome: sky gradient, layered silhouettes, and soft lights. Kept simple
 * (SVG + gradients) so they scale to any screen and cost nothing to render.
 */

export interface Palette {
  sky: [string, string, string];
  far: string;
  near: string;
  ground: string;
  light: string;
  /** Platform colours in battle (top, rim). */
  platform: [string, string];
}

export const PALETTES: Record<Biome, Palette> = {
  forest: { sky: ["#163a2a", "#2e6b3f", "#8fc970"], far: "#1d4a2c", near: "#123222", ground: "#2f5a2a", light: "#fff4c2", platform: ["#7fbf5a", "#4e8a35"] },
  cave: { sky: ["#0d0b10", "#231c22", "#3c3030"], far: "#2a2226", near: "#17121a", ground: "#3a2f2a", light: "#ffcf8a", platform: ["#8a7563", "#5c4b3f"] },
  coast: { sky: ["#2b4e7a", "#5c8fc2", "#a9d3ea"], far: "#3c6e94", near: "#1f4f74", ground: "#d9c48f", light: "#ffffff", platform: ["#e9d9a6", "#bfa86e"] },
  sky: { sky: ["#4a8fd8", "#8cc5f2", "#e2f3ff"], far: "#ffffff", near: "#dcecff", ground: "#a7d58a", light: "#fff8d8", platform: ["#f4fbff", "#b9d6ee"] },
  hideout: { sky: ["#140a10", "#2a1220", "#3d1828"], far: "#2d1a26", near: "#180c14", ground: "#2e2430", light: "#ff4256", platform: ["#5b4a5e", "#3a2c3e"] },
  power: { sky: ["#151a2e", "#25305a", "#3d4c86"], far: "#28345e", near: "#141a33", ground: "#3a3f55", light: "#ffe85a", platform: ["#8a90a8", "#5a5f78"] },
  dojo: { sky: ["#3b1e14", "#7a3a22", "#e0a070"], far: "#5a2a1a", near: "#2e140c", ground: "#a77a4a", light: "#ffd9a0", platform: ["#c99a66", "#8e6640"] },
  tower: { sky: ["#0e0a1c", "#241a42", "#3d2c63"], far: "#2a1f48", near: "#140e26", ground: "#3a3150", light: "#b99bff", platform: ["#6a5a8a", "#463a62"] },
  volcano: { sky: ["#1e0a06", "#5a1a0c", "#d0501c"], far: "#4a160c", near: "#240a06", ground: "#3a1c14", light: "#ff8a2a", platform: ["#7a4a3a", "#4e2c22"] },
  abyss: { sky: ["#03101e", "#08284a", "#14507a"], far: "#0a3050", near: "#041a30", ground: "#1a3c50", light: "#7fd8ff", platform: ["#3f6e88", "#244a60"] },
  sanctum: { sky: ["#1c0f33", "#4a2a74", "#c084d8"], far: "#3a2060", near: "#1e1036", ground: "#5a4a7a", light: "#ffb7f5", platform: ["#c9b5e6", "#8e74b8"] },
  ice: { sky: ["#1a3550", "#5c8db8", "#d7ecff"], far: "#9cc4e4", near: "#5a86ad", ground: "#e8f4ff", light: "#ffffff", platform: ["#f2f9ff", "#a9c9e6"] },
  desert: { sky: ["#8a5a2a", "#d49a50", "#f5d9a0"], far: "#c08850", near: "#9a6430", ground: "#e2b874", light: "#fff2c0", platform: ["#efcf8f", "#c49a58"] },
  marsh: { sky: ["#140f1c", "#2c1e3a", "#4a3a5a"], far: "#2a2236", near: "#150f1e", ground: "#3a3a2a", light: "#c46bff", platform: ["#6a5a72", "#463a4e"] },
  space: { sky: ["#03030c", "#0c0e2a", "#1c1f4a"], far: "#141640", near: "#08091e", ground: "#262a4a", light: "#8fb4ff", platform: ["#5a6090", "#383d66"] },
  foundry: { sky: ["#1a1410", "#3a2a1e", "#6a4a2e"], far: "#3a2c22", near: "#1c1410", ground: "#4a3e36", light: "#ff9a3a", platform: ["#8a8a90", "#5c5c64"] },
  arena: { sky: ["#0e1430", "#23306a", "#5a6ab8"], far: "#1c2654", near: "#0e1430", ground: "#4a5a8a", light: "#fff2b0", platform: ["#d8dcef", "#9aa2c6"] },
  den: { sky: ["#0c1a1c", "#1e3a3e", "#4a7a7a"], far: "#22444a", near: "#0f2226", ground: "#3a4a44", light: "#9affd8", platform: ["#6f8a80", "#4a6058"] },
  shadow: { sky: ["#07040c", "#160a1e", "#2a1030"], far: "#1c0c22", near: "#0a0410", ground: "#241a2a", light: "#ff4a8a", platform: ["#4a3a52", "#2c2234"] },
  frigate: { sky: ["#0a1426", "#1a2e52", "#3a5a8a"], far: "#22385e", near: "#0e1a30", ground: "#3a4660", light: "#9fd8ff", platform: ["#7a8aa8", "#4e5c78"] },
  league: { sky: ["#140e06", "#3a2a10", "#8a6a2a"], far: "#4a3614", near: "#1e1608", ground: "#6a5430", light: "#ffd779", platform: ["#e6d3a0", "#b39a5e"] },
  summit: { sky: ["#3a4a66", "#8a9ab8", "#e8eef8"], far: "#c8d4e6", near: "#8a9cb8", ground: "#f4f7fb", light: "#ffffff", platform: ["#ffffff", "#c2cee0"] },
};

function ridge(rng: Rng, w: number, h: number, base: number, amp: number, step: number, sharp = false): string {
  let d = `M0 ${h} L0 ${base}`;
  for (let x = 0; x <= w; x += step) {
    const y = base - rng.next() * amp;
    d += sharp ? ` L${x} ${y}` : ` Q${x - step / 2} ${y - amp * 0.3} ${x} ${y}`;
  }
  return `${d} L${w} ${h} Z`;
}

function trees(rng: Rng, w: number, base: number, count: number, size: number): string {
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = rng.next() * w;
    const s = size * (0.6 + rng.next() * 0.7);
    d += `M${x} ${base - s * 2.2} L${x - s * 0.7} ${base - s * 0.6} L${x - s * 0.35} ${base - s * 0.6} L${x - s} ${base} L${x + s} ${base} L${x + s * 0.35} ${base - s * 0.6} L${x + s * 0.7} ${base - s * 0.6} Z `;
  }
  return d;
}

function pillars(w: number, base: number, count: number, height: number, width: number): string {
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) / count) * w;
    d += `M${x - width / 2} ${base} L${x - width / 2} ${base - height} L${x - width * 0.7} ${base - height} L${x - width * 0.7} ${base - height - 8} L${x + width * 0.7} ${base - height - 8} L${x + width * 0.7} ${base - height} L${x + width / 2} ${base - height} L${x + width / 2} ${base} Z `;
  }
  return d;
}

function stalactites(rng: Rng, w: number, count: number, len: number): string {
  let d = `M0 0 L${w} 0 L${w} 10 `;
  for (let i = count; i >= 0; i--) {
    const x = (i / count) * w;
    d += `L${x + 12} 10 L${x} ${10 + len * (0.4 + rng.next())} L${x - 12} 10 `;
  }
  return d + "L0 10 Z";
}

function blocks(rng: Rng, w: number, base: number, count: number, maxH: number): string {
  let d = "";
  let x = 0;
  for (let i = 0; i < count && x < w; i++) {
    const bw = 40 + rng.next() * 90;
    const bh = maxH * (0.3 + rng.next() * 0.7);
    d += `M${x} ${base} L${x} ${base - bh} L${x + bw} ${base - bh} L${x + bw} ${base} Z `;
    if (rng.chance(0.4)) d += `M${x + bw * 0.3} ${base - bh} L${x + bw * 0.3} ${base - bh - 40} L${x + bw * 0.4} ${base - bh - 40} L${x + bw * 0.4} ${base - bh} Z `;
    x += bw + rng.next() * 30;
  }
  return d;
}

function silhouettes(biome: Biome, rng: Rng, w: number, h: number): { far: string; near: string; top?: string } {
  switch (biome) {
    case "forest": return { far: ridge(rng, w, h, h * 0.62, 60, 120) + trees(rng, w, h * 0.66, 14, 34), near: trees(rng, w, h * 0.92, 10, 60) };
    case "cave": return { far: ridge(rng, w, h, h * 0.72, 70, 90, true), near: ridge(rng, w, h, h * 0.88, 50, 70, true), top: stalactites(rng, w, 14, 70) };
    case "coast": case "abyss": return { far: ridge(rng, w, h, h * 0.58, 30, 160), near: ridge(rng, w, h, h * 0.8, 14, 60) };
    case "sky": return { far: ridge(rng, w, h, h * 0.8, 50, 140), near: ridge(rng, w, h, h * 0.95, 24, 90) };
    case "hideout": case "foundry": case "frigate": case "power": return { far: blocks(rng, w, h * 0.7, 18, h * 0.35), near: blocks(rng, w, h * 0.92, 12, h * 0.2) };
    case "dojo": case "arena": case "league": return { far: pillars(w, h * 0.72, 7, h * 0.42, 34), near: ridge(rng, w, h, h * 0.9, 6, 200) };
    case "tower": case "shadow": return { far: pillars(w, h * 0.75, 5, h * 0.55, 50) + ridge(rng, w, h, h * 0.75, 20, 100), near: ridge(rng, w, h, h * 0.92, 30, 70, true) };
    case "volcano": return { far: `M0 ${h} L${w * 0.2} ${h * 0.55} L${w * 0.4} ${h * 0.3} L${w * 0.48} ${h * 0.32} L${w * 0.68} ${h * 0.58} L${w} ${h * 0.5} L${w} ${h} Z`, near: ridge(rng, w, h, h * 0.86, 40, 80, true) };
    case "sanctum": case "space": return { far: ridge(rng, w, h, h * 0.85, 40, 160), near: ridge(rng, w, h, h * 0.96, 16, 120) };
    case "ice": case "summit": return { far: ridge(rng, w, h, h * 0.6, 160, 110, true), near: ridge(rng, w, h, h * 0.86, 60, 80, true) };
    case "desert": return { far: ridge(rng, w, h, h * 0.68, 50, 260) + `M${w * 0.62} ${h * 0.68} L${w * 0.72} ${h * 0.46} L${w * 0.82} ${h * 0.68} Z`, near: ridge(rng, w, h, h * 0.88, 40, 220) };
    case "marsh": return { far: ridge(rng, w, h, h * 0.72, 30, 120), near: trees(rng, w, h * 0.95, 30, 14) };
    case "den": return { far: ridge(rng, w, h, h * 0.55, 200, 90, true), near: ridge(rng, w, h, h * 0.85, 80, 70, true) };
  }
}

/** Full-bleed backdrop for exploration screens. */
export function Scenery({ biome, seed = 1, children, dim = 0 }: { biome: Biome; seed?: number; children?: ReactNode; dim?: number }) {
  const pal = PALETTES[biome];
  const W = 1600, H = 900;
  const shapes = useMemo(() => silhouettes(biome, new Rng(seed), W, H), [biome, seed]);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(180deg, ${pal.sky[0]} 0%, ${pal.sky[1]} 55%, ${pal.sky[2]} 100%)` }}>
      {/* Key light */}
      <div className="absolute -top-1/4 left-1/2 h-[90%] w-[90%] -translate-x-1/2 rounded-full opacity-40 blur-3xl" style={{ background: `radial-gradient(closest-side, ${pal.light}, transparent)`, animation: "pulse-glow 6s ease-in-out infinite" }} />
      {/* Light shafts */}
      <div className="absolute inset-0 opacity-[0.12] mix-blend-screen" style={{ background: `repeating-linear-gradient(105deg, transparent 0 80px, ${pal.light} 80px 120px, transparent 120px 260px)` }} />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <path d={shapes.far} fill={pal.far} opacity={0.85} />
        <path d={shapes.near} fill={pal.near} />
        {shapes.top && <path d={shapes.top} fill={pal.near} />}
      </svg>
      {children}
      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${0.55 + dim}) 100%)` }} />
    </div>
  );
}
