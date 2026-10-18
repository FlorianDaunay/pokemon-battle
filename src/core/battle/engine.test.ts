import { describe, expect, it } from "vitest";
import { createPokemon } from "../pokemon";
import { Rng } from "../rng";
import { BattleController } from "./engine";

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
