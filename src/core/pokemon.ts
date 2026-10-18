import { dex, species, speciesMeta, defaultMoves, levelEvolution, movesLearntAt, STAT_IDS, toID } from "./dex";
import type { StatId, StatTable, EvoContext } from "./dex";
import { Rng } from "./rng";

export type StatusId = "brn" | "par" | "psn" | "tox" | "slp" | "frz";

export interface MoveSlot {
  id: string;
  pp: number;
  /** PP Ups applied (0–3). */
  ups: number;
}

/** A Pokémon the player owns (party or box). Everything the sim needs plus run state. */
export interface OwnedPokemon {
  uid: string;
  species: string;
  nickname?: string;
  level: number;
  /** Total experience points. */
  exp: number;
  nature: string;
  ability: string;
  gender: "M" | "F" | "N";
  shiny: boolean;
  ivs: StatTable;
  evs: StatTable;
  moves: MoveSlot[];
  item?: string;
  /** Current HP; persists between rooms of a floor. */
  hp: number;
  status?: StatusId;
  ball: string;
  /** Floor where it was caught (0 = starter / gift). */
  metFloor: number;
  personality: number;
}

export const zeroStats = (): StatTable => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
export const fullIvs = (): StatTable => ({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });

// ---------------------------------------------------------------------------------------------
// Stats

export function calcStat(stat: StatId, base: number, iv: number, ev: number, level: number, nature: string): number {
  if (stat === "hp") {
    if (base === 1) return 1; // Shedinja
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  }
  const n = dex.natures.get(nature);
  const mult = n.plus === stat ? 1.1 : n.minus === stat ? 0.9 : 1;
  return Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5) * mult);
}

export function statsOf(p: Pick<OwnedPokemon, "species" | "ivs" | "evs" | "level" | "nature">): StatTable {
  const base = species(p.species).baseStats;
  const out = zeroStats();
  for (const s of STAT_IDS) out[s] = calcStat(s, base[s], p.ivs[s], p.evs[s], p.level, p.nature);
  return out;
}

export const maxHp = (p: OwnedPokemon): number => statsOf(p).hp;

// ---------------------------------------------------------------------------------------------
// Experience

/** Total experience needed to reach `level` for a PokeAPI growth rate. */
export function expForLevel(level: number, growth: number): number {
  const n = Math.max(1, Math.min(100, level));
  if (n === 1) return 0;
  const n3 = n ** 3;
  switch (growth) {
    case 1: return Math.floor((5 * n3) / 4);
    case 3: return Math.floor((4 * n3) / 5);
    case 4: return Math.max(0, Math.floor((6 * n3) / 5 - 15 * n * n + 100 * n - 140));
    case 5:
      if (n <= 50) return Math.floor((n3 * (100 - n)) / 50);
      if (n <= 68) return Math.floor((n3 * (150 - n)) / 100);
      if (n <= 98) return Math.floor((n3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n3 * (160 - n)) / 100);
    case 6:
      if (n <= 15) return Math.floor((n3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n <= 36) return Math.floor((n3 * (n + 14)) / 50);
      return Math.floor((n3 * (Math.floor(n / 2) + 32)) / 50);
    default: return n3;
  }
}

export function growthOf(p: Pick<OwnedPokemon, "species">): number {
  return speciesMeta(p.species).growth;
}

/** Progress (0–1) through the current level. */
export function levelProgress(p: OwnedPokemon): number {
  if (p.level >= 100) return 1;
  const g = growthOf(p);
  const lo = expForLevel(p.level, g);
  const hi = expForLevel(p.level + 1, g);
  return Math.max(0, Math.min(1, (p.exp - lo) / (hi - lo)));
}

/**
 * Gen 5 scaled experience for defeating `foe` at `foeLevel`, gained by a Pokémon at `level`.
 * `trainer` adds the 1.5× bonus; `bonus` is the game's own multiplier (Lucky Egg, shared exp...).
 */
export function expGain(foeSpecies: string, foeLevel: number, level: number, trainer: boolean, bonus = 1): number {
  const b = speciesMeta(foeSpecies).baseExp;
  const a = trainer ? 1.5 : 1;
  const base = (a * b * foeLevel) / 5;
  const scale = ((2 * foeLevel + 10) / (foeLevel + level + 10)) ** 2.5;
  return Math.max(1, Math.floor((base * scale + 1) * bonus));
}

// ---------------------------------------------------------------------------------------------
// Creation

export interface CreateOptions {
  species: string;
  level: number;
  rng: Rng;
  shiny?: boolean;
  /** Perfect IVs for bosses and late game. */
  ivs?: StatTable;
  evs?: StatTable;
  nature?: string;
  ability?: string;
  moves?: string[];
  item?: string;
  ball?: string;
  metFloor?: number;
  /** Chance to have the hidden ability. */
  hiddenAbilityChance?: number;
}

let uidCounter = 0;
export function newUid(rng: Rng): string {
  uidCounter = (uidCounter + 1) % 1296;
  return rng.fork().toString(36) + uidCounter.toString(36);
}

function rollGender(id: string, rng: Rng): "M" | "F" | "N" {
  const s = species(id);
  if (s.gender) return s.gender as "M" | "F" | "N";
  return rng.chance(s.genderRatio.M) ? "M" : "F";
}

function rollAbility(id: string, rng: Rng, hiddenChance: number): string {
  const a = species(id).abilities as unknown as Record<string, string | undefined>;
  if (a.H && rng.chance(hiddenChance)) return toID(a.H);
  return toID(a["1"] && rng.chance(0.5) ? a["1"] : a["0"]!);
}

export function createPokemon(o: CreateOptions): OwnedPokemon {
  const { rng } = o;
  const id = toID(o.species);
  const natures = dex.natures.all().map((n) => n.id);
  const ivs = o.ivs ?? {
    hp: rng.int(0, 31), atk: rng.int(0, 31), def: rng.int(0, 31),
    spa: rng.int(0, 31), spd: rng.int(0, 31), spe: rng.int(0, 31),
  };
  const p: OwnedPokemon = {
    uid: newUid(rng),
    species: id,
    level: o.level,
    exp: expForLevel(o.level, speciesMeta(id).growth),
    nature: o.nature ?? rng.pick(natures),
    ability: o.ability ?? rollAbility(id, rng, o.hiddenAbilityChance ?? 0.05),
    gender: rollGender(id, rng),
    shiny: o.shiny ?? false,
    ivs,
    evs: o.evs ?? zeroStats(),
    moves: (o.moves ?? defaultMoves(id, o.level)).slice(0, 4).map((m) => ({ id: toID(m), pp: basePp(m), ups: 0 })),
    item: o.item,
    hp: 0,
    ball: o.ball ?? "pokeball",
    metFloor: o.metFloor ?? 0,
    personality: rng.fork(),
  };
  p.hp = maxHp(p);
  return p;
}

export function basePp(move: string): number {
  return dex.moves.get(move).pp;
}

export function maxPp(slot: MoveSlot): number {
  const m = dex.moves.get(slot.id);
  if (m.noPPBoosts) return m.pp;
  return Math.floor(m.pp * (1 + 0.2 * slot.ups));
}

export function healFully(p: OwnedPokemon): void {
  p.hp = maxHp(p);
  p.status = undefined;
  for (const m of p.moves) m.pp = maxPp(m);
}

export function displayName(p: OwnedPokemon, speciesName: (id: string) => string): string {
  return p.nickname || speciesName(p.species);
}

// ---------------------------------------------------------------------------------------------
// Levelling

export interface LevelUpEvent {
  level: number;
  /** Moves learnt at this level (the UI asks which slot to replace when 4 are known). */
  newMoves: string[];
  /** Species it may now evolve into (the UI offers the evolution, which can be cancelled). */
  evolution: string | null;
}

export function evoContext(p: OwnedPokemon, hour = new Date().getHours()): EvoContext {
  const s = statsOf(p);
  return { gender: p.gender, personality: p.personality, atk: s.atk, def: s.def, hour };
}

/**
 * Adds experience and returns one event per level gained. HP grows with max HP. Does not
 * evolve or learn moves by itself: the caller applies the player's choices.
 */
export function addExp(p: OwnedPokemon, amount: number): LevelUpEvent[] {
  const events: LevelUpEvent[] = [];
  if (p.level >= 100) return events;
  const growth = growthOf(p);
  p.exp = Math.min(p.exp + amount, expForLevel(100, growth));
  while (p.level < 100 && p.exp >= expForLevel(p.level + 1, growth)) {
    const before = maxHp(p);
    p.level++;
    if (p.hp > 0) p.hp += maxHp(p) - before;
    events.push({
      level: p.level,
      newMoves: movesLearntAt(p.species, p.level).filter((m) => !p.moves.some((s) => s.id === m)),
      evolution: levelEvolution(p.species, p.level, evoContext(p)),
    });
  }
  return events;
}

/** Sets a level directly (Rare Candy, test saves), keeping experience consistent. */
export function setLevel(p: OwnedPokemon, level: number): LevelUpEvent[] {
  const growth = growthOf(p);
  const target = expForLevel(level, growth);
  return addExp(p, Math.max(0, target - p.exp));
}

/** Evolves in place: HP keeps the same missing amount, the ability keeps its slot. */
export function evolve(p: OwnedPokemon, into: string): void {
  const from = species(p.species);
  const to = species(into);
  const slot = (Object.entries(from.abilities) as [string, string][]).find(([, a]) => toID(a) === p.ability)?.[0] ?? "0";
  const lost = maxHp(p) - p.hp;
  p.species = to.id;
  const toAbilities = to.abilities as unknown as Record<string, string | undefined>;
  p.ability = toID(toAbilities[slot] ?? toAbilities["0"]!);
  p.hp = Math.max(p.hp > 0 ? 1 : 0, maxHp(p) - lost);
}

export function learnMove(p: OwnedPokemon, move: string, replaceIndex?: number): boolean {
  const id = toID(move);
  if (p.moves.some((m) => m.id === id)) return false;
  const slot = { id, pp: basePp(id), ups: 0 };
  if (p.moves.length < 4) p.moves.push(slot);
  else if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < 4) p.moves[replaceIndex] = slot;
  else return false;
  return true;
}
