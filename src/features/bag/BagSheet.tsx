import { useState } from "react";
import { useGame, useSave } from "@/store/game";
import { giveItem, useItemOn } from "@/core/game";
import { itemDef } from "@/core/items";
import type { ItemCategory } from "@/core/items";
import { dex, evolutionItemsFor, STAT_IDS } from "@/core/dex";
import type { StatId } from "@/core/dex";
import { maxHp, maxPp } from "@/core/pokemon";
import type { OwnedPokemon } from "@/core/pokemon";
import { itemDesc, itemName, moveName, natureName, speciesName, useT } from "@/i18n";
import { HpBar, ItemIcon, PokemonSprite } from "@/ui/sprites";
import { Modal, Sheet, Tabs } from "@/ui/layout";
import { jingles, sfx } from "@/audio/sfx";

const CATS: ItemCategory[] = ["medicine", "ball", "battle", "berry", "held", "evolution", "training", "key"];
const USABLE: ItemCategory[] = ["medicine", "training", "evolution"];

export function BagSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const toast = useGame((s) => s.toast);
  const queueLevelUps = useGame((s) => s.queueLevelUps);
  const [cat, setCat] = useState<ItemCategory>("medicine");
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<null | "use" | "give">(null);
  const [target, setTarget] = useState<OwnedPokemon | null>(null);

  const owned = Object.entries(save.bag).filter(([id, n]) => n > 0 && (itemDef(id)?.category ?? "key") === cat);
  const def = sel ? itemDef(sel) : undefined;
  const needsMove = def?.heal?.pp && !def.heal.allMoves || sel === "ppup" || sel === "ppmax";
  const needsStat = sel === "bottlecap";
  const needsNature = sel === "mint";

  const apply = (p: OwnedPokemon, opts: { move?: number; stat?: StatId; nature?: string } = {}) => {
    if (!sel) return;
    let ok = false;
    let evolvedTo = "";
    update((d) => {
      const mon = [...d.party, ...d.box].find((x) => x.uid === p.uid);
      if (!mon) return;
      if (mode === "give") ok = giveItem(d, mon, sel);
      else {
        const r = useItemOn(d, sel, mon, opts);
        ok = r.ok;
        if (r.ok && r.kind === "level") queueLevelUps(mon.uid, r.events);
        if (r.ok && r.kind === "evolve") evolvedTo = r.into;
      }
    });
    if (ok) {
      if (evolvedTo) { jingles.evolve(); toast("battle.evolved", { name: speciesName(p.species, t.lang), into: speciesName(evolvedTo, t.lang) }, "dna"); }
      else { sfx(mode === "give" ? "confirm" : "heal"); toast(mode === "give" ? "bag.given" : "bag.worked", { name: speciesName(p.species, t.lang), item: itemName(sel, t.lang) }, "check"); }
    } else {
      sfx("error");
      toast("bag.cantUse", undefined, "info");
    }
    setTarget(null);
    setMode(null);
  };

  return (
    <Sheet title={t("bag.title")} onClose={onClose}>
      <Tabs value={cat} onChange={(c) => { setCat(c); setSel(null); }} options={CATS.map((c) => ({ id: c, label: t(`bag.cat.${c}`) }))} />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {owned.length === 0 && <p className="col-span-full py-8 text-center text-text-muted">{t("bag.empty")}</p>}
        {owned.map(([id, n]) => (
          <button key={id} className={`flex items-center gap-3 rounded-tile border-2 p-2 text-left ${sel === id ? "border-accent bg-accent/10" : "border-transparent bg-canvas/40 hover:bg-surface-hover"}`} onClick={() => setSel(id)}>
            <ItemIcon id={id} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-black">{itemName(id, t.lang)}</div>
              <div className="line-clamp-1 text-xs text-text-secondary">{itemDesc(id, t.lang)}</div>
            </div>
            <span className="font-black tabular-nums">×{n}</span>
          </button>
        ))}
      </div>
      {sel && def && (
        <div className="card sticky bottom-0 mt-3 flex flex-wrap items-center gap-2 p-3">
          <ItemIcon id={sel} size={36} />
          <p className="min-w-0 flex-1 text-sm">{itemDesc(sel, t.lang)}</p>
          {USABLE.includes(def.category) && <button className="btn btn-primary btn-sm" onClick={() => setMode("use")}>{t("common.use")}</button>}
          {def.holdable && <button className="btn btn-sm" onClick={() => setMode("give")}>{t("common.give")}</button>}
        </div>
      )}

      {mode && sel && !target && (
        <Modal onClose={() => setMode(null)}>
          <h3 className="mb-2 font-black">{t(mode === "use" ? "bag.useOn" : "bag.giveTo", { item: itemName(sel, t.lang) })}</h3>
          <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
            {save.party.map((p) => {
              const evoHint = def?.category === "evolution" && evolutionItemsFor(p.species).includes(sel);
              return (
                <button key={p.uid} className="flex items-center gap-2 rounded-tile bg-canvas/40 p-1.5 text-left hover:bg-surface-hover" onClick={() => (needsMove || needsStat || needsNature ? setTarget(p) : apply(p))}>
                  <PokemonSprite species={p.species} shiny={p.shiny} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black">{p.nickname || speciesName(p.species, t.lang)} <span className="text-xs text-text-muted">{t("common.lv")}{p.level}</span></div>
                    <HpBar hp={p.hp} max={maxHp(p)} />
                  </div>
                  {evoHint && <span className="badge bg-success/20 text-success">✓</span>}
                  {p.item && <ItemIcon id={p.item} size={20} />}
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {target && sel && (
        <Modal onClose={() => setTarget(null)}>
          {needsMove && (
            <>
              <h3 className="mb-2 font-black">{t("bag.chooseMove")}</h3>
              {target.moves.map((m, i) => (
                <button key={m.id} className="btn mb-1.5 w-full justify-between" onClick={() => apply(target, { move: i })}>
                  {moveName(m.id, t.lang)}<span className="text-xs tabular-nums">{m.pp}/{maxPp(m)}</span>
                </button>
              ))}
            </>
          )}
          {needsStat && (
            <>
              <h3 className="mb-2 font-black">{t("bag.chooseStat")}</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {STAT_IDS.map((s) => <button key={s} className="btn" disabled={target.ivs[s] >= 31} onClick={() => apply(target, { stat: s })}>{t(`summary.statNames.${s}`)} ({target.ivs[s]})</button>)}
              </div>
            </>
          )}
          {needsNature && (
            <>
              <h3 className="mb-2 font-black">{t("bag.chooseNature")}</h3>
              <div className="grid max-h-[55vh] grid-cols-2 gap-1.5 overflow-y-auto">
                {dex.natures.all().map((n) => (
                  <button key={n.id} className="btn btn-sm flex-col !items-start" disabled={n.id === target.nature} onClick={() => apply(target, { nature: n.id })}>
                    <span>{natureName(n.id, t.lang)}</span>
                    <span className="text-[10px] text-text-muted">{n.plus ? `+${t(`summary.statShort.${n.plus}`)} −${t(`summary.statShort.${n.minus}`)}` : "—"}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </Sheet>
  );
}


