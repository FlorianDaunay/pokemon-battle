import { useState } from "react";
import { useGame, useSave } from "@/store/game";
import type { Overlay } from "@/store/game";
import { startRun, startableFloors } from "@/core/game";
import { QUESTS, questReady } from "@/core/quests";
import { LAST_MAIN_FLOOR } from "@/core/spire/themes";
import { themeForFloor, floorLevel } from "@/core/spire/floor";
import { useT } from "@/i18n";
import { themeName } from "@/core/spire/themes";
import { Scenery } from "@/fx/Scenery";
import { Particles } from "@/fx/Particles";
import { Icon } from "@/ui/Icon";
import { HpBar, PokemonSprite } from "@/ui/sprites";
import { Modal, MoneyChip } from "@/ui/layout";
import { maxHp } from "@/core/pokemon";
import { sfx } from "@/audio/sfx";
import { avatarUrl } from "@/features/title/NewGameScreen";

const STATIONS: { id: Exclude<Overlay, null>; icon: string; key: string }[] = [
  { id: "mart", icon: "shop", key: "mart" },
  { id: "pc", icon: "pc", key: "pc" },
  { id: "tutor", icon: "scroll", key: "tutor" },
  { id: "dojo", icon: "fist", key: "dojo" },
  { id: "quests", icon: "board", key: "quests" },
  { id: "trophies", icon: "trophy", key: "trophies" },
  { id: "journal", icon: "book", key: "journal" },
];

export function LobbyScreen() {
  const t = useT();
  const save = useSave();
  const open = useGame((s) => s.open);
  const update = useGame((s) => s.update);
  const go = useGame((s) => s.go);
  const quit = useGame((s) => s.quit);
  const [picking, setPicking] = useState(false);
  const ready = QUESTS.filter((q) => questReady(save, q)).length;
  const floors = startableFloors(save);

  const enter = (floor: number) => {
    sfx("door");
    update((d) => startRun(d, floor));
    go("spire");
  };

  return (
    <div className="absolute inset-0">
      <Scenery biome="coast" seed={5}>
        {/* The Spire on the horizon */}
        <svg viewBox="0 0 200 400" className="absolute bottom-[18%] left-1/2 h-[62%] -translate-x-1/2 opacity-90" preserveAspectRatio="xMidYMax meet">
          <defs>
            <linearGradient id="spire" x1="0" x2="1">
              <stop offset="0" stopColor="#2b3768" />
              <stop offset="0.5" stopColor="#4a5aa0" />
              <stop offset="1" stopColor="#1d2550" />
            </linearGradient>
          </defs>
          <path d="M100 0 L120 120 L135 300 L150 400 L50 400 L65 300 L80 120 Z" fill="url(#spire)" />
          {[60, 120, 180, 240, 300, 350].map((y, i) => <rect key={y} x={88 - i * 4} y={y} width={24 + i * 8} height="3" fill="#ffd779" opacity="0.7" style={{ animation: `pulse-glow ${2 + i * 0.4}s ease-in-out infinite` }} />)}
          <circle cx="100" cy="14" r="8" fill="#ffe9a8" style={{ filter: "blur(2px)", animation: "pulse-glow 3s ease-in-out infinite" }} />
        </svg>
      </Scenery>
      <Particles ambient="feathers" density={0.5} />

      <div className="absolute inset-0 flex flex-col overflow-y-auto safe-pad">
        <header className="flex items-center gap-2">
          <img src={avatarUrl(save.avatar)} alt="" className="pixel h-12 w-12 rounded-full bg-black/30 object-contain" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-black text-white text-shadow">{save.name}</div>
            <div className="text-xs font-bold text-white/80 text-shadow">{t("lobby.title")}</div>
          </div>
          <MoneyChip amount={save.money} />
          <button className="btn btn-sm" onClick={() => open("settings")} aria-label="settings"><Icon name="gear" size={16} /></button>
          <button className="btn btn-sm" onClick={quit} title={t("lobby.saveQuit")}><Icon name="close" size={16} /></button>
        </header>

        {/* Party strip */}
        <button className="card mt-3 flex items-center gap-2 overflow-x-auto p-2 text-left" onClick={() => open("party")}>
          {save.party.map((p) => (
            <div key={p.uid} className="flex min-w-[72px] flex-col items-center">
              <PokemonSprite species={p.species} shiny={p.shiny} size={56} />
              <div className="text-[10px] font-black">{t("common.lv")}{p.level}</div>
              <HpBar hp={p.hp} max={maxHp(p)} className="w-14" />
            </div>
          ))}
          <div className="ml-auto flex flex-col gap-1 pl-2">
            <span className="chip"><Icon name="team" size={14} />{t("lobby.team")}</span>
          </div>
        </button>

        <div className="mt-auto" />

        {/* Spire entrance */}
        <div className="card mx-auto mt-4 w-full max-w-xl p-4 text-center animate-slide-up">
          <div className="label">{t("lobby.spire")}</div>
          <div className="mt-1 flex justify-center gap-4 text-sm">
            <span><b className="text-accent">{save.progress.best}</b> <span className="text-text-muted">{t("lobby.best")}</span></span>
            <span><b className="text-accent">{save.progress.checkpoint}</b> <span className="text-text-muted">{t("lobby.checkpoint")}</span></span>
          </div>
          <button className="btn btn-primary mt-3 w-full py-3 text-base" onClick={() => (floors.length > 1 ? setPicking(true) : enter(floors[0]))}>
            <Icon name="tower" />{t("lobby.enter")}
          </button>
          <p className="mt-2 text-xs text-text-secondary">{t("lobby.spireDesc")}</p>
        </div>

        {/* Stations */}
        <div className="mx-auto mt-3 grid w-full max-w-2xl grid-cols-4 gap-2 pb-2 sm:grid-cols-8">
          <StationButton icon="bag" label={t("lobby.bag")} onClick={() => open("bag")} />
          {STATIONS.map((s) => (
            <StationButton key={s.id} icon={s.icon} label={t(`lobby.${s.key}`)} onClick={() => open(s.id)} badge={s.id === "quests" && ready ? ready : undefined} />
          ))}
        </div>
      </div>

      {picking && (
        <Modal onClose={() => setPicking(false)}>
          <h3 className="mb-3 text-lg font-black">{t("lobby.startFrom")}</h3>
          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
            {[...floors].reverse().map((f) => {
              const theme = themeForFloor(f, save.floors[String(f)]?.seed ?? 0);
              return (
                <button key={f} className="btn justify-between py-3" onClick={() => enter(f)}>
                  <span className="text-left">
                    <span className="block font-black">{t("spire.floor", { n: f })}{f === save.progress.checkpoint && <span className="badge ml-2 bg-accent text-accent-foreground">{t("lobby.checkpoint")}</span>}</span>
                    <span className="text-xs font-semibold text-text-secondary">{f > LAST_MAIN_FLOOR ? t("lobby.apex") : themeName(theme, t.lang)} · {t("common.lv")}{floorLevel(f)}</span>
                  </span>
                  <Icon name="chevron" />
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

function StationButton({ icon, label, onClick, badge }: { icon: string; label: string; onClick: () => void; badge?: number }) {
  return (
    <button className="card relative flex flex-col items-center gap-1 px-1 py-2.5 transition hover:-translate-y-0.5 hover:border-accent/60" onClick={onClick}>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-accent"><Icon name={icon} /></span>
      <span className="text-center text-[10px] font-extrabold leading-tight">{label}</span>
      {badge ? <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-black text-white">{badge}</span> : null}
    </button>
  );
}
