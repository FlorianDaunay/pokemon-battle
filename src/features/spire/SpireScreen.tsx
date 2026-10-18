import { useEffect, useMemo, useState } from "react";
import { useGame, useSave } from "@/store/game";
import { buy, claimRoom, clearFloor, completeRoom, earn, endRun, enterRoom, findRoom, getFloor, isEmptyRoom, leaveRoom, passRoom, restRoom } from "@/core/game";
import { addItem } from "@/core/save";
import { STEPS_PER_FLOOR } from "@/core/spire/floor";
import type { Floor, Room, RoomKind } from "@/core/spire/floor";
import { LAST_MAIN_FLOOR, themeName } from "@/core/spire/themes";
import { trainer, trainerName } from "@/core/spire/trainers";
import { itemDef } from "@/core/items";
import { maxHp } from "@/core/pokemon";
import { itemDesc, itemName, money, useT } from "@/i18n";
import { Scenery } from "@/fx/Scenery";
import { Particles } from "@/fx/Particles";
import { Icon } from "@/ui/Icon";
import { HpBar, ItemIcon, PokemonIcon, PokemonSprite, StatusBadge, TrainerSprite } from "@/ui/sprites";
import { Confirm, Modal, MoneyChip } from "@/ui/layout";
import { cry, jingles, sfx } from "@/audio/sfx";
import { useSettings } from "@/store/settings";
import { World } from "@/features/world/World";
import type { Cell, WorldEntity } from "@/features/world/World";
import type { Dir } from "@/features/world/Walker";
import { playerPic, trainerPic } from "@/features/world/Walker";
import { Bubble, Glow, ItemBall, Marker, Person, Tag } from "@/features/world/props";
import { MB_TALL_GRASS, preloadWorld, useWorldMap } from "@/features/world/useEmerald";
import { WorldLoading } from "@/features/world/WorldLoading";

const KIND_STYLE: Record<RoomKind, { icon: string; glow: string; color: string }> = {
  trainer: { icon: "team", glow: "rgb(255 120 90 / 0.5)", color: "#ff8a6a" },
  wild: { icon: "sparkle", glow: "rgb(120 220 120 / 0.45)", color: "#7fe08a" },
  item: { icon: "star", glow: "rgb(255 215 100 / 0.5)", color: "#ffd56a" },
  rest: { icon: "rest", glow: "rgb(120 200 255 / 0.5)", color: "#7fd0ff" },
  merchant: { icon: "coin", glow: "rgb(220 160 255 / 0.5)", color: "#d9a0ff" },
  legend: { icon: "crown", glow: "rgb(255 255 255 / 0.7)", color: "#ffffff" },
  boss: { icon: "skull", glow: "rgb(255 80 80 / 0.6)", color: "#ff6060" },
};

// The real Emerald maps the Spire is made of (Battle Pike rooms, a route, the Elite Four's rooms).
const HALL = { layout: "BattleFrontier_BattlePikeThreePathRoom", curtains: [2, 6, 10], doorY: 3, spawn: { x: 6, y: 9 }, exit: { x: 6, y: 10 } };
const ROOM = { layout: "BattleFrontier_BattlePikeRoomNormal", spot: { x: 4, y: 4 }, way: { x: 4, y: 3 }, spawn: { x: 4, y: 6 }, exit: { x: 4, y: 7 } };
const MEADOW = { layout: "Route101", spot: { x: 13, y: 11 }, spawn: { x: 10, y: 17 }, exit: { x: 10, y: 18 } };
const ARENAS = ["EverGrandeCity_SidneysRoom", "EverGrandeCity_PhoebesRoom", "EverGrandeCity_GlaciasRoom", "EverGrandeCity_DrakesRoom"];
const ARENA = { spot: { x: 6, y: 5 }, spawn: { x: 6, y: 12 }, exit: { x: 6, y: 13 } };
const curtainsFor = (n: number) => (n === 1 ? [6] : n === 2 ? [2, 10] : [2, 6, 10]);

const roomLabel = (room: Room) => (room.partner ? "tag" : room.double ? "double" : room.kind);

export function SpireScreen() {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const go = useGame((s) => s.go);
  const open = useGame((s) => s.open);
  const overlay = useGame((s) => s.overlay);
  const [retreat, setRetreat] = useState(false);
  const [hallSpawn, setHallSpawn] = useState<(Cell & { dir: Dir }) | null>(null);
  const run = save.run;

  const floor = useMemo(() => (run ? getFloor(structuredClone(save), run.floor) : null), [run?.floor, save.floors[String(run?.floor)]?.seed, save.legendsCaught.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!run) go("lobby");
  }, [run, go]);
  useEffect(() => preloadWorld([HALL.layout, ROOM.layout, MEADOW.layout, ...ARENAS]), []);
  // A new step starts at the entrance.
  useEffect(() => setHallSpawn(null), [run?.step, run?.floor]);
  if (!run || !floor) return null;

  const theme = floor.theme;
  const apex = run.floor > LAST_MAIN_FLOOR;
  const room = run.current ? findRoom(floor, run.current) : undefined;
  const lead = save.party.find((p) => p.hp > 0) ?? save.party[0];
  const follower = lead ? { species: lead.species, shiny: lead.shiny } : undefined;
  const pic = playerPic(save.avatar);

  const leave = (doorX: number) => {
    sfx("door");
    update((d) => leaveRoom(d));
    setHallSpawn({ x: doorX, y: HALL.doorY + 1, dir: "down" });
  };

  return (
    <div className="absolute inset-0">
      <Scenery biome={theme.biome} seed={floor.n * 31} dim={0.3} />
      {room ? (
        <RoomView key={room.id} room={room} floor={floor} pic={pic} follower={follower} paused={!!overlay || retreat} onLeave={leave} />
      ) : (
        <HallView floor={floor} step={run.step} rooms={run.step <= STEPS_PER_FLOOR ? floor.steps[run.step] : []} spawn={hallSpawn} pic={pic} follower={follower} paused={!!overlay || retreat} onRetreat={() => setRetreat(true)} />
      )}
      <Particles ambient={theme.ambient} density={0.4} />

      <div className="pointer-events-none absolute inset-x-0 top-0 safe-pad">
        <header className="pointer-events-auto flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-black uppercase tracking-widest text-white/80 text-shadow">{apex ? t("spire.apexTitle") : themeName(theme, t.lang)}</div>
            <div className="text-xl font-black text-white text-shadow">{t("spire.floor", { n: run.floor })}</div>
          </div>
          <MoneyChip amount={save.money} />
          <button className="btn btn-sm" onClick={() => open("party")}><Icon name="team" size={16} /></button>
          <button className="btn btn-sm" onClick={() => open("bag")}><Icon name="bag" size={16} /></button>
          <button className="btn btn-sm" onClick={() => setRetreat(true)} title={t("spire.retreat")}><Icon name="door" size={16} /></button>
        </header>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {/* Progress through the floor */}
          <div className="flex items-center gap-1">
            {Array.from({ length: STEPS_PER_FLOOR + 1 }, (_, i) => (
              <div key={i} className={`grid h-5 w-5 place-items-center rounded-full border-2 text-[9px] font-black ${i < run.step ? "border-accent bg-accent text-accent-foreground" : i === run.step ? "border-white bg-white/25 text-white animate-pulse" : "border-white/30 text-white/50"}`}>
                {i === STEPS_PER_FLOOR ? <Icon name="skull" size={10} /> : i + 1}
              </div>
            ))}
          </div>
          {/* Party status */}
          <button className="pointer-events-auto flex gap-0.5 rounded-tile bg-black/45 p-0.5 backdrop-blur-sm" onClick={() => open("party")}>
            {save.party.map((p) => (
              <div key={p.uid} className={`flex w-9 flex-col items-center ${p.hp <= 0 ? "opacity-50 grayscale" : ""}`}>
                <PokemonIcon species={p.species} size={30} />
                <HpBar hp={p.hp} max={maxHp(p)} className="w-8" />
                {p.status && <span className="scale-75"><StatusBadge status={p.status} /></span>}
              </div>
            ))}
          </button>
        </div>
      </div>

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

// ---------------------------------------------------------------------------------------------
// The hall: one curtain per door

function HallView({ floor, step, rooms, spawn, pic, follower, paused, onRetreat }: { floor: Floor; step: number; rooms: Room[]; spawn: (Cell & { dir: Dir }) | null; pic: string; follower?: { species: string; shiny: boolean }; paused: boolean; onRetreat: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const { map, error, retry } = useWorldMap(HALL.layout);
  const [focus, setFocus] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const floorN = floor.n;
  const done = step > STEPS_PER_FLOOR;
  const xs = done ? [6] : curtainsFor(rooms.length);

  const choose = (room: Room) => {
    sfx("door");
    // Spent doors are passages: the next room is just behind.
    if (isEmptyRoom(save, room, floorN)) update((d) => passRoom(d, room.id));
    else update((d) => enterRoom(d, room.id));
  };

  const entities = useMemo<WorldEntity[]>(() => {
    const out: WorldEntity[] = [
      { id: "down", x: HALL.exit.x, y: HALL.exit.y, solid: false, onUse: onRetreat, render: (T) => <Marker T={T} label={t("world.stairsDown")} top={0.75} /> },
    ];
    // Curtains with nothing behind stay shut.
    for (const x of HALL.curtains) if (!xs.includes(x)) out.push({ id: `shut-${x}`, x, y: HALL.doorY });
    if (done) {
      out.push({ id: "up", x: 6, y: HALL.doorY, solid: false, onUse: () => { sfx("door"); setCleared(true); } });
      out.push({ id: "up-mark", x: 6, y: HALL.doorY, ghost: true, above: true, render: (T) => <Marker T={T} label={t("world.stairsUp")} color="#ffd779" glow="rgba(255,215,120,0.7)" /> });
      return out;
    }
    rooms.forEach((room, i) => {
      const style = KIND_STYLE[room.kind];
      const empty = isEmptyRoom(save, room, floorN);
      out.push({ id: room.id, x: xs[i], y: HALL.doorY, solid: false, approach: true, onUse: () => choose(room) });
      // What waits behind, shown over the curtain (above the map's top layer).
      out.push({
        id: `${room.id}-preview`,
        x: xs[i],
        y: HALL.doorY,
        ghost: true,
        above: true,
        render: (T) => (
          <div className="absolute inset-0" style={{ opacity: empty ? 0.55 : 1 }}>
            <div className="absolute left-1/2 grid -translate-x-1/2 place-items-center" style={{ top: -T * 1.9, width: T * 2, height: T * 1.6 }}>
              <Glow color={style.glow} />
              <DoorPreview room={room} T={T} empty={empty} />
            </div>
            <Tag T={T} top={-2.35} color={style.color}>{t(`spire.kind.${roomLabel(room)}`)}</Tag>
          </div>
        ),
      });
    });
    return out;
  }, [rooms, done, save.floors, floorN, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const focused = rooms.find((r) => r.id === focus);
  const start = spawn ?? { ...HALL.spawn, dir: "up" as const };
  if (!map) return <WorldLoading error={error} onRetry={retry} />;

  return (
    <>
      <World
        mapKey={`hall-${floorN}-${step}-${spawn ? `${spawn.x}` : "s"}`}
        map={map}
        entities={entities}
        spawn={start}
        pic={pic}
        follower={follower}
        paused={paused || cleared}
        onFocus={setFocus}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 p-2 safe-pad">
        {focused ? (
          <DoorCard room={focused} floorN={floorN} onEnter={() => choose(focused)} />
        ) : (
          <div className="rounded-pill bg-black/60 px-3 py-1 text-center text-xs font-black text-white text-shadow">
            {done ? t("spire.cleared", { n: floorN }) : step === STEPS_PER_FLOOR ? t("spire.kindDesc.boss") : t("spire.choose")}
          </div>
        )}
      </div>
      {cleared && <FloorCleared onClose={() => setCleared(false)} />}
    </>
  );
}

function DoorPreview({ room, T, empty }: { room: Room; T: number; empty: boolean }) {
  const t = useT();
  const style = KIND_STYLE[room.kind];
  const tr = room.trainer ? trainer(room.trainer) : null;
  const partner = room.partner ? trainer(room.partner) : null;
  const size = T * 1.5;
  return (
    <div className="relative flex items-end justify-center" style={{ height: size }}>
      {tr && partner ? (
        <>
          <TrainerSprite trainer={tr} className="object-contain drop-shadow-lg" style={{ width: size * 0.8, height: size }} />
          <TrainerSprite trainer={partner} className="object-contain drop-shadow-lg" style={{ width: size * 0.8, height: size, marginLeft: -size * 0.3 }} />
        </>
      ) : tr ? (
        <TrainerSprite trainer={tr} className="object-contain drop-shadow-lg" style={{ width: size, height: size }} />
      ) : room.species && !empty ? (
        <PokemonSprite species={room.species} size={size} className="brightness-0 opacity-80" />
      ) : room.kind === "merchant" ? (
        <ItemIcon id="amuletcoin" size={T * 0.9} />
      ) : (
        <span className="drop-shadow" style={{ color: style.color }}><Icon name={empty ? "door" : style.icon} size={T * 0.9} strokeWidth={1.8} /></span>
      )}
      {room.shiny && !empty && <span className="absolute -right-1 top-0 text-yellow-200 animate-pulse" title={t("spire.shinyHint")}><Icon name="sparkle" size={T * 0.4} /></span>}
    </div>
  );
}

function DoorCard({ room, floorN, onEnter }: { room: Room; floorN: number; onEnter: () => void }) {
  const t = useT();
  const save = useSave();
  const style = KIND_STYLE[room.kind];
  const tr = room.trainer ? trainer(room.trainer) : null;
  const partner = room.partner ? trainer(room.partner) : null;
  const empty = isEmptyRoom(save, room, floorN);
  const label = roomLabel(room);
  return (
    <div className="pointer-events-auto card flex w-full max-w-md items-center gap-3 p-2.5 animate-slide-up" style={{ borderColor: style.color }}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black" style={{ color: style.color }}>{t(`spire.kind.${label}`)}</div>
        {tr && <div className="truncate text-xs font-bold">{trainerName(tr, t.lang)}{partner ? ` & ${trainerName(partner, t.lang)}` : ` · ${t(`trainerClass.${tr.cls}`)}`}</div>}
        <div className="text-[11px] leading-snug text-text-secondary">{empty ? emptyText(t, room) : t(`spire.kindDesc.${label}`)}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-text-muted">
          {room.kind !== "item" && room.kind !== "rest" && room.kind !== "merchant" && <span>{t("common.lv")}{room.level}</span>}
          {room.weather && <span className="chip !py-0 !text-[10px]">{t(`spire.weather.${room.weather}`)}</span>}
        </div>
      </div>
      <button className="btn btn-primary" onClick={onEnter}><Icon name="door" size={16} />{t("world.enter")}</button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Inside a room

function RoomView({ room, floor, pic, follower, paused, onLeave }: { room: Room; floor: Floor; pic: string; follower?: { species: string; shiny: boolean }; paused: boolean; onLeave: (doorX: number) => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const startBattle = useGame((s) => s.startBattle);
  const criesOn = useSettings((s) => s.cries);
  const [panel, setPanel] = useState<null | "item" | "merchant" | "rest">(null);
  const [alert, setAlert] = useState(false);
  const floorN = floor.n;
  const empty = isEmptyRoom(save, room, floorN);
  const wild = (room.kind === "wild" || room.kind === "legend") && !empty;
  const boss = room.kind === "boss";
  const place = wild ? MEADOW : boss ? ARENA : ROOM;
  const layout = wild ? MEADOW.layout : boss ? ARENAS[floorN % ARENAS.length] : ROOM.layout;
  const { map, error, retry } = useWorldMap(layout);
  const doorX = (() => {
    const s = floor.steps.findIndex((st) => st.some((r) => r.id === room.id));
    const xs = curtainsFor(floor.steps[s]?.length ?? 1);
    return xs[floor.steps[s]?.findIndex((r) => r.id === room.id) ?? 0] ?? HALL.spawn.x;
  })();

  const battle = () => {
    if (alert) return;
    setAlert(true);
    sfx("door");
    if (room.species && criesOn) cry(room.species);
    setTimeout(() => startBattle({ room, floor: floorN }), 650);
  };

  // Trainers spot you once you come close; wild Pokémon jump out of the tall grass.
  const spotted = (at: Cell) => {
    if (empty || !map) return;
    if ((room.kind === "trainer" && at.y <= ROOM.spot.y + 1) || (boss && at.y <= ARENA.spot.y + 2)) battle();
    if (wild && map.behavior[at.y * map.width + at.x] === MB_TALL_GRASS) battle();
  };

  const finishRoom = () => {
    update((d) => completeRoom(d));
    setPanel(null);
  };

  const entities = useMemo<WorldEntity[]>(() => {
    const out: WorldEntity[] = [
      { id: "entrance", x: place.exit.x, y: place.exit.y, solid: false, onUse: () => onLeave(doorX), render: (T) => <Marker T={T} label={t("world.back")} top={0.75} /> },
    ];
    if (empty) {
      out.push({ id: "exit", x: ROOM.way.x, y: ROOM.way.y, solid: false, onUse: () => { sfx("door"); update((d) => completeRoom(d)); }, render: (T) => <Marker T={T} label={t("world.exit")} color="#ffd779" glow="rgba(255,215,120,0.7)" /> });
      return out;
    }
    const spot = place.spot;
    const tr = room.trainer ? trainer(room.trainer) : null;
    const partner = room.partner ? trainer(room.partner) : null;
    const color = KIND_STYLE[room.kind].color;
    switch (room.kind) {
      case "boss":
      case "trainer": {
        const who = [tr, partner].filter((x): x is NonNullable<typeof x> => !!x);
        const xs = who.length > 1 ? [spot.x - 1, spot.x + 1] : [spot.x];
        who.forEach((x, i) => {
          out.push({ id: `tr-${i}`, x: xs[i], y: spot.y, onUse: battle, render: (T) => <Person T={T} pic={trainerPic(x.id, x.cls)} label={trainerName(x, t.lang)} labelColor={color} badge={alert ? "!" : undefined} /> });
        });
        break;
      }
      case "wild":
      case "legend":
        out.push({
          id: "mon",
          x: spot.x,
          y: spot.y,
          onUse: battle,
          render: (T) => (
            <div className="absolute inset-0 grid place-items-end justify-center">
              {room.kind === "legend" && <Glow color="rgba(255,255,255,0.7)" />}
              <div className="animate-bob"><PokemonIcon species={room.species!} size={T * 1.4} /></div>
              {alert && <Bubble T={T}>!</Bubble>}
            </div>
          ),
        });
        break;
      case "item":
        out.push({ id: "ball", x: spot.x, y: spot.y, onUse: () => { sfx("click"); setPanel("item"); }, render: (T) => <><Glow /><ItemBall T={T} /></> });
        break;
      case "rest":
        out.push({ id: "nurse", x: spot.x, y: spot.y, onUse: () => setPanel("rest"), render: (T) => <Person T={T} pic="people/nurse" label={t("spire.kind.rest")} labelColor={color} /> });
        break;
      case "merchant":
        out.push({ id: "merchant", x: spot.x, y: spot.y, onUse: () => setPanel("merchant"), render: (T) => <Person T={T} pic="people/mart_employee" label={t("spire.kind.merchant")} labelColor={color} /> });
        break;
    }
    return out;
  }, [room, empty, alert, t, place]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!map) return <WorldLoading error={error} onRetry={retry} />;
  return (
    <>
      <World
        mapKey={`room-${room.id}-${layout}`}
        map={map}
        entities={entities}
        spawn={{ ...place.spawn, dir: "up" }}
        pic={pic}
        follower={follower}
        paused={paused || !!panel || alert}
        onStep={spotted}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2 safe-pad">
        <div className="rounded-pill bg-black/60 px-3 py-1 text-center text-xs font-black text-white text-shadow">
          {empty ? emptyText(t, room) : t(`spire.kindDesc.${roomLabel(room)}`)}
        </div>
      </div>

      {panel === "item" && <TreasurePanel room={room} onDone={finishRoom} />}
      {panel === "merchant" && <MerchantPanel room={room} onDone={finishRoom} />}
      {panel === "rest" && (
        <Modal>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-sky-400/20 text-sky-300"><Icon name="heart" size={32} /></div>
            <p className="font-semibold">{t("spire.restText")}</p>
            <button className="btn btn-primary" onClick={() => { jingles.heal(); update((d) => restRoom(d)); finishRoom(); }}>{t("common.continue")}</button>
          </div>
        </Modal>
      )}
    </>
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

function FloorCleared({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const go = useGame((s) => s.go);
  const n = save.run!.floor;
  return (
    <Modal onClose={onClose}>
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/20 text-accent"><Icon name="crown" size={34} /></div>
        <h2 className="mt-2 text-2xl font-black">{t("spire.cleared", { n })}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("spire.teamHealed")}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button className="btn btn-primary py-3" onClick={() => { sfx("door"); update((d) => clearFloor(d)); onClose(); }}>
            <Icon name="up" />{t("spire.climb", { n: n + 1 })}
          </button>
          <button className="btn" onClick={() => { update((d) => { clearFloor(d); endRun(d, false); }); go("lobby"); }}>
            <Icon name="door" />{t("spire.toCamp")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function emptyText(t: ReturnType<typeof useT>, room: Room): string {
  return room.kind === "item" ? `${t("spire.claimed")}. ${t("spire.passThrough")}` : `${t("spire.caughtHere")} ${t("spire.passThrough")}`;
}
