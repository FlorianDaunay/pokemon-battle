import { useEffect, useRef, useState } from "react";
import { useGame } from "@/store/game";
import type { Pending } from "@/store/game";
import { evolve, learnMove } from "@/core/pokemon";
import type { OwnedPokemon } from "@/core/pokemon";
import { dex } from "@/core/dex";
import { moveDesc, moveName, speciesName, useT } from "@/i18n";
import { Modal } from "@/ui/layout";
import { PokemonSprite, TypeBadge } from "@/ui/sprites";
import { Particles } from "@/fx/Particles";
import { music } from "@/audio/sequencer";
import { TRACKS } from "@/audio/tracks";
import { cry, jingles, sfx } from "@/audio/sfx";
import { restoreMusic } from "@/features/MusicDirector";

/** Learn-move prompts and evolutions queued after battles or Rare Candies. */
export function PendingQueue() {
  const pending = useGame((s) => s.pending);
  const screen = useGame((s) => s.screen);
  const save = useGame((s) => s.save);
  const resolve = useGame((s) => s.resolvePending);
  const head = pending[0];
  if (!head || !save || screen === "battle" || screen === "title") return null;
  const mon = [...save.party, ...save.box].find((p) => p.uid === head.uid);
  if (!mon) {
    queueMicrotask(resolve);
    return null;
  }
  if (head.kind === "learn") return <LearnMove key={`${head.uid}-${head.move}`} mon={mon} item={head} />;
  return <Evolution key={`${head.uid}-${head.into}`} mon={mon} into={head.into} />;
}

function LearnMove({ mon, item }: { mon: OwnedPokemon; item: Extract<Pending, { kind: "learn" }> }) {
  const t = useT();
  const update = useGame((s) => s.update);
  const resolve = useGame((s) => s.resolvePending);
  const name = mon.nickname || speciesName(mon.species, t.lang);
  const already = mon.moves.some((m) => m.id === item.move);

  useEffect(() => {
    if (already) resolve();
    else if (mon.moves.length < 4) {
      update((d) => { const p = [...d.party, ...d.box].find((x) => x.uid === mon.uid); if (p) learnMove(p, item.move); });
      useGame.getState().toast("battle.learned", { name, move: moveName(item.move, t.lang) }, "scroll");
      sfx("confirm");
      resolve();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (already || mon.moves.length < 4) return null;
  const nm = dex.moves.get(item.move);
  const choose = (i: number | null) => {
    if (i !== null) {
      const old = moveName(mon.moves[i].id, t.lang);
      update((d) => { const p = [...d.party, ...d.box].find((x) => x.uid === mon.uid); if (p) learnMove(p, item.move, i); });
      useGame.getState().toast("battle.forgot", { name, old, move: moveName(item.move, t.lang) }, "scroll");
    } else useGame.getState().toast("battle.skipLearn", { name, move: moveName(item.move, t.lang) }, "scroll");
    resolve();
  };
  return (
    <Modal>
      <div className="mb-3 flex items-center gap-3">
        <PokemonSprite species={mon.species} shiny={mon.shiny} size={56} />
        <p className="text-sm font-semibold">{t("battle.wantsLearn", { name, move: moveName(item.move, t.lang) })}</p>
      </div>
      <div className="mb-3 rounded-tile border border-accent/50 bg-accent/10 p-2">
        <div className="flex items-center gap-2"><TypeBadge type={nm.type} small /><b>{moveName(item.move, t.lang)}</b><span className="ml-auto text-xs">{nm.basePower || "—"} / {nm.accuracy === true ? "—" : nm.accuracy}</span></div>
        <p className="mt-1 text-xs text-text-secondary">{moveDesc(item.move, t.lang)}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {mon.moves.map((m, i) => {
          const mv = dex.moves.get(m.id);
          return (
            <button key={m.id} className="btn justify-start" onClick={() => choose(i)}>
              <TypeBadge type={mv.type} small /><span className="flex-1 text-left">{moveName(m.id, t.lang)}</span><span className="text-xs text-text-muted">{mv.basePower || "—"}</span>
            </button>
          );
        })}
        <button className="btn btn-ghost" onClick={() => choose(null)}>{t("common.cancel")}</button>
      </div>
    </Modal>
  );
}

function Evolution({ mon, into }: { mon: OwnedPokemon; into: string }) {
  const t = useT();
  const update = useGame((s) => s.update);
  const resolve = useGame((s) => s.resolvePending);
  const [phase, setPhase] = useState<"start" | "morph" | "done" | "stopped">("start");
  const [showNew, setShowNew] = useState(false);
  const timers = useRef<number[]>([]);
  const name = mon.nickname || speciesName(mon.species, t.lang);

  useEffect(() => {
    music.play("evolutionLoop", TRACKS.evolutionLoop, 0.2);
    cry(mon.species);
    timers.current.push(window.setTimeout(() => setPhase("morph"), 1600));
    // Flicker between the two forms, faster and faster.
    let delay = 500;
    let at = 1600;
    let flip = false;
    while (at < 6200) {
      const show = (flip = !flip);
      timers.current.push(window.setTimeout(() => setShowNew(show), at));
      at += delay;
      delay = Math.max(70, delay * 0.82);
    }
    timers.current.push(window.setTimeout(() => {
      setShowNew(true);
      setPhase("done");
      sfx("evolveFlash");
      jingles.evolve();
      cry(into);
      update((d) => {
        const p = [...d.party, ...d.box].find((x) => x.uid === mon.uid);
        if (!p) return;
        evolve(p, into);
        d.stats.evolutions++;
        if (!d.dex.caught.includes(into)) d.dex.caught.push(into);
        if (!d.dex.seen.includes(into)) d.dex.seen.push(into);
      });
    }, 6400));
    return () => timers.current.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => {
    timers.current.forEach(clearTimeout);
    setShowNew(false);
    setPhase("stopped");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-gradient-to-b from-[#0b0d1a] via-[#1b1f44] to-[#0b0d1a] animate-fade">
      <Particles ambient="sparkles" />
      <div className="absolute h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(closest-side, #9fd8ff, transparent)", animation: phase === "morph" ? "pulse-glow 0.6s ease-in-out infinite" : undefined }} />
      <div className="relative flex flex-col items-center gap-6 px-4">
        <div style={{ animation: phase === "morph" ? "evo-glow 0.5s ease-in-out infinite" : undefined }}>
          <PokemonSprite species={showNew ? into : mon.species} shiny={mon.shiny} size={180} />
        </div>
        <div className="dialog-box max-w-lg px-5 py-3 text-center text-lg font-bold">
          {phase === "start" || phase === "morph" ? t("battle.evolving", { name }) : phase === "done" ? t("battle.evolved", { name, into: speciesName(into, t.lang) }) : t("battle.evoStopped", { name })}
        </div>
        {phase === "morph" && <button className="btn" onClick={stop}>{t("battle.stopEvo")}</button>}
        {(phase === "done" || phase === "stopped") && <button className="btn btn-primary" onClick={() => { restoreMusic(); resolve(); }}>{t("common.continue")}</button>}
      </div>
    </div>
  );
}
