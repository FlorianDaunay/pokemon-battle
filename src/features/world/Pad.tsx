import { useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { Dir } from "./Walker";

/** Touch screens walk with an on-screen pad rather than by tapping where to go. */
export function useTouchControls(): boolean {
  const query = "(pointer: coarse)";
  const [touch, setTouch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setTouch(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return touch;
}

/** Height kept free at the bottom of the screen for the pad. */
export const PAD_SPACE = 150;

function Key({ children, onDown, onUp, className = "" }: { children: ReactNode; onDown: () => void; onUp?: () => void; className?: string }) {
  const down = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onDown();
  };
  const up = (e: ReactPointerEvent) => {
    e.stopPropagation();
    onUp?.();
  };
  return (
    <button
      data-silent
      className={`grid select-none place-items-center rounded-xl border-2 border-white/30 bg-black/45 text-xl font-black text-white shadow-lg backdrop-blur-sm active:bg-white/30 ${className}`}
      style={{ touchAction: "none" }}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/** Arrows bottom-left, A bottom-right. */
export function Pad({ onPress, onRelease, onAction }: { onPress: (d: Dir) => void; onRelease: (d: Dir) => void; onAction: () => void }) {
  const k = (d: Dir, label: string, cls: string) => <Key className={`absolute h-12 w-12 ${cls}`} onDown={() => onPress(d)} onUp={() => onRelease(d)}>{label}</Key>;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between px-4 pb-4 safe-pad">
      <div className="pointer-events-auto relative h-[136px] w-[136px]">
        {k("up", "▲", "left-[44px] top-0")}
        {k("left", "◀", "left-0 top-[44px]")}
        {k("right", "▶", "right-0 top-[44px]")}
        {k("down", "▼", "bottom-0 left-[44px]")}
      </div>
      <div className="pointer-events-auto mb-6">
        <Key className="h-16 w-16 rounded-full text-2xl" onDown={onAction}>A</Key>
      </div>
    </div>
  );
}
