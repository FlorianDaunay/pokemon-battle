import type { OwnedPokemon } from "./pokemon";
import { createPokemon, healFully } from "./pokemon";
import { Rng, randomSeed } from "./rng";

export const SAVE_VERSION = 1;

export interface RunState {
  floor: number;
  /** Index of the current step (doors); STEPS_PER_FLOOR is the boss. */
  step: number;
  /** Room ids chosen so far on this floor. */
  path: string[];
  /** Room being played (chosen but not resolved). */
  current: string | null;
  startedAt: number;
  /** Money earned during this run. */
  earned: number;
}

export interface Stats {
  battlesWon: number;
  trainersDefeated: number;
  wildDefeated: number;
  caught: number;
  shiniesSeen: number;
  shiniesCaught: number;
  evolutions: number;
  moneyEarned: number;
  moneySpent: number;
  floorsCleared: number;
  blackouts: number;
  flawlessBosses: number;
  /** Times each trainer was beaten. */
  defeated: Record<string, number>;
  /** Weathers a battle was won in. */
  weatherWins: string[];
}

export interface QuestState {
  done: boolean;
  claimed: boolean;
}

export interface SaveData {
  version: number;
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  updatedAt: number;
  playTimeMs: number;
  money: number;
  party: OwnedPokemon[];
  box: OwnedPokemon[];
  bag: Record<string, number>;
  dex: { seen: string[]; caught: string[] };
  progress: {
    /** Highest floor reached. */
    best: number;
    /** Floor the next run starts from (the floor you lost on, or the next uncleared one). */
    checkpoint: number;
    /** The main climb (floor 30) has been beaten. */
    cleared: boolean;
    runs: number;
  };
  /** Per floor: the seed it was generated from and the rooms already claimed (items, catches). */
  floors: Record<string, { seed: number; claimed: string[] }>;
  run: RunState | null;
  quests: Record<string, QuestState>;
  achievements: Record<string, number>;
  stats: Stats;
  /** Journal entries read. */
  lore: string[];
  flags: Record<string, boolean>;
  legendsCaught: string[];
}

export const emptyStats = (): Stats => ({
  battlesWon: 0, trainersDefeated: 0, wildDefeated: 0, caught: 0, shiniesSeen: 0, shiniesCaught: 0, evolutions: 0,
  moneyEarned: 0, moneySpent: 0, floorsCleared: 0, blackouts: 0, flawlessBosses: 0, defeated: {}, weatherWins: [],
});

export const STARTERS = [
  "bulbasaur", "charmander", "squirtle", "chikorita", "cyndaquil", "totodile", "treecko", "torchic", "mudkip",
  "turtwig", "chimchar", "piplup", "snivy", "tepig", "oshawott", "pikachu", "eevee",
];

export function newSave(name: string, avatar: string, starter: string, seed = randomSeed()): SaveData {
  const rng = new Rng(seed);
  const now = Date.now();
  const mon = createPokemon({ species: starter, level: 5, rng, ivs: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 }, metFloor: 0 });
  // A starter's odds of being shiny are the same as anywhere in the Spire.
  mon.shiny = rng.chance(1 / 256);
  return normalizeSave({
    version: SAVE_VERSION,
    id: rng.fork().toString(36) + now.toString(36),
    name: name.trim().slice(0, 12) || "Trainer",
    avatar,
    createdAt: now,
    updatedAt: now,
    playTimeMs: 0,
    money: 3000,
    party: [mon],
    box: [],
    bag: { pokeball: 5, potion: 3 },
    dex: { seen: [starter], caught: [starter] },
    progress: { best: 0, checkpoint: 1, cleared: false, runs: 0 },
    floors: {},
    run: null,
    quests: {},
    achievements: {},
    stats: emptyStats(),
    lore: [],
    flags: {},
    legendsCaught: [],
  });
}

/** Fills in anything missing (saves from older versions, hand-edited or imported files). */
export function normalizeSave(raw: unknown): SaveData {
  const s = (raw ?? {}) as Partial<SaveData>;
  if (!s.id || !Array.isArray(s.party)) throw new Error("save.invalid");
  const out: SaveData = {
    version: SAVE_VERSION,
    id: String(s.id),
    name: s.name ?? "Trainer",
    avatar: s.avatar ?? "hilbert",
    createdAt: s.createdAt ?? Date.now(),
    updatedAt: s.updatedAt ?? Date.now(),
    playTimeMs: s.playTimeMs ?? 0,
    money: Math.max(0, Math.floor(s.money ?? 0)),
    party: s.party.slice(0, 6),
    box: s.box ?? [],
    bag: { ...(s.bag ?? {}) },
    dex: { seen: s.dex?.seen ?? [], caught: s.dex?.caught ?? [] },
    progress: { best: 0, checkpoint: 1, cleared: false, runs: 0, ...(s.progress ?? {}) },
    floors: s.floors ?? {},
    run: s.run ?? null,
    quests: s.quests ?? {},
    achievements: s.achievements ?? {},
    stats: { ...emptyStats(), ...(s.stats ?? {}) },
    lore: s.lore ?? [],
    flags: s.flags ?? {},
    legendsCaught: s.legendsCaught ?? [],
  };
  for (const p of [...out.party, ...out.box]) {
    p.moves = (p.moves ?? []).slice(0, 4).map((m) => ({ id: m.id, pp: m.pp ?? 5, ups: m.ups ?? 0 }));
    p.evs ??= { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    p.ivs ??= { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 };
    p.ball ??= "pokeball";
    p.personality ??= 0;
    p.metFloor ??= 0;
    if (typeof p.hp !== "number") healFully(p);
  }
  if (!out.party.length && out.box.length) out.party.push(out.box.shift()!);
  return out;
}

export function addItem(save: SaveData, id: string, count = 1): void {
  save.bag[id] = (save.bag[id] ?? 0) + count;
  if (save.bag[id] <= 0) delete save.bag[id];
}

export function hasItem(save: SaveData, id: string): boolean {
  return (save.bag[id] ?? 0) > 0;
}

export function registerSeen(save: SaveData, species: string): void {
  if (!save.dex.seen.includes(species)) save.dex.seen.push(species);
}

export function registerCaught(save: SaveData, species: string): void {
  registerSeen(save, species);
  if (!save.dex.caught.includes(species)) save.dex.caught.push(species);
}

/** Adds a Pokémon to the party, or the box when the party is full. Returns where it went. */
export function receivePokemon(save: SaveData, p: OwnedPokemon): "party" | "box" {
  registerCaught(save, p.species);
  if (save.party.length < 6) {
    save.party.push(p);
    return "party";
  }
  save.box.push(p);
  return "box";
}
