import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { spriteNum, TYPE_COLORS } from "@/core/dex";
import { itemDef, itemSpriteName } from "@/core/items";
import { itemEnglishName, typeName, useLang } from "@/i18n";
import { trainerSpriteUrl } from "@/core/spire/trainers";
import type { TrainerDef } from "@/core/spire/trainers";
import { PokeBall } from "./Icon";

const BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites";

export function pokemonSpriteUrls(species: string, opts: { shiny?: boolean; back?: boolean }): string[] {
  const num = spriteNum(species);
  const shiny = opts.shiny ? "shiny/" : "";
  const back = opts.back ? "back/" : "";
  const bw = `${BASE}/pokemon/versions/generation-v/black-white`;
  return [
    `${bw}/animated/${back}${shiny}${num}.gif`,
    `${bw}/${back}${shiny}${num}.png`,
    `${BASE}/pokemon/${back}${shiny}${num}.png`,
  ];
}

/** Battle/menu sprite: animated Black & White sprite, with static fallbacks. */
export function PokemonSprite({
  species, shiny, back, className = "", style, size, onLoad,
}: { species: string; shiny?: boolean; back?: boolean; className?: string; style?: CSSProperties; size?: number; onLoad?: () => void }) {
  const urls = pokemonSpriteUrls(species, { shiny, back });
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [species, shiny, back]);
  if (i >= urls.length) return <div className={`grid place-items-center text-3xl ${className}`} style={{ width: size, height: size, ...style }}>?</div>;
  return (
    <img
      src={urls[i]}
      alt=""
      draggable={false}
      className={`pixel select-none ${className}`}
      style={{ width: size, height: size, objectFit: "contain", ...style }}
      onError={() => setI((x) => x + 1)}
      onLoad={onLoad}
    />
  );
}

/** Small box icon (Gen 7 menu icons, cropped). */
export function PokemonIcon({ species, size = 40, className = "" }: { species: string; size?: number; className?: string }) {
  const num = spriteNum(species);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [species]);
  if (failed || num > 10000) return <PokemonSprite species={species} size={size} className={className} />;
  return (
    <img
      src={`${BASE}/pokemon/versions/generation-vii/icons/${num}.png`}
      alt=""
      draggable={false}
      className={`pixel ${className}`}
      style={{ width: size, height: size * 0.75, objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

export function ItemIcon({ id, size = 28, className = "" }: { id: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  const def = itemDef(id);
  if (def?.category === "ball" && failed) return <PokeBall size={size} kind={id} className={className} />;
  if (failed) return <div className={`grid place-items-center rounded-full bg-surface-hover text-[10px] font-black ${className}`} style={{ width: size, height: size }}>?</div>;
  return (
    <img
      src={`${BASE}/items/${itemSpriteName(id, itemEnglishName(id))}.png`}
      alt=""
      draggable={false}
      className={`pixel ${className}`}
      style={{ width: size, height: size, objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

export function TrainerSprite({ trainer, className = "", style }: { trainer: TrainerDef; className?: string; style?: CSSProperties }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`grid place-items-center ${className}`} style={style}>
        <svg viewBox="0 0 60 80" className="h-full w-full opacity-80">
          <circle cx="30" cy="18" r="12" fill="#1c1f33" />
          <path d="M10 80c0-22 9-40 20-40s20 18 20 40z" fill="#1c1f33" />
        </svg>
      </div>
    );
  }
  return <img src={trainerSpriteUrl(trainer)} alt="" draggable={false} className={`pixel ${className}`} style={style} onError={() => setFailed(true)} />;
}

export function TypeBadge({ type, small }: { type: string; small?: boolean }) {
  const lang = useLang();
  return (
    <span
      className={`badge text-white text-shadow ${small ? "!text-[9px] !px-1.5" : ""}`}
      style={{ background: `linear-gradient(180deg, ${TYPE_COLORS[type] ?? "#888"}, ${TYPE_COLORS[type] ?? "#888"}cc)`, border: "1px solid rgb(0 0 0 / 0.25)" }}
    >
      {typeName(type, lang)}
    </span>
  );
}

export function hpColor(ratio: number): string {
  return ratio > 0.5 ? "#3fd46b" : ratio > 0.2 ? "#f5c33b" : "#f0503c";
}

export function HpBar({ hp, max, className = "", showText }: { hp: number; max: number; className?: string; showText?: boolean }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-black text-amber-400">HP</span>
        <div className="hp-track h-2 flex-1">
          <div className="hp-fill" style={{ width: `${ratio * 100}%`, backgroundColor: hpColor(ratio) }} />
        </div>
      </div>
      {showText && <div className="text-right text-[11px] font-bold tabular-nums">{Math.max(0, Math.ceil(hp))}/{max}</div>}
    </div>
  );
}

export function ExpBar({ ratio, className = "" }: { ratio: number; className?: string }) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-black/40 ${className}`}>
      <div className="h-full rounded-full bg-sky-400 transition-all duration-700" style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
    </div>
  );
}

export const STATUS_COLORS: Record<string, string> = { brn: "#E2582C", par: "#D9B300", psn: "#A43FB4", tox: "#7A1F8C", slp: "#8A8AA0", frz: "#5BBCE0", fnt: "#444" };
const STATUS_LABEL: Record<string, Record<string, string>> = {
  en: { brn: "BRN", par: "PAR", psn: "PSN", tox: "TOX", slp: "SLP", frz: "FRZ", fnt: "KO" },
  fr: { brn: "BRÛ", par: "PAR", psn: "PSN", tox: "PSN", slp: "SOM", frz: "GEL", fnt: "K.O." },
};

export function StatusBadge({ status }: { status?: string }) {
  const lang = useLang();
  if (!status) return null;
  return (
    <span className="badge text-white" style={{ background: STATUS_COLORS[status] ?? "#666" }}>
      {STATUS_LABEL[lang][status] ?? status}
    </span>
  );
}

export function GenderIcon({ gender }: { gender: string }) {
  if (gender === "M") return <span className="font-black text-sky-500">♂</span>;
  if (gender === "F") return <span className="font-black text-pink-500">♀</span>;
  return null;
}
