import { Battle, Dex, Teams } from "@pkmn/sim";
import type { Pokemon, PokemonSet } from "@pkmn/sim";
import { species, speciesMeta, toID } from "../dex";
import { itemDef } from "../items";
import type { BallContext } from "../items";
import { maxHp, maxPp } from "../pokemon";
import type { OwnedPokemon, StatusId } from "../pokemon";
import { Rng } from "../rng";
import { chooseAction, chooseSwitch } from "./ai";
import type { AiLevel } from "./ai";
import { rollCatch, rollRun } from "./catch";
import { parseLines, visibleLines } from "./protocol";
import type { BattleEvent } from "./protocol";

// A do-nothing, top-priority move: lets the player spend their turn on the bag (or a failed
// catch/run) while the opponent still acts and end-of-turn effects still happen.
const BAG_ACTION = "bagaction";
let bagActionInstalled = false;
function installBagAction() {
  if (bagActionInstalled) return;
  bagActionInstalled = true;
  (Dex.data.Moves as Record<string, unknown>)[BAG_ACTION] = {
    num: 0,
    name: "Bag Action",
    accuracy: true,
    basePower: 0,
    category: "Status",
    pp: 64,
    priority: 7,
    flags: { failcopycat: 1, failencore: 1, failmefirst: 1, nosleeptalk: 1, failinstruct: 1, noassist: 1, failmimic: 1 },
    target: "self",
    type: "???",
    onTryMove() {
      return null;
    },
    secondary: null,
  };
}

export type WeatherId = "raindance" | "sunnyday" | "sandstorm" | "hail";

export interface BattleOptions {
  kind: "wild" | "trainer";
  player: OwnedPokemon[];
  /** Foe party; for trainers the ace is last. */
  foe: OwnedPokemon[];
  ai: AiLevel;
  seed: number;
  weather?: WeatherId;
  ball: Omit<BallContext, "turn" | "foeLevel" | "foeTypes">;
  /** Catch-rate multiplier (key items). */
  catchBonus?: number;
}

export type Outcome = "win" | "lose" | "caught" | "fled" | null;

export interface MoveOption {
  index: number;
  id: string;
  pp: number;
  maxpp: number;
  disabled: boolean;
}

export interface PlayerRequest {
  kind: "move" | "switch" | "wait";
  moves: MoveOption[];
  /** Party indexes that can be switched in. */
  switchable: number[];
  trapped: boolean;
  /** Must Struggle (no PP / all disabled). */
  struggle: boolean;
  /** Locked into a move (Outrage, recharge, second turn of a charge move): the turn plays itself. */
  locked: boolean;
}

const slotName = (i: number) => `S${i}`;

const CONSUMABLES = new Set(["focussash", "whiteherb", "mentalherb", "powerherb", "airballoon", "redcard", "ejectbutton"]);
function isConsumable(item: string): boolean {
  return CONSUMABLES.has(item) || itemDef(item)?.category === "berry" || item.endsWith("gem");
}

function toSet(p: OwnedPokemon, index: number): PokemonSet {
  return {
    name: slotName(index),
    species: species(p.species).name,
    item: p.item && Dex.items.get(p.item).exists ? Dex.items.get(p.item).name : "",
    ability: Dex.abilities.get(p.ability).name,
    moves: p.moves.map((m) => Dex.moves.get(m.id).name),
    nature: Dex.natures.get(p.nature).name,
    gender: p.gender === "N" ? "" : p.gender,
    evs: p.evs,
    ivs: p.ivs,
    level: p.level,
    shiny: p.shiny,
    happiness: 255,
  } as PokemonSet;
}

function applyStoredState(mon: Pokemon, p: OwnedPokemon) {
  mon.hp = Math.min(mon.maxhp, Math.max(0, p.hp));
  if (mon.hp <= 0) {
    mon.hp = 0;
    mon.fainted = true;
    mon.side.pokemonLeft--;
    mon.status = "fnt" as never;
  } else if (p.status) {
    mon.setStatus(p.status, null, null, true);
  }
  syncPp(mon, p);
}

/** Showdown assumes max PP Ups; the game tracks its own, so the sim follows. */
function syncPp(mon: Pokemon, p: OwnedPokemon) {
  p.moves.forEach((m, i) => {
    if (mon.moveSlots[i]) {
      mon.moveSlots[i].maxpp = mon.baseMoveSlots[i].maxpp = maxPp(m);
      mon.moveSlots[i].pp = Math.min(m.pp, mon.moveSlots[i].maxpp);
      mon.baseMoveSlots[i].pp = mon.moveSlots[i].pp;
    }
  });
}

/**
 * One battle: wraps the Showdown simulator, adds bag/catch/run, drives the opponent and turns
 * the log into events. The UI calls an action, then animates the returned events.
 */
export class BattleController {
  readonly battle: Battle;
  readonly opts: BattleOptions;
  private cursor = 0;
  private rng: Rng;
  private runAttempts = 0;
  outcome: Outcome = null;
  /** Foe party indexes that fainted (for experience). */
  readonly defeated = new Set<number>();
  /** Player party indexes that were sent out at some point (for experience). */
  readonly participants = new Set<number>();
  /** Foe indexes each player member faced (gen 5 splits exp between participants). */
  readonly faced = new Map<number, Set<number>>();
  turn = 1;
  private aceName: string;

  constructor(opts: BattleOptions) {
    installBagAction();
    this.opts = opts;
    this.rng = new Rng(opts.seed ^ 0x5bd1e995);
    const seed = `${opts.seed & 0xffff},${(opts.seed >>> 16) & 0xffff},4660,39030` as const;
    this.battle = new Battle({ formatid: "gen5customgame@@@!teampreview" as never, seed });

    // The first healthy member leads; names keep the original party index.
    const order = opts.player.map((p, i) => ({ p, i }));
    const lead = order.findIndex(({ p }) => p.hp > 0);
    if (lead > 0) order.unshift(...order.splice(lead, 1));
    this.battle.setPlayer("p1", { name: "Player", team: Teams.pack(order.map(({ p, i }) => toSet(p, i))) });
    this.battle.p1.pokemon.forEach((mon) => {
      const idx = Number(mon.set.name.slice(1));
      applyStoredState(mon, opts.player[idx]);
    });

    this.aceName = slotName(opts.foe.length - 1);
    this.cursor = this.battle.log.length;
    this.battle.setPlayer("p2", { name: "Foe", team: Teams.pack(opts.foe.map(toSet)) });
    for (const mon of this.battle.p2.pokemon) syncPp(mon, opts.foe[BattleController.indexOf(mon)]);
    // Starting the battle resets the count of usable Pokémon: re-apply the ones already knocked out.
    for (const mon of this.battle.p1.pokemon) {
      if (opts.player[BattleController.indexOf(mon)].hp <= 0) {
        mon.hp = 0;
        mon.fainted = true;
        mon.status = "fnt" as never;
      }
    }
    this.battle.p1.pokemonLeft = this.battle.p1.pokemon.filter((m) => !m.fainted).length;
    this.markActive();

    if (opts.weather && !this.battle.field.weather) {
      this.battle.field.setWeather(opts.weather, this.battle.p2.active[0]);
      this.battle.field.weatherState.duration = 0; // environment weather lasts all battle
    }
  }

  /** Events produced since the last call (start of battle on the first call). */
  drain(): BattleEvent[] {
    const lines = visibleLines(this.battle.log, this.cursor);
    this.cursor = this.battle.log.length;
    const events = parseLines(lines);
    for (const e of events) {
      if (e.t === "turn") this.turn = e.n;
      if (e.t === "faint" && e.side === "p2") {
        const active = this.battle.p2.pokemon.find((m) => m.fainted && !this.defeated.has(Number(m.set.name.slice(1))));
        if (active) this.defeated.add(Number(active.set.name.slice(1)));
      }
    }
    this.markActive();
    this.checkEnd(events);
    return events;
  }

  private markActive() {
    const me = this.battle.p1.active[0];
    const foe = this.battle.p2.active[0];
    if (!me) return;
    const mi = Number(me.set.name.slice(1));
    this.participants.add(mi);
    if (foe && !me.fainted) {
      const fi = Number(foe.set.name.slice(1));
      if (!this.faced.has(fi)) this.faced.set(fi, new Set());
      this.faced.get(fi)!.add(mi);
    }
  }

  private checkEnd(events: BattleEvent[]) {
    if (this.outcome) return;
    const win = events.find((e) => e.t === "win");
    if (win && win.t === "win") this.outcome = win.side === "p1" ? "win" : "lose";
    else if (this.battle.ended) this.outcome = this.battle.winner === "Player" ? "win" : "lose";
  }

  get playerActive(): Pokemon {
    return this.battle.p1.active[0];
  }

  get foeActive(): Pokemon {
    return this.battle.p2.active[0];
  }

  /** Party index of a sim Pokémon. */
  static indexOf(mon: Pokemon): number {
    return Number(mon.set.name.slice(1));
  }

  request(): PlayerRequest {
    const side = this.battle.p1;
    const state = side.requestState;
    const switchable = side.pokemon.filter((m) => !m.isActive && !m.fainted && m.hp > 0).map((m) => BattleController.indexOf(m));
    if (state === "switch") return { kind: "switch", moves: [], switchable, trapped: false, struggle: false, locked: false };
    if (state !== "move") return { kind: "wait", moves: [], switchable, trapped: false, struggle: false, locked: false };
    const active = side.active[0];
    const data = active.getMoveRequestData();
    const moves: MoveOption[] = [];
    // Showdown sends a locked move without PP.
    const locked = data.moves.length === 1 && !("pp" in data.moves[0]) && data.moves[0].id !== "struggle";
    data.moves.forEach((m, i) => {
      if (m.id === BAG_ACTION) return;
      const anyM = m as { id: string; pp?: number; maxpp?: number; disabled?: boolean | string };
      moves.push({ index: i + 1, id: m.id, pp: anyM.pp ?? 0, maxpp: anyM.maxpp ?? 0, disabled: !!anyM.disabled });
    });
    const struggle = moves.length === 1 && moves[0].id === "struggle";
    const trapped = !!(data.trapped || data.maybeTrapped);
    return { kind: "move", moves, switchable: trapped ? [] : switchable, trapped, struggle, locked };
  }

  /** Lets the opponent answer any pending request (move, or replacement after a faint). */
  private foeChoose() {
    const side = this.battle.p2;
    if (side.requestState === "move") this.battle.choose("p2", chooseAction(this.battle, this.opts.ai, this.rng));
    else if (side.requestState === "switch") this.battle.choose("p2", chooseSwitch(this.battle, this.opts.ai, this.rng, this.aceName));
  }

  private commit(p1Choice: string | null): BattleEvent[] {
    if (p1Choice && this.battle.p1.requestState) {
      if (!this.battle.choose("p1", p1Choice)) {
        // Shouldn't happen: fall back to the default so the battle never stalls.
        this.battle.p1.clearChoice();
        this.battle.p1.autoChoose();
        if (this.battle.allChoicesDone()) this.battle.commitChoices();
      }
    }
    if (this.battle.p2.requestState) this.foeChoose();
    // The foe may need several replacements in a row while the player waits.
    let guard = 0;
    while (!this.battle.ended && !this.battle.p1.requestState && this.battle.p2.requestState && guard++ < 6) this.foeChoose();
    return this.drain();
  }

  chooseMove(index: number): BattleEvent[] {
    return this.commit(`move ${index}`);
  }

  chooseSwitch(partyIndex: number): BattleEvent[] {
    const pos = this.battle.p1.pokemon.findIndex((m) => BattleController.indexOf(m) === partyIndex);
    return this.commit(`switch ${pos + 1}`);
  }

  /** Spends the player's turn doing nothing in the sim (after a bag action). */
  private passTurn(pre: BattleEvent[]): BattleEvent[] {
    const active = this.playerActive;
    const lastMove = active.lastMove;
    active.moveSlots.push({ id: BAG_ACTION, move: "Bag Action", pp: 64, maxpp: 64, target: "self", disabled: false, used: false } as never);
    const events = this.commit(`move ${active.moveSlots.length}`);
    // Clean up so the bag never shows up as a move or a choice lock.
    for (const mon of this.battle.p1.pokemon) {
      mon.moveSlots = mon.moveSlots.filter((s) => s.id !== BAG_ACTION);
      if (mon.volatiles.choicelock?.move === BAG_ACTION) mon.removeVolatile("choicelock");
      if (mon.lastMove?.id === BAG_ACTION) mon.lastMove = lastMove;
    }
    return [...pre, ...events];
  }

  /** Whether the bag can be used now (Choice-locked or Encored turns can't spare a move slot). */
  canUseBag(): boolean {
    const active = this.playerActive;
    return this.battle.p1.requestState === "move" && !active.volatiles.encore && !active.volatiles.twoturnmove && !active.volatiles.mustrecharge && !active.volatiles.lockedmove;
  }

  /**
   * Uses a medicine or X item on a party member (by party index). Returns the events, or null if
   * it would have no effect.
   */
  useItem(itemId: string, partyIndex: number, moveIndex?: number): BattleEvent[] | null {
    const def = itemDef(itemId);
    const mon = this.battle.p1.pokemon.find((m) => BattleController.indexOf(m) === partyIndex);
    if (!def || !mon) return null;
    const pre: BattleEvent[] = [{ t: "bag", item: itemId, target: partyIndex }];
    const heal = def.heal;
    let did = false;
    if (heal?.revive) {
      if (!mon.fainted) return null;
      mon.fainted = false;
      mon.faintQueued = false;
      mon.status = "" as never;
      mon.hp = Math.max(1, Math.floor(mon.maxhp * heal.revive));
      mon.side.pokemonLeft++;
      did = true;
      pre.push({ t: "message", key: "battle.revived", params: { slot: partyIndex } });
    } else if (heal) {
      if (mon.fainted) return null;
      if (heal.hp && mon.hp < mon.maxhp) {
        const amount = heal.hp === "full" ? mon.maxhp : heal.hp;
        mon.hp = Math.min(mon.maxhp, mon.hp + amount);
        did = true;
        if (mon.isActive) pre.push({ t: "heal", side: "p1", hp: mon.hp, maxhp: mon.maxhp, from: itemId });
        else pre.push({ t: "message", key: "battle.healedBench", params: { slot: partyIndex } });
      }
      if (heal.status && mon.status && (heal.status === "all" || heal.status.includes(mon.status as StatusId))) {
        const prev = mon.status;
        mon.clearStatus();
        if (heal.status === "all" && mon.volatiles.confusion) mon.removeVolatile("confusion");
        did = true;
        if (mon.isActive) pre.push({ t: "curestatus", side: "p1", status: prev });
      }
      if (heal.pp) {
        const slots = heal.allMoves ? mon.moveSlots : moveIndex !== undefined ? [mon.moveSlots[moveIndex]] : [];
        for (const s of slots) {
          if (!s || s.pp >= s.maxpp) continue;
          s.pp = heal.pp === "full" ? s.maxpp : Math.min(s.maxpp, s.pp + heal.pp);
          const base = mon.baseMoveSlots.find((b) => b.id === s.id);
          if (base) base.pp = s.pp;
          did = true;
        }
        if (did) pre.push({ t: "message", key: "battle.ppRestored", params: { slot: partyIndex } });
      }
    } else if (def.boost) {
      if (!mon.isActive) return null;
      const applied = mon.boostBy(def.boost);
      if (!applied) return null;
      did = true;
      for (const [stat, amount] of Object.entries(def.boost)) pre.push({ t: "boost", side: "p1", stat, amount: amount ?? 0 });
    }
    if (!did) return null;
    return this.passTurn(pre);
  }

  throwBall(ballId: string, caughtBefore: boolean): BattleEvent[] {
    const def = itemDef(ballId);
    const foe = this.foeActive;
    const ctx: BallContext = { ...this.opts.ball, caughtBefore, turn: this.turn, foeLevel: foe.level, foeTypes: foe.getTypes() };
    const mult = def?.ball?.(ctx) ?? 1;
    const { shakes, caught } = rollCatch({
      maxhp: foe.maxhp,
      hp: foe.hp,
      catchRate: speciesMeta(foe.species.id).catchRate,
      ballMult: mult,
      status: foe.status || undefined,
      rng: this.rng,
      bonus: this.opts.catchBonus,
    });
    const pre: BattleEvent[] = [{ t: "ball", ball: ballId, shakes, caught }];
    if (caught) {
      this.outcome = "caught";
      return pre;
    }
    return this.passTurn(pre);
  }

  tryRun(): BattleEvent[] {
    this.runAttempts++;
    const ok = rollRun({ mySpeed: this.playerActive.getStat("spe", false, true), foeSpeed: this.foeActive.getStat("spe", false, true), attempts: this.runAttempts, rng: this.rng });
    if (ok) {
      this.outcome = "fled";
      return [{ t: "run", ok: true }];
    }
    return this.passTurn([{ t: "run", ok: false }]);
  }

  /** Writes HP, status and PP back into the player's Pokémon (call once the battle is over). */
  syncBack(): void {
    for (const mon of this.battle.p1.pokemon) {
      const p = this.opts.player[BattleController.indexOf(mon)];
      p.hp = mon.fainted ? 0 : Math.min(maxHp(p), mon.hp);
      const st = mon.status as string;
      p.status = !mon.fainted && st && st !== "fnt" ? (st as StatusId) : undefined;
      mon.baseMoveSlots.forEach((s, i) => {
        if (p.moves[i] && toID(s.id) === p.moves[i].id) p.moves[i].pp = Math.min(s.pp, maxPp(p.moves[i]));
      });
      // Single-use items spent in battle are gone; anything swapped or knocked off comes back (Gen 5).
      if (p.item && toID(mon.item) !== p.item && isConsumable(p.item)) p.item = undefined;
    }
  }

  /** The caught Pokémon's HP and status, to store it as it was. */
  foeState(): { hp: number; status?: StatusId } {
    const f = this.foeActive;
    const st = f.status as string;
    return { hp: f.hp, status: st && st !== "fnt" ? (st as StatusId) : undefined };
  }
}
