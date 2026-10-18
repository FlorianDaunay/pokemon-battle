import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { PokemonIcon } from "@/ui/sprites";
import { Walker } from "./Walker";
import type { Dir } from "./Walker";
import type { WorldMap } from "./useEmerald";
import { Pad, useTouchControls } from "./Pad";

/**
 * A real Emerald map the player walks on: arrow keys / WASD / ZQSD, or tap a spot to walk
 * there. Entities are buildings, doors, NPCs, chests…: bumping into a solid one (or tapping it)
 * uses it, stepping onto a non-solid one (a door, stairs) triggers it.
 */

export interface Cell {
  x: number;
  y: number;
}

export interface WorldEntity {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  /** Blocks the way (default). Non-solid entities trigger when stepped on. */
  solid?: boolean;
  /** Tapping it walks up to it (and faces it) rather than stepping in: doors with something behind. */
  approach?: boolean;
  onUse?: () => void;
  render?: (tile: number) => ReactNode;
  /** Drawn over the player (roofs, tree tops). */
  above?: boolean;
  /** Scenery only: never blocks or triggers (the tiles underneath decide). */
  ghost?: boolean;
}

export interface WorldProps {
  /** Changing it puts the player back on the spawn (a new map). */
  mapKey: string;
  map: WorldMap;
  entities: WorldEntity[];
  spawn: Cell & { dir: Dir };
  /** The player's overworld sprite (an Emerald object-event picture). */
  pic: string;
  follower?: { species: string; shiny: boolean };
  /** A CSS filter over the map (themed rooms). */
  filter?: string;
  /** Stops input while a menu or dialog is open. */
  paused?: boolean;
  /** The entity the player faces (or stands on, or right under), e.g. to describe a door. */
  onFocus?: (id: string | null) => void;
  /** After each step. */
  onStep?: (at: Cell) => void;
  children?: ReactNode;
}

const STEP_MS = 170;
const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYS: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right", z: "up", q: "left",
  W: "up", S: "down", A: "left", D: "right", Z: "up", Q: "left",
};

const inside = (e: WorldEntity, x: number, y: number) => x >= e.x && x < e.x + (e.w ?? 1) && y >= e.y && y < e.y + (e.h ?? 1);
const dirTo = (from: Cell, to: Cell): Dir => (to.x > from.x ? "right" : to.x < from.x ? "left" : to.y > from.y ? "down" : "up");

export function World({ mapKey, map, entities, spawn, pic, follower, filter, paused, onFocus, onStep, children }: WorldProps) {
  const H = map.height;
  const W = map.width;
  const touch = useTouchControls();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ w: 800, h: 600 });
  const [pos, setPos] = useState<Cell>({ x: spawn.x, y: spawn.y });
  const [dir, setDir] = useState<Dir>(spawn.dir);
  const [step, setStep] = useState(0);
  // The follower walks one step behind; it shows up once the player moves.
  const [trail, setTrail] = useState<Cell>({ x: spawn.x, y: spawn.y });

  const posRef = useRef(pos);
  const dirRef = useRef(dir);
  const path = useRef<Cell[]>([]);
  const arrival = useRef<null | { face?: Dir; use?: WorldEntity }>(null);
  const held = useRef<Dir[]>([]);
  const ents = useRef(entities);
  const pausedRef = useRef(!!paused);
  const lastMove = useRef(0);
  const stepCb = useRef(onStep);
  stepCb.current = onStep;
  ents.current = entities;
  pausedRef.current = !!paused;

  // A new map: back to its spawn.
  useEffect(() => {
    posRef.current = { x: spawn.x, y: spawn.y };
    dirRef.current = spawn.dir;
    path.current = [];
    arrival.current = null;
    setPos(posRef.current);
    setDir(spawn.dir);
    setTrail(posRef.current);
    setStep(0);
  }, [mapKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setView({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const entityAt = (x: number, y: number) => ents.current.find((e) => !e.ghost && inside(e, x, y));
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !map.blocked[y * W + x];
  const walkable = (x: number, y: number) => {
    if (!open(x, y)) return false;
    const e = entityAt(x, y);
    return !e || e.solid === false;
  };

  /** Shortest walk to any goal cell. Triggers (doors) are avoided unless they are the goal. */
  const findPath = (from: Cell, goals: Cell[]): Cell[] | null => {
    const key = (c: Cell) => c.y * W + c.x;
    const goalSet = new Set(goals.map(key));
    if (goalSet.has(key(from))) return [];
    const prev = new Map<number, number>([[key(from), -1]]);
    const queue: Cell[] = [from];
    while (queue.length) {
      const c = queue.shift()!;
      for (const d of ["up", "down", "left", "right"] as Dir[]) {
        const n = { x: c.x + DELTA[d][0], y: c.y + DELTA[d][1] };
        const k = key(n);
        if (prev.has(k) || !walkable(n.x, n.y)) continue;
        const e = entityAt(n.x, n.y);
        if (e?.onUse && !goalSet.has(k)) continue;
        prev.set(k, key(c));
        if (goalSet.has(k)) {
          const out: Cell[] = [];
          for (let cur = k; cur !== key(from); cur = prev.get(cur)!) out.unshift({ x: cur % W, y: Math.floor(cur / W) });
          return out;
        }
        queue.push(n);
      }
    }
    return null;
  };

  const face = (d: Dir) => {
    dirRef.current = d;
    setDir(d);
  };

  /** One step. Bumping into something solid uses it; stepping on a trigger fires it. */
  const tryMove = (d: Dir): boolean => {
    const { x, y } = posRef.current;
    const nx = x + DELTA[d][0];
    const ny = y + DELTA[d][1];
    face(d);
    const e = entityAt(nx, ny);
    if (e && e.solid !== false) {
      path.current = [];
      arrival.current = null;
      held.current = [];
      e.onUse?.();
      return false;
    }
    if (!walkable(nx, ny)) {
      path.current = [];
      return false;
    }
    setTrail(posRef.current);
    posRef.current = { x: nx, y: ny };
    setPos(posRef.current);
    setStep((s) => (s === 1 ? 2 : 1));
    lastMove.current = Date.now();
    stepCb.current?.(posRef.current);
    if (e?.onUse) {
      path.current = [];
      arrival.current = null;
      held.current = [];
      e.onUse();
    }
    return true;
  };

  // The walking clock.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (pausedRef.current) {
        path.current = [];
        held.current = [];
        return;
      }
      if (path.current.length) {
        const next = path.current.shift()!;
        tryMove(dirTo(posRef.current, next));
        if (!path.current.length && arrival.current) {
          const a = arrival.current;
          arrival.current = null;
          if (a.face) face(a.face);
          a.use?.onUse?.();
        }
      } else if (held.current.length) {
        // A short press is one step; holding keeps walking.
        if (Date.now() - lastMove.current >= STEP_MS * 0.9) tryMove(held.current[held.current.length - 1]);
      } else if (Date.now() - lastMove.current > STEP_MS * 1.5) {
        setStep(0);
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  const useInFront = () => {
    const [dx, dy] = DELTA[dirRef.current];
    const e = entityAt(posRef.current.x + dx, posRef.current.y + dy) ?? entityAt(posRef.current.x, posRef.current.y);
    e?.onUse?.();
  };

  const press = (d: Dir) => {
    if (pausedRef.current) return;
    path.current = [];
    arrival.current = null;
    if (!held.current.includes(d)) {
      held.current.push(d);
      // Respond at once; the clock keeps walking while it's held.
      if (Date.now() - lastMove.current > STEP_MS * 0.6) tryMove(d);
    }
  };
  const release = (d: Dir) => void (held.current = held.current.filter((x) => x !== d));

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (pausedRef.current || (e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      const d = KEYS[e.key];
      if (d) {
        e.preventDefault();
        press(d);
      } else if (e.key === " " || e.key === "Enter" || e.key === "e" || e.key === "E") {
        if ((e.target as HTMLElement | null)?.closest("button")) return;
        e.preventDefault();
        useInFront();
      }
    };
    const up = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (d) release(d);
    };
    const blur = () => void (held.current = []);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tell the screen what the player is looking at.
  useEffect(() => {
    if (!onFocus) return;
    const [dx, dy] = DELTA[dir];
    const e = entityAt(pos.x + dx, pos.y + dy) ?? entityAt(pos.x, pos.y) ?? entityAt(pos.x, pos.y - 1);
    onFocus(e?.id ?? null);
  }, [pos, dir, entities]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap to walk.
  // Whole pixels per Emerald pixel when possible, so the art stays crisp.
  const T = Math.max(32, Math.min(64, Math.floor(Math.min(view.w / 10, view.h / 9) / 8) * 8));
  const tap = (ev: React.PointerEvent) => {
    // Touch screens use the pad.
    if (touch || pausedRef.current || !mapRef.current) return;
    const r = mapRef.current.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left) / T);
    const y = Math.floor((ev.clientY - r.top) / T);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    held.current = [];
    const e = entityAt(x, y);
    const from = posRef.current;
    if (e && (e.solid !== false || e.approach)) {
      // Walk next to it, face it, then use it (solid things only).
      const around: { c: Cell; face: Dir }[] = [];
      const w = e.w ?? 1, h = e.h ?? 1;
      for (let i = 0; i < w; i++) {
        around.push({ c: { x: e.x + i, y: e.y + h }, face: "up" }, { c: { x: e.x + i, y: e.y - 1 }, face: "down" });
      }
      for (let j = 0; j < h; j++) {
        around.push({ c: { x: e.x - 1, y: e.y + j }, face: "right" }, { c: { x: e.x + w, y: e.y + j }, face: "left" });
      }
      const spots = around.filter(({ c }) => walkable(c.x, c.y) && !entityAt(c.x, c.y)?.onUse || (c.x === from.x && c.y === from.y));
      const route = findPath(from, spots.map((s) => s.c));
      if (!route) return;
      const end = route.length ? route[route.length - 1] : from;
      const spot = spots.find((s) => s.c.x === end.x && s.c.y === end.y);
      const use = e.solid !== false ? e : e.approach && route.length === 0 ? e : undefined;
      if (!route.length) {
        if (spot) face(spot.face);
        use?.onUse?.();
        return;
      }
      path.current = route;
      arrival.current = { face: spot?.face, use };
      return;
    }
    if (!walkable(x, y)) return;
    const route = findPath(from, [{ x, y }]);
    if (route) {
      path.current = route;
      arrival.current = null;
    }
  };

  // Camera: follow the player, clamped to the map (centred when it fits).
  const cam = (size: number, map: number, at: number) => (map <= size ? (size - map) / 2 : Math.min(0, Math.max(size - map, size / 2 - (at + 0.5) * T)));
  const ox = cam(view.w, W * T, pos.x);
  const oy = cam(view.h, H * T, pos.y);
  const moveDir = dirTo(trail, pos);
  const glide: CSSProperties = { transition: `left ${STEP_MS}ms linear, top ${STEP_MS}ms linear` };

  return (
    <div ref={boxRef} className="absolute inset-0 touch-none select-none overflow-hidden" onPointerDown={tap}>
      <div ref={mapRef} data-cols={W} className="absolute left-0 top-0" style={{ width: W * T, height: H * T, transform: `translate(${ox}px, ${oy}px)`, transition: `transform ${STEP_MS}ms linear` }}>
        <img src={map.below} alt="" draggable={false} className="pixel absolute left-0 top-0 max-w-none" style={{ width: W * T, height: H * T, imageRendering: "pixelated", filter }} />
        {entities.filter((e) => !e.above).map((e) => (
          <div key={e.id} className="absolute" style={{ left: e.x * T, top: e.y * T, width: (e.w ?? 1) * T, height: (e.h ?? 1) * T, zIndex: (e.y + (e.h ?? 1)) * 10 }}>
            {e.render?.(T)}
          </div>
        ))}
        {follower && (trail.x !== pos.x || trail.y !== pos.y) && (
          <div className="pointer-events-none absolute grid place-items-end justify-center" style={{ ...glide, left: trail.x * T - T * 0.1, top: trail.y * T - T * 0.25, width: T * 1.2, height: T * 1.2, zIndex: (trail.y + 1) * 10 }}>
            <div className={step ? "animate-bob" : ""} style={{ transform: moveDir === "right" ? "scaleX(-1)" : undefined, filter: "drop-shadow(0 2px 1px rgba(0,0,0,0.35))" }}>
              <PokemonIcon species={follower.species} size={T * 1.2} />
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute" style={{ ...glide, left: pos.x * T, top: pos.y * T - T, width: T, zIndex: (pos.y + 1) * 10 + 5 }}>
          <Walker pic={pic} dir={dir} step={step} T={T} />
        </div>
        <img src={map.above} alt="" draggable={false} className="pixel pointer-events-none absolute left-0 top-0 max-w-none" style={{ width: W * T, height: H * T, imageRendering: "pixelated", zIndex: 800, filter }} />
        {entities.filter((e) => e.above).map((e) => (
          <div key={e.id} className="pointer-events-none absolute" style={{ left: e.x * T, top: e.y * T, width: (e.w ?? 1) * T, height: (e.h ?? 1) * T, zIndex: 900 }}>
            {e.render?.(T)}
          </div>
        ))}
      </div>
      {touch && !paused && <Pad onPress={press} onRelease={release} onAction={useInFront} />}
      {children}
    </div>
  );
}
