import { useRef, useState } from "react";
import { useGame } from "@/store/game";
import { SLOT_COUNT, allSlots, deleteSlot, exportSave, importSaveFile, writeSlot } from "@/store/saves";
import type { SaveData } from "@/core/save";
import { speciesName, useT } from "@/i18n";
import { Scenery } from "@/fx/Scenery";
import { Particles } from "@/fx/Particles";
import { PokemonIcon } from "@/ui/sprites";
import { Icon } from "@/ui/Icon";
import { Confirm } from "@/ui/layout";

export const newGameSlot = { value: 1 };

function playTime(ms: number) {
  const m = Math.floor(ms / 60000);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

export function SlotsScreen() {
  const t = useT();
  const go = useGame((s) => s.go);
  const load = useGame((s) => s.load);
  const toast = useGame((s) => s.toast);
  const [slots, setSlots] = useState(allSlots);
  const [confirm, setConfirm] = useState<{ text: string; action: () => void; danger?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importTarget = useRef(1);

  const refresh = () => setSlots(allSlots());

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const save = await importSaveFile(file);
      const slot = importTarget.current;
      const apply = () => {
        writeSlot(slot, save);
        refresh();
        toast("slots.imported", undefined, "upload");
        setConfirm(null);
      };
      if (slots[slot - 1]) setConfirm({ text: t("slots.overwriteConfirm"), action: apply });
      else apply();
    } catch {
      toast("slots.importError", undefined, "info");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="absolute inset-0">
      <Scenery biome="league" seed={3} />
      <Particles ambient="motes" />
      <div className="absolute inset-0 flex flex-col items-center overflow-y-auto safe-pad">
        <div className="flex w-full max-w-2xl items-center gap-2 py-2">
          <button className="btn btn-ghost text-white" onClick={() => go("title")}><Icon name="back" /></button>
          <h1 className="text-2xl font-black text-white text-shadow">{t("slots.title")}</h1>
        </div>
        <div className="flex w-full max-w-2xl flex-col gap-3 pb-6">
          {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((slot) => {
            const s: SaveData | null = slots[slot - 1];
            return (
              <div key={slot} className="card p-3 animate-slide-up" style={{ animationDelay: `${slot * 60}ms` }}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="label">{t("slots.slot", { n: slot })}</span>
                  {s && <span className="text-xs text-text-muted">{playTime(s.playTimeMs)} · {new Date(s.updatedAt).toLocaleDateString(t.lang)}</span>}
                </div>
                {s ? (
                  <>
                    <button className="flex w-full items-center gap-3 rounded-tile p-2 text-left hover:bg-surface-hover" onClick={() => load(slot, s)}>
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-accent/15 font-black text-accent">{s.name.slice(0, 1).toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-lg font-black">{s.name}</div>
                        <div className="text-xs text-text-secondary">
                          {t("slots.best", { n: s.progress.best })} · {t("slots.dex", { n: s.dex.caught.length })}
                          {s.run && <> · {t("slots.floor", { n: s.run.floor })}</>}
                        </div>
                      </div>
                      <div className="hidden gap-0.5 sm:flex">
                        {s.party.map((p) => <PokemonIcon key={p.uid} species={p.species} size={36} />)}
                      </div>
                      <Icon name="play" className="text-accent" />
                    </button>
                    <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                      {s.party.map((p) => <span key={p.uid} title={speciesName(p.species, t.lang)}><PokemonIcon species={p.species} size={32} /></span>)}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-end gap-1">
                      <button className="btn btn-sm" onClick={() => { exportSave(s); toast("slots.exported", undefined, "download"); }}><Icon name="download" size={14} />{t("common.export")}</button>
                      <button className="btn btn-sm" onClick={() => { importTarget.current = slot; fileRef.current?.click(); }}><Icon name="upload" size={14} />{t("common.import")}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setConfirm({ text: t("slots.deleteConfirm"), danger: true, action: () => { deleteSlot(slot); refresh(); setConfirm(null); } })}>
                        <Icon name="trash" size={14} />{t("common.delete")}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 font-bold text-text-muted">{t("slots.empty")}</span>
                    <button className="btn btn-sm" onClick={() => { importTarget.current = slot; fileRef.current?.click(); }}><Icon name="upload" size={14} />{t("common.import")}</button>
                    <button className="btn btn-primary btn-sm" onClick={() => { newGameSlot.value = slot; go("newgame"); }}><Icon name="plus" size={14} />{t("slots.startHere")}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
      {confirm && <Confirm text={confirm.text} danger={confirm.danger} onYes={confirm.action} onNo={() => setConfirm(null)} />}
    </div>
  );
}
