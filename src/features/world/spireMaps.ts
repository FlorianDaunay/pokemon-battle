import { composeMap, loadBlocks, renderCells } from "./emerald";
import type { Io, RenderedMap, Stamp } from "./emerald";

/**
 * The Spire's maps, cut out of real Emerald rooms on odd widths so everything centres:
 * a hall with exactly as many curtains as there are doors, and themed rooms for wild Pokémon.
 */

export interface Place {
  /** Map key (see useEmerald's BUILT) or an Emerald layout name. */
  map: string;
  spawn: { x: number; y: number };
  exit: { x: number; y: number };
  /** Where what the room holds stands. */
  spot: { x: number; y: number };
  /** The way on, for rooms already emptied. */
  way: { x: number; y: number };
}

// ---------------------------------------------------------------------------------------------
// Hall: Battle Pike's three-path room, one 3-wide curtain per door between 1-wide pillars.

const PIKE_HALL = "BattleFrontier_BattlePikeThreePathRoom";
export const HALL_H = 11;
export const HALL_DOOR_Y = 3;
export const hallWidth = (doors: number) => doors * 4 + 1;
export const hallMid = (doors: number) => (hallWidth(doors) - 1) / 2;
/** Door cells (x) of a hall with `doors` curtains. */
export const hallDoors = (doors: number) => Array.from({ length: doors }, (_, i) => 2 + i * 4);

export async function buildHall(io: Io, doors: number): Promise<RenderedMap> {
  const { info, cells } = await loadBlocks(io, PIKE_HALL);
  // Source columns: left edge 0, curtains 1–3 / 5–7 / 9–11, pillars 4 and 8, right edge 12.
  const units = doors === 1 ? [[5, 6, 7]] : doors === 2 ? [[1, 2, 3], [9, 10, 11]] : [[1, 2, 3], [5, 6, 7], [9, 10, 11]];
  const columns = [0];
  units.forEach((u, i) => columns.push(...u, i < units.length - 1 ? (i === 0 ? 4 : 8) : 12));
  const W = columns.length;
  const out = new Uint16Array(W * HALL_H);
  for (let y = 0; y < HALL_H; y++) {
    // The bottom two rows are plain floor (the original's are off-centre).
    const sy = Math.min(y, 8);
    columns.forEach((sx, x) => (out[y * W + x] = cells[sy * info.width + sx]));
  }
  return renderCells(io, PIKE_HALL, W, HALL_H, out);
}

export function hallPlace(doors: number): Omit<Place, "spot" | "way"> {
  const mid = hallMid(doors);
  return { map: `hall-${doors}`, spawn: { x: mid, y: HALL_H - 2 }, exit: { x: mid, y: HALL_H - 1 } };
}

// ---------------------------------------------------------------------------------------------
// Rooms

/** Battle Pike's small room, for trainers, treasure, rest and the merchant. */
export const PIKE_ROOM: Place = { map: "BattleFrontier_BattlePikeRoomNormal", spawn: { x: 4, y: 6 }, exit: { x: 4, y: 7 }, spot: { x: 4, y: 4 }, way: { x: 4, y: 3 } };

/** A Regi chamber (Island Cave's lower room), 17 wide. */
export const CHAMBER: Place = { map: "chamber", spawn: { x: 8, y: 8 }, exit: { x: 8, y: 9 }, spot: { x: 8, y: 4 }, way: { x: 8, y: 0 } };
export function buildChamber(io: Io): Promise<RenderedMap> {
  return composeMap(io, "IslandCave", 17, 10, [8, 21], [{ from: [0, 20, 17, 10], to: [0, 0] }]);
}

/** A clearing in Petalburg Woods, 11 wide, ringed with trees. */
export const CLEARING: Place = { map: "clearing", spawn: { x: 5, y: 7 }, exit: { x: 5, y: 8 }, spot: { x: 5, y: 4 }, way: { x: 5, y: 1 } };
export function buildClearing(io: Io): Promise<RenderedMap> {
  const W = 11, H = 9;
  const GRASS: Stamp["from"] = [14, 8, 1, 1];
  const stamps: Stamp[] = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) stamps.push({ from: [0, 2, 2, 2], to: [x, y] });
  // The clearing: 7 wide in the middle, with a path out at the front and the back.
  for (let y = 2; y < H - 1; y++) for (let x = 2; x < W - 2; x++) stamps.push({ from: GRASS, to: [x, y] });
  stamps.push({ from: GRASS, to: [5, H - 1] }, { from: GRASS, to: [5, 1] });
  return composeMap(io, "PetalburgWoods", W, H, [14, 8], stamps);
}

/** The Elite Four's rooms, for floor guardians. */
export const ARENAS = ["EverGrandeCity_SidneysRoom", "EverGrandeCity_PhoebesRoom", "EverGrandeCity_GlaciasRoom", "EverGrandeCity_DrakesRoom"];
export const ARENA: Omit<Place, "map"> = { spawn: { x: 6, y: 12 }, exit: { x: 6, y: 13 }, spot: { x: 6, y: 5 }, way: { x: 6, y: 2 } };

const FOREST_TYPES = new Set(["Grass", "Bug", "Normal"]);

/** The room a wild Pokémon waits in, from its first type, with a colour wash for the chamber. */
export function wildRoom(type: string): { place: Place; filter?: string } {
  if (FOREST_TYPES.has(type)) return { place: CLEARING };
  const WASH: Record<string, string> = {
    Water: "hue-rotate(170deg) saturate(1.3)",
    Ice: "hue-rotate(160deg) saturate(0.6) brightness(1.25)",
    Fire: "hue-rotate(-25deg) saturate(1.8)",
    Electric: "hue-rotate(20deg) saturate(1.6) brightness(1.1)",
    Psychic: "hue-rotate(290deg) saturate(1.2)",
    Ghost: "hue-rotate(230deg) saturate(0.9) brightness(0.75)",
    Dark: "saturate(0.4) brightness(0.6)",
    Dragon: "hue-rotate(210deg) saturate(1.4) brightness(0.9)",
    Steel: "saturate(0.15) brightness(1.15)",
    Poison: "hue-rotate(250deg) saturate(1.3) brightness(0.85)",
    Flying: "hue-rotate(180deg) saturate(0.7) brightness(1.3)",
    Fighting: "hue-rotate(-10deg) saturate(1.3)",
  };
  return { place: CHAMBER, filter: WASH[type] };
}
