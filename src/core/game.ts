import { dex, eggMoves, itemEvolution, levelUpMoves, species, speciesMeta, teachableMoves, toID } from "./dex";
import type { StatId } from "./dex";
import { itemDef, sellPrice } from "./items";
import { addExp, evoContext, evolve, expGain, healFully, maxHp, maxPp, setLevel } from "./pokemon";
import type { LevelUpEvent, OwnedPokemon } from "./pokemon";
import { Rng, randomSeed } from "./rng";
import type { RunState, SaveData } from "./save";
import { addItem, hasItem } from "./save";
import { BASE_SHINY_RATE, STEPS_PER_FLOOR, generateFloor, newFloorSeed } from "./spire/floor";
import type { Floor, Room } from "./spire/floor";
import { LAST_MAIN_FLOOR } from "./spire/themes";

/** Everything that changes a save lives here, as plain functions mutating a draft save. */

export function shinyRate(save: SaveData): number {
  return hasItem(save, "shinycharm") ? BASE_SHINY_RATE * 2 : BASE_SHINY_RATE;
}

export function floorSeed(save: SaveData, n: number): number {
  const key = String(n);
  if (!save.floors[key]) save.floors[key] = { seed: newFloorSeed(save.id, n, randomSeed()), claimed: [] };
  return save.floors[key].seed;
}

export function getFloor(save: SaveData, n: number): Floor {
  return generateFloor(n, floorSeed(save, n), { shinyRate: shinyRate(save), caughtLegends: save.legendsCaught });
}

export function findRoom(floor: Floor, id: string): Room | undefined {
  for (const step of floor.steps) for (const r of step) if (r.id === id) return r;
  return undefined;
}

export function isClaimed(save: SaveData, room: Room, n: number): boolean {
  return !!save.floors[String(n)]?.claimed.includes(room.id);
}

export function claimRoom(save: SaveData, n: number, roomId: string): void {
  floorSeed(save, n);
  const f = save.floors[String(n)];
  if (!f.claimed.includes(roomId)) f.claimed.push(roomId);
}

export function healParty(save: SaveData): void {
  for (const p of save.party) healFully(p);
}

/** Floors a new run may start from: 1, every 5th, and the checkpoint. */
export function startableFloors(save: SaveData): number[] {
  const out = new Set<number>([1]);
  for (let f = 5; f < save.progress.checkpoint; f += 5) out.add(f + 1);
  out.add(save.progress.checkpoint);
  return [...out].sort((a, b) => a - b);
}

export function startRun(save: SaveData, floor: number): void {
  healParty(save);
  save.progress.runs++;
  save.run = { floor, step: 0, path: [], current: null, startedAt: Date.now(), earned: 0 } satisfies RunState;
  floorSeed(save, floor);
  save.progress.best = Math.max(save.progress.best, floor);
}

export function enterRoom(save: SaveData, roomId: string): void {
  if (!save.run) return;
  save.run.current = roomId;
}

/** Marks the current room done and moves to the next step. */
export function completeRoom(save: SaveData): void {
  const run = save.run;
  if (!run || !run.current) return;
  run.path.push(run.current);
  run.current = null;
  run.step++;
}

export function isBossStep(run: RunState): boolean {
  return run.step >= STEPS_PER_FLOOR;
}

/** After the boss: heal, move on. The next floor becomes the checkpoint. */
export function clearFloor(save: SaveData): void {
  const run = save.run;
  if (!run) return;
  save.stats.floorsCleared++;
  if (run.floor === LAST_MAIN_FLOOR) save.progress.cleared = true;
  run.floor++;
  run.step = 0;
  run.path = [];
  run.current = null;
  save.progress.best = Math.max(save.progress.best, run.floor);
  save.progress.checkpoint = Math.max(save.progress.checkpoint, run.floor);
  floorSeed(save, run.floor);
  healParty(save);
}

/** Leaves the Spire (defeat or retreat). Progress is kept; the next run starts on this floor. */
export function endRun(save: SaveData, blackout: boolean): void {
  const run = save.run;
  if (!run) return;
  if (blackout) save.stats.blackouts++;
  save.progress.checkpoint = Math.max(save.progress.checkpoint, run.floor);
  save.run = null;
  healParty(save);
}

export function restRoom(save: SaveData): void {
  for (const p of save.party) {
    const max = maxHp(p);
    if (p.hp <= 0) p.hp = Math.floor(max / 4);
    else p.hp = Math.min(max, p.hp + Math.ceil(max / 2));
    p.status = undefined;
    for (const m of p.moves) m.pp = Math.min(maxPp(m), m.pp + Math.ceil(maxPp(m) / 2));
  }
}

// ---------------------------------------------------------------------------------------------
// Experience

/** Tuned so a team that fights most rooms sits a few levels above the floor (see the progression notes). */
const EXP_RATE = 0.5;

export interface ExpResult {
  uid: string;
  gained: number;
  levels: LevelUpEvent[];
}

/**
 * Hands out experience for defeated foes. Members that fought get the full amount, the rest of
 * the party half (an always-on Exp. Share, so a six-member team keeps pace).
 */
export function distributeExp(
  save: SaveData,
  foes: OwnedPokemon[],
  defeated: Iterable<number>,
  faced: Map<number, Set<number>>,
  trainer: boolean
): ExpResult[] {
  const results = new Map<string, ExpResult>();
  const charm = hasItem(save, "expcharm") ? 1.5 : 1;
  for (const fi of defeated) {
    const foe = foes[fi];
    if (!foe) continue;
    const fought = faced.get(fi) ?? new Set<number>();
    save.party.forEach((p, i) => {
      if (p.hp <= 0 || p.level >= 100) return;
      const share = fought.has(i) ? 1 : 0.5;
      const egg = p.item === "luckyegg" ? 1.5 : 1;
      const amount = expGain(foe.species, foe.level, p.level, trainer, EXP_RATE * share * egg * charm);
      const r = results.get(p.uid) ?? { uid: p.uid, gained: 0, levels: [] };
      r.gained += amount;
      r.levels.push(...addExp(p, amount));
      results.set(p.uid, r);
    });
  }
  return [...results.values()];
}

// ---------------------------------------------------------------------------------------------
// Items outside battle

export type UseResult =
  | { ok: true; kind: "heal" | "revive" | "pp" | "status" | "ev" | "ppup" | "ability" | "nature" | "ivs" }
  | { ok: true; kind: "level"; events: LevelUpEvent[] }
  | { ok: true; kind: "evolve"; into: string }
  | { ok: false; reason: string };

const VITAMINS: Record<string, StatId> = { hpup: "hp", protein: "atk", iron: "def", calcium: "spa", zinc: "spd", carbos: "spe" };

/** Uses an item from the bag on a Pokémon outside battle. Consumes it when it worked. */
export function useItemOn(save: SaveData, itemId: string, p: OwnedPokemon, opts: { move?: number; stat?: StatId; nature?: string } = {}): UseResult {
  if (!hasItem(save, itemId)) return { ok: false, reason: "noItem" };
  const def = itemDef(itemId);
  let result: UseResult = { ok: false, reason: "noEffect" };
  const heal = def?.heal;
  if (heal?.revive) {
    if (p.hp <= 0) {
      p.hp = Math.max(1, Math.floor(maxHp(p) * heal.revive));
      p.status = undefined;
      result = { ok: true, kind: "revive" };
    }
  } else if (heal && p.hp > 0) {
    let did = false;
    if (heal.hp && p.hp < maxHp(p)) {
      p.hp = Math.min(maxHp(p), p.hp + (heal.hp === "full" ? maxHp(p) : heal.hp));
      did = true;
    }
    if (heal.status && p.status && (heal.status === "all" || heal.status.includes(p.status))) {
      p.status = undefined;
      did = true;
    }
    if (heal.pp) {
      const slots = heal.allMoves ? p.moves : opts.move !== undefined ? [p.moves[opts.move]] : [];
      for (const s of slots) {
        if (!s || s.pp >= maxPp(s)) continue;
        s.pp = heal.pp === "full" ? maxPp(s) : Math.min(maxPp(s), s.pp + heal.pp);
        did = true;
      }
    }
    if (did) result = { ok: true, kind: heal.pp ? "pp" : heal.hp ? "heal" : "status" };
  } else if (itemId === "rarecandy") {
    if (p.level < 100) result = { ok: true, kind: "level", events: setLevel(p, p.level + 1) };
  } else if (VITAMINS[itemId]) {
    const stat = VITAMINS[itemId];
    const total = Object.values(p.evs).reduce((a, b) => a + b, 0);
    if (p.evs[stat] < 252 && total < 510) {
      const add = Math.min(10, 252 - p.evs[stat], 510 - total);
      const before = maxHp(p);
      p.evs[stat] += add;
      if (stat === "hp" && p.hp > 0) p.hp += maxHp(p) - before;
      result = { ok: true, kind: "ev" };
    }
  } else if (itemId === "ppup" || itemId === "ppmax") {
    const s = opts.move !== undefined ? p.moves[opts.move] : undefined;
    if (s && s.ups < 3 && !dex.moves.get(s.id).noPPBoosts) {
      const before = maxPp(s);
      s.ups = itemId === "ppmax" ? 3 : s.ups + 1;
      s.pp += maxPp(s) - before;
      result = { ok: true, kind: "ppup" };
    }
  } else if (itemId === "abilitycapsule") {
    const a = species(p.species).abilities as unknown as Record<string, string | undefined>;
    const cur = toID(a["0"] ?? "") === p.ability ? "0" : toID(a["1"] ?? "") === p.ability ? "1" : null;
    if (a["1"] && cur) {
      p.ability = toID(a[cur === "0" ? "1" : "0"]!);
      result = { ok: true, kind: "ability" };
    }
  } else if (itemId === "abilitypatch") {
    const a = species(p.species).abilities as unknown as Record<string, string | undefined>;
    if (a.H && toID(a.H) !== p.ability) {
      p.ability = toID(a.H);
      result = { ok: true, kind: "ability" };
    }
  } else if (itemId === "mint") {
    if (opts.nature && opts.nature !== p.nature && dex.natures.get(opts.nature).exists) {
      p.nature = toID(opts.nature);
      result = { ok: true, kind: "nature" };
    }
  } else if (itemId === "bottlecap" || itemId === "goldbottlecap") {
    const stats: StatId[] = itemId === "goldbottlecap" ? ["hp", "atk", "def", "spa", "spd", "spe"] : opts.stat ? [opts.stat] : [];
    if (stats.some((s) => p.ivs[s] < 31)) {
      const before = maxHp(p);
      for (const s of stats) p.ivs[s] = 31;
      if (p.hp > 0) p.hp += maxHp(p) - before;
      result = { ok: true, kind: "ivs" };
    }
  } else if (def?.category === "evolution") {
    const into = itemEvolution(p.species, itemId, evoContext(p));
    if (into) result = { ok: true, kind: "evolve", into };
  }
  if (result.ok) {
    addItem(save, itemId, -1);
    if (result.kind === "evolve") {
      evolve(p, result.into);
      save.stats.evolutions++;
      if (!save.dex.caught.includes(p.species)) save.dex.caught.push(p.species);
      if (!save.dex.seen.includes(p.species)) save.dex.seen.push(p.species);
    }
  }
  return result;
}

export function giveItem(save: SaveData, p: OwnedPokemon, itemId: string | undefined): boolean {
  if (itemId && !hasItem(save, itemId)) return false;
  if (p.item) addItem(save, p.item, 1);
  p.item = undefined;
  if (itemId) {
    addItem(save, itemId, -1);
    p.item = itemId;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Shop, tutor, dojo

export function buy(save: SaveData, itemId: string, count: number, unitPrice = itemDef(itemId)?.price ?? 0): boolean {
  const total = unitPrice * count;
  if (count <= 0 || unitPrice <= 0 || save.money < total) return false;
  save.money -= total;
  save.stats.moneySpent += total;
  addItem(save, itemId, count);
  return true;
}

export function sell(save: SaveData, itemId: string, count: number): boolean {
  if ((save.bag[itemId] ?? 0) < count || count <= 0) return false;
  const price = sellPrice(itemId);
  if (price <= 0) return false;
  addItem(save, itemId, -count);
  save.money += price * count;
  return true;
}

export function earn(save: SaveData, amount: number): void {
  save.money += amount;
  save.stats.moneyEarned += amount;
  if (save.run) save.run.earned += amount;
}

export interface TutorMove {
  move: string;
  price: number;
  source: "level" | "tm" | "egg";
}

/** Moves the tutor can teach, priced by power and source. */
export function tutorMoves(p: OwnedPokemon): TutorMove[] {
  const known = new Set(p.moves.map((m) => m.id));
  const out = new Map<string, TutorMove>();
  const price = (move: string, mult: number) => {
    const m = dex.moves.get(move);
    const power = m.category === "Status" ? 70 : m.basePower || 70;
    return Math.round((power * 40 * mult) / 100) * 100;
  };
  for (const m of levelUpMoves(p.species)) if (m.level <= p.level && !known.has(m.move)) out.set(m.move, { move: m.move, price: price(m.move, 0.5), source: "level" });
  for (const m of teachableMoves(p.species)) if (!known.has(m) && !out.has(m)) out.set(m, { move: m, price: price(m, 1), source: "tm" });
  for (const m of eggMoves(p.species)) if (!known.has(m) && !out.has(m)) out.set(m, { move: m, price: price(m, 1.6), source: "egg" });
  return [...out.values()].sort((a, b) => a.price - b.price || a.move.localeCompare(b.move));
}

/** Price to reassign all EVs at the dojo (grows with level). */
export function dojoPrice(p: OwnedPokemon): number {
  return Math.max(500, Math.round((p.level * 120) / 100) * 100);
}

export function setEvs(save: SaveData, p: OwnedPokemon, evs: Record<StatId, number>): boolean {
  const total = Object.values(evs).reduce((a, b) => a + b, 0);
  if (total > 510 || Object.values(evs).some((v) => v < 0 || v > 252)) return false;
  const price = dojoPrice(p);
  if (save.money < price) return false;
  save.money -= price;
  save.stats.moneySpent += price;
  const before = maxHp(p);
  p.evs = { ...evs };
  if (p.hp > 0) p.hp = Math.max(1, p.hp + maxHp(p) - before);
  return true;
}

export function catchValue(id: string): number {
  return speciesMeta(id).catchRate;
}

export function newRng(): Rng {
  return new Rng(randomSeed());
}
