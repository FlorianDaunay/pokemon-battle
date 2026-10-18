import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "en" | "fr";

interface SettingsState {
  lang: Lang;
  music: number;
  sfx: number;
  /** Milliseconds per character of battle text (0 = instant). */
  textSpeed: number;
  /** Fewer particles and shorter animations. */
  reducedFx: boolean;
  /** Pokémon cries (fetched from PokeAPI). */
  cries: boolean;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: "en",
      music: 0.6,
      sfx: 0.8,
      textSpeed: 18,
      reducedFx: false,
      cries: true,
      set: (patch) => set(patch),
    }),
    { name: "echo-spire-settings", version: 1 }
  )
);
