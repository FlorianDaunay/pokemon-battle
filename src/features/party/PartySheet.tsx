import { useState } from "react";
import { useGame, useSave } from "@/store/game";
import { giveItem } from "@/core/game";
import { maxHp } from "@/core/pokemon";
import { itemName, speciesName, useT } from "@/i18n";
import { HpBar, ItemIcon, PokemonSprite, StatusBadge } from "@/ui/sprites";
import { Sheet } from "@/ui/layout";
import { Icon } from "@/ui/Icon";
import { Summary } from "./Summary";

export function PartySheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const [sel, setSel] = useState<string | null>(save.party[0]?.uid ?? null);
  const [naming, setNaming] = useState(false);
  const p = save.party.find((x) => x.uid === sel) ?? save.party[0];
  const idx = save.party.findIndex((x) => x.uid === p?.uid);

  return (
    <Sheet title={t("lobby.team")} onClose={onClose} wide>
      <div className="grid gap-3 md:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-1.5">
          {save.party.map((m) => (
            <button key={m.uid} className={`flex items-center gap-2 rounded-tile border-2 p-1.5 text-left ${m.uid === p?.uid ? "border-accent bg-accent/10" : "border-transparent bg-canvas/40 hover:bg-surface-hover"}`} onClick={() => setSel(m.uid)}>
              <PokemonSprite species={m.species} shiny={m.shiny} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate text-sm font-black">{m.nickname || speciesName(m.species, t.lang)}<span className="text-xs text-text-muted">{t("common.lv")}{m.level}</span></div>
                <HpBar hp={m.hp} max={maxHp(m)} />
                <div className="flex items-center gap-1"><StatusBadge status={m.hp <= 0 ? "fnt" : m.status} />{m.item && <ItemIcon id={m.item} size={18} />}</div>
              </div>
            </button>
          ))}
        </div>
        {p && (
          <div className="card p-3">
            <Summary p={p} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button className="btn btn-sm" disabled={idx === 0} onClick={() => update((d) => { const [x] = d.party.splice(idx, 1); d.party.unshift(x); })}><Icon name="star" size={14} />{t("summary.lead")}</button>
              <button className="btn btn-sm" disabled={idx === 0} onClick={() => update((d) => { [d.party[idx - 1], d.party[idx]] = [d.party[idx], d.party[idx - 1]]; })}><Icon name="up" size={14} />{t("summary.moveUp")}</button>
              {p.item && <button className="btn btn-sm" onClick={() => update((d) => void giveItem(d, d.party[idx], undefined))}><ItemIcon id={p.item} size={16} />{t("summary.takeItem")}</button>}
              <button className="btn btn-sm" onClick={() => setNaming(true)}><Icon name="scroll" size={14} />{t("summary.nickname")}</button>
            </div>
            {naming && (
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("n") ?? "").trim().slice(0, 12); update((d) => void (d.party[idx].nickname = v || undefined)); setNaming(false); }}>
                <input name="n" className="input flex-1" defaultValue={p.nickname ?? ""} placeholder={speciesName(p.species, t.lang)} maxLength={12} autoFocus />
                <button className="btn btn-primary btn-sm">{t("common.ok")}</button>
              </form>
            )}
            {p.item && <p className="mt-2 text-xs text-text-muted">{t("summary.item")}: {itemName(p.item, t.lang)}</p>}
          </div>
        )}
      </div>
    </Sheet>
  );
}
