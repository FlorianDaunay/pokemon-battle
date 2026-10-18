import type { WeatherId } from "../battle/engine";
import { PLAYABLE_SPECIES, speciesMeta, stageForLevel } from "../dex";
import { ITEMS } from "../items";
import { Rng, hashString } from "../rng";
import { LAST_MAIN_FLOOR, MAIN_FLOORS, THEMES, themeById } from "./themes";
import type { ThemeDef } from "./themes";
import { TRAINERS } from "./trainers";

export type RoomKind = "trainer" | "wild" | "item" | "rest" | "merchant" | "legend" | "boss";

export interface Room {
  id: string;
  kind: RoomKind;
  level: number;
  seed: number;
  trainer?: string;
  /** Trainer rooms: a double battle (two Pokémon a side). */
  double?: boolean;
  /** Tag battles: the second trainer, fighting alongside `trainer` with their own team. */
  partner?: string;
  species?: string;
  shiny?: boolean;
  /** Item choices (item room) or stock (merchant). */
  items?: string[];
  /** Money offered as an alternative in item rooms. */
  money?: number;
  weather?: WeatherId;
}

export interface Floor {
  n: number;
  theme: ThemeDef;
  /** Steps of door choices; the last step is the boss alone. */
  steps: Room[][];
  /** Trainers the Apex mixes in (main floors use the theme's list). */
  trainers: string[];
}

export const STEPS_PER_FLOOR = 5;
/** First floors where double battles, then tag battles (two trainers), show up. */
export const DOUBLE_FROM = 5;
export const TAG_FROM = 8;
/** Tate & Liza always fight double battles. */
const TWINS = "tateandliza";
export const BASE_SHINY_RATE = 1 / 256;

/** Level of the wild Pokémon and trainers on a floor. Floor 30 ≈ 75, the Apex reaches 100 by floor 43. */
export function floorLevel(n: number): number {
  if (n <= LAST_MAIN_FLOOR) return Math.round(5 + ((n - 1) * 70) / (LAST_MAIN_FLOOR - 1));
  return Math.min(100, 75 + (n - LAST_MAIN_FLOOR) * 2);
}

export function themeForFloor(n: number, seed: number): ThemeDef {
  if (n <= LAST_MAIN_FLOOR) return themeById(MAIN_FLOORS[n - 1]);
  return new Rng(seed ^ 0x7a3e).pick(THEMES);
}

const APEX_TRAINERS = TRAINERS.filter((t) => t.cls !== "legend").map((t) => t.id);
const APEX_BOSSES = TRAINERS.filter((t) => t.cls === "champion" || t.cls === "legend" || t.cls === "boss").map((t) => t.id);

export interface FloorContext {
  shinyRate: number;
  /** Legendaries already caught never show up again. */
  caughtLegends: string[];
}

function lootTable(n: number): [string, number][] {
  const out: [string, number][] = [];
  for (const it of ITEMS) {
    if (it.category === "key" || it.price === 0) continue;
    if ((it.unlock ?? 0) > n + 4) continue;
    const w =
      it.category === "ball" ? 6 :
      it.category === "medicine" ? 7 :
      it.category === "berry" ? 4 :
      it.category === "held" ? 3 :
      it.category === "evolution" ? 3 :
      it.category === "training" ? (it.id === "rarecandy" ? 6 : 1.5) :
      2;
    out.push([it.id, w]);
  }
  return out;
}

function pickDistinct(rng: Rng, table: [string, number][], count: number): string[] {
  const picked: string[] = [];
  let guard = 0;
  while (picked.length < count && guard++ < 50) {
    const id = rng.weighted(table);
    if (!picked.includes(id)) picked.push(id);
  }
  return picked;
}

function rollWeather(theme: ThemeDef, rng: Rng): WeatherId | undefined {
  return theme.weather && rng.chance(theme.weatherChance ?? 1) ? theme.weather : undefined;
}

function wildSpecies(theme: ThemeDef, level: number, rng: Rng): string {
  const base = rng.pick(theme.pool.filter((s) => PLAYABLE_SPECIES.includes(s)));
  return stageForLevel(base, level, (opts) => rng.pick(opts));
}

/**
 * Builds a floor from its seed. The same seed (kept in the save) always gives the same floor:
 * same rooms, same trainers' teams, same shinies.
 */
export function generateFloor(n: number, seed: number, ctx: FloorContext): Floor {
  const rng = new Rng(seed);
  const theme = themeForFloor(n, seed);
  const apex = n > LAST_MAIN_FLOOR;
  const base = floorLevel(n);
  const trainers = apex ? rng.shuffle(APEX_TRAINERS).slice(0, 5) : rng.shuffle(theme.trainers.filter((t) => t !== theme.boss));
  if (!trainers.length) trainers.push(...theme.trainers);
  let trainerCursor = 0;
  const loot = lootTable(n);
  const legends = theme.legends.filter((l) => !ctx.caughtLegends.includes(l) && PLAYABLE_SPECIES.includes(l));
  let legendPlaced = false;
  let merchantPlaced = false;

  const steps: Room[][] = [];
  for (let step = 0; step < STEPS_PER_FLOOR; step++) {
    const doors = step === 0 ? 2 : rng.chance(0.65) ? 3 : 2;
    const level = Math.min(100, base + Math.floor(step / 2));
    const rooms: Room[] = [];
    const kinds: RoomKind[] = [];
    for (let d = 0; d < doors; d++) {
      const weights: [RoomKind, number][] = [
        ["trainer", 34],
        ["wild", 30],
        ["item", 18],
        ["rest", step === 0 || kinds.includes("rest") ? 0 : 8],
        ["merchant", merchantPlaced || step < 1 ? 0 : 5],
      ];
      let kind = rng.weighted(weights);
      // The first room of the early floors always offers a catch, so a lone starter gets company.
      if (n <= 3 && step === 0 && d === 0) kind = "wild";
      // Two identical doors are dull: re-roll once.
      if (kinds.includes(kind) && kind !== "trainer") kind = rng.weighted(weights);
      if (!legendPlaced && legends.length && n >= 12 && step >= 2 && rng.chance(apex ? 0.12 : 0.07)) kind = "legend";
      kinds.push(kind);
      const roomSeed = rng.fork();
      const roomRng = new Rng(roomSeed);
      const room: Room = { id: `${n}-${step}-${d}`, kind, level, seed: roomSeed };
      switch (kind) {
        case "trainer": {
          room.trainer = trainers[trainerCursor++ % trainers.length];
          room.weather = rollWeather(theme, roomRng);
          // Its own sequence, so adding doubles left every existing floor as it was.
          const fmt = new Rng(roomSeed ^ 0xd0b1e);
          const partners = trainers.filter((t) => t !== room.trainer);
          if (room.trainer === TWINS) room.double = true;
          else if (n >= DOUBLE_FROM && fmt.chance(apex ? 0.3 : 0.2)) {
            room.double = true;
            if (n >= TAG_FROM && partners.length && fmt.chance(0.45)) room.partner = fmt.pick(partners);
          }
          break;
        }
        case "wild": {
          const lvl = Math.max(2, level - 1 + roomRng.int(0, 2));
          room.level = Math.min(100, lvl);
          room.species = wildSpecies(theme, room.level, roomRng);
          room.shiny = new Rng(roomSeed ^ 0x5e1f).chance(ctx.shinyRate);
          room.weather = rollWeather(theme, roomRng);
          break;
        }
        case "legend":
          legendPlaced = true;
          room.species = roomRng.pick(legends);
          room.level = Math.min(100, Math.max(level + 3, 40));
          room.shiny = new Rng(roomSeed ^ 0x5e1f).chance(ctx.shinyRate);
          room.weather = rollWeather(theme, roomRng);
          break;
        case "item":
          room.items = pickDistinct(roomRng, loot, 3);
          room.money = Math.round((150 + base * 18) / 10) * 10;
          break;
        case "merchant":
          merchantPlaced = true;
          room.items = pickDistinct(roomRng, lootTable(n + 6).filter(([id]) => !["pokeball", "potion"].includes(id)), 5);
          break;
        case "rest":
          break;
      }
      rooms.push(room);
    }
    steps.push(rooms);
  }

  const bossSeed = rng.fork();
  const bossId = apex ? new Rng(bossSeed).pick(APEX_BOSSES) : theme.boss;
  steps.push([{ id: `${n}-boss`, kind: "boss", level: Math.min(100, base + 3), seed: bossSeed, trainer: bossId, double: bossId === TWINS || undefined, weather: rollWeather(theme, new Rng(bossSeed ^ 1)) }]);
  return { n, theme, steps, trainers };
}

/** Prize money for beating a trainer room. */
export function trainerReward(level: number, cls: string, boss: boolean): number {
  const mult = { gym: 1, admin: 0.9, elite: 1.5, champion: 2, boss: 1.8, rival: 1.3, legend: 2.5 }[cls] ?? 1;
  return Math.round((level * 24 * mult * (boss ? 2 : 1)) / 10) * 10;
}

/** Deterministic seed for a floor of a save, created the first time the floor is visited. */
export function newFloorSeed(saveId: string, n: number, salt: number): number {
  return hashString(`${saveId}:${n}:${salt}`);
}

export function isLegendary(id: string): boolean {
  return speciesMeta(id).legendary;
}
