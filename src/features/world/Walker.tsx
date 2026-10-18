import { memo } from "react";
import { useSpriteImage } from "./useEmerald";

/** Real Emerald overworld sprites for the player, NPCs and trainer echoes. */

export type Dir = "up" | "down" | "left" | "right";

const FEMALE_AVATARS = new Set(["hilda", "rosa", "dawn", "lyra", "may"]);

/** The player's walking sprite for an avatar. */
export const playerPic = (avatar: string) => (FEMALE_AVATARS.has(avatar) ? "people/may/walking" : "people/brendan/walking");

const OWN: Record<string, string> = {
  roxanne: "people/gym_leaders/roxanne", brawly: "people/gym_leaders/brawly", wattson: "people/gym_leaders/wattson",
  flannery: "people/gym_leaders/flannery", norman: "people/gym_leaders/norman", winona: "people/gym_leaders/winona",
  tateandliza: "people/gym_leaders/tate", juan: "people/gym_leaders/juan", sidney: "people/elite_four/sidney",
  phoebe: "people/elite_four/phoebe", glacia: "people/elite_four/glacia", drake: "people/elite_four/drake",
  steven: "people/steven", wallace: "people/wallace", maxie: "people/team_magma/maxie", archie: "people/team_aqua/archie",
  tabitha: "people/team_magma/magma_member_m", courtney: "people/team_magma/magma_member_f",
  matt: "people/team_aqua/aqua_member_m", shelly: "people/team_aqua/aqua_member_f", red: "people/red",
};

const FEMALE = new Set([
  "misty", "erika", "sabrina", "lorelei", "agatha", "ariana", "whitney", "jasmine", "clair", "karen", "janine", "gardenia",
  "maylene", "fantina", "candice", "bertha", "cynthia", "mars", "jupiter", "lenora", "elesa", "skyla", "roxie", "iris",
  "shauntal", "caitlin",
]);

const BY_CLASS: Record<string, [string, string]> = {
  gym: ["people/black_belt", "people/beauty"],
  elite: ["people/expert_m", "people/expert_f"],
  champion: ["people/gentleman", "people/beauty"],
  admin: ["people/team_magma/magma_member_m", "people/team_magma/magma_member_f"],
  boss: ["people/scientist_2", "people/hex_maniac"],
  rival: ["people/youngster", "people/lass"],
  legend: ["people/psychic_m", "people/hex_maniac"],
};

/** The overworld sprite of a trainer echo: their own when Emerald has one, else a look-alike. */
export function trainerPic(id: string, cls: string): string {
  return OWN[id] ?? (BY_CLASS[cls] ?? BY_CLASS.gym)[FEMALE.has(id) ? 1 : 0];
}

// Emerald walking sheets: face down, up, left; then two steps each for down, up, left.
const FACE: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 2 };
const WALK: Record<Dir, [number, number]> = { down: [3, 4], up: [5, 6], left: [7, 8], right: [7, 8] };

/**
 * A 16×32 overworld character drawn `T` pixels per cell (two cells tall, feet on its cell).
 * `step` 0 stands; 1 and 2 alternate while walking. Facing right mirrors the left frames.
 */
export const Walker = memo(function Walker({ pic, dir, step, T }: { pic: string; dir: Dir; step: number; T: number }) {
  const img = useSpriteImage(pic);
  if (!img) return null;
  const scale = T / 16;
  const many = img.frames >= 9;
  const frame = !many ? (img.frames >= 3 ? FACE[dir] : 0) : step === 0 ? FACE[dir] : WALK[dir][step - 1];
  return (
    <div
      className="pixel"
      style={{
        width: img.fw * scale,
        height: img.fh * scale,
        backgroundImage: `url(${img.url})`,
        backgroundSize: `${img.frames * img.fw * scale}px ${img.fh * scale}px`,
        backgroundPosition: `${-frame * img.fw * scale}px 0`,
        imageRendering: "pixelated",
        transform: dir === "right" && img.frames >= 3 ? "scaleX(-1)" : undefined,
      }}
    />
  );
});
