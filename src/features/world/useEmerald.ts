import { useEffect, useState } from "react";
import { EMERALD, loadMapEvents, loadSprite, renderLayout } from "./emerald";
import type { Io, MapEvents, RenderedMap } from "./emerald";
import { buildChamber, buildClearing, buildHall } from "./spireMaps";

/** Browser side: fetch from GitHub (HTTP-cached), inflate with the native stream. */
async function fetchBytes(path: string): Promise<Uint8Array> {
  const r = await fetch(`${EMERALD}/${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return new Uint8Array(await r.arrayBuffer());
}

export const browserIo: Io = {
  bytes: fetchBytes,
  text: async (p) => new TextDecoder().decode(await fetchBytes(p)),
  inflate: async (data) => {
    const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  },
};

function toUrl(rgba: Uint8ClampedArray, w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  return canvas.toDataURL();
}

export interface WorldMap {
  width: number;
  height: number;
  blocked: boolean[];
  behavior: number[];
  below: string;
  above: string;
}

/** Metatile behaviours the game cares about. */
export const MB_TALL_GRASS = 0x02;

const maps = new Map<string, Promise<WorldMap>>();

/** Maps built by the game rather than read as they are. */
const BUILT: Record<string, (io: Io) => Promise<RenderedMap>> = {
  "hall-1": (io) => buildHall(io, 1),
  "hall-2": (io) => buildHall(io, 2),
  "hall-3": (io) => buildHall(io, 3),
  chamber: buildChamber,
  clearing: buildClearing,
};

/** A real Emerald map (a layout name, or a built one) as two images plus its collisions. */
export function loadWorldMap(layout: string): Promise<WorldMap> {
  const key = layout;
  if (!maps.has(key)) {
    const render = BUILT[layout] ? BUILT[layout](browserIo) : renderLayout(browserIo, layout);
    maps.set(key, render.then((m: RenderedMap) => ({
      width: m.width,
      height: m.height,
      blocked: m.blocked,
      behavior: m.behavior,
      below: toUrl(m.below, m.width * 16, m.height * 16),
      above: toUrl(m.above, m.width * 16, m.height * 16),
    })).catch((e) => { maps.delete(key); throw e; }));
  }
  return maps.get(key)!;
}

export function useWorldMap(layout: string): { map: WorldMap | null; error: boolean; retry: () => void } {
  const [map, setMap] = useState<WorldMap | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setMap(null);
    setError(false);
    loadWorldMap(layout).then((m) => alive && setMap(m)).catch(() => alive && setError(true));
    return () => void (alive = false);
  }, [layout, attempt]);
  return { map, error, retry: () => setAttempt((a) => a + 1) };
}

export function useMapEvents(map: string): MapEvents | null {
  const [ev, setEv] = useState<MapEvents | null>(null);
  useEffect(() => {
    let alive = true;
    loadMapEvents(browserIo, map).then((e) => alive && setEv(e)).catch(() => {});
    return () => void (alive = false);
  }, [map]);
  return ev;
}

export interface SpriteImage {
  url: string;
  fw: number;
  fh: number;
  frames: number;
}

const sprites = new Map<string, Promise<SpriteImage>>();

export function loadSpriteImage(pic: string, fw = 16, fh = 32): Promise<SpriteImage> {
  const key = `${pic}:${fw}x${fh}`;
  if (!sprites.has(key)) {
    sprites.set(key, loadSprite(browserIo, pic, fw, fh).then((s) => ({ url: toUrl(s.rgba, s.width, s.height), fw: s.fw, fh: s.fh, frames: s.frames })).catch((e) => { sprites.delete(key); throw e; }));
  }
  return sprites.get(key)!;
}

export function useSpriteImage(pic: string, fw = 16, fh = 32): SpriteImage | null {
  const [img, setImg] = useState<SpriteImage | null>(null);
  useEffect(() => {
    let alive = true;
    loadSpriteImage(pic, fw, fh).then((s) => alive && setImg(s)).catch(() => {});
    return () => void (alive = false);
  }, [pic, fw, fh]);
  return img;
}

/** Warms the cache for the maps used by the camp and the Spire. */
export function preloadWorld(layouts: string[]): void {
  for (const l of layouts) void loadWorldMap(l).catch(() => {});
}
