import { Dex, toID } from "@pkmn/sim";
import type { Species } from "@pkmn/sim";
import metaJson from "@/data/species-meta.json";

/** Generation 5 data: every species, move, ability and item the game uses comes from here. */
export const dex = Dex.forGen(5);
export { toID };

export type StatId = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export type StatTable = Record<StatId, number>;
export const STAT_IDS: StatId[] = ["hp", "atk", "def", "spa", "spd", "spe"];

export const TYPES = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
  "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel",
] as const;
export type TypeName = (typeof TYPES)[number];

interface SpeciesMeta {
  catchRate: number;
  baseExp: number;
  /** PokeAPI growth rate id: 1 slow, 2 medium, 3 fast, 4 medium-slow, 5 erratic, 6 fluctuating. */
  growth: number;
  legendary: boolean;
}

const META = metaJson as unknown as Record<string, [number, number, number, number]>;

export function species(id: string): Species {
  return dex.species.get(id);
}

export function speciesMeta(id: string): SpeciesMeta {
  const s = species(id);
  const row = META[s.id] ?? META[toID(s.baseSpecies)] ?? [45, 100, 2, 0];
  return { catchRate: row[0], baseExp: row[1], growth: row[2], legendary: row[3] === 1 };
}

/** Species a player can own: Gen 1–5, base formes plus the few formes worth keeping. */
const EXTRA_FORMES = new Set(["rotomheat", "rotomwash", "rotomfrost", "rotomfan", "rotommow", "giratinaorigin", "shayminsky", "tornadustherian", "thundurustherian", "landorustherian", "kyuremblack", "kyuremwhite", "deoxysattack", "deoxysdefense", "deoxysspeed"]);

export const PLAYABLE_SPECIES: string[] = dex.species
  .all()
  .filter((s) => s.num >= 1 && s.num <= 649 && !s.isNonstandard && (!s.forme || EXTRA_FORMES.has(s.id)) && !s.battleOnly)
  .map((s) => s.id);

/** All formes a Pokémon can switch between (base first), or [] when it has only one. */
export function formesOf(id: string): string[] {
  const base = toID(species(id).baseSpecies);
  const list = [base, ...[...EXTRA_FORMES].filter((f) => toID(species(f).baseSpecies) === base)];
  return list.length > 1 ? list : [];
}

/** National Dex number used for sprites (formes have their own PokeAPI ids). */
const FORME_SPRITE_IDS: Record<string, number> = {
  deoxysattack: 10001, deoxysdefense: 10002, deoxysspeed: 10003, rotomheat: 10008, rotomwash: 10009,
  rotomfrost: 10010, rotomfan: 10011, rotommow: 10012, giratinaorigin: 10007, shayminsky: 10006,
  tornadustherian: 10019, thundurustherian: 10020, landorustherian: 10021, kyuremblack: 10022, kyuremwhite: 10023,
};

export function spriteNum(id: string): number {
  return FORME_SPRITE_IDS[toID(id)] ?? species(id).num;
}

// ---------------------------------------------------------------------------------------------
// Learnsets

interface LevelMove {
  level: number;
  move: string;
}

const levelMovesCache = new Map<string, LevelMove[]>();

function learnsetOf(id: string): Record<string, string[]> {
  const s = species(id);
  const data = dex.data.Learnsets as Record<string, { learnset?: Record<string, string[]> }>;
  const own = data[s.id]?.learnset ?? {};
  const baseId = toID(s.changesFrom ?? s.baseSpecies);
  if (baseId === s.id) return own;
  // Formes (Rotom-Wash...) only list their extra moves: merge with the base species.
  const merged: Record<string, string[]> = { ...(data[baseId]?.learnset ?? {}) };
  for (const [move, sources] of Object.entries(own)) merged[move] = [...(merged[move] ?? []), ...sources];
  return merged;
}

function usable(move: string): boolean {
  const m = dex.moves.get(move);
  return m.exists && !m.isNonstandard && m.gen <= 5;
}

/** Gen 5 level-up moves, ordered by level (falls back to Gen 4 data for the rare gaps). */
export function levelUpMoves(id: string): LevelMove[] {
  const key = toID(id);
  const cached = levelMovesCache.get(key);
  if (cached) return cached;
  const out: LevelMove[] = [];
  for (const [move, sources] of Object.entries(learnsetOf(id))) {
    if (!usable(move)) continue;
    const src = sources.find((s) => s.startsWith("5L")) ?? sources.find((s) => s.startsWith("4L"));
    if (src) out.push({ level: Math.max(1, Number(src.slice(2))), move });
  }
  out.sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
  levelMovesCache.set(key, out);
  return out;
}

/** Moves taught by TM/HM or tutor in Gen 5 (what the Move Tutor in the lobby can teach). */
export function teachableMoves(id: string): string[] {
  return Object.entries(learnsetOf(id))
    .filter(([move, sources]) => usable(move) && sources.some((s) => s.startsWith("5M") || s.startsWith("5T") || s.startsWith("4M") || s.startsWith("4T")))
    .map(([move]) => move);
}

/** Egg moves are offered by the tutor too, at a premium. */
export function eggMoves(id: string): string[] {
  let s = species(id);
  while (s.prevo) s = species(s.prevo);
  return Object.entries(learnsetOf(s.id))
    .filter(([move, sources]) => usable(move) && sources.some((x) => x.startsWith("5E") || x.startsWith("4E")))
    .map(([move]) => move);
}

/** Moves learnt at exactly this level (for level-up prompts). */
export function movesLearntAt(id: string, level: number): string[] {
  return levelUpMoves(id).filter((m) => m.level === level).map((m) => m.move);
}

/** The four most recent level-up moves, like a wild Pokémon in the games. */
export function defaultMoves(id: string, level: number): string[] {
  const known = levelUpMoves(id).filter((m) => m.level <= level).map((m) => m.move);
  const unique = [...new Set(known.reverse())];
  return unique.slice(0, 4).reverse();
}

// ---------------------------------------------------------------------------------------------
// Evolutions

export type EvoMethod =
  | { kind: "level"; level: number }
  | { kind: "item"; item: string }
  /** Trades become an item too: a Link Cable, or the held item the trade needed. */
  | { kind: "trade"; item: string };

/** Level at which an NPC's Pokémon is shown in this stage (also the auto-evolve level for the player). */
const FRIENDSHIP_LEVEL = 22;
const MOVE_LEVEL = 33;

function minLevelOf(id: string): number {
  const s = species(id);
  if (!s.prevo) return 1;
  const prev = minLevelOf(s.prevo);
  switch (s.evoType) {
    case undefined:
      return s.evoLevel ?? prev + 10;
    case "levelFriendship":
      return Math.max(FRIENDSHIP_LEVEL, prev + 6);
    case "levelMove":
      return Math.max(MOVE_LEVEL, prev + 8);
    case "trade":
      return Math.max(36, prev + 14);
    case "useItem":
    case "levelHold":
    case "levelExtra":
    default:
      return Math.max(30, prev + 10);
  }
}

/** The level from which this species appears in NPC teams. */
export function stageMinLevel(id: string): number {
  return minLevelOf(id);
}

/** How the player evolves `from` into `to`. */
export function evoMethod(to: string): EvoMethod | null {
  const s = species(to);
  if (!s.prevo) return null;
  switch (s.evoType) {
    case undefined:
      return { kind: "level", level: s.evoLevel ?? minLevelOf(to) };
    case "levelFriendship":
      return { kind: "level", level: minLevelOf(to) };
    case "levelMove":
      return { kind: "level", level: minLevelOf(to) };
    case "trade":
      return { kind: "trade", item: s.evoItem ? toID(s.evoItem) : "linkcable" };
    case "useItem":
    case "levelHold":
      return { kind: "item", item: toID(s.evoItem ?? "linkcable") };
    case "levelExtra": {
      // Gen 4–5 location evolutions become stones.
      const cond = (s.evoCondition ?? "").toLowerCase();
      if (cond.includes("magnetic")) return { kind: "item", item: "thunderstone" };
      if (cond.includes("moss")) return { kind: "item", item: "leafstone" };
      if (cond.includes("ice rock")) return { kind: "item", item: "icestone" };
      return { kind: "level", level: minLevelOf(to) };
    }
    default:
      return { kind: "level", level: minLevelOf(to) };
  }
}

export interface EvoContext {
  gender: "M" | "F" | "N";
  /** Stable per-Pokémon number, settles random branches (Wurmple). */
  personality: number;
  atk: number;
  def: number;
  hour: number;
}

/** Whether a branch's side condition (gender, time of day, stats) holds. */
function branchAllowed(to: string, ctx: EvoContext): boolean {
  const s = species(to);
  if (s.gender && s.gender !== "N" && s.gender !== ctx.gender) return false;
  const cond = (s.evoCondition ?? "").toLowerCase();
  const day = ctx.hour >= 6 && ctx.hour < 18;
  if (cond.includes("during the day") && !day) return false;
  if (cond.includes("at night") && day) return false;
  if (cond.includes("atk stat > its def")) return ctx.atk > ctx.def;
  if (cond.includes("atk stat < its def")) return ctx.atk < ctx.def;
  if (cond.includes("atk stat = its def")) return ctx.atk === ctx.def;
  return true;
}

function evosOf(id: string): string[] {
  return species(id).evos.map(toID).filter((e) => PLAYABLE_SPECIES.includes(e));
}

/** Level-up evolution reached at `level`, if any. */
export function levelEvolution(id: string, level: number, ctx: EvoContext): string | null {
  const candidates = evosOf(id).filter((to) => {
    const m = evoMethod(to);
    return m?.kind === "level" && level >= m.level && branchAllowed(to, ctx);
  });
  if (!candidates.length) return null;
  if (toID(id) === "wurmple") return candidates[ctx.personality % candidates.length];
  return candidates[0];
}

/** Evolution triggered by using `item` on this species, if any. */
export function itemEvolution(id: string, item: string, ctx: EvoContext): string | null {
  return (
    evosOf(id).find((to) => {
      const m = evoMethod(to);
      return m && m.kind !== "level" && m.item === item && branchAllowed(to, { ...ctx, hour: 12 }) ;
    }) ??
    evosOf(id).find((to) => {
      const m = evoMethod(to);
      // Time-of-day branches with a held item (Sneasel, Gligar) ignore the clock.
      return m && m.kind !== "level" && m.item === item;
    }) ??
    null
  );
}

/** All evolution items that would do something on this species. */
export function evolutionItemsFor(id: string): string[] {
  return evosOf(id)
    .map(evoMethod)
    .filter((m): m is Exclude<EvoMethod, { kind: "level" }> => !!m && m.kind !== "level")
    .map((m) => m.item);
}

/**
 * The stage of `id`'s family an NPC would field at `level`: devolves when too low, evolves when
 * high enough. `pick` chooses between branches.
 */
export function stageForLevel(id: string, level: number, pick: (options: string[]) => string = (o) => o[0]): string {
  let cur: string = toID(id);
  while (species(cur).prevo && minLevelOf(cur) > level) cur = toID(species(cur).prevo);
  for (;;) {
    const next = evosOf(cur).filter((e) => minLevelOf(e) <= level);
    if (!next.length) return cur;
    cur = pick(next);
  }
}

export function isFullyEvolved(id: string): boolean {
  return evosOf(id).length === 0;
}

// ---------------------------------------------------------------------------------------------
// Types

export function typeEffectiveness(moveType: string, defender: readonly string[]): number {
  if (!dex.getImmunity(moveType, defender as string[])) return 0;
  return 2 ** dex.getEffectiveness(moveType, defender as string[]);
}

export const TYPE_COLORS: Record<string, string> = {
  Normal: "#A8A77A", Fire: "#EE8130", Water: "#6390F0", Electric: "#F7D02C", Grass: "#7AC74C",
  Ice: "#96D9D6", Fighting: "#C22E28", Poison: "#A33EA1", Ground: "#E2BF65", Flying: "#A98FF3",
  Psychic: "#F95587", Bug: "#A6B91A", Rock: "#B6A136", Ghost: "#735797", Dragon: "#6F35FC",
  Dark: "#705746", Steel: "#B7B7CE", "???": "#68A090",
};
