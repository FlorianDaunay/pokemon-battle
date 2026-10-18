import { create } from "zustand";
import type { SaveData } from "@/core/save";
import type { LevelUpEvent } from "@/core/pokemon";
import { updateAchievements } from "@/core/quests";
import type { Room } from "@/core/spire/floor";
import { writeSlot } from "./saves";

export type Screen = "title" | "slots" | "newgame" | "lobby" | "spire" | "battle";
export type Overlay = "party" | "bag" | "mart" | "pc" | "tutor" | "dojo" | "quests" | "trophies" | "journal" | "dex" | "settings" | null;

/** A choice the player must make after levelling up (learn a move, evolve). */
export type Pending =
  | { kind: "learn"; uid: string; move: string }
  | { kind: "evolve"; uid: string; into: string };

export interface Toast {
  id: number;
  key: string;
  params?: Record<string, string | number>;
  icon?: string;
}

export interface BattleRequest {
  room: Room;
  floor: number;
}

interface GameState {
  screen: Screen;
  overlay: Overlay;
  slot: number | null;
  save: SaveData | null;
  battle: BattleRequest | null;
  pending: Pending[];
  toasts: Toast[];
  go: (screen: Screen) => void;
  open: (overlay: Overlay) => void;
  load: (slot: number, save: SaveData) => void;
  /** Applies a change to a copy of the save, then autosaves. */
  update: (fn: (draft: SaveData) => void) => void;
  startBattle: (req: BattleRequest) => void;
  endBattle: () => void;
  queueLevelUps: (uid: string, events: LevelUpEvent[]) => void;
  resolvePending: () => void;
  toast: (key: string, params?: Record<string, string | number>, icon?: string) => void;
  dismissToast: (id: number) => void;
  quit: () => void;
}

let toastId = 0;

export const useGame = create<GameState>()((set, get) => ({
  screen: "title",
  overlay: null,
  slot: null,
  save: null,
  battle: null,
  pending: [],
  toasts: [],

  go: (screen) => set({ screen, overlay: null }),
  open: (overlay) => set({ overlay }),

  load: (slot, save) => {
    writeSlot(slot, save);
    set({ slot, save, screen: save.run ? "spire" : "lobby", overlay: null, pending: [] });
  },

  update: (fn) => {
    const { save, slot } = get();
    if (!save || slot === null) return;
    const draft = structuredClone(save);
    fn(draft);
    draft.updatedAt = Date.now();
    const gained = updateAchievements(draft);
    writeSlot(slot, draft);
    set({ save: draft });
    for (const id of gained) get().toast("trophies.unlocked", { id }, "trophy");
  },

  startBattle: (req) => set({ battle: req, screen: "battle", overlay: null }),
  endBattle: () => set({ battle: null }),

  queueLevelUps: (uid, events) => {
    const extra: Pending[] = [];
    for (const e of events) {
      for (const move of e.newMoves) extra.push({ kind: "learn", uid, move });
    }
    // Only the last reachable evolution matters (several levels at once).
    const evo = [...events].reverse().find((e) => e.evolution);
    if (evo?.evolution) extra.push({ kind: "evolve", uid, into: evo.evolution });
    if (extra.length) set({ pending: [...get().pending, ...extra] });
  },

  resolvePending: () => set({ pending: get().pending.slice(1) }),

  toast: (key, params, icon) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, key, params, icon }] });
    setTimeout(() => get().dismissToast(id), 3800);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),

  quit: () => set({ screen: "title", overlay: null, save: null, slot: null, battle: null, pending: [] }),
}));

/** Current save, asserting a game is loaded (screens past the title). */
export function useSave(): SaveData {
  const save = useGame((s) => s.save);
  if (!save) throw new Error("No save loaded");
  return save;
}
