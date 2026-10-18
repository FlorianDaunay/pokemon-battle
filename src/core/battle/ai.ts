import type { Battle, Pokemon, Move } from "@pkmn/sim";
import { typeEffectiveness } from "../dex";
import type { Rng } from "../rng";

/**
 * Opponent brains. `wild` picks at random; trainers estimate damage and get sharper with the
 * floor: `basic` mostly hits hard, `smart` also uses status/setup and switches out of bad
 * matchups, `expert` reads abilities, speed and priority and plays the long game.
 */
export type AiLevel = "wild" | "basic" | "smart" | "expert";

const ABILITY_IMMUNITY: Record<string, string> = {
  levitate: "Ground", flashfire: "Fire", voltabsorb: "Electric", lightningrod: "Electric", motordrive: "Electric",
  waterabsorb: "Water", stormdrain: "Water", dryskin: "Water", sapsipper: "Grass",
};

const SETUP_MOVES = new Set([
  "swordsdance", "dragondance", "nastyplot", "calmmind", "bulkup", "quiverdance", "shellsmash", "agility",
  "rockpolish", "curse", "coil", "honeclaws", "workup", "growth", "shiftgear", "tailglow", "cottonguard", "irondefense", "amnesia",
]);
const RECOVERY_MOVES = new Set(["recover", "roost", "softboiled", "milkdrink", "slackoff", "synthesis", "moonlight", "morningsun", "wish", "healorder", "rest"]);
const HAZARDS = new Set(["stealthrock", "spikes", "toxicspikes"]);
const SCREENS = new Set(["reflect", "lightscreen"]);

/** Rough expected damage (fraction of target's current HP, can exceed 1). */
export function estimateDamage(battle: Battle, attacker: Pokemon, defender: Pokemon, move: Move, knowsAbility = true): number {
  if (move.category === "Status") return 0;
  const types = defender.getTypes();
  let eff = typeEffectiveness(move.type, types);
  if (move.id === "thousandarrows" || (move.type === "Ground" && !defender.isGrounded())) eff = move.type === "Ground" ? 0 : eff;
  if (knowsAbility) {
    const imm = ABILITY_IMMUNITY[defender.ability];
    if (imm && imm === move.type) eff = 0;
    if (defender.ability === "wonderguard" && eff <= 1) eff = 0;
  }
  if (eff === 0) return 0;
  let bp = move.basePower;
  if (move.id === "seismictoss" || move.id === "nightshade") return attacker.level / Math.max(1, defender.hp);
  if (move.id === "superfang") return 0.5;
  if (move.ohko) return 0.3 * (move.accuracy === true ? 1 : (move.accuracy as number) / 100) * 3;
  if (!bp) bp = 60;
  if (move.multihit) bp *= Array.isArray(move.multihit) ? 3 : move.multihit;
  const physical = move.category === "Physical";
  const atk = attacker.getStat(physical ? "atk" : "spa", false, true);
  const def = defender.getStat(physical ? "def" : "spd", false, true);
  const stab = attacker.hasType(move.type) ? (attacker.ability === "adaptability" ? 2 : 1.5) : 1;
  let dmg = ((((2 * attacker.level) / 5 + 2) * bp * atk) / def / 50 + 2) * stab * eff * 0.925;
  const weather = battle.field.effectiveWeather();
  if ((weather === "raindance" && move.type === "Water") || (weather === "sunnyday" && move.type === "Fire")) dmg *= 1.5;
  if ((weather === "raindance" && move.type === "Fire") || (weather === "sunnyday" && move.type === "Water")) dmg *= 0.5;
  if (physical && attacker.status === "brn" && attacker.ability !== "guts") dmg *= 0.5;
  const item = attacker.item;
  if (item === "choiceband" && physical) dmg *= 1.5;
  if (item === "choicespecs" && !physical) dmg *= 1.5;
  if (item === "lifeorb") dmg *= 1.3;
  if (item === "expertbelt" && eff > 1) dmg *= 1.2;
  const acc = move.accuracy === true ? 1 : Math.min(1, (move.accuracy as number) / 100);
  return (dmg * acc) / Math.max(1, defender.hp);
}

function speedOf(p: Pokemon): number {
  let s = p.getStat("spe", false, true);
  if (p.status === "par") s *= 0.25;
  if (p.item === "choicescarf") s *= 1.5;
  return s;
}

interface Option {
  choice: string;
  score: number;
}

function usableMoves(p: Pokemon): { slot: number; move: Move }[] {
  const req = p.getMoveRequestData();
  const out: { slot: number; move: Move }[] = [];
  req.moves.forEach((m, i) => {
    const disabled = "disabled" in m && m.disabled;
    if (m.id === "bagaction" || disabled) return;
    if ("pp" in m && typeof m.pp === "number" && m.pp <= 0) return;
    out.push({ slot: i + 1, move: p.battle.dex.moves.get(m.id) });
  });
  return out;
}

function scoreStatusMove(battle: Battle, me: Pokemon, foe: Pokemon, move: Move, level: AiLevel, threat: number): number {
  const hpRatio = me.hp / me.maxhp;
  const id = move.id;
  if (RECOVERY_MOVES.has(id)) return hpRatio < 0.45 ? 1.2 : hpRatio < 0.7 ? 0.25 : -1;
  if (SETUP_MOVES.has(id)) {
    const boosts = Object.values(me.boosts).reduce((a, b) => a + Math.max(0, b), 0);
    if (boosts >= 4) return -1;
    return threat < 0.35 && hpRatio > 0.6 ? (level === "expert" ? 0.9 : 0.55) : -0.5;
  }
  if (HAZARDS.has(id)) {
    const cond = foe.side.sideConditions;
    if (cond[id] && (id === "stealthrock" || (cond[id].layers ?? 1) >= (id === "spikes" ? 3 : 2))) return -1;
    return foe.side.pokemonLeft > 2 ? 0.6 : 0.1;
  }
  if (SCREENS.has(id)) return me.side.sideConditions[id] ? -1 : 0.45;
  if (move.status) {
    if (foe.status || foe.volatiles.substitute) return -1;
    if (move.status === "par" && (foe.hasType("Electric") || (move.type === "Electric" && !foe.runImmunity("Electric", false)))) return -1;
    if (move.status === "brn" && foe.hasType("Fire")) return -1;
    if ((move.status === "psn" || move.status === "tox") && (foe.hasType("Poison") || foe.hasType("Steel"))) return -1;
    if (move.status === "slp" && foe.side.pokemon.some((p) => p.status === "slp" && !p.fainted)) return 0.1;
    if (typeEffectiveness(move.type, foe.getTypes()) === 0 && move.type === "Electric") return -1;
    const acc = move.accuracy === true ? 1 : (move.accuracy as number) / 100;
    const fit = move.status === "brn" ? (foe.getStat("atk", false, true) > foe.getStat("spa", false, true) ? 1 : 0.4) : move.status === "par" ? (speedOf(foe) > speedOf(me) ? 1 : 0.5) : 0.8;
    return 0.6 * acc * fit;
  }
  if (move.volatileStatus === "confusion") return foe.volatiles.confusion ? -1 : 0.25;
  if (move.volatileStatus === "substitute") return me.volatiles.substitute || hpRatio < 0.3 ? -1 : 0.3;
  if (move.volatileStatus === "leechseed") return foe.volatiles.leechseed || foe.hasType("Grass") ? -1 : 0.45;
  if (id === "protect" || id === "detect") return foe.status === "tox" || foe.status === "psn" || foe.volatiles.leechseed ? 0.4 : 0.05;
  if (move.boosts && move.target !== "self") return 0.2;
  if (move.weather) return battle.field.weather === move.weather.toLowerCase() ? -1 : 0.4;
  return 0.15;
}

/** Best switch-in against the foe's active (expert/smart). Returns -1 if staying is better. */
function bestSwitch(battle: Battle, me: Pokemon, foe: Pokemon): { slot: number; gain: number } {
  const side = me.side;
  const ownBest = (p: Pokemon) => Math.max(0, ...usableMovesOf(p).map((m) => estimateDamage(battle, p, foe, m)));
  const takenFrom = (p: Pokemon) => Math.max(0, ...foe.moveSlots.map((s) => estimateDamage(battle, foe, p, battle.dex.moves.get(s.id), false)));
  const current = ownBest(me) - takenFrom(me);
  let best = { slot: -1, gain: 0 };
  side.pokemon.forEach((p, i) => {
    if (p.isActive || p.fainted || p.hp <= 0) return;
    const value = ownBest(p) - takenFrom(p) * 1.15;
    const gain = value - current;
    if (gain > best.gain) best = { slot: i + 1, gain };
  });
  return best;
}

function usableMovesOf(p: Pokemon): Move[] {
  return p.moveSlots.filter((s) => s.pp > 0 && s.id !== "bagaction").map((s) => p.battle.dex.moves.get(s.id));
}

/** Choice string for side p2 when it must pick a move (or may switch). */
export function chooseAction(battle: Battle, level: AiLevel, rng: Rng): string {
  const me = battle.p2.active[0];
  const foe = battle.p1.active[0];
  const moves = usableMoves(me);
  if (!moves.length) return "move 1"; // Struggle
  if (level === "wild" || !foe) return `move ${rng.pick(moves).slot}`;

  const knows = level === "expert";
  const myFaster = speedOf(me) >= speedOf(foe);
  const threat = Math.max(0, ...foe.moveSlots.map((s) => estimateDamage(battle, foe, me, battle.dex.moves.get(s.id), false)));
  const options: Option[] = moves.map(({ slot, move }) => {
    if (move.category === "Status") return { choice: `move ${slot}`, score: level === "basic" ? scoreStatusMove(battle, me, foe, move, level, threat) * 0.6 : scoreStatusMove(battle, me, foe, move, level, threat) };
    const dmg = estimateDamage(battle, me, foe, move, knows || level === "smart");
    let score = Math.min(dmg, 1.2);
    if (dmg >= 1) {
      score += 0.6; // a KO
      if (move.priority > 0 && !myFaster) score += 0.5;
    }
    if (move.priority > 0 && foe.hp / foe.maxhp < 0.25) score += 0.2;
    if (move.self?.boosts && Object.values(move.self.boosts).some((b) => (b ?? 0) < 0)) score -= 0.08; // Overheat & co
    if (move.recoil || move.mindBlownRecoil) score -= 0.05;
    if (move.flags.charge && !me.volatiles.twoturnmove && me.item !== "powerherb") score -= 0.3;
    if (move.flags.recharge) score -= 0.15;
    return { choice: `move ${slot}`, score };
  });

  // Smart trainers bail out of hopeless matchups now and then.
  const canSwitch = !me.trapped && !me.volatiles.partiallytrapped && me.side.pokemon.some((p) => !p.isActive && !p.fainted);
  if (canSwitch && (level === "smart" || level === "expert")) {
    const best = bestSwitch(battle, me, foe);
    const bestMove = Math.max(...options.map((o) => o.score));
    const danger = threat >= me.hp / me.maxhp * 0.9 && !myFaster;
    const threshold = level === "expert" ? 0.45 : 0.75;
    if (best.slot > 0 && best.gain > threshold && (danger || bestMove < 0.3) && rng.chance(level === "expert" ? 0.85 : 0.45)) {
      return `switch ${best.slot}`;
    }
  }

  options.sort((a, b) => b.score - a.score);
  if (level === "basic") {
    if (rng.chance(0.3)) return rng.pick(options).choice;
    return options[0].choice;
  }
  // Smart: occasionally second-best to stay unpredictable.
  if (level === "smart" && options.length > 1 && options[1].score > options[0].score * 0.8 && rng.chance(0.25)) return options[1].choice;
  return options[0].choice;
}

/** Replacement after a faint (or U-turn): the member that does best against the foe. */
export function chooseSwitch(battle: Battle, level: AiLevel, rng: Rng, ace: string): string {
  const side = battle.p2;
  const foe = battle.p1.active[0];
  const candidates = side.pokemon.map((p, i) => ({ p, slot: i + 1 })).filter(({ p }) => !p.isActive && !p.fainted && p.hp > 0);
  if (!candidates.length) return "pass";
  if (level === "wild" || level === "basic" || !foe) {
    // Keep the ace for the end.
    const nonAce = candidates.filter((c) => c.p.set.name !== ace);
    return `switch ${(nonAce.length ? (level === "basic" ? nonAce[0] : rng.pick(nonAce)) : candidates[0]).slot}`;
  }
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const c of candidates) {
    const dealt = Math.max(0, ...usableMovesOf(c.p).map((m) => estimateDamage(battle, c.p, foe, m)));
    const taken = Math.max(0, ...foe.moveSlots.map((s) => estimateDamage(battle, foe, c.p, battle.dex.moves.get(s.id), false)));
    let score = Math.min(dealt, 1.5) - taken + (speedOf(c.p) > speedOf(foe) ? 0.2 : 0);
    if (c.p.set.name === ace && candidates.length > 1) score -= 0.4; // save the ace
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return `switch ${best.slot}`;
}
