/**
 * Real Pokémon Emerald maps and overworld sprites, read at runtime from the pret/pokeemerald
 * decompilation (PNG tiles, JASC palettes, metatile and map binaries) and drawn to RGBA images.
 * Pure: the caller supplies `fetch` and a zlib `inflate`, so it runs in the browser and in Node.
 */

export const EMERALD = "https://raw.githubusercontent.com/pret/pokeemerald/master";

export interface Io {
  bytes: (path: string) => Promise<Uint8Array>;
  text: (path: string) => Promise<string>;
  inflate: (data: Uint8Array) => Promise<Uint8Array>;
}

// ---------------------------------------------------------------------------------------------
// PNG (indexed, as the decompilation stores its graphics)

export interface IndexedImage {
  width: number;
  height: number;
  /** One palette index per pixel. */
  pixels: Uint8Array;
  palette: [number, number, number][];
}

function u32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

export async function decodePng(data: Uint8Array, inflate: Io["inflate"]): Promise<IndexedImage> {
  let o = 8;
  let width = 0, height = 0, depth = 8, type = 3;
  const idat: Uint8Array[] = [];
  const palette: [number, number, number][] = [];
  while (o < data.length) {
    const len = u32(data, o);
    const kind = String.fromCharCode(data[o + 4], data[o + 5], data[o + 6], data[o + 7]);
    const body = data.subarray(o + 8, o + 8 + len);
    if (kind === "IHDR") {
      width = u32(body, 0);
      height = u32(body, 4);
      depth = body[8];
      type = body[9];
    } else if (kind === "PLTE") {
      for (let i = 0; i + 2 < body.length; i += 3) palette.push([body[i], body[i + 1], body[i + 2]]);
    } else if (kind === "IDAT") idat.push(body);
    else if (kind === "IEND") break;
    o += 12 + len;
  }
  if (type !== 3 && type !== 0) throw new Error(`Unsupported PNG colour type ${type}`);
  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of idat) {
    joined.set(c, p);
    p += c.length;
  }
  const raw = await inflate(joined);
  const stride = Math.ceil((width * depth) / 8);
  const bpp = Math.max(1, depth / 8);
  const rows = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = rows.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[x] = v & 0xff;
    }
    prev = out;
  }
  const pixels = new Uint8Array(width * height);
  const perByte = 8 / depth;
  const mask = (1 << depth) - 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byte = rows[y * stride + Math.floor(x / perByte)];
      const shift = 8 - depth * ((x % perByte) + 1);
      pixels[y * width + x] = (byte >> shift) & mask;
    }
  }
  return { width, height, pixels, palette };
}

export function parsePal(text: string): [number, number, number][] {
  return text.split(/\r?\n/).slice(3).filter((l) => l.trim()).map((l) => l.trim().split(/\s+/).map(Number) as [number, number, number]);
}

// ---------------------------------------------------------------------------------------------
// Tilesets and maps

export interface Tileset {
  tiles: IndexedImage;
  /** 16 palettes; the primary tileset owns 0–5, the secondary 6–12. */
  palettes: [number, number, number][][];
  metatiles: Uint16Array;
  attributes: Uint16Array;
}

const PRIMARY_TILES = 512;
const PRIMARY_METATILES = 512;

/** gTileset_BattlePike → data/tilesets/secondary/battle_pike */
export function tilesetPath(name: string, primary: boolean): string {
  const snake = name.replace(/^gTileset_/, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return `data/tilesets/${primary ? "primary" : "secondary"}/${snake}`;
}

function u16s(b: Uint8Array): Uint16Array {
  const out = new Uint16Array(b.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = b[i * 2] | (b[i * 2 + 1] << 8);
  return out;
}

const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, make: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, make().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key) as Promise<T>;
}

export function loadTileset(io: Io, dir: string): Promise<Tileset> {
  return once(`ts:${dir}`, async () => {
    const [png, meta, attr, ...pals] = await Promise.all([
      io.bytes(`${dir}/tiles.png`),
      io.bytes(`${dir}/metatiles.bin`),
      io.bytes(`${dir}/metatile_attributes.bin`),
      ...Array.from({ length: 13 }, (_, i) => io.text(`${dir}/palettes/${String(i).padStart(2, "0")}.pal`)),
    ]);
    return { tiles: await decodePng(png, io.inflate), metatiles: u16s(meta), attributes: u16s(attr), palettes: pals.map(parsePal) };
  });
}

export interface LayoutInfo {
  width: number;
  height: number;
  primary: string;
  secondary: string;
  blockdata: string;
}

export function loadLayouts(io: Io): Promise<Record<string, LayoutInfo>> {
  return once("layouts", async () => {
    const json = JSON.parse(await io.text("data/layouts/layouts.json")) as { layouts: { name?: string; width?: number; height?: number; primary_tileset?: string; secondary_tileset?: string; blockdata_filepath?: string }[] };
    const out: Record<string, LayoutInfo> = {};
    for (const l of json.layouts) {
      if (!l.name || !l.blockdata_filepath) continue;
      out[l.name.replace(/_Layout$/, "")] = { width: l.width!, height: l.height!, primary: l.primary_tileset!, secondary: l.secondary_tileset!, blockdata: l.blockdata_filepath };
    }
    return out;
  });
}

export interface RenderedMap {
  /** Size in 16-pixel cells. */
  width: number;
  height: number;
  /** Ground and everything under the player. */
  below: Uint8ClampedArray;
  /** Tops drawn over the player (roofs, tree tops), transparent elsewhere. */
  above: Uint8ClampedArray;
  /** Cells the game marks as impassable. */
  blocked: boolean[];
  /** Metatile behaviour of each cell (tall grass, doors…). */
  behavior: number[];
}

/** Draws one 8×8 tile into an RGBA buffer. */
function blit(dst: Uint8ClampedArray, dstW: number, dx: number, dy: number, ts: Tileset, tile: number, pal: [number, number, number][], hflip: boolean, vflip: boolean, opaque: boolean) {
  const img = ts.tiles;
  const perRow = img.width / 8;
  const tx = (tile % perRow) * 8;
  const ty = Math.floor(tile / perRow) * 8;
  if (ty >= img.height) return;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const sx = tx + (hflip ? 7 - x : x);
      const sy = ty + (vflip ? 7 - y : y);
      const idx = img.pixels[sy * img.width + sx];
      if (idx === 0 && !opaque) continue;
      const c = pal[idx] ?? [0, 0, 0];
      const o = ((dy + y) * dstW + dx + x) * 4;
      dst[o] = c[0];
      dst[o + 1] = c[1];
      dst[o + 2] = c[2];
      dst[o + 3] = 255;
    }
  }
}

/**
 * Renders a map layout. `blocks` optionally replaces the layout's own cells (u16 per cell:
 * metatile id in bits 0–9, collision in bits 10–11), to draw variations of a real room.
 */
export async function renderLayout(io: Io, name: string, edit?: (cells: Uint16Array, width: number, height: number) => void): Promise<RenderedMap> {
  const layouts = await loadLayouts(io);
  const info = layouts[name];
  if (!info) throw new Error(`Unknown layout ${name}`);
  const [primary, secondary, block] = await Promise.all([
    loadTileset(io, tilesetPath(info.primary, true)),
    loadTileset(io, tilesetPath(info.secondary, false)),
    once(`blk:${info.blockdata}`, () => io.bytes(info.blockdata)),
  ]);
  const cells = u16s(block).slice(0, info.width * info.height);
  edit?.(cells, info.width, info.height);
  const palettes = [...primary.palettes.slice(0, 6), ...secondary.palettes.slice(6, 13)];
  const W = info.width * 16;
  const below = new Uint8ClampedArray(W * info.height * 16 * 4);
  const above = new Uint8ClampedArray(W * info.height * 16 * 4);
  const blocked: boolean[] = [];
  const behavior: number[] = [];
  for (let cy = 0; cy < info.height; cy++) {
    for (let cx = 0; cx < info.width; cx++) {
      const cell = cells[cy * info.width + cx];
      const id = cell & 0x3ff;
      blocked.push(((cell >> 10) & 3) !== 0);
      const set = id < PRIMARY_METATILES ? primary : secondary;
      const local = id < PRIMARY_METATILES ? id : id - PRIMARY_METATILES;
      const attr = set.attributes[local] ?? 0;
      behavior.push(attr & 0xff);
      const layerType = attr >> 12; // 0 normal, 1 covered, 2 split
      for (let layer = 0; layer < 2; layer++) {
        const top = layer === 1;
        const dst = top && layerType !== 1 ? above : below;
        for (let i = 0; i < 4; i++) {
          const entry = set.metatiles[local * 8 + layer * 4 + i] ?? 0;
          const tileId = entry & 0x3ff;
          const tiles = tileId < PRIMARY_TILES ? primary : secondary;
          const pal = palettes[(entry >> 12) & 0xf] ?? palettes[0];
          blit(dst, W, cx * 16 + (i % 2) * 8, cy * 16 + (i >> 1) * 8, tiles, tileId < PRIMARY_TILES ? tileId : tileId - PRIMARY_TILES, pal, !!(entry & 0x400), !!(entry & 0x800), !top);
        }
      }
    }
  }
  return { width: info.width, height: info.height, below, above, blocked, behavior };
}

export interface MapEvents {
  objects: { graphics: string; x: number; y: number }[];
  warps: { x: number; y: number; dest: string }[];
  signs: { x: number; y: number }[];
}

/** NPCs, doors and signs of a map (data/maps/<Map>/map.json). */
export function loadMapEvents(io: Io, map: string): Promise<MapEvents> {
  return once(`ev:${map}`, async () => {
    const j = JSON.parse(await io.text(`data/maps/${map}/map.json`)) as { object_events?: { graphics_id: string; x: number; y: number }[]; warp_events?: { x: number; y: number; dest_map: string }[]; bg_events?: { x: number; y: number }[] };
    return {
      objects: (j.object_events ?? []).map((o) => ({ graphics: o.graphics_id, x: o.x, y: o.y })),
      warps: (j.warp_events ?? []).map((w) => ({ x: w.x, y: w.y, dest: w.dest_map })),
      signs: (j.bg_events ?? []).map((b) => ({ x: b.x, y: b.y })),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Overworld sprites

export interface SpriteSheet {
  /** Frame size in pixels. */
  fw: number;
  fh: number;
  frames: number;
  width: number;
  height: number;
  /** RGBA, index 0 transparent. */
  rgba: Uint8ClampedArray;
}

/** An object event picture, e.g. "people/brendan/walking" or "people/hiker". */
export function loadSprite(io: Io, pic: string, fw = 16, fh = 32): Promise<SpriteSheet> {
  return once(`spr:${pic}`, async () => {
    const img = await decodePng(await io.bytes(`graphics/object_events/pics/${pic}.png`), io.inflate);
    const rgba = new Uint8ClampedArray(img.width * img.height * 4);
    for (let i = 0; i < img.pixels.length; i++) {
      const idx = img.pixels[i];
      if (idx === 0) continue;
      const c = img.palette[idx] ?? [0, 0, 0];
      rgba[i * 4] = c[0];
      rgba[i * 4 + 1] = c[1];
      rgba[i * 4 + 2] = c[2];
      rgba[i * 4 + 3] = 255;
    }
    const h = Math.min(fh, img.height);
    return { fw, fh: h, frames: Math.floor(img.width / fw), width: img.width, height: img.height, rgba };
  });
}
