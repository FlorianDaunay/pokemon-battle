import { composeMap } from "./emerald";
import type { Io, RenderedMap, Stamp } from "./emerald";

/**
 * The camp: a new map built from Battle Frontier pieces. Everything is laid out on odd widths
 * around the centre column: a 5-wide avenue from the tower door, 3-wide paths across in front of
 * the doors, and buildings in mirrored pairs.
 */

export const CAMP_W = 31;
export const CAMP_H = 34;
export const CAMP_MID = 15;
const SRC = "BattleFrontier_OutsideEast";

// Pieces of the source map: [x, y, width, height].
const TOWER: Stamp["from"] = [8, 0, 17, 17];
const GRASS: [number, number] = [1, 40];
const PAVING: Stamp["from"] = [8, 45, 1, 1];
const TREE: Stamp["from"] = [18, 57, 1, 2];
const PC: Stamp["from"] = [1, 48, 6, 4];
const SHOP: Stamp["from"] = [21, 48, 6, 4];
const HOUSE_A: Stamp["from"] = [13, 48, 3, 4];
const HOUSE_B: Stamp["from"] = [3, 41, 3, 4];
const PLANTER: Stamp["from"] = [15, 38, 5, 2];
const FLAG: Stamp["from"] = [1, 54, 1, 2];
const SIGN: Stamp["from"] = [13, 17, 1, 1];

const AVENUE = { x: CAMP_MID - 2, w: 5 };
const PATHS = [22, 29]; // first row of each 3-high path

/** Where things are on the camp map (cells). Doors are the cells to bump into. */
export const CAMP = {
  door: { x: CAMP_MID, y: 14 },
  spawn: { x: CAMP_MID, y: 18 },
  tutor: { x: 5, y: 21 },
  dojo: { x: CAMP_W - 6, y: 21 },
  pc: { x: 4, y: 28 },
  mart: { x: CAMP_W - 7, y: 28 },
  quests: { x: AVENUE.x - 1, y: 17 },
  trophies: { x: AVENUE.x + AVENUE.w, y: 17 },
  journal: { x: CAMP_MID + 1, y: 25 },
  forms: { x: CAMP_MID - 1, y: 25 },
};

/** Repeats a piece over an area. */
function tile(from: Stamp["from"], x0: number, y0: number, w: number, h: number): Stamp[] {
  const out: Stamp[] = [];
  for (let y = y0; y < y0 + h; y += from[3]) for (let x = x0; x < x0 + w; x += from[2]) out.push({ from, to: [x, y] });
  return out;
}

export function buildCamp(io: Io): Promise<RenderedMap> {
  const stamps: Stamp[] = [
    // Woods around the tower and along the edges
    ...tile(TREE, 0, 0, CAMP_MID - 8, 17),
    ...tile(TREE, CAMP_MID + 9, 0, CAMP_W - CAMP_MID - 9, 17),
    ...tile(TREE, 0, 17, 1, CAMP_H - 17),
    ...tile(TREE, CAMP_W - 1, 17, 1, CAMP_H - 17),
    ...tile(TREE, 0, CAMP_H - 2, CAMP_W, 2),
    // Avenue and paths
    ...tile(PAVING, AVENUE.x, 17, AVENUE.w, CAMP_H - 19),
    ...PATHS.flatMap((y) => tile(PAVING, 1, y, CAMP_W - 2, 3)),
    { from: TOWER, to: [CAMP_MID - 8, 0] },
    // Mirrored pairs
    { from: HOUSE_A, to: [4, 18] },
    { from: HOUSE_B, to: [CAMP_W - 7, 18] },
    { from: PC, to: [2, 25] },
    { from: SHOP, to: [CAMP_W - 8, 25] },
    { from: PLANTER, to: [AVENUE.x - 6, 26] },
    { from: PLANTER, to: [AVENUE.x + AVENUE.w + 1, 26] },
    { from: SIGN, to: [CAMP.quests.x, CAMP.quests.y] },
    { from: SIGN, to: [CAMP.trophies.x, CAMP.trophies.y] },
  ];
  // Flags line the avenue in pairs.
  for (const y of [18, 25]) stamps.push({ from: FLAG, to: [AVENUE.x - 1, y] }, { from: FLAG, to: [AVENUE.x + AVENUE.w, y] });
  return composeMap(io, SRC, CAMP_W, CAMP_H, GRASS, stamps);
}
