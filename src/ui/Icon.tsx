import type { SVGProps } from "react";

/** Inline icon set (24px grid, stroke-based, currentColor). */

const PATHS: Record<string, string> = {
  back: "M15 5l-7 7 7 7",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12l4 4 10-10",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  chevron: "M9 6l6 6-6 6",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  menu: "M4 7h16M4 12h16M4 17h16",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  bag: "M6 8h12l1 12H5L6 8zM9 8V6a3 3 0 016 0v2",
  team: "M8 11a3 3 0 100-6 3 3 0 000 6zM16 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15.5c.6-.3 1.3-.5 2-.5 3 0 6 2 6 5",
  pc: "M3 5h18v11H3zM8 20h8M12 16v4",
  shop: "M4 9l1.5-5h13L20 9M4 9h16v11H4zM9 20v-6h6v6",
  scroll: "M7 4h11a2 2 0 012 2v12a2 2 0 01-2 2H7M7 4a2 2 0 00-2 2v1h4V6a2 2 0 00-2-2zM9 9h7M9 13h7M9 17h4",
  fist: "M7 11V7a2 2 0 014 0v3M11 10V6a2 2 0 014 0v4M15 10V8a2 2 0 014 0v5a7 7 0 01-7 7h-1a6 6 0 01-6-6v-2a2 2 0 014 0",
  board: "M4 4h16v13H4zM9 21l3-4 3 4M8 9h8M8 12h5",
  trophy: "M8 4h8v5a4 4 0 01-8 0V4zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8",
  book: "M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h12",
  dex: "M5 3h14v18H5zM5 9h14M12 12a2 2 0 100 4 2 2 0 000-4z",
  door: "M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17M3 21h18M14 12h.01",
  tower: "M8 21V9l4-6 4 6v12M6 21h12M10 13h4M10 17h4",
  coin: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v10M9 9.5c0-1 1.3-2 3-2s3 .8 3 2-1.3 1.7-3 2-3 1-3 2 1.3 2 3 2 3-1 3-2",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  heart: "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z",
  crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5z",
  boot: "M7 3h5v9l7 3v5H5V3",
  badge: "M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7z",
  cap: "M3 13c0-5 4-8 9-8s9 3 9 8M3 13h18M12 13v-3",
  dna: "M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12M8 7h8M8 17h8",
  book2: "M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5zM12 6v14",
  swap: "M7 7h13l-3-3M17 17H4l3 3",
  run: "M13 4a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM9 21l3-6 3 3v3M6 12l4-4 3 1 2 3 3 1",
  flame: "M12 21c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-5-3-7 0 4-5 6-5 11 0 4 3 7 7 7z",
  drop: "M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  snow: "M12 2v20M4 7l16 10M20 7L4 17",
  wind: "M3 8h11a3 3 0 10-3-3M3 12h16a3 3 0 11-3 3M3 16h8",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  upload: "M12 20V8M7 13l5-5 5 5M4 4h16",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  play: "M7 4l13 8-13 8z",
  info: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01",
  volume: "M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 018 0v4",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  rest: "M3 18h18M5 18v-5a3 3 0 013-3h8a3 3 0 013 3v5M7 10V7h4v3",
  skull: "M12 3a8 8 0 00-8 8c0 3 1.5 5 4 6v3h8v-3c2.5-1 4-3 4-6a8 8 0 00-8-8zM9 12h.01M15 12h.01",
};

export type IconName = keyof typeof PATHS | string;

export function Icon({ name, size = 20, strokeWidth = 2, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

/** A Poké Ball drawn in SVG (menus, loading, throws). */
export function PokeBall({ size = 24, kind = "poke", className = "" }: { size?: number; kind?: string; className?: string }) {
  const top: Record<string, string> = {
    pokeball: "#E3350D", poke: "#E3350D", greatball: "#3B82F6", ultraball: "#2D2D2D", masterball: "#7C3AED", quickball: "#38BDF8",
    timerball: "#F87171", duskball: "#1F7A3A", netball: "#22D3EE", diveball: "#2563EB", nestball: "#84CC16", repeatball: "#F97316",
    healball: "#F472B6", luxuryball: "#111827",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#fff" stroke="#1b1b28" strokeWidth="2" />
      <path d="M2 16a14 14 0 0128 0z" fill={top[kind] ?? top.poke} stroke="#1b1b28" strokeWidth="2" />
      {kind === "ultraball" && <path d="M8 6l4 6M24 6l-4 6" stroke="#FACC15" strokeWidth="3" />}
      {kind === "greatball" && <path d="M7 9l4 3M25 9l-4 3" stroke="#EF4444" strokeWidth="3" />}
      {kind === "masterball" && <text x="16" y="12" fontSize="7" textAnchor="middle" fill="#fff" fontWeight="900">M</text>}
      <path d="M2 16h28" stroke="#1b1b28" strokeWidth="2" />
      <circle cx="16" cy="16" r="4.5" fill="#fff" stroke="#1b1b28" strokeWidth="2" />
      <circle cx="16" cy="16" r="2" fill="#eee" />
    </svg>
  );
}
