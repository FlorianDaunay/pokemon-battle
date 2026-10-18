import { normalizeSave } from "@/core/save";
import type { SaveData } from "@/core/save";

/** Three save slots in localStorage, plus JSON import/export. */

export const SLOT_COUNT = 3;
const key = (slot: number) => `echo-spire-slot-${slot}`;
const LAST_KEY = "echo-spire-last-slot";

export function readSlot(slot: number): SaveData | null {
  try {
    const raw = localStorage.getItem(key(slot));
    return raw ? normalizeSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeSlot(slot: number, save: SaveData): void {
  try {
    localStorage.setItem(key(slot), JSON.stringify(save));
    localStorage.setItem(LAST_KEY, String(slot));
  } catch {
    // Storage full or blocked: the game keeps running; export still works.
  }
}

export function deleteSlot(slot: number): void {
  try {
    localStorage.removeItem(key(slot));
  } catch {
    /* ignore */
  }
}

export function lastSlot(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_KEY));
    return v >= 1 && v <= SLOT_COUNT && readSlot(v) ? v : null;
  } catch {
    return null;
  }
}

export function allSlots(): (SaveData | null)[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => readSlot(i + 1));
}

export function exportSave(save: SaveData): void {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `echo-spire-${save.name.replace(/[^\w-]+/g, "_")}-floor${save.progress.best}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads and validates a save file chosen by the player. */
export async function importSaveFile(file: File): Promise<SaveData> {
  const text = await file.text();
  return normalizeSave(JSON.parse(text));
}
