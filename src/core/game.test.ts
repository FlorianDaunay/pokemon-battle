import { describe, expect, it } from "vitest";
import { claimRoom, getFloor, isEmptyRoom, passRoom, startRun } from "./game";
import { newSave } from "./save";

describe("climbing", () => {
  it("never blocks on a step whose doors are all spent", () => {
    const save = newSave("Test", "red", "pikachu", 42);
    startRun(save, 1);
    const floor = getFloor(save, 1);
    // Spend every door of the first step (catch / treasure) on an earlier visit.
    for (const room of floor.steps[0]) {
      room.kind = "wild";
      claimRoom(save, 1, room.id);
    }
    const room = floor.steps[0][0];
    expect(isEmptyRoom(save, room, 1)).toBe(true);
    passRoom(save, room.id);
    expect(save.run!.step).toBe(1);
    expect(save.run!.current).toBeNull();
  });
});

describe("formes", () => {
  it("switches Rotom's appliance and its signature move", async () => {
    const { changeForme } = await import("./game");
    const { createPokemon } = await import("./pokemon");
    const { Rng } = await import("./rng");
    const save = newSave("Test", "rosa", "pikachu", 1);
    const rotom = createPokemon({ species: "rotom", level: 40, rng: new Rng(2), moves: ["thundershock", "shadowball", "discharge", "thunderwave"] });
    expect(changeForme(save, rotom, "rotomwash")).toBe(true);
    expect(rotom.species).toBe("rotomwash");
    expect(rotom.moves.map((m) => m.id)).toContain("hydropump");
    expect(changeForme(save, rotom, "rotomheat")).toBe(true);
    expect(rotom.moves.map((m) => m.id)).toContain("overheat");
    expect(rotom.moves.map((m) => m.id)).not.toContain("hydropump");
    expect(changeForme(save, rotom, "pikachu")).toBe(false);
    expect(changeForme(save, rotom, "rotom")).toBe(true);
    expect(rotom.moves.map((m) => m.id)).toContain("thundershock");
  });
});
