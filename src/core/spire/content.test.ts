import { describe, expect, it } from "vitest";
import { PLAYABLE_SPECIES, dex, stageForLevel } from "../dex";
import { ITEMS } from "../items";
import { THEMES, MAIN_FLOORS, themeById } from "./themes";
import { TRAINERS, trainer } from "./trainers";
import { buildRoomTeam, buildTrainerTeam } from "./teams";
import { floorLevel, generateFloor, BASE_SHINY_RATE, DOUBLE_FROM, TAG_FROM } from "./floor";

describe("content", () => {
  it("only uses Gen 1–5 species that exist", () => {
    const bad: string[] = [];
    for (const t of THEMES) for (const s of [...t.pool, ...t.legends]) if (!PLAYABLE_SPECIES.includes(s)) bad.push(`${t.id}:${s}`);
    for (const t of TRAINERS) for (const s of t.roster) if (!PLAYABLE_SPECIES.includes(s)) bad.push(`${t.id}:${s}`);
    expect(bad).toEqual([]);
  });

  it("references existing trainers and themes", () => {
    for (const t of THEMES) {
      expect(() => trainer(t.boss)).not.toThrow();
      for (const id of t.trainers) expect(() => trainer(id), `${t.id}:${id}`).not.toThrow();
    }
    for (const id of MAIN_FLOORS) expect(themeById(id).id).toBe(id);
  });

  it("knows every item it sells", () => {
    const missing = ITEMS.filter((i) => !i.custom && !dex.items.get(i.id).exists).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it("devolves NPC teams at low level", () => {
    expect(stageForLevel("rhyperior", 10)).toBe("rhyhorn");
    expect(stageForLevel("rhyperior", 45)).toBe("rhydon");
    expect(stageForLevel("charizard", 20)).toBe("charmeleon");
    expect(stageForLevel("pidgey", 40)).toBe("pidgeot");
  });

  it("regenerates the same floor (and shinies) from the same seed", () => {
    const ctx = { shinyRate: 0.3, caughtLegends: [] };
    const a = generateFloor(5, 1234, ctx);
    const b = generateFloor(5, 1234, ctx);
    expect(JSON.stringify(a.steps)).toBe(JSON.stringify(b.steps));
    const boss = a.steps[a.steps.length - 1][0];
    const t1 = buildTrainerTeam(boss.trainer!, 5, boss.level, true, boss.seed, 0.3);
    const t2 = buildTrainerTeam(boss.trainer!, 5, boss.level, true, boss.seed, 0.3);
    expect(t1.map((p) => [p.species, p.shiny])).toEqual(t2.map((p) => [p.species, p.shiny]));
  });

  it("builds every trainer team at every tier", () => {
    for (const f of [1, 8, 16, 25, 35]) {
      for (const t of TRAINERS) {
        const team = buildTrainerTeam(t.id, f, floorLevel(f), false, 99, BASE_SHINY_RATE);
        expect(team.length).toBeGreaterThan(0);
        for (const p of team) expect(p.moves.length, `${t.id} ${p.species} f${f}`).toBeGreaterThan(0);
      }
    }
  });

  it("adds double and tag battles from their floors on", () => {
    const ctx = { shinyRate: 0, caughtLegends: [] };
    const rooms = (from: number, to: number) => {
      const out = [];
      for (let n = from; n <= to; n++) for (let seed = 1; seed <= 20; seed++) out.push(...generateFloor(n, seed, ctx).steps.flat());
      return out;
    };
    expect(rooms(1, DOUBLE_FROM - 1).some((r) => r.double && r.trainer !== "tateandliza")).toBe(false);
    const later = rooms(TAG_FROM, TAG_FROM + 10);
    expect(later.some((r) => r.double && !r.partner)).toBe(true);
    expect(later.some((r) => r.partner && r.partner !== r.trainer)).toBe(true);
    expect(rooms(1, 40).filter((r) => r.trainer === "tateandliza").every((r) => r.double)).toBe(true);
  });

  it("builds tag teams with each trainer's lead up front", () => {
    const { foe, owners } = buildRoomTeam({ kind: "trainer", trainer: "brock", partner: "misty", double: true, level: 30, seed: 5 }, 12, 0);
    expect(owners).toHaveLength(foe.length);
    expect(owners!.slice(0, 2)).toEqual([0, 1]);
    // Floor 12 teams have six Pokémon: three each.
    expect(foe).toHaveLength(6);
    expect(owners!.filter((o) => o === 0)).toHaveLength(3);
    expect(owners!.filter((o) => o === 1)).toHaveLength(3);
  });
});
