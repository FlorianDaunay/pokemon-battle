import { useState } from "react";
import { dex, evoMethod, isFullyEvolved, species, STAT_IDS } from "@/core/dex";
import { levelProgress, maxHp, maxPp, statsOf, expForLevel, growthOf } from "@/core/pokemon";
import type { OwnedPokemon } from "@/core/pokemon";
import { abilityDesc, abilityName, itemName, moveDesc, moveName, natureName, speciesName, useT } from "@/i18n";
import { ExpBar, GenderIcon, HpBar, ItemIcon, PokemonSprite, StatusBadge, TypeBadge } from "@/ui/sprites";
import { Tabs } from "@/ui/layout";
import { PokeBall } from "@/ui/Icon";

/** Info / stats / moves of one Pokémon. */
export function Summary({ p }: { p: OwnedPokemon }) {
  const t = useT();
  const [tab, setTab] = useState<"info" | "stats" | "moves">("info");
  const s = species(p.species);
  const stats = statsOf(p);
  const nature = dex.natures.get(p.nature);
  const evos = s.evos.map((e) => ({ to: e, m: evoMethod(e) }));
  const nextExp = p.level < 100 ? expForLevel(p.level + 1, growthOf(p)) - p.exp : 0;

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-card bg-gradient-to-b from-accent/20 to-transparent">
          <PokemonSprite species={p.species} shiny={p.shiny} size={96} />
          {p.shiny && <span className="absolute right-1 top-1 text-yellow-300">✦</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-xl font-black">
            <span className="truncate">{p.nickname || speciesName(p.species, t.lang)}</span>
            <GenderIcon gender={p.gender} />
            <PokeBall size={14} kind={p.ball} />
          </div>
          <div className="text-sm text-text-secondary">{t("common.lv")}{p.level} · {speciesName(p.species, t.lang)}</div>
          <div className="mt-1 flex gap-1">{s.types.map((ty) => <TypeBadge key={ty} type={ty} />)}<StatusBadge status={p.hp <= 0 ? "fnt" : p.status} /></div>
          <HpBar hp={p.hp} max={maxHp(p)} showText className="mt-2 max-w-[220px]" />
          <ExpBar ratio={levelProgress(p)} className="mt-1 max-w-[220px]" />
        </div>
      </div>

      <div className="mt-3"><Tabs value={tab} onChange={setTab} options={[{ id: "info", label: t("summary.info") }, { id: "stats", label: t("summary.stats") }, { id: "moves", label: t("summary.moves") }]} /></div>

      {tab === "info" && (
        <div className="mt-3 space-y-2 text-sm">
          <Row label={t("summary.nature")} value={`${natureName(p.nature, t.lang)}${nature.plus ? ` (+${t(`summary.statShort.${nature.plus}`)} −${t(`summary.statShort.${nature.minus}`)})` : ""}`} />
          <Row label={t("summary.ability")} value={abilityName(p.ability, t.lang)} sub={abilityDesc(p.ability, t.lang)} />
          <Row label={t("summary.item")} value={p.item ? itemName(p.item, t.lang) : t("common.none")} icon={p.item ? <ItemIcon id={p.item} size={24} /> : undefined} />
          <Row label={t("summary.exp")} value={`${p.exp.toLocaleString()}`} sub={p.level < 100 ? `${t("summary.toNext")}: ${nextExp.toLocaleString()}` : undefined} />
          <Row label="" value={p.metFloor ? t("summary.met", { n: p.metFloor }) : t("summary.partner")} />
          <div className="rounded-tile bg-canvas/40 p-2">
            {isFullyEvolved(p.species) ? (
              <span className="text-text-muted">{t("summary.fullyEvolved")}</span>
            ) : (
              evos.map(({ to, m }) => (
                <div key={to} className="flex items-center gap-2">
                  <PokemonSprite species={to} size={36} />
                  <span className="font-bold">{speciesName(to, t.lang)}</span>
                  <span className="text-xs text-text-secondary">
                    {m?.kind === "level" ? t("summary.evolveAt", { n: m.level }) : m ? t("summary.evolveWith", { item: itemName(m.item, t.lang) }) : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "stats" && (
        <div className="mt-3">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 gap-y-1.5 text-sm">
            <span />
            <span />
            <span className="label">{t("summary.base")}</span>
            <span className="label">{t("summary.ivs")}</span>
            <span className="label">{t("summary.evs")}</span>
            {STAT_IDS.map((st) => {
              const plus = nature.plus === st, minus = nature.minus === st;
              return (
                <div key={st} className="contents">
                  <span className={`font-bold ${plus ? "text-danger" : minus ? "text-sky-400" : ""}`}>{t(`summary.statNames.${st}`)}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas/60">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (stats[st] / (st === "hp" ? 500 : 400)) * 100)}%` }} />
                    </div>
                    <span className="w-9 text-right font-black tabular-nums">{stats[st]}</span>
                  </div>
                  <span className="text-right tabular-nums text-text-secondary">{s.baseStats[st]}</span>
                  <span className="text-right tabular-nums text-text-secondary">{p.ivs[st]}</span>
                  <span className="text-right tabular-nums text-text-secondary">{p.evs[st]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "moves" && (
        <div className="mt-3 space-y-2">
          {p.moves.map((m) => {
            const mv = dex.moves.get(m.id);
            return (
              <div key={m.id} className="rounded-tile bg-canvas/40 p-2">
                <div className="flex items-center gap-2">
                  <TypeBadge type={mv.type} small />
                  <span className="flex-1 font-black">{moveName(m.id, t.lang)}</span>
                  <span className="text-xs tabular-nums text-text-secondary">PP {m.pp}/{maxPp(m)}</span>
                </div>
                <div className="mt-1 flex gap-3 text-[11px] text-text-secondary">
                  <span>{mv.category === "Physical" ? t("summary.physical") : mv.category === "Special" ? t("summary.special") : t("summary.statusCat")}</span>
                  <span>{t("summary.power")}: {mv.basePower || "—"}</span>
                  <span>{t("summary.accuracy")}: {mv.accuracy === true ? "—" : `${mv.accuracy}%`}</span>
                </div>
                <div className="mt-1 text-xs">{moveDesc(m.id, t.lang)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-tile bg-canvas/40 p-2">
      {label && <span className="label w-24 shrink-0 pt-0.5">{label}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 font-bold">{icon}{value}</div>
        {sub && <div className="text-xs text-text-secondary">{sub}</div>}
      </div>
    </div>
  );
}
