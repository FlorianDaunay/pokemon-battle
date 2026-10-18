import type { PokemonSet } from "@pkmn/sim";
import { dex, levelUpMoves, species, speciesMeta, stageForLevel, teachableMoves, toID, defaultMoves } from "../dex";
import type { StatTable } from "../dex";
import { createPokemon, fullIvs } from "../pokemon";
import type { OwnedPokemon } from "../pokemon";
import { Rng } from "../rng";
import { trainer } from "./trainers";

// Showdown's Gen 5 random-battle set builder gives late-game echoes real competitive sets.
// It's a big module, so it's loaded in the background and used once ready.
interface SetGenerator {
  randomSets: Record<string, unknown>;
  randomSet(species: string, teamDetails?: object, isLead?: boolean): PokemonSet & { level: number };
  setSeed(seed: string): void;
}
let setGenerator: SetGenerator | null = null;
export function preloadSetGenerator(): Promise<void> {
  return import("@pkmn/randoms").then((m) => {
    setGenerator = m.TeamGenerators.getTeamGenerator("gen5randombattle", "1,2,3,4") as unknown as SetGenerator;
  });
}

export interface Quality {
  /** 0 random IVs, 1 at least 15, 2 perfect. */
  ivs: 0 | 1 | 2;
  /** 0 none, 1 balanced 85s, 2 competitive spread. */
  evs: 0 | 1 | 2;
  /** 0 last level-up moves, 1 best of level-up + TMs, 2 competitive sets. */
  moves: 0 | 1 | 2;
  /** 0 none, 1 berries, 2 competitive items. */
  items: 0 | 1 | 2;
}

export function qualityFor(floor: number, boss: boolean): Quality {
  const f = floor + (boss ? 4 : 0);
  return {
    ivs: f >= 22 ? 2 : f >= 10 ? 1 : 0,
    evs: f >= 22 ? 2 : f >= 12 ? 1 : 0,
    moves: f >= 18 ? 2 : f >= 7 ? 1 : 0,
    items: f >= 17 ? 2 : f >= 8 ? 1 : 0,
  };
}

const GOOD_STATUS = new Set([
  "toxic", "thunderwave", "willowisp", "swordsdance", "nastyplot", "calmmind", "dragondance", "bulkup", "quiverdance",
  "recover", "roost", "softboiled", "slackoff", "stealthrock", "spikes", "spore", "sleeppowder", "leechseed",
  "substitute", "agility", "rockpolish", "shellsmash", "lightscreen", "reflect", "milkdrink", "synthesis", "moonlight",
  "trickroom", "taunt", "stunspore", "glare", "yawn", "coil", "honeclaws", "irondefense", "amnesia", "cottonguard", "shiftgear",
]);
const BANNED = new Set(["selfdestruct", "explosion", "memento", "healingwish", "lunardance", "finalgambit", "struggle", "focuspunch", "dreameater", "lastresort", "synchronoise", "belch", "snore", "sleeptalk", "naturalgift", "fling", "present", "frustration", "spitup", "swallow", "dig", "bounce", "fly", "dive", "shadowforce", "skullbash", "skyattack", "solarbeam", "razorwind", "hyperbeam", "gigaimpact", "blastburn", "hydrocannon", "frenzyplant", "rockwrecker", "roaroftime"]);

/** Best four moves for an NPC: strong STAB, coverage, and one useful status move. */
export function pickMoves(id: string, level: number, withTms: boolean, rng: Rng): string[] {
  const s = species(id);
  const pool = new Set(levelUpMoves(id).filter((m) => m.level <= level).map((m) => m.move));
  if (withTms) for (const m of teachableMoves(id)) pool.add(m);
  const physicalBias = s.baseStats.atk >= s.baseStats.spa ? "Physical" : "Special";
  const scored = [...pool]
    .map((m) => dex.moves.get(m))
    .filter((m) => m.exists && !BANNED.has(m.id) && !m.id.startsWith("hiddenpower"))
    .map((m) => {
      if (m.category === "Status") return { m, score: GOOD_STATUS.has(m.id) ? 55 + rng.next() * 25 : 0 };
      const acc = m.accuracy === true ? 1 : m.accuracy / 100;
      const bp = m.multihit ? m.basePower * 3 : m.basePower || 60;
      const stab = s.types.includes(m.type) ? 1.5 : 1;
      const fit = m.category === physicalBias ? 1.15 : 0.8;
      const drawback = m.recoil || m.self?.boosts || m.flags.recharge ? 0.9 : 1;
      return { m, score: bp * acc * stab * fit * drawback + rng.next() * 6 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: typeof scored = [];
  const types = new Set<string>();
  let statusCount = 0;
  for (const x of scored) {
    if (picked.length >= 4) break;
    if (x.m.category === "Status") {
      if (statusCount >= (level >= 40 ? 2 : 1)) continue;
      statusCount++;
      picked.push(x);
      continue;
    }
    if (types.has(x.m.type) && scored.some((y) => !picked.includes(y) && y.m.category !== "Status" && !types.has(y.m.type) && y.score > x.score * 0.6)) continue;
    types.add(x.m.type);
    picked.push(x);
  }
  // Fill leftovers with whatever scored next.
  for (const x of scored) {
    if (picked.length >= 4) break;
    if (!picked.includes(x)) picked.push(x);
  }
  const moves = picked.map((x) => x.m.id);
  return moves.length ? moves : defaultMoves(id, level);
}

const BERRIES = ["sitrusberry", "oranberry", "lumberry", "chestoberry", "sitrusberry"];

function evsFor(id: string, quality: Quality["evs"]): StatTable {
  if (quality === 0) return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  if (quality === 1) return { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 };
  const b = species(id).baseStats;
  const physical = b.atk >= b.spa;
  const fast = b.spe >= 80;
  return fast
    ? { hp: 4, atk: physical ? 252 : 0, def: 0, spa: physical ? 0 : 252, spd: 0, spe: 252 }
    : { hp: 252, atk: physical ? 252 : 0, def: 0, spa: physical ? 0 : 252, spd: 4, spe: 0 };
}

export interface BuildOptions {
  species: string;
  level: number;
  rng: Rng;
  quality: Quality;
  shiny: boolean;
  /** Keep the species as given (no devolving), e.g. legendaries. */
  exact?: boolean;
}

/** One NPC Pokémon at the given level and quality. */
export function buildNpcPokemon(o: BuildOptions): OwnedPokemon {
  const { rng, quality, level } = o;
  const id = o.exact ? toID(o.species) : stageForLevel(o.species, level, (opts) => rng.pick(opts));
  const ivs = quality.ivs === 2 ? fullIvs() : undefined;
  let moves: string[];
  let item: string | undefined;
  let ability: string | undefined;
  let evs = evsFor(id, quality.evs);
  const competitive = quality.moves === 2 && setGenerator?.randomSets[id];
  if (competitive && setGenerator) {
    setGenerator.setSeed(`${rng.int(0, 65535)},${rng.int(0, 65535)},${rng.int(0, 65535)},${rng.int(0, 65535)}`);
    const set = setGenerator.randomSet(id, {}, false);
    moves = set.moves.map((m) => toID(m));
    ability = toID(set.ability);
    if (quality.items === 2) item = toID(set.item);
    if (quality.evs === 2) evs = Object.assign({ hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 }, set.evs) as StatTable;
  } else {
    moves = quality.moves === 0 ? defaultMoves(id, level) : pickMoves(id, level, quality.moves >= 1 && level >= 20, rng);
  }
  if (!item && quality.items >= 1 && rng.chance(quality.items === 2 ? 0.9 : 0.5)) {
    item = quality.items === 2 ? rng.pick(["leftovers", "lifeorb", "sitrusberry", "lumberry", "focussash", "expertbelt", "choicescarf"]) : rng.pick(BERRIES);
  }
  const p = createPokemon({ species: id, level, rng, shiny: o.shiny, ivs, evs, moves, item, ability, hiddenAbilityChance: quality.moves >= 1 ? 0.25 : 0.05 });
  // Hidden Power keeps its type through the IVs the set builder expects.
  for (const m of p.moves) {
    if (m.id.startsWith("hiddenpower") && m.id !== "hiddenpower") {
      const type = m.id.slice("hiddenpower".length);
      const hpIvs = dex.types.get(type).HPivs as Partial<StatTable> | undefined;
      if (hpIvs) Object.assign(p.ivs, hpIvs);
    }
  }
  return p;
}

export function teamSize(floor: number, boss: boolean): number {
  // Floor 1–2: one Pokémon (two for the guardian), a full six from floor 14.
  return Math.min(6, Math.max(1, Math.round(floor / 2.4 + 0.6)) + (boss ? 1 : 0));
}

/** A trainer's team for a room. The ace is the last member (sent out last). */
export function buildTrainerTeam(trainerId: string, floor: number, level: number, boss: boolean, seed: number, shinyRate: number, sizeOverride?: number): OwnedPokemon[] {
  const rng = new Rng(seed);
  // Shininess has its own sequence so it never depends on how the sets were built.
  const shinyRng = new Rng(seed ^ 0x51a1e5);
  const shinies = [0, 1, 2, 3, 4, 5].map(() => shinyRng.chance(shinyRate));
  const tr = trainer(trainerId);
  const size = Math.min(sizeOverride ?? teamSize(floor, boss), tr.roster.length);
  const quality = qualityFor(floor, boss);
  // Legendaries (N's Zekrom) only join once the echo is strong enough.
  const roster = tr.roster.filter((s) => !speciesMeta(s).legendary || level >= 50);
  const ace = roster[0];
  const others = roster.slice(1, size);
  const team: OwnedPokemon[] = [];
  others.forEach((s, i) => {
    const lvl = Math.max(2, level - (others.length - i > 2 ? 2 : 1) + rng.int(0, 1));
    team.push(buildNpcPokemon({ species: s, level: Math.min(100, lvl), rng, quality, shiny: shinies[i] }));
  });
  team.push(buildNpcPokemon({ species: ace, level: Math.min(100, level + (boss ? 2 : 1)), rng, quality: { ...quality, ivs: Math.max(quality.ivs, 1) as Quality["ivs"] }, shiny: shinies[5] }));
  return team;
}

export interface FoeTeam {
  foe: OwnedPokemon[];
  /** Tag battles: owner (0 trainer, 1 partner) of each foe. */
  owners?: number[];
}

/**
 * The foes of a trainer room. Doubles get at least two Pokémon; in a tag battle the two
 * trainers split a normal team between them, and their leads come first (trainer left,
 * partner right).
 */
export function buildRoomTeam(room: { trainer?: string; partner?: string; double?: boolean; kind: string; level: number; seed: number }, floor: number, shinyRate: number): FoeTeam {
  const boss = room.kind === "boss";
  if (!room.partner) {
    const size = room.double ? Math.max(2, teamSize(floor, boss)) : undefined;
    return { foe: buildTrainerTeam(room.trainer!, floor, room.level, boss, room.seed, shinyRate, size) };
  }
  // The two share a normal team's worth: 3 + 3 for a team of six.
  const total = Math.max(2, teamSize(floor, boss));
  const a = buildTrainerTeam(room.trainer!, floor, room.level, boss, room.seed, shinyRate, Math.ceil(total / 2));
  const b = buildTrainerTeam(room.partner, floor, room.level, boss, room.seed ^ 0x7a9, shinyRate, Math.floor(total / 2));
  const foe = [a[0], b[0], ...a.slice(1), ...b.slice(1)];
  const owners = [0, 1, ...a.slice(1).map(() => 0), ...b.slice(1).map(() => 1)];
  return { foe, owners };
}
