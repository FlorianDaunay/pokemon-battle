import { useState } from "react";
import { useGame, useSave } from "@/store/game";
import { addItem } from "@/core/save";
import { speciesName, useT } from "@/i18n";
import { PokemonIcon, PokemonSprite } from "@/ui/sprites";
import { Confirm, Sheet } from "@/ui/layout";
import { Icon } from "@/ui/Icon";
import { Summary } from "@/features/party/Summary";

export function PcSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const toast = useGame((s) => s.toast);
  const [sel, setSel] = useState<{ where: "party" | "box"; uid: string } | null>(null);
  const [query, setQuery] = useState("");
  const [release, setRelease] = useState(false);

  const mon = sel ? (sel.where === "party" ? save.party : save.box).find((p) => p.uid === sel.uid) : undefined;
  const box = save.box.filter((p) => !query || speciesName(p.species, t.lang).toLowerCase().includes(query.toLowerCase()));

  const move = () => {
    if (!sel || !mon) return;
    if (sel.where === "party") {
      if (save.party.filter((p) => p.hp > 0 && p.uid !== mon.uid).length === 0) return toast("pc.last", undefined, "info");
      update((d) => { const i = d.party.findIndex((p) => p.uid === mon.uid); d.box.push(...d.party.splice(i, 1)); });
      setSel({ where: "box", uid: mon.uid });
    } else {
      if (save.party.length >= 6) return toast("pc.full", undefined, "info");
      update((d) => { const i = d.box.findIndex((p) => p.uid === mon.uid); d.party.push(...d.box.splice(i, 1)); });
      setSel({ where: "party", uid: mon.uid });
    }
  };

  return (
    <Sheet title={t("pc.title")} onClose={onClose} wide>
      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div>
          <div className="label mb-1">{t("pc.party")} ({save.party.length}/6)</div>
          <div className="grid grid-cols-6 gap-1">
            {save.party.map((p) => (
              <button key={p.uid} className={`grid place-items-center rounded-tile border-2 p-1 ${sel?.uid === p.uid ? "border-accent bg-accent/10" : "border-transparent bg-canvas/40"}`} onClick={() => setSel({ where: "party", uid: p.uid })}>
                <PokemonSprite species={p.species} shiny={p.shiny} size={44} />
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="label flex-1">{t("pc.box")} ({save.box.length})</div>
            <input className="input w-40 py-1 text-sm" placeholder={t("pc.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="mt-1 grid grid-cols-5 gap-1 sm:grid-cols-8">
            {box.length === 0 && <p className="col-span-full py-6 text-center text-text-muted">{t("pc.emptyBox")}</p>}
            {box.map((p) => (
              <button key={p.uid} className={`relative grid place-items-center rounded-tile border-2 p-1 ${sel?.uid === p.uid ? "border-accent bg-accent/10" : "border-transparent bg-canvas/40 hover:bg-surface-hover"}`} onClick={() => setSel({ where: "box", uid: p.uid })}>
                <PokemonIcon species={p.species} size={40} />
                <span className="text-[9px] font-black">{t("common.lv")}{p.level}</span>
                {p.shiny && <span className="absolute right-0.5 top-0 text-[10px] text-yellow-300">✦</span>}
              </button>
            ))}
          </div>
        </div>
        {mon && sel && (
          <div className="card p-3">
            <Summary p={mon} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button className="btn btn-primary btn-sm" onClick={move}><Icon name="swap" size={14} />{sel.where === "party" ? t("pc.deposit") : t("pc.withdraw")}</button>
              {sel.where === "box" && <button className="btn btn-danger btn-sm" onClick={() => setRelease(true)}><Icon name="trash" size={14} />{t("pc.release")}</button>}
            </div>
          </div>
        )}
      </div>
      {release && mon && (
        <Confirm
          danger
          text={t("pc.releaseConfirm", { name: mon.nickname || speciesName(mon.species, t.lang) })}
          onNo={() => setRelease(false)}
          onYes={() => {
            update((d) => {
              const i = d.box.findIndex((p) => p.uid === mon.uid);
              const [gone] = d.box.splice(i, 1);
              if (gone?.item) addItem(d, gone.item, 1);
            });
            setSel(null);
            setRelease(false);
          }}
        />
      )}
    </Sheet>
  );
}
