import { useEffect, useMemo, useState } from "react";
import { useGame, useSave } from "@/store/game";
import { buy, claimRoom, clearFloor, completeRoom, earn, endRun, enterRoom, getFloor, isEmptyRoom, passRoom, restRoom } from "@/core/game";
import { addItem } from "@/core/save";
import { STEPS_PER_FLOOR } from "@/core/spire/floor";
import type { Room, RoomKind } from "@/core/spire/floor";
import { LAST_MAIN_FLOOR, themeName } from "@/core/spire/themes";
import { trainer, trainerName } from "@/core/spire/trainers";
import { itemDef } from "@/core/items";
import { maxHp } from "@/core/pokemon";
import { itemDesc, itemName, money, useT } from "@/i18n";
import { Scenery } from "@/fx/Scenery";
import { Particles } from "@/fx/Particles";
import { Icon } from "@/ui/Icon";
import { HpBar, ItemIcon, PokemonSprite, StatusBadge, TrainerSprite } from "@/ui/sprites";
import { Confirm, Modal, MoneyChip } from "@/ui/layout";
import { jingles, sfx } from "@/audio/sfx";

const KIND_STYLE: Record<RoomKind, { icon: string; glow: string; color: string }> = {
  trainer: { icon: "team", glow: "rgb(255 120 90 / 0.5)", color: "#ff8a6a" },
  wild: { icon: "sparkle", glow: "rgb(120 220 120 / 0.45)", color: "#7fe08a" },
  item: { icon: "star", glow: "rgb(255 215 100 / 0.5)", color: "#ffd56a" },
  rest: { icon: "rest", glow: "rgb(120 200 255 / 0.5)", color: "#7fd0ff" },
  merchant: { icon: "coin", glow: "rgb(220 160 255 / 0.5)", color: "#d9a0ff" },
  legend: { icon: "crown", glow: "rgb(255 255 255 / 0.7)", color: "#ffffff" },
  boss: { icon: "skull", glow: "rgb(255 80 80 / 0.6)", color: "#ff6060" },
};

export function SpireScreen() {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const go = useGame((s) => s.go);
  const open = useGame((s) => s.open);
  const startBattle = useGame((s) => s.startBattle);
  const [panel, setPanel] = useState<null | { kind: "item" | "merchant" | "rest"; room: Room }>(null);
  const [retreat, setRetreat] = useState(false);
  const run = save.run;

  const floor = useMemo(() => (run ? getFloor(structuredClone(save), run.floor) : null), [run?.floor, save.floors[String(run?.floor)]?.seed, save.legendsCaught.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!run) go("lobby");
  }, [run, go]);
  if (!run || !floor) return null;

  const theme = floor.theme;
  const cleared = run.step > STEPS_PER_FLOOR;
  const stepRooms = cleared ? [] : floor.steps[run.step];
  const apex = run.floor > LAST_MAIN_FLOOR;

  const choose = (room: Room) => {
    sfx("door");
    if (isEmptyRoom(save, room, run.floor)) {
      update((d) => passRoom(d, room.id));
      return;
    }
    update((d) => enterRoom(d, room.id));
    if (room.kind === "trainer" || room.kind === "boss" || room.kind === "wild" || room.kind === "legend") {
      startBattle({ room, floor: run.floor });
    } else {
      setPanel({ kind: room.kind as "item" | "merchant" | "rest", room });
    }
  };

  const finishRoom = () => {
    update((d) => completeRoom(d));
    setPanel(null);
  };

  return (
    <div className="absolute inset-0">
      <Scenery biome={theme.biome} seed={floor.n * 31} />
      <Particles ambient={theme.ambient} />
      <div className="absolute inset-0 flex flex-col overflow-y-auto safe-pad">
        <header className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black uppercase tracking-widest text-white/80 text-shadow">{apex ? t("spire.apexTitle") : themeName(theme, t.lang)}</div>
            <div className="text-2xl font-black text-white text-shadow">{t("spire.floor", { n: run.floor })}</div>
          </div>
          <MoneyChip amount={save.money} />
          <button className="btn btn-sm" onClick={() => open("party")}><Icon name="team" size={16} /></button>
          <button className="btn btn-sm" onClick={() => open("bag")}><Icon name="bag" size={16} /></button>
          <button className="btn btn-sm" onClick={() => setRetreat(true)} title={t("spire.retreat")}><Icon name="door" size={16} /></button>
        </header>

        {/* Progress through the floor */}
        <div className="mx-auto mt-3 flex items-center gap-1.5">
          {Array.from({ length: STEPS_PER_FLOOR + 1 }, (_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`grid h-7 w-7 place-items-center rounded-full border-2 text-[10px] font-black ${i < run.step ? "border-accent bg-accent text-accent-foreground" : i === run.step ? "border-white bg-white/20 text-white animate-pulse" : "border-white/30 text-white/50"}`}>
                {i === STEPS_PER_FLOOR ? <Icon name="skull" size={14} /> : i + 1}
              </div>
              {i < STEPS_PER_FLOOR && <div className={`h-0.5 w-4 sm:w-8 ${i < run.step ? "bg-accent" : "bg-white/30"}`} />}
            </div>
          ))}
        </div>

        {/* Party status */}
        <div className="mx-auto mt-3 flex flex-wrap justify-center gap-1.5">
          {save.party.map((p) => (
            <div key={p.uid} className={`card flex w-[92px] items-center gap-1 p-1 ${p.hp <= 0 ? "opacity-50 grayscale" : ""}`}>
              <PokemonSprite species={p.species} shiny={p.shiny} size={34} />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black">{t("common.lv")}{p.level} <StatusBadge status={p.status} /></div>
                <HpBar hp={p.hp} max={maxHp(p)} />
              </div>
            </div>
          ))}
        </div>

        <div className="my-auto py-4">
          {!cleared && (
            <>
              <p className="mb-3 text-center font-black text-white text-shadow">{run.step === STEPS_PER_FLOOR ? t("spire.kindDesc.boss") : t("spire.choose")}</p>
              <div className="mx-auto flex max-w-4xl flex-wrap items-stretch justify-center gap-3">
                {stepRooms.map((room, i) => (
                  <Door key={room.id} room={room} index={i} empty={isEmptyRoom(save, room, run.floor)} onChoose={() => choose(room)} />
                ))}
              </div>
            </>
          )}
          {cleared && <FloorCleared />}
        </div>
      </div>

      {panel?.kind === "item" && <TreasurePanel room={panel.room} onDone={finishRoom} />}
      {panel?.kind === "merchant" && <MerchantPanel room={panel.room} onDone={finishRoom} />}
      {panel?.kind === "rest" && (
        <Modal>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-sky-400/20 text-sky-300"><Icon name="heart" size={32} /></div>
            <p className="font-semibold">{t("spire.restText")}</p>
            <button className="btn btn-primary" onClick={() => { jingles.heal(); update((d) => restRoom(d)); finishRoom(); }}>{t("common.continue")}</button>
          </div>
        </Modal>
      )}
      {retreat && (
        <Confirm
          text={t("spire.retreatConfirm")}
          onNo={() => setRetreat(false)}
          onYes={() => { update((d) => endRun(d, false)); setRetreat(false); go("lobby"); }}
        />
      )}
    </div>
  );
}

function Door({ room, index, empty, onChoose }: { room: Room; index: number; empty: boolean; onChoose: () => void }) {
  const t = useT();
  const style = KIND_STYLE[room.kind];
  const tr = room.trainer ? trainer(room.trainer) : null;
  const partner = room.partner ? trainer(room.partner) : null;
  const label = partner ? "tag" : room.double ? "double" : room.kind;
  return (
    <button
      onClick={onChoose}
      className={`group relative flex w-[150px] flex-col items-center overflow-hidden rounded-t-[80px] rounded-b-card border-2 bg-gradient-to-b from-black/50 to-black/75 p-3 pt-6 text-white backdrop-blur-sm transition hover:-translate-y-1 sm:w-[190px] animate-slide-up ${empty ? "opacity-60" : ""}`}
      style={{ borderColor: style.color, ["--glow" as string]: style.glow, animation: `slide-up 0.4s ${index * 80}ms both, door-glow 2.6s ease-in-out infinite` }}
    >
      <div className="absolute inset-x-0 top-0 h-24 opacity-40" style={{ background: `radial-gradient(closest-side, ${style.color}, transparent)` }} />
      <div className="relative grid h-24 w-full place-items-center sm:h-28">
        {tr && partner ? (
          <div className="flex -space-x-8">
            <TrainerSprite trainer={tr} className="h-24 w-20 object-contain drop-shadow-lg sm:h-28 sm:w-24" />
            <TrainerSprite trainer={partner} className="h-24 w-20 object-contain drop-shadow-lg sm:h-28 sm:w-24" />
          </div>
        ) : tr ? (
          <TrainerSprite trainer={tr} className="h-24 w-24 object-contain drop-shadow-lg sm:h-28 sm:w-28" />
        ) : room.species ? (
          <div className="relative">
            <PokemonSprite species={room.species} size={84} className="brightness-0 opacity-80" />
            {room.kind === "legend" && <div className="absolute inset-0 animate-pulse rounded-full bg-white/20 blur-xl" />}
          </div>
        ) : room.kind === "merchant" ? (
          <ItemIcon id="amuletcoin" size={56} />
        ) : (
          <span style={{ color: style.color }}><Icon name={style.icon} size={52} strokeWidth={1.6} /></span>
        )}
        {room.shiny && !empty && <span className="absolute right-1 top-0 text-yellow-200 animate-pulse" title={t("spire.shinyHint")}><Icon name="sparkle" size={22} /></span>}
      </div>
      <div className="relative mt-2 text-sm font-black" style={{ color: style.color }}>{t(`spire.kind.${label}`)}</div>
      {tr && <div className="relative text-center text-xs font-bold">{trainerName(tr, t.lang)}{partner ? ` & ${trainerName(partner, t.lang)}` : <span className="text-white/60"> · {t(`trainerClass.${tr.cls}`)}</span>}</div>}
      <div className="relative mt-1 text-center text-[11px] leading-snug text-white/75">{empty ? `${t(room.kind === "item" ? "spire.claimed" : "spire.caughtHere")} ${t("spire.passThrough")}` : t(`spire.kindDesc.${label}`)}</div>
      <div className="relative mt-2 flex items-center gap-1 text-[10px] font-bold text-white/70">
        {room.kind !== "item" && room.kind !== "rest" && room.kind !== "merchant" && <span>{t("common.lv")}{room.level}</span>}
        {room.weather && <span className="chip !py-0 !text-[10px]">{t(`spire.weather.${room.weather}`)}</span>}
      </div>
    </button>
  );
}

function TreasurePanel({ room, onDone }: { room: Room; onDone: () => void }) {
  const t = useT();
  const update = useGame((s) => s.update);
  const save = useSave();
  const take = (item: string | null) => {
    jingles.item();
    update((d) => {
      if (item) addItem(d, item, itemDef(item)?.category === "ball" || itemDef(item)?.category === "medicine" ? 3 : 1);
      else earn(d, room.money ?? 0);
      claimRoom(d, save.run!.floor, room.id);
    });
    onDone();
  };
  return (
    <Modal>
      <h3 className="mb-3 text-center text-lg font-black">{t("spire.pickTreasure")}</h3>
      <div className="flex flex-col gap-2">
        {(room.items ?? []).map((id) => {
          const qty = itemDef(id)?.category === "ball" || itemDef(id)?.category === "medicine" ? 3 : 1;
          return (
            <button key={id} className="btn justify-start gap-3 py-2 text-left" onClick={() => take(id)}>
              <ItemIcon id={id} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block font-black">{itemName(id, t.lang)}{qty > 1 && ` ×${qty}`}</span>
                <span className="line-clamp-2 text-xs font-medium text-text-secondary">{itemDesc(id, t.lang)}</span>
              </span>
            </button>
          );
        })}
        <button className="btn btn-ghost" onClick={() => take(null)}>
          <Icon name="coin" size={16} />{t("spire.takeMoney", { n: money(room.money ?? 0, t.lang).replace(/[₽\s]/g, "") })}
        </button>
      </div>
    </Modal>
  );
}

function MerchantPanel({ room, onDone }: { room: Room; onDone: () => void }) {
  const t = useT();
  const update = useGame((s) => s.update);
  const save = useSave();
  const [sold, setSold] = useState<string[]>([]);
  const priceOf = (id: string) => Math.round(((itemDef(id)?.price ?? 1000) * 1.3) / 10) * 10;
  return (
    <Modal>
      <div className="mb-3 flex items-center gap-3">
        <ItemIcon id="amuletcoin" size={40} />
        <p className="flex-1 text-sm font-semibold">{t("spire.merchantHello")}</p>
        <MoneyChip amount={save.money} />
      </div>
      <div className="flex flex-col gap-2">
        {(room.items ?? []).map((id) => {
          const price = priceOf(id);
          const done = sold.includes(id);
          return (
            <div key={id} className="flex items-center gap-3 rounded-tile bg-surface-hover p-2">
              <ItemIcon id={id} size={32} />
              <div className="min-w-0 flex-1">
                <div className="font-black">{itemName(id, t.lang)}</div>
                <div className="line-clamp-1 text-xs text-text-secondary">{itemDesc(id, t.lang)}</div>
              </div>
              <button
                className="btn btn-sm btn-primary"
                disabled={done || save.money < price}
                onClick={() => { sfx("coin"); update((d) => void buy(d, id, 1, price)); setSold([...sold, id]); }}
              >
                {done ? <Icon name="check" size={14} /> : money(price, t.lang)}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <button className="btn" onClick={() => { update((d) => claimRoom(d, save.run!.floor, room.id)); onDone(); }}>{t("spire.leave")}</button>
      </div>
    </Modal>
  );
}

function FloorCleared() {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const go = useGame((s) => s.go);
  const n = save.run!.floor;
  return (
    <div className="card mx-auto max-w-md p-5 text-center animate-pop">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/20 text-accent"><Icon name="crown" size={34} /></div>
      <h2 className="mt-2 text-2xl font-black">{t("spire.cleared", { n })}</h2>
      <p className="mt-1 text-sm text-text-secondary">{t("spire.teamHealed")}</p>
      <div className="mt-4 flex flex-col gap-2">
        <button className="btn btn-primary py-3" onClick={() => { sfx("door"); update((d) => clearFloor(d)); }}>
          <Icon name="up" />{t("spire.climb", { n: n + 1 })}
        </button>
        <button className="btn" onClick={() => { update((d) => { clearFloor(d); endRun(d, false); }); go("lobby"); }}>
          <Icon name="door" />{t("spire.toCamp")}
        </button>
      </div>
    </div>
  );
}
