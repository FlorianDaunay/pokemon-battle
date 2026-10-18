import { useEffect } from "react";
import { useGame } from "@/store/game";
import { music } from "@/audio/sequencer";
import { TRACKS } from "@/audio/tracks";
import type { TrackId } from "@/audio/tracks";
import { themeForFloor } from "@/core/spire/floor";
import { LAST_MAIN_FLOOR } from "@/core/spire/themes";
import type { Biome } from "@/core/spire/themes";

const DARK_BIOMES = new Set<Biome>(["cave", "hideout", "tower", "shadow", "marsh", "space", "abyss", "frigate", "volcano"]);
const HIGH_BIOMES = new Set<Biome>(["league", "summit", "den"]);

/** The track for exploring a floor. */
export function spireTrack(floor: number, seed: number): TrackId {
  const biome = themeForFloor(floor, seed).biome;
  if (floor > LAST_MAIN_FLOOR) return "spireApex";
  if (floor > 20 || HIGH_BIOMES.has(biome)) return "spireHigh";
  return DARK_BIOMES.has(biome) ? "spireDark" : "spireBright";
}

export function playTrack(id: TrackId) {
  music.play(id, TRACKS[id]);
}

/** Picks background music from the current screen (battles choose their own). */
export function MusicDirector() {
  const screen = useGame((s) => s.screen);
  const floor = useGame((s) => s.save?.run?.floor ?? 0);
  const seed = useGame((s) => (s.save && s.save.run ? s.save.floors[String(s.save.run.floor)]?.seed ?? 0 : 0));
  useEffect(() => {
    if (screen === "title" || screen === "slots" || screen === "newgame") playTrack("title");
    else if (screen === "lobby") playTrack("camp");
    else if (screen === "spire" && floor) playTrack(spireTrack(floor, seed));
  }, [screen, floor, seed]);
  return null;
}

/** Brings back the screen's music after something took it over (evolution). */
export function restoreMusic() {
  const { screen, save } = useGame.getState();
  if (screen === "lobby") playTrack("camp");
  else if (screen === "spire" && save?.run) playTrack(spireTrack(save.run.floor, save.floors[String(save.run.floor)]?.seed ?? 0));
}
