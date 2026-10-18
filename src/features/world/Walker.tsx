import { memo } from "react";
import OW from "@/data/ow-sprites.json";
import { useSpriteImage } from "./useEmerald";

/**
 * Overworld sprites. Black 2 / White 2 walking sheets (4 directions × 4 frames) come from the
 * Essentials BW kit for Nate, Rosa and the following Pokémon; other heroes walk with Emerald's
 * sheets. Trainers and NPCs stand with their B2W2 sprite (older generations when B2W2 has
 * none), fetched once into public/ow by scripts/fetch-ow-sprites.mjs.
 */

export type Dir = "up" | "down" | "left" | "right";

const FEMALE_AVATARS = new Set(["hilda", "rosa", "dawn", "lyra", "may"]);

/** Essentials BW's character sheets (RPG Maker layout: rows down, left, right, up). */
const BW_SHEETS = "https://raw.githubusercontent.com/Eronan/Essentials-BW/master/Graphics/Characters";
const HERO_SHEETS: Record<string, string> = { nate: "trchar000", rosa: "trchar001" };

/**
 * The player's walking sprite for an avatar: a B2W2 sheet URL when there is one, else an
 * Emerald picture (Brendan or May).
 */
export const playerPic = (avatar: string) =>
  HERO_SHEETS[avatar] ? `${BW_SHEETS}/${HERO_SHEETS[avatar]}.png` : FEMALE_AVATARS.has(avatar) ? "people/may/walking" : "people/brendan/walking";

/** A Pokémon's walking sheet (national dex number, shiny variant). */
export const pokemonSheet = (num: number, shiny: boolean) => `${BW_SHEETS}/${String(num).padStart(3, "0")}${shiny ? "s" : ""}.png`;

/** A standing sprite: a B2W2-style single frame (public/ow) or an Emerald sheet. */
export type Look = { od: string } | { pic: string };

const HAS_OD = new Set(Object.keys(OW));
const odUrl = (id: string) => `${import.meta.env.BASE_URL}ow/${id}.png`;

// Hoenn's teams look best in their own Emerald sprites.
const EMERALD_LOOKS: Record<string, string> = {
  maxie: "people/team_magma/maxie", tabitha: "people/team_magma/magma_member_m", courtney: "people/team_magma/magma_member_f",
  archie: "people/team_aqua/archie", matt: "people/team_aqua/aqua_member_m", shelly: "people/team_aqua/aqua_member_f",
};

/** How a trainer echo or NPC (by id: a trainer, "nurse", "clerk", "professor"…) looks standing. */
export function lookOf(id: string): Look {
  if (EMERALD_LOOKS[id]) return { pic: EMERALD_LOOKS[id] };
  if (HAS_OD.has(id)) return { od: odUrl(id) };
  return { pic: "people/youngster" };
}

// Emerald walking sheets: face down, up, left; then two steps each for down, up, left.
const FACE: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 2 };
const WALK: Record<Dir, [number, number]> = { down: [3, 4], up: [5, 6], left: [7, 8], right: [7, 8] };

/**
 * A 16×32 overworld character drawn `T` pixels per cell (two cells tall, feet on its cell).
 * `step` 0 stands; 1 and 2 alternate while walking. Facing right mirrors the left frames.
 */
export const Walker = memo(function Walker({ pic, dir, step, T }: { pic: string; dir: Dir; step: number; T: number }) {
  if (pic.startsWith("http")) return <Sheet url={pic} dir={dir} step={step} T={T} />;
  return <EmeraldWalker pic={pic} dir={dir} step={step} T={T} />;
});

const SHEET_ROW: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };
const SHEET_COL = [0, 1, 3];

/**
 * An RPG Maker style 4×4 sheet (64-pixel cells drawn two cells wide, feet on the cell), as
 * Essentials BW ships them.
 */
export const Sheet = memo(function Sheet({ url, dir, step, T, onError }: { url: string; dir: Dir; step: number; T: number; onError?: () => void }) {
  const size = T * 2;
  return (
    <div className="pixel overflow-hidden" style={{ width: size, height: size, marginLeft: -T / 2, imageRendering: "pixelated" }}>
      <img
        src={url}
        alt=""
        draggable={false}
        onError={onError}
        className="max-w-none"
        style={{ width: size * 4, height: size * 4, imageRendering: "pixelated", transform: `translate(${-SHEET_COL[step] * size}px, ${-SHEET_ROW[dir] * size}px)` }}
      />
    </div>
  );
});

const EmeraldWalker = memo(function EmeraldWalker({ pic, dir, step, T }: { pic: string; dir: Dir; step: number; T: number }) {
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

/** A standing character, feet on its cell: B2W2 frames are 32×32 (two cells), Emerald 16×32. */
export function Standing({ look, T }: { look: Look; T: number }) {
  if ("od" in look) {
    return <img src={look.od} alt="" draggable={false} className="pixel absolute max-w-none" style={{ left: -T / 2, top: -T, width: T * 2, height: T * 2, imageRendering: "pixelated" }} />;
  }
  return (
    <div className="absolute left-0" style={{ top: -T }}>
      <Walker pic={look.pic} dir="down" step={0} T={T} />
    </div>
  );
}
