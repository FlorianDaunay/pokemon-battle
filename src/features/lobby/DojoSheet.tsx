import { useEffect, useState } from "react";
import { useGame, useSave } from "@/store/game";
import { dojoPrice, setEvs } from "@/core/game";
import { STAT_IDS } from "@/core/dex";
import type { StatId, StatTable } from "@/core/dex";
import { statsOf } from "@/core/pokemon";
import { money, speciesName, useT } from "@/i18n";
import { PokemonSprite } from "@/ui/sprites";
import { MoneyChip, Sheet } from "@/ui/layout";
import { sfx } from "@/audio/sfx";

const PRESETS: Record<string, StatTable> = {
  phys: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
  spec: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
  tank: { hp: 252, atk: 0, def: 128, spa: 0, spd: 128, spe: 0 },
  balanced: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 },
};

export function DojoSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const toast = useGame((s) => s.toast);
  const [uid, setUid] = useState(save.party[0]?.uid);
  const p = save.party.find((x) => x.uid === uid) ?? save.party[0];
  const [evs, setLocal] = useState<StatTable>(p.evs);
  useEffect(() => setLocal(p.evs), [p.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = Object.values(evs).reduce((a, b) => a + b, 0);
  const preview = statsOf({ ...p, evs });
  const price = dojoPrice(p);

  const set = (s: StatId, v: number) => {
    const others = total - evs[s];
    setLocal({ ...evs, [s]: Math.max(0, Math.min(252, v, 510 - others)) });
  };

  return (
    <Sheet title={t("dojo.title")} onClose={onClose} right={<MoneyChip amount={save.money} />}>
      <p className="mb-2 text-sm text-text-secondary">{t("dojo.hello")}</p>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {save.party.map((m) => (
          <button key={m.uid} className={`shrink-0 rounded-tile border-2 p-1 ${m.uid === p.uid ? "border-accent bg-accent/10" : "border-transparent bg-canvas/40"}`} onClick={() => setUid(m.uid)}>
            <PokemonSprite species={m.species} shiny={m.shiny} size={48} />
          </button>
        ))}
      </div>
      <div className="card mt-2 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-black">{p.nickname || speciesName(p.species, t.lang)}</span>
          <span className={`chip ${510 - total === 0 ? "text-success" : ""}`}>{t("dojo.remaining", { n: 510 - total })}</span>
        </div>
        {STAT_IDS.map((s) => (
          <div key={s} className="mb-2 grid grid-cols-[80px_1fr_44px_44px] items-center gap-2 text-sm">
            <span className="font-bold">{t(`summary.statShort.${s}`)}</span>
            <input type="range" min={0} max={252} step={4} value={evs[s]} onChange={(e) => set(s, Number(e.target.value))} className="accent-[rgb(var(--color-accent))]" />
            <span className="text-right tabular-nums">{evs[s]}</span>
            <span className="text-right font-black tabular-nums">{preview[s]}</span>
          </div>
        ))}
        <div className="label mt-2">{t("dojo.presets")}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.entries(PRESETS).map(([k, v]) => <button key={k} className="btn btn-sm" onClick={() => setLocal(v)}>{t(`dojo.presetNames.${k}`)}</button>)}
          <button className="btn btn-sm btn-ghost" onClick={() => setLocal({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 })}>{t("dojo.reset")}</button>
        </div>
        <button
          className="btn btn-primary mt-3 w-full"
          disabled={save.money < price}
          onClick={() => {
            let ok = false;
            update((d) => { ok = setEvs(d, d.party.find((x) => x.uid === p.uid)!, evs); });
            if (ok) { sfx("statUp"); toast("dojo.done", { name: p.nickname || speciesName(p.species, t.lang) }, "fist"); } else sfx("error");
          }}
        >
          {t("dojo.apply", { n: money(price, t.lang).replace(/[₽\s]/g, "") })}
        </button>
      </div>
    </Sheet>
  );
}
