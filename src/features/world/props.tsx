import type { ReactNode } from "react";
import { Standing } from "./Walker";
import type { Look } from "./Walker";
import { useSpriteImage } from "./useEmerald";

/** Labels and markers drawn over the real maps. */

/** A name plate floating over something. */
export function Tag({ children, color = "#ffffff", T, top = -0.42 }: { children: ReactNode; color?: string; T: number; top?: number }) {
  return (
    <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-pill bg-black/70 px-2 py-0.5 font-black leading-tight shadow" style={{ top: top * T, fontSize: Math.max(9, T * 0.24), color }}>
      {children}
    </div>
  );
}

/** "!" or a badge count over an entity. */
export function Bubble({ T, children, top = -0.75 }: { T: number; children: ReactNode; top?: number }) {
  return (
    <div className="pointer-events-none absolute left-1/2 z-20 grid -translate-x-1/2 place-items-center rounded-full bg-white font-black text-danger shadow animate-bob" style={{ top: top * T, width: T * 0.5, height: T * 0.5, fontSize: T * 0.32 }}>
      {children}
    </div>
  );
}

/** A character standing on a cell (feet on it, two cells tall), with an optional name. */
export function Person({ T, look, label, labelColor, badge }: { T: number; look: Look; label?: string; labelColor?: string; badge?: ReactNode }) {
  return (
    <div className="absolute inset-0">
      <Standing look={look} T={T} />
      {label && <Tag T={T} top={-1.42} color={labelColor}>{label}</Tag>}
      {badge ? <Bubble T={T} top={-1.75}>{badge}</Bubble> : null}
    </div>
  );
}

/** A Poké Ball lying on the ground (items). */
export function ItemBall({ T }: { T: number }) {
  const img = useSpriteImage("misc/item_ball", 16, 16);
  if (!img) return null;
  return <img src={img.url} alt="" className="pixel absolute inset-0" style={{ width: T, height: T, imageRendering: "pixelated" }} />;
}

/** A soft glow marking somewhere to go (a door, the way on). */
export function Glow({ color = "rgba(255,220,120,0.65)" }: { color?: string }) {
  return <div className="pointer-events-none absolute inset-[-20%] rounded-full blur-md" style={{ background: `radial-gradient(closest-side, ${color}, transparent)`, animation: "pulse-glow 2s ease-in-out infinite" }} />;
}

/** A label pinned to a cell, e.g. over a door or a sign. */
export function Marker({ T, label, color, badge, glow, top = -0.5 }: { T: number; label: string; color?: string; badge?: number; glow?: string; top?: number }) {
  return (
    <div className="absolute inset-0">
      {glow && <Glow color={glow} />}
      <Tag T={T} top={top} color={color}>{label}</Tag>
      {badge ? <Bubble T={T} top={-1.05}>{badge}</Bubble> : null}
    </div>
  );
}
