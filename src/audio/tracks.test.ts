import { describe, expect, it } from "vitest";
import { parseMml } from "./sequencer";
import { DRUMS } from "./synth";
import * as all from "./tracks";
import type { Track } from "./sequencer";

const tracks = Object.entries(all).filter(([, v]) => v && typeof v === "object" && "parts" in v) as [string, Track][];

describe("soundtrack", () => {
  it("parses MML: lengths, dots, ties, repeats, chords", () => {
    const r = parseMml("o4 l8 c d4. e&e16 [f]2 {ceg}2 | g1", false);
    expect(r.introLen).toBeCloseTo(0.5 + 1.5 + 0.75 + 1 + 2);
    expect(r.bodyLen).toBe(4);
    expect(r.intro.filter((e) => e.beat === r.introLen - 2)).toHaveLength(3);
  });

  for (const [name, track] of tracks) {
    it(`${name}: every part lines up`, () => {
      const parsed = track.parts.map((p) => ({ inst: p.inst, ...parseMml(p.mml, DRUMS.has(p.inst)) }));
      const intro = parsed.map((p) => p.introLen);
      const body = parsed.map((p) => p.bodyLen);
      if (track.loop !== false) {
        expect(new Set(intro.map((x) => x.toFixed(3))).size, `${name} intro ${intro}`).toBe(1);
        expect(new Set(body.map((x) => x.toFixed(3))).size, `${name} body ${body}`).toBe(1);
        // Whole bars.
        expect(body[0] % 4).toBeCloseTo(0);
      }
      for (const p of parsed) expect(p.intro.length + p.body.length, `${name}/${p.inst} empty`).toBeGreaterThan(0);
    });
  }
});
