import { describe, expect, it } from "vitest";
import { createPokemon } from "../pokemon";
import { Rng } from "../rng";
import { BattleController, needsTarget } from "./engine";

const ball = { caughtBefore: false, dark: false, water: false };

function setup(kind: "wild" | "trainer", seed = 7) {
  const rng = new Rng(seed);
  const player = [createPokemon({ species: "pikachu", level: 20, rng }), createPokemon({ species: "bulbasaur", level: 18, rng })];
  const foe = kind === "wild" ? [createPokemon({ species: "pidgey", level: 8, rng })] : [createPokemon({ species: "geodude", level: 12, rng }), createPokemon({ species: "onix", level: 14, rng })];
  return { player, foe, ctrl: new BattleController({ kind, player, foe, ai: kind === "wild" ? "wild" : "smart", seed, ball }) };
}

describe("BattleController", () => {
  it("plays a trainer battle to the end", () => {
    const { ctrl, player } = setup("trainer");
    const start = ctrl.drain();
    expect(start.some((e) => e.t === "switch" && e.side === "p2")).toBe(true);
    let guard = 0;
    while (!ctrl.outcome && guard++ < 200) {
      const req = ctrl.request();
      if (req.kind === "switch") ctrl.chooseSwitch(req.switchable[0]);
      else if (req.kind === "move") ctrl.chooseMove(req.moves.find((m) => !m.disabled && m.pp > 0)?.index ?? 1);
      else break;
    }
    expect(ctrl.outcome === "win" || ctrl.outcome === "lose").toBe(true);
    ctrl.syncBack();
    expect(player.every((p) => p.hp >= 0)).toBe(true);
  });

  it("uses a potion without a move and keeps the bag action out of the move list", () => {
    const { ctrl, player } = setup("wild");
    ctrl.drain();
    player[0].hp = 10;
    ctrl.battle.p1.active[0].hp = 10;
    const events = ctrl.useItem("potion", 0);
    expect(events).not.toBeNull();
    expect(events!.some((e) => e.t === "heal")).toBe(true);
    expect(ctrl.request().moves.some((m) => m.id === "bagaction")).toBe(false);
    expect(events!.some((e) => e.t === "move" && e.side === "p1")).toBe(false);
  });

  it("catches with a master ball", () => {
    const { ctrl } = setup("wild");
    ctrl.drain();
    const events = ctrl.throwBall("masterball", false);
    expect(ctrl.outcome).toBe("caught");
    expect(events[0]).toMatchObject({ t: "ball", caught: true });
  });

  it("starts with stored HP, status and environment weather", () => {
    const rng = new Rng(3);
    const player = [createPokemon({ species: "charmander", level: 10, rng })];
    player[0].hp = 5;
    player[0].status = "par";
    const foe = [createPokemon({ species: "sandshrew", level: 10, rng })];
    const ctrl = new BattleController({ kind: "wild", player, foe, ai: "wild", seed: 1, weather: "sandstorm", ball });
    const events = ctrl.drain();
    expect(ctrl.playerActive.hp).toBe(5);
    expect(ctrl.playerActive.status).toBe("par");
    expect(events.some((e) => e.t === "weather" && e.weather === "Sandstorm")).toBe(true);
  });
});

describe("locked moves", () => {
  it("flags Outrage's second turn as locked and plays it", () => {
    const rng = new Rng(3);
    const player = [createPokemon({ species: "dragonite", level: 60, rng, moves: ["outrage", "hyperbeam"] })];
    const foe = [createPokemon({ species: "snorlax", level: 70, rng, moves: ["rest"] })];
    const ctrl = new BattleController({ kind: "wild", player, foe, ai: "wild", seed: 9, ball });
    ctrl.drain();
    ctrl.chooseMove(1);
    const req = ctrl.request();
    expect(req.locked).toBe(true);
    const events = ctrl.chooseMove(req.moves[0].index);
    expect(events.some((e) => e.t === "move" && e.side === "p1" && e.move === "Outrage")).toBe(true);
  });

  it("does not flag a normal turn", () => {
    const { ctrl } = setup("wild");
    ctrl.drain();
    expect(ctrl.request().locked).toBe(false);
  });
});

describe("party with knocked-out members", () => {
  it("ends the battle when the last healthy Pokémon faints", () => {
    const rng = new Rng(3);
    const player = [createPokemon({ species: "magikarp", level: 5, rng, moves: ["splash"] }), createPokemon({ species: "pidgey", level: 5, rng })];
    player[1].hp = 0;
    const foe = [createPokemon({ species: "machamp", level: 60, rng })];
    const ctrl = new BattleController({ kind: "wild", player, foe, ai: "wild", seed: 9, ball });
    ctrl.drain();
    expect(ctrl.battle.p1.pokemonLeft).toBe(1);
    ctrl.chooseMove(1);
    expect(ctrl.outcome).toBe("lose");
  });
});

/** Plays a battle to the end with the first usable move (aimed at the rightmost foe) for each slot. */
function autoplay(ctrl: BattleController, onTurn?: () => void) {
  let guard = 0;
  while (!ctrl.outcome && guard++ < 300) {
    onTurn?.();
    const req = ctrl.request();
    if (req.kind === "switch") {
      const pool = [...req.switchable];
      ctrl.submit(req.replace.map(() => (pool.length ? { kind: "switch" as const, slot: pool.shift()! } : { kind: "pass" as const })));
    } else if (req.kind === "move") {
      const foeLoc = ctrl.battle.p2.active.map((m) => !!m && !m.fainted).lastIndexOf(true) + 1;
      ctrl.submit(req.slots.map((s) => {
        const m = s.moves.find((x) => !x.disabled && (x.pp > 0 || s.locked || s.struggle)) ?? s.moves[0];
        return { kind: "move" as const, index: m.index, target: !s.locked && needsTarget(m.target) ? foeLoc || 1 : undefined };
      }));
    } else break;
  }
}

describe("double battles", () => {
  const team = (species: string[], level: number, seed: number) => {
    const rng = new Rng(seed);
    return species.map((s) => createPokemon({ species: s, level, rng }));
  };

  it("plays a double battle against one trainer", () => {
    const player = team(["pikachu", "bulbasaur", "squirtle"], 30, 1);
    const foe = team(["geodude", "onix", "machop"], 26, 2);
    const ctrl = new BattleController({ kind: "trainer", player, foe, ai: "expert", seed: 5, ball, double: true });
    const start = ctrl.drain();
    expect(ctrl.slots).toBe(2);
    expect(start.filter((e) => e.t === "switch" && e.side === "p2").map((e) => e.pos)).toEqual([0, 1]);
    expect(ctrl.request().slots).toHaveLength(2);
    autoplay(ctrl);
    expect(ctrl.outcome === "win" || ctrl.outcome === "lose").toBe(true);
  });

  it("keeps each trainer's Pokémon on their own side in a tag battle", () => {
    const player = team(["charizard", "blastoise", "venusaur"], 36, 3);
    // Trainer 0: golem, steelix (left). Trainer 1: zubat alone (right).
    const foe = team(["golem", "zubat", "steelix"], 34, 4);
    const owners = [0, 1, 0];
    const ctrl = new BattleController({ kind: "trainer", player, foe, ai: "smart", seed: 8, ball, double: true, foeOwners: owners });
    ctrl.drain();
    ctrl.battle.p2.active[1].hp = 1; // Zubat falls first, while trainer 1's partner still has a bench
    let emptySpot = false;
    const check = () => {
      const [left, right] = ctrl.battle.p2.active;
      if (right?.fainted && left && !left.fainted && ctrl.battle.p2.pokemon.some((m) => !m.isActive && !m.fainted)) emptySpot = true;
      for (const mon of ctrl.battle.p2.active) {
        if (mon && !mon.fainted) expect(owners[BattleController.indexOf(mon)]).toBe(mon.position);
      }
    };
    autoplay(ctrl, check);
    expect(ctrl.outcome === "win" || ctrl.outcome === "lose").toBe(true);
    expect(emptySpot).toBe(true);
  });

  it("falls back to a single battle with one healthy Pokémon", () => {
    const player = team(["pikachu", "bulbasaur"], 30, 1);
    player[1].hp = 0;
    const ctrl = new BattleController({ kind: "trainer", player, foe: team(["geodude", "onix"], 20, 2), ai: "basic", seed: 5, ball, double: true });
    expect(ctrl.slots).toBe(1);
  });

  it("never stalls in tag battles once one trainer runs out", () => {
    for (let seed = 1; seed <= 120; seed++) {
      const rng = new Rng(seed);
      const pool = ["geodude", "zubat", "machop", "oddish", "psyduck", "growlithe", "abra", "tentacool", "magnemite", "gastly"];
      const mk = (n: number) => Array.from({ length: n }, () => createPokemon({ species: rng.pick(pool), level: 40, rng }));
      const foe = mk(rng.int(4, 6));
      const owners = foe.map((_, i) => (i < 2 ? i : rng.int(0, 1)));
      const ctrl = new BattleController({ kind: "trainer", player: mk(3), foe, ai: "smart", seed, ball, double: true, foeOwners: owners });
      ctrl.drain();
      let guard = 0;
      while (!ctrl.outcome && guard++ < 300) {
        const req = ctrl.request();
        expect(req.kind, `seed ${seed}`).not.toBe("wait");
        if (req.kind === "switch") {
          const left = [...req.switchable];
          ctrl.submit(req.replace.map(() => (left.length ? { kind: "switch" as const, slot: left.shift()! } : { kind: "pass" as const })));
        } else {
          const foeLoc = ctrl.battle.p2.active.map((m) => !!m && !m.fainted).lastIndexOf(true) + 1;
          ctrl.submit(req.slots.map((sl) => {
            const m = sl.moves.find((x) => !x.disabled && (x.pp > 0 || sl.locked || sl.struggle)) ?? sl.moves[0];
            return { kind: "move" as const, index: m.index, target: !sl.locked && needsTarget(m.target) ? foeLoc || 1 : undefined };
          }));
        }
      }
    }
  });
});
