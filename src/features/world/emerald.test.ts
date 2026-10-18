import { describe, expect, it } from "vitest";
import { parsePal, tilesetPath } from "./emerald";

describe("emerald assets", () => {
  it("finds tileset folders from their names", () => {
    expect(tilesetPath("gTileset_General", true)).toBe("data/tilesets/primary/general");
    expect(tilesetPath("gTileset_BattlePike", false)).toBe("data/tilesets/secondary/battle_pike");
    expect(tilesetPath("gTileset_EliteFour", false)).toBe("data/tilesets/secondary/elite_four");
  });

  it("reads JASC palettes", () => {
    expect(parsePal("JASC-PAL\r\n0100\r\n2\r\n24 41 82\r\n255 255 255\r\n")).toEqual([[24, 41, 82], [255, 255, 255]]);
  });
});
