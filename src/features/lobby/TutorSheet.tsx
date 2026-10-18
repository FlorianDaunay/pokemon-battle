import { useMemo, useState } from "react";
import { useGame, useSave } from "@/store/game";
import { learnMove } from "@/core/pokemon";
import { tutorMoves } from "@/core/game";
import type { TutorMove } from "@/core/game";
import { dex } from "@/core/dex";
import { money, moveDesc, moveName, speciesName, useT } from "@/i18n";
import { PokemonSprite, TypeBadge } from "@/ui/sprites";
import { Modal, MoneyChip, Sheet } from "@/ui/layout";
import { sfx } from "@/audio/sfx";

export function TutorSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const toast = useGame((s) => s.toast);
  const [uid, setUid] = useState(save.party[0]?.uid);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<TutorMove | null>(null);
  const p = save.party.find((x) => x.uid === uid) ?? save.party[0];
  const list = useMemo(() => (p ? tutorMoves(p) : []), [p]);
  const filtered = list.filter((m) => !q || moveName(m.move, t.lang).toLowerCase().includes(q.toLowerCase()) || dex.moves.get(m.move).type.toLowerCase().includes(q.toLowerCase()));

  const teach = (m: TutorMove, replace?: number) => {
    if (save.money < m.price) { sfx("error"); return toast("shop.poor", undefined, "coin"); }
    if (p.moves.length >= 4 && replace === undefined) return setPending(m);
    update((d) => {
      const mon = d.party.find((x) => x.uid === p.uid)!;
      if (learnMove(mon, m.move, replace)) {
        d.money -= m.price;
        d.stats.moneySpent += m.price;
      }
    });
    sfx("confirm");
    toast("tutor.learned", { name: p.nickname || speciesName(p.species, t.lang), move: moveName(m.move, t.lang) }, "scroll");
    setPending(null);
  };

  return (
    <Sheet title={t("tutor.title")} onClose={onClose} right={<MoneyChip amount={save.money} />} wide>
      <p className="mb-2 text-sm text-text-secondary">{t("tutor.hello")}</p>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {save.party.map((m) => (
          <button key={m.uid} className={`shrink-0 rounded-tile border-2 p-1 ${m.uid === p?.uid ? "border-accent bg-accent/10" : "border-transparent bg-canvas/40"}`} onClick={() => setUid(m.uid)}>
            <PokemonSprite species={m.species} shiny={m.shiny} size={48} />
          </button>
        ))}
      </div>
      {p && (
        <>
          <div className="mt-2 flex flex-wrap gap-1">
            {p.moves.map((m) => <span key={m.id} className="chip">{moveName(m.id, t.lang)}</span>)}
          </div>
          <input className="input mt-2 w-full" placeholder={t("tutor.search")} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {filtered.map((m) => {
              const mv = dex.moves.get(m.move);
              return (
                <div key={m.move} className="flex items-center gap-2 rounded-tile bg-canvas/40 p-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <TypeBadge type={mv.type} small />
                      <span className="truncate font-black">{moveName(m.move, t.lang)}</span>
                      <span className="badge bg-surface-hover text-text-secondary">{t(`tutor.source.${m.source}`)}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-text-secondary">{mv.basePower ? `${t("summary.power")} ${mv.basePower} · ` : ""}{mv.accuracy === true ? "" : `${mv.accuracy}% · `}{moveDesc(m.move, t.lang)}</div>
                  </div>
                  <button className="btn btn-primary btn-sm shrink-0" disabled={save.money < m.price} onClick={() => teach(m)}>{money(m.price, t.lang)}</button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {pending && p && (
        <Modal onClose={() => setPending(null)}>
          <h3 className="mb-2 font-black">{t("tutor.replace")}</h3>
          {p.moves.map((m, i) => <button key={m.id} className="btn mb-1.5 w-full" onClick={() => teach(pending, i)}>{moveName(m.id, t.lang)} → {moveName(pending.move, t.lang)}</button>)}
          <button className="btn btn-ghost w-full" onClick={() => setPending(null)}>{t("common.cancel")}</button>
        </Modal>
      )}
    </Sheet>
  );
}
