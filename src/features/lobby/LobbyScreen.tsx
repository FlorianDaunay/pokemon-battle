import { useMemo, useState } from "react";
import { useGame, useSave } from "@/store/game";
import type { Overlay } from "@/store/game";
import { startRun, startableFloors } from "@/core/game";
import { QUESTS, questReady } from "@/core/quests";
import { LAST_MAIN_FLOOR } from "@/core/spire/themes";
import { themeForFloor, floorLevel } from "@/core/spire/floor";
import { useT } from "@/i18n";
import { themeName } from "@/core/spire/themes";
import { Particles } from "@/fx/Particles";
import { Icon } from "@/ui/Icon";
import { HpBar, PokemonSprite } from "@/ui/sprites";
import { Modal, MoneyChip } from "@/ui/layout";
import { maxHp } from "@/core/pokemon";
import { sfx } from "@/audio/sfx";
import { avatarUrl } from "@/features/title/NewGameScreen";
import { World } from "@/features/world/World";
import type { WorldEntity } from "@/features/world/World";
import { Marker, Person } from "@/features/world/props";
import { playerPic } from "@/features/world/Walker";
import { useWorldMap } from "@/features/world/useEmerald";
import { WorldLoading } from "@/features/world/WorldLoading";

// The camp is Fallarbor Town: its doors and signs lead to the camp's services, the road east to the Spire.
const CAMP = "FallarborTown";
const SPAWN = { x: 10, y: 9, dir: "down" as const };

export function LobbyScreen() {
  const t = useT();
  const save = useSave();
  const overlay = useGame((s) => s.overlay);
  const open = useGame((s) => s.open);
  const update = useGame((s) => s.update);
  const go = useGame((s) => s.go);
  const quit = useGame((s) => s.quit);
  const [picking, setPicking] = useState(false);
  const ready = QUESTS.filter((q) => questReady(save, q)).length;
  const floors = startableFloors(save);
  const lead = save.party.find((p) => p.hp > 0) ?? save.party[0];

  const enter = (floor: number) => {
    sfx("door");
    update((d) => startRun(d, floor));
    go("spire");
  };

  const station = (id: Exclude<Overlay, null>) => () => {
    sfx("select");
    open(id);
  };

  const { map, error, retry } = useWorldMap(CAMP);
  const entities = useMemo<WorldEntity[]>(() => {
    const door = (id: Exclude<Overlay, null>, x: number, y: number, label: string, badge?: number): WorldEntity => ({ id, x, y, onUse: station(id), render: (T) => <Marker T={T} label={label} badge={badge} /> });
    const spire: WorldEntity[] = [6, 7, 8, 9, 10].map((y) => ({
      id: `spire-${y}`,
      x: 19,
      y,
      solid: false,
      onUse: () => (floors.length > 1 ? setPicking(true) : enter(floors[0])),
      render: y === 8 ? (T) => <Marker T={T} label={`${t("lobby.spire")} →`} color="#ffd779" glow="rgba(255,215,120,0.6)" /> : undefined,
    }));
    return [
      door("mart", 15, 15, t("lobby.mart")),
      door("pc", 14, 7, t("lobby.pc")),
      door("tutor", 1, 6, t("lobby.tutor")),
      door("dojo", 8, 7, t("lobby.dojo")),
      door("quests", 10, 11, t("lobby.quests"), ready || undefined),
      door("trophies", 6, 8, t("lobby.trophies")),
      { id: "journal", x: 4, y: 12, onUse: station("journal"), render: (T) => <Person T={T} pic="people/prof_birch" label={t("lobby.journal")} /> },
      { id: "girl", x: 8, y: 11, render: (T) => <Person T={T} pic="people/girl_1" /> },
      { id: "expert", x: 12, y: 9, render: (T) => <Person T={T} pic="people/expert_m" dir="left" /> },
      { id: "gentleman", x: 11, y: 15, render: (T) => <Person T={T} pic="people/gentleman" /> },
      ...spire,
    ];
  }, [t, ready, floors.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 bg-[#2a2420]">
      {map ? (
        <World
          mapKey="camp"
          map={map}
          entities={entities}
          spawn={SPAWN}
          pic={playerPic(save.avatar)}
          follower={lead ? { species: lead.species, shiny: lead.shiny } : undefined}
          paused={!!overlay || picking}
        />
      ) : (
        <WorldLoading error={error} onRetry={retry} />
      )}
      <Particles ambient="dust" density={0.5} />

      <div className="pointer-events-none absolute inset-x-0 top-0 safe-pad">
        <header className="pointer-events-auto flex items-center gap-2">
          <img src={avatarUrl(save.avatar)} alt="" className="pixel hidden h-11 w-11 rounded-full bg-black/30 object-contain sm:block" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-black text-white text-shadow">{save.name}</div>
            <div className="truncate text-xs font-bold text-white/85 text-shadow"><span className="hidden sm:inline">{t("lobby.title")} · </span><span className="text-accent">{t("lobby.best")} {save.progress.best}</span></div>
          </div>
          <MoneyChip amount={save.money} />
          <button className="btn btn-sm" onClick={() => open("party")} title={t("lobby.team")}><Icon name="team" size={16} /></button>
          <button className="btn btn-sm" onClick={() => open("bag")} title={t("lobby.bag")}><Icon name="bag" size={16} /></button>
          <button className="btn btn-sm" onClick={() => open("settings")} aria-label="settings"><Icon name="gear" size={16} /></button>
          <button className="btn btn-sm" onClick={quit} title={t("lobby.saveQuit")}><Icon name="close" size={16} /></button>
        </header>
        {/* Party strip */}
        <button className="pointer-events-auto mt-2 flex gap-1 rounded-tile bg-black/35 p-1 backdrop-blur-sm" onClick={() => open("party")}>
          {save.party.map((p) => (
            <div key={p.uid} className="flex w-11 flex-col items-center">
              <PokemonSprite species={p.species} shiny={p.shiny} size={36} />
              <HpBar hp={p.hp} max={maxHp(p)} className="w-9" />
            </div>
          ))}
        </button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] font-bold text-white/80 text-shadow safe-pad">{t("world.hint")}</div>

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
