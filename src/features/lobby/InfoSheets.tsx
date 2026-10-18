import { useState } from "react";
import { useGame, useSave } from "@/store/game";
import { ACHIEVEMENTS, LORE, QUESTS, claimQuest, questProgress, questReady } from "@/core/quests";
import { PLAYABLE_SPECIES, species } from "@/core/dex";
import { itemName, money, speciesName, useT } from "@/i18n";
import { ItemIcon, PokemonIcon } from "@/ui/sprites";
import { Sheet } from "@/ui/layout";
import { Icon } from "@/ui/Icon";
import { jingles } from "@/audio/sfx";

export function QuestsSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const visible = QUESTS.filter((q) => (q.unlock ?? 0) <= save.progress.best);
  const order = [...visible].sort((a, b) => Number(questReady(save, b)) - Number(questReady(save, a)) || Number(!!save.quests[a.id]?.claimed) - Number(!!save.quests[b.id]?.claimed));
  return (
    <Sheet title={t("quests.title")} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {order.map((q) => {
          const [title, desc] = t.list(`quest.${q.id}`);
          const prog = questProgress(save, q);
          const claimed = !!save.quests[q.id]?.claimed;
          const ready = questReady(save, q);
          return (
            <div key={q.id} className={`rounded-tile border p-3 ${ready ? "border-accent bg-accent/10" : "border-border bg-canvas/40"} ${claimed ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-black">{title}</div>
                  <div className="text-xs text-text-secondary">{desc}</div>
                </div>
                {claimed ? (
                  <span className="badge bg-success/20 text-success">{t("quests.claimed")}</span>
                ) : (
                  <button className="btn btn-primary btn-sm" disabled={!ready} onClick={() => { update((d) => void claimQuest(d, q.id)); jingles.item(); }}>{t("quests.claim")}</button>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas/70"><div className="h-full rounded-full bg-accent" style={{ width: `${(prog / q.goal) * 100}%` }} /></div>
                <span className="text-xs font-bold tabular-nums">{t("quests.progress", { a: prog, b: q.goal })}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="label">{t("quests.reward")}</span>
                {q.reward.money ? <span className="chip text-amber-300">{money(q.reward.money, t.lang)}</span> : null}
                {Object.entries(q.reward.items ?? {}).map(([id, n]) => <span key={id} className="chip"><ItemIcon id={id} size={16} />{itemName(id, t.lang)}{n > 1 ? ` ×${n}` : ""}</span>)}
              </div>
            </div>
          );
        })}
        {QUESTS.length > visible.length && <p className="py-3 text-center text-sm text-text-muted"><Icon name="lock" size={14} className="mr-1 inline" />{t("quests.hidden")}</p>}
      </div>
    </Sheet>
  );
}

export function TrophiesSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const got = ACHIEVEMENTS.filter((a) => save.achievements[a.id]).length;
  return (
    <Sheet title={t("trophies.title")} onClose={onClose}>
      <p className="mb-3 text-sm text-text-secondary">{t("trophies.count", { a: got, b: ACHIEVEMENTS.length })}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a) => {
          const [title, desc] = t.list(`ach.${a.id}`);
          const at = save.achievements[a.id];
          return (
            <div key={a.id} className={`flex items-center gap-3 rounded-tile border p-3 ${at ? "border-accent/50 bg-accent/10" : "border-border bg-canvas/40 opacity-60"}`}>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${at ? "bg-gradient-to-b from-amber-300 to-amber-600 text-amber-950" : "bg-surface-hover text-text-muted"}`}>
                <Icon name={at ? a.icon : "lock"} size={22} />
              </span>
              <div className="min-w-0">
                <div className="font-black">{title}</div>
                <div className="text-xs text-text-secondary">{desc}</div>
                {at && <div className="text-[10px] text-text-muted">{new Date(at).toLocaleDateString(t.lang)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

export function JournalSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Sheet title={t("journal.title")} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {LORE.map((l) => {
          const unlocked = save.progress.best >= l.floor;
          const [title, text] = t.list(`lore.${l.id}`);
          const isNew = unlocked && !save.lore.includes(l.id);
          return (
            <div key={l.id} className={`rounded-tile border border-border bg-canvas/40 ${unlocked ? "" : "opacity-50"}`}>
              <button
                className="flex w-full items-center gap-2 p-3 text-left"
                disabled={!unlocked}
                onClick={() => { setOpen(open === l.id ? null : l.id); if (isNew) update((d) => void d.lore.push(l.id)); }}
              >
                <Icon name={unlocked ? "book2" : "lock"} size={18} className="text-accent" />
                <span className="flex-1 font-black">{unlocked ? title : t("journal.lockedEntry", { n: l.floor })}</span>
                {isNew && <span className="badge bg-accent text-accent-foreground">{t("common.new")}</span>}
              </button>
              {open === l.id && <p className="px-4 pb-4 font-serif text-[15px] italic leading-relaxed text-text-secondary animate-fade">{text}</p>}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

export function DexSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const list = PLAYABLE_SPECIES.filter((id) => !species(id).forme);
  return (
    <Sheet title={t("dex.title")} onClose={onClose} wide>
      <p className="mb-3 text-sm text-text-secondary">{t("dex.seen", { n: save.dex.seen.length })} · {t("dex.caught", { n: save.dex.caught.length })}</p>
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
        {list.map((id) => {
          const caught = save.dex.caught.includes(id);
          const seen = caught || save.dex.seen.includes(id);
          return (
            <div key={id} className="flex flex-col items-center rounded-tile bg-canvas/40 p-1" title={seen ? speciesName(id, t.lang) : "???"}>
              <span className={seen ? "" : "brightness-0 opacity-30"}><PokemonIcon species={id} size={36} /></span>
              <span className="text-[9px] tabular-nums text-text-muted">{String(species(id).num).padStart(3, "0")}{caught && " ●"}</span>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
