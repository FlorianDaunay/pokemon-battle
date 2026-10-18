import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame, useSave } from "@/store/game";
import { useSettings } from "@/store/settings";
import { BattleController, needsTarget } from "@/core/battle/engine";
import type { MoveOption, PlayerRequest, SlotAction } from "@/core/battle/engine";
import type { BattleEvent, Side } from "@/core/battle/protocol";
import type { AiLevel } from "@/core/battle/ai";
import { claimRoom, completeRoom, distributeExp, earn, endRun, getFloor, shinyRate } from "@/core/game";
import type { ExpResult } from "@/core/game";
import { addItem, receivePokemon, registerSeen } from "@/core/save";
import { buildNpcPokemon, buildRoomTeam, qualityFor } from "@/core/spire/teams";
import { trainer as trainerDef, trainerName } from "@/core/spire/trainers";
import type { TrainerDef } from "@/core/spire/trainers";
import { trainerReward } from "@/core/spire/floor";
import { dex, toID, TYPE_COLORS } from "@/core/dex";
import { itemDef } from "@/core/items";
import { levelProgress, maxHp } from "@/core/pokemon";
import type { OwnedPokemon } from "@/core/pokemon";
import { Rng } from "@/core/rng";
import { itemName, moveName, speciesName, translate, translateList, useT } from "@/i18n";
import { PALETTES } from "@/fx/Scenery";
import { Particles } from "@/fx/Particles";
import { ExpBar, GenderIcon, HpBar, ItemIcon, PokemonSprite, StatusBadge, TrainerSprite, TypeBadge } from "@/ui/sprites";
import { Icon, PokeBall } from "@/ui/Icon";
import { music } from "@/audio/sequencer";
import { TRACKS } from "@/audio/tracks";
import type { TrackId } from "@/audio/tracks";
import { cry, hitSfx, jingles, sfx } from "@/audio/sfx";
import { avatarUrl } from "@/features/title/NewGameScreen";
import { MoveFx } from "./MoveFx";
import type { FxPoint, MoveFxHandle } from "./MoveFx";
import { effectLabel, narrate } from "./narrate";

interface SideView {
  slot: number;
  species: string;
  level: number;
  hp: number;
  maxhp: number;
  status?: string;
  shiny: boolean;
  gender: string;
  anim: string;
  visible: boolean;
  /** Stat stages (−6…+6), only the non-zero ones. */
  boosts: Record<string, number>;
  /** Behind a Substitute. */
  sub: boolean;
  confused: boolean;
}

/** What lies on the field: hazards and screens per side (with layers or turns), field effects. */
interface FieldView {
  sides: Record<Side, Record<string, number>>;
  field: string[];
  /** Turns of weather left, null when it lasts (abilities in Gen 5, the floor's own weather). */
  weatherTurns: number | null;
}

/** The Pokémon on one side of the field, by position (one entry in singles, two in doubles). */
type Views = (SideView | null)[];

type Menu = "none" | "main" | "fight" | "target" | "bag" | "party" | "forceSwitch" | "results";

/** A move target the player can pick in doubles. */
interface TargetOption {
  side: Side;
  pos: number;
  /** Showdown target location. */
  loc: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PHYSICAL_CONTACT_KINDS = new Set(["Fighting", "Normal", "Bug", "Dark", "Steel", "Rock", "Ground", "Flying", "Dragon", "Poison", "Grass", "Water", "Fire", "Ice", "Electric", "Psychic", "Ghost"]);

/** Where each Pokémon stands, as fractions of the scene (singles, doubles). */
const SPOTS: Record<Side, { x: number; y: number }[][]> = {
  p1: [[{ x: 0.27, y: 0.68 }], [{ x: 0.19, y: 0.7 }, { x: 0.41, y: 0.66 }]],
  p2: [[{ x: 0.72, y: 0.36 }], [{ x: 0.61, y: 0.37 }, { x: 0.83, y: 0.34 }]],
};

function trackFor(kind: string, tr: TrainerDef | null): TrackId {
  if (kind === "legend") return "battleChampion";
  if (!tr) return "battleWild";
  if (tr.cls === "champion" || tr.cls === "legend") return "battleChampion";
  if (kind === "boss" || tr.cls === "boss" || tr.cls === "elite") return "battleBoss";
  return "battleTrainer";
}

function aiFor(floor: number, kind: string): AiLevel {
  if (kind === "wild" || kind === "legend") return "wild";
  const f = floor + (kind === "boss" ? 5 : 0);
  return f >= 16 ? "expert" : f >= 6 ? "smart" : "basic";
}

export function BattleScreen() {
  const req = useGame((s) => s.battle);
  const save = useSave();

  // Everything about the battle is built once.
  const setup = useMemo(() => {
    if (!req || !save.run) return null;
    const { room, floor } = req;
    const tr = room.trainer ? trainerDef(room.trainer) : null;
    const partner = room.partner ? trainerDef(room.partner) : null;
    const rate = shinyRate(save);
    let foe: OwnedPokemon[];
    let owners: number[] | undefined;
    if (tr) ({ foe, owners } = buildRoomTeam(room, floor, rate));
    else {
      const rng = new Rng(room.seed);
      const legend = room.kind === "legend";
      foe = [buildNpcPokemon({ species: room.species!, level: room.level, rng, quality: legend ? { ...qualityFor(floor, false), ivs: 2, items: 0 } : { ivs: 0, evs: 0, moves: 0, items: 0 }, shiny: !!room.shiny, exact: legend })];
    }
    const party = structuredClone(save.party);
    const theme = getFloor(structuredClone(save), floor).theme;
    const ctrl = new BattleController({
      kind: tr ? "trainer" : "wild",
      player: party,
      foe,
      ai: aiFor(floor, room.kind),
      seed: room.seed ^ (save.progress.runs * 7919) ^ Date.now(),
      weather: room.weather,
      ball: { caughtBefore: false, dark: !!theme.dark, water: !!theme.water },
      double: !!room.double,
      foeOwners: owners,
    });
    // Handy when debugging in the browser console.
    if (import.meta.env.DEV) (window as unknown as { __battle?: BattleController }).__battle = ctrl;
    return { room, floor, tr, partner, owners, foe, party, ctrl, theme };
  }, [req]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!setup) return null;
  return <BattleView key={setup.room.id + setup.room.seed} {...setup} />;
}

type Setup = {
  room: NonNullable<ReturnType<typeof useGame.getState>["battle"]>["room"];
  floor: number;
  tr: TrainerDef | null;
  /** Tag battles: the second trainer. */
  partner: TrainerDef | null;
  /** Tag battles: owner (0 trainer, 1 partner) of each foe. */
  owners?: number[];
  foe: OwnedPokemon[];
  party: OwnedPokemon[];
  ctrl: BattleController;
  theme: ReturnType<typeof getFloor>["theme"];
};

function BattleView({ room, floor, tr, partner, owners, foe, party, ctrl, theme }: Setup) {
  const t = useT();
  const lang = t.lang;
  const save = useSave();
  const update = useGame((s) => s.update);
  const go = useGame((s) => s.go);
  const endBattle = useGame((s) => s.endBattle);
  const queueLevelUps = useGame((s) => s.queueLevelUps);
  const textSpeed = useSettings((s) => s.textSpeed);
  const criesOn = useSettings((s) => s.cries);
  const wild = !tr;
  const double = ctrl.slots > 1;
  const trainers = [tr, partner].filter((x): x is TrainerDef => !!x);

  const [mine, setMine] = useState<Views>([]);
  const [foes, setFoes] = useState<Views>([]);
  const [text, setText] = useState("");
  const [shown, setShown] = useState(0);
  const [menu, setMenu] = useState<Menu>("none");
  const [weather, setWeather] = useState<string | null>(null);
  const [field, setField] = useState<FieldView>({ sides: { p1: {}, p2: {} }, field: [], weatherTurns: null });
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState(false);
  const [trainerOnField, setTrainerOnField] = useState<"in" | "out" | "gone">(tr ? "in" : "gone");
  const [avatarOnField, setAvatarOnField] = useState<"in" | "out">("in");
  const [ball, setBall] = useState<null | { kind: string; phase: "throw" | "shake" | "caught" | "broke" }>(null);
  const [request, setRequest] = useState<PlayerRequest | null>(null);
  /** Which Pokémon is choosing: index into `request.slots` (moves) or `request.replace` (switches). */
  const [cursor, setCursor] = useState(0);
  const [targeting, setTargeting] = useState<MoveOption | null>(null);
  const [results, setResults] = useState<null | { kind: "win" | "lose" | "caught" | "fled" }>(null);

  const sceneRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<MoveFxHandle>(null);
  const advance = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const mineRef = useRef<Views>([]);
  const foesRef = useRef<Views>([]);
  const lastEff = useRef<"super" | "resisted" | "immune" | undefined>(undefined);
  const playerFainted = useRef(false);
  const fast = useRef(false);
  const lastBall = useRef("pokeball");
  /** Choices made so far this turn, and the events of bag items already used. */
  const actions = useRef<SlotAction[]>([]);
  const preEvents = useRef<BattleEvent[]>([]);
  const unstuck = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);

  // Music
  useEffect(() => {
    const id = trackFor(room.kind, tr);
    music.play(id, TRACKS[id], 0.2);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const partyName = useCallback((slot: number) => {
    const p = party[slot];
    return p?.nickname || speciesName(p?.species ?? "", lang);
  }, [party, lang]);

  const nameOf = useCallback((side: Side, pos = 0) => {
    const v = (side === "p1" ? mineRef : foesRef).current[pos] ?? (side === "p1" ? mineRef : foesRef).current.find(Boolean);
    if (!v) return "";
    if (side === "p1") return party[v.slot]?.nickname || speciesName(v.species, lang);
    const n = speciesName(v.species, lang);
    return translate(lang, wild ? "battle.wild" : "battle.foe", { name: n });
  }, [party, lang, wild]);

  /** Trainer label for messages: "Tate & Liza" in tag battles. */
  const trainersLabel = trainers.map((x) => trainerName(x, lang)).join(" & ");

  /** Shows a line in the text box until it has been read (or tapped). */
  const say = useCallback(async (line: string | null, hold = 650) => {
    if (!line || !alive.current) return;
    setText(line);
    setShown(textSpeed ? 0 : line.length);
    const typing = textSpeed * line.length;
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; advance.current = null; resolve(); } };
      advance.current = finish;
      setTimeout(finish, fast.current ? 250 : typing + hold);
    });
  }, [textSpeed]);

  // Typewriter
  useEffect(() => {
    if (shown >= text.length) return;
    const id = setTimeout(() => setShown((s) => Math.min(text.length, s + 2)), textSpeed * 2);
    return () => clearTimeout(id);
  }, [shown, text, textSpeed]);

  const spot = (side: Side, pos = 0) => SPOTS[side][double ? 1 : 0][Math.min(pos, double ? 1 : 0)];

  const point = useCallback((side: Side, pos = 0): FxPoint => {
    const r = sceneRef.current?.getBoundingClientRect();
    const w = r?.width ?? 800, h = r?.height ?? 450;
    const s = SPOTS[side][double ? 1 : 0][Math.min(pos, double ? 1 : 0)];
    return { x: w * s.x, y: h * s.y };
  }, [double]);

  const putSide = (side: Side, pos: number, v: SideView | null) => {
    const ref = side === "p1" ? mineRef : foesRef;
    const next = [...ref.current];
    next[pos] = v;
    ref.current = next;
    (side === "p1" ? setMine : setFoes)(next);
  };

  const setSide = (side: Side, pos: number | undefined, patch: Partial<SideView> | ((v: SideView) => Partial<SideView>)) => {
    const ref = side === "p1" ? mineRef : foesRef;
    const p = pos ?? 0;
    const cur = ref.current[p];
    if (!cur) return;
    putSide(side, p, { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) });
  };

  const viewFor = (side: Side, slot: number, hp: number, maxhp: number): SideView => {
    const p = side === "p1" ? party[slot] : foe[slot];
    const mon = (side === "p1" ? ctrl.battle.p1 : ctrl.battle.p2).pokemon.find((m) => BattleController.indexOf(m) === slot);
    const st = mon?.status as string | undefined;
    return { slot, species: p.species, level: p.level, hp, maxhp, status: st && st !== "fnt" ? st : undefined, shiny: p.shiny, gender: p.gender, anim: "animate-send-out", visible: true, boosts: {}, sub: false, confused: false };
  };

  /** Reads stat stages, substitutes, confusion, hazards and screens back from the sim (end of a turn). */
  const resync = () => {
    for (const side of ["p1", "p2"] as Side[]) {
      const simSide = side === "p1" ? ctrl.battle.p1 : ctrl.battle.p2;
      simSide.active.forEach((mon, pos) => {
        if (!mon || mon.fainted) return;
        const boosts = Object.fromEntries(Object.entries(mon.boosts).filter(([, v]) => v));
        setSide(side, pos, (v) => (v.slot === BattleController.indexOf(mon) ? { boosts, sub: !!mon.volatiles.substitute, confused: !!mon.volatiles.confusion } : {}));
      });
    }
    const conds = (side: typeof ctrl.battle.p1) => Object.fromEntries(Object.entries(side.sideConditions).map(([id, c]) => [id, (c as { layers?: number }).layers ?? ((c as { duration?: number }).duration || 1)]));
    const ws = ctrl.battle.field.weatherState as { duration?: number };
    setField({ sides: { p1: conds(ctrl.battle.p1), p2: conds(ctrl.battle.p2) }, field: Object.keys(ctrl.battle.field.pseudoWeather), weatherTurns: ctrl.battle.field.weather && ws.duration ? ws.duration : null });
  };

  /** Plays one event: text, sound and animation. */
  const step = async (e: BattleEvent) => {
    if (!alive.current) return;
    const ctx = { lang, name: nameOf, partyName, wild };
    const pos = e.pos ?? 0;
    switch (e.t) {
      case "switch": {
        const v = viewFor(e.side, e.slot, e.hp, e.maxhp);
        if (e.side === "p1") {
          // A Pokémon still standing there is called back first (switch, U-turn…).
          const out = mineRef.current[pos];
          if (out?.visible && out.hp > 0 && out.slot !== e.slot && !e.drag) {
            await say(translate(lang, "battle.comeBack", { name: partyName(out.slot) }), 200);
            setSide("p1", pos, { anim: "animate-recall" });
            await sleep(350);
          }
          setAvatarOnField("out");
          putSide("p1", pos, v);
          sfx("throw");
          if (criesOn) cry(v.species);
          await say(translate(lang, "battle.go", { name: partyName(e.slot) }), 300);
        } else {
          const first = !foesRef.current.some(Boolean);
          putSide("p2", pos, v);
          setTrainerOnField((s) => (s === "in" ? "out" : s));
          if (criesOn) cry(v.species);
          registerSeenLater(v.species);
          if (v.shiny) { sfx("sparkle"); markShinySeen(); }
          if (wild && first) break;
          const owner = owners?.[e.slot] === 1 ? partner : tr;
          await say(translate(lang, "battle.sendOut", { trainer: owner ? trainerName(owner, lang) : "", name: speciesName(v.species, lang) }), 300);
        }
        if (v.shiny) await sleep(500);
        break;
      }
      case "move": {
        lastEff.current = undefined;
        await say(narrate(e, ctx), 250);
        const move = dex.moves.get(e.move);
        const target: Side = e.target ?? (e.side === "p1" ? "p2" : "p1");
        const tpos = e.targetPos ?? 0;
        const selfTarget = move.target === "self" || move.target === "allySide" || move.target === "allies" || (target === e.side && tpos === pos);
        const from = point(e.side, pos);
        const to = point(target, tpos);
        if (e.miss || e.still) break;
        if (move.category === "Status") {
          await fxRef.current?.play({ kind: "aura", type: move.type, from: selfTarget ? from : to, to: selfTarget ? from : to });
        } else if (move.category === "Physical" && PHYSICAL_CONTACT_KINDS.has(move.type) && move.flags.contact) {
          setSide(e.side, pos, { anim: e.side === "p1" ? "animate-lunge-r" : "animate-lunge-l" });
          await sleep(160);
          await fxRef.current?.play({ kind: move.type === "Dark" || move.type === "Steel" || move.type === "Bug" ? "slash" : "impact", type: move.type, from, to, big: move.basePower >= 90 });
        } else if (move.type === "Electric") {
          await fxRef.current?.play({ kind: "bolt", type: move.type, from, to, big: move.basePower >= 90 });
        } else if ((move.type === "Rock" || move.type === "Ground" || move.type === "Ice") && move.category === "Physical") {
          await fxRef.current?.play({ kind: "rain", type: move.type, from, to });
        } else {
          await fxRef.current?.play({ kind: "projectile", type: move.type, from, to, big: move.basePower >= 90 });
        }
        break;
      }
      case "effectiveness":
        lastEff.current = e.kind;
        if (e.kind === "immune") await say(narrate(e, ctx));
        else pendingEffText.current = narrate(e, ctx);
        break;
      case "crit":
        pendingCrit.current = true;
        break;
      case "damage": {
        if (!e.from) {
          hitSfx(lastEff.current);
          setSide(e.side, pos, { anim: "animate-blink" });
          if (lastEff.current === "super" || pendingCrit.current) setShake((s) => s + 1);
        }
        setSide(e.side, pos, (v) => ({ hp: e.hp, maxhp: e.hp === 0 ? v.maxhp : e.maxhp }));
        await sleep(e.from ? 200 : 650);
        if (pendingCrit.current) { pendingCrit.current = false; await say(translate(lang, "battle.crit"), 400); }
        if (pendingEffText.current) { const l = pendingEffText.current; pendingEffText.current = null; await say(l, 400); }
        await say(narrate(e, ctx));
        break;
      }
      case "heal":
      case "sethp":
        if (e.t === "heal") sfx("heal");
        setSide(e.side, pos, { hp: e.hp, maxhp: e.maxhp });
        await sleep(400);
        if (e.t === "heal") await say(narrate(e, ctx));
        break;
      case "status":
        sfx("status");
        setSide(e.side, pos, { status: e.status });
        await say(narrate(e, ctx));
        break;
      case "curestatus":
        setSide(e.side, pos, { status: undefined });
        await say(narrate(e, ctx));
        break;
      case "boost":
        setSide(e.side, pos, (v) => {
          const next = { ...v.boosts, [e.stat]: Math.max(-6, Math.min(6, (v.boosts[e.stat] ?? 0) + e.amount)) };
          if (!next[e.stat]) delete next[e.stat];
          return { boosts: next };
        });
        sfx(e.amount > 0 ? "statUp" : "statDown");
        await fxRef.current?.play({ kind: "aura", type: e.amount > 0 ? "Water" : "Fighting", from: point(e.side, pos), to: point(e.side, pos) });
        await say(narrate(e, ctx));
        break;
      case "faint":
        if (e.side === "p1") playerFainted.current = true;
        setSide(e.side, pos, { anim: "animate-faint", hp: 0 });
        sfx("faint");
        await sleep(500);
        await say(narrate(e, ctx));
        setSide(e.side, pos, { visible: false });
        break;
      case "weather":
        setWeather(e.weather === "none" ? null : toID(e.weather));
        await say(narrate(e, ctx), e.upkeep ? 300 : 650);
        break;
      case "bag":
        await say(translate(lang, "battle.usedItem", { item: itemName(e.item, lang) }), 300);
        break;
      case "ball": {
        const name = speciesName(foesRef.current[0]?.species ?? "", lang);
        await say(translate(lang, "battle.threw", { ball: itemName(e.ball, lang) }), 100);
        setBall({ kind: e.ball, phase: "throw" });
        sfx("throw");
        await sleep(700);
        setSide("p2", 0, { anim: "animate-recall" });
        await sleep(400);
        setBall({ kind: e.ball, phase: "shake" });
        for (let i = 0; i < e.shakes; i++) {
          await sleep(500);
          sfx("shake");
        }
        await sleep(400);
        if (e.caught) {
          sfx("click");
          setBall({ kind: e.ball, phase: "caught" });
          jingles.caught();
          await say(translate(lang, "battle.caught", { name }), 1400);
        } else {
          setBall(null);
          setSide("p2", 0, { anim: "animate-send-out" });
          sfx("run");
          await say(translate(lang, `battle.broke.${Math.min(3, e.shakes)}`), 400);
        }
        break;
      }
      case "run":
        sfx("run");
        await say(translate(lang, e.ok ? "battle.fled" : "battle.noFlee"));
        break;
      case "ability":
        await say(narrate(e, ctx), 500);
        break;
      case "turn":
      case "win":
        break;
      case "effect": {
        const id = toID(e.effect);
        if (e.side && (e.kind === "start" || e.kind === "end") && (id === "substitute" || id === "confusion")) {
          setSide(e.side, pos, id === "substitute" ? { sub: e.kind === "start" } : { confused: e.kind === "start" });
        }
        if (e.side && (e.kind === "sidestart" || e.kind === "sideend")) {
          const side = e.side;
          setField((f) => {
            const conds = { ...f.sides[side] };
            if (e.kind === "sidestart") conds[id] = (conds[id] ?? 0) + 1;
            else delete conds[id];
            return { ...f, sides: { ...f.sides, [side]: conds } };
          });
        }
        if (e.kind === "fieldstart" || e.kind === "fieldend") setField((f) => ({ ...f, field: e.kind === "fieldstart" ? [...f.field, id] : f.field.filter((x) => x !== id) }));
        if (e.kind === "clearallboost") for (const sd of ["p1", "p2"] as Side[]) for (const ps of [0, 1]) setSide(sd, ps, { boosts: {} });
        if (e.side && (e.kind === "clearboost" || e.kind === "clearnegativeboost")) {
          setSide(e.side, pos, (v) => ({ boosts: e.kind === "clearboost" ? {} : Object.fromEntries(Object.entries(v.boosts).filter(([, b]) => b > 0)) }));
        }
        await say(narrate(e, ctx));
        break;
      }
      default:
        await say(narrate(e, ctx));
    }
  };

  const pendingEffText = useRef<string | null>(null);
  const pendingCrit = useRef(false);
  const seenQueue = useRef<string[]>([]);
  const shinySeen = useRef(false);
  const registerSeenLater = (s: string) => seenQueue.current.push(s);
  const markShinySeen = () => void (shinySeen.current = true);

  const play = async (events: BattleEvent[]) => {
    setMenu("none");
    for (const e of events) {
      if (!alive.current) return;
      await step(e);
    }
    if (pendingEffText.current) { const l = pendingEffText.current; pendingEffText.current = null; await say(l, 300); }
    afterPlayback();
  };

  const afterPlayback = () => {
    if (!alive.current) return;
    if (ctrl.outcome) {
      void finish(ctrl.outcome);
      return;
    }
    const r = ctrl.request();
    // Never leave the player waiting on nothing (see BattleController.unstick).
    if (r.kind === "wait" && unstuck.current++ < 3) {
      void play(ctrl.unstick());
      return;
    }
    unstuck.current = 0;
    resync();
    setRequest(r);
    actions.current = [];
    preEvents.current = [];
    if (r.kind === "switch") {
      setCursor(0);
      setText(translate(lang, "battle.forceSwitch"));
      setShown(999);
      setMenu("forceSwitch");
    } else if (r.kind === "move") {
      nextSlot(r, 0);
    }
  };

  /** Moves on to the next Pokémon that must choose (locked ones play by themselves), or plays the turn. */
  const nextSlot = (r: PlayerRequest, from: number) => {
    let k = from;
    while (k < r.slots.length && r.slots[k].locked) {
      actions.current[k] = { kind: "move", index: r.slots[k].moves[0]?.index ?? 1 };
      k++;
    }
    if (k >= r.slots.length) {
      void play(ctrl.submit(actions.current.slice(0, r.slots.length), preEvents.current));
      return;
    }
    showMain(r, k);
  };

  const showMain = (r: PlayerRequest, k: number) => {
    setCursor(k);
    setText(translate(lang, "battle.whatDo", { name: partyName(r.slots[k].slot) }));
    setShown(999);
    setMenu("main");
  };

  const decide = (action: SlotAction) => {
    if (!request) return;
    actions.current[cursor] = action;
    nextSlot(request, cursor + 1);
  };

  /** Back to the previous Pokémon's choice (not past a bag item already used). */
  const previousSlot = (() => {
    if (!request || request.kind !== "move") return -1;
    let k = cursor - 1;
    while (k >= 0 && request.slots[k].locked) k--;
    return k >= 0 && actions.current[k]?.kind !== "bag" ? k : -1;
  })();

  // Intro (once, even when React runs effects twice in development)
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const start = ctrl.drain();
      await sleep(400);
      if (tr) {
        if (partner) {
          await say(translate(lang, "battle.challengeTag", { a: `${translate(lang, `trainerClass.${tr.cls}`)} ${trainerName(tr, lang)}`, b: `${translate(lang, `trainerClass.${partner.cls}`)} ${trainerName(partner, lang)}` }), 700);
        } else {
          const special = translate(lang, `special.${tr.id}`);
          const quotes = translateList(lang, `quotes.${tr.cls}`);
          await say(translate(lang, "battle.challenge", { trainer: `${translate(lang, `trainerClass.${tr.cls}`)} ${trainerName(tr, lang)}` }), 500);
          await say(special.startsWith("special.") ? quotes[room.seed % quotes.length] : special, 900);
        }
        if (double) await say(translate(lang, "battle.doubleBattle"), 500);
      } else {
        const sp = foe[0].species;
        putSide("p2", 0, viewFor("p2", 0, foe[0].hp, maxHp(foe[0])));
        if (criesOn) cry(sp);
        if (foe[0].shiny) { sfx("sparkle"); shinySeen.current = true; await sleep(600); }
        registerSeenLater(sp);
        await say(translate(lang, room.kind === "legend" ? "battle.legendAppeared" : "battle.wildAppeared", { name: speciesName(sp, lang) }), 500);
      }
      // Foe goes out first, then the player.
      const ordered = [...start.filter((e) => e.t === "switch" && e.side === "p2"), ...start.filter((e) => !(e.t === "switch" && e.side === "p2"))];
      await play(ordered);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------------------------------
  // Player actions

  const slotReq = request?.kind === "move" ? request.slots[cursor] : undefined;

  /** Who a move can be aimed at, in doubles. */
  const targetsFor = (m: MoveOption): TargetOption[] => {
    if (!double || !slotReq || !needsTarget(m.target)) return [];
    const out: TargetOption[] = [];
    const own = ctrl.battle.p1.active;
    const ally = own.find((x) => x && !x.fainted && x.position !== slotReq.pos);
    if (m.target === "adjacentAlly" || m.target === "adjacentAllyOrSelf") {
      if (m.target === "adjacentAllyOrSelf") out.push({ side: "p1", pos: slotReq.pos, loc: -(slotReq.pos + 1) });
      if (ally) out.push({ side: "p1", pos: ally.position, loc: -(ally.position + 1) });
      return out;
    }
    for (const f of ctrl.battle.p2.active) if (f && !f.fainted) out.push({ side: "p2", pos: f.position, loc: f.position + 1 });
    if ((m.target === "normal" || m.target === "any") && ally) out.push({ side: "p1", pos: ally.position, loc: -(ally.position + 1) });
    return out;
  };

  const chooseMove = (m: MoveOption) => {
    const targets = targetsFor(m);
    const foesOnly = targets.filter((x) => x.side === "p2");
    // One foe left and no reason to hit the ally: no need to ask.
    if (targets.length > 1 && !(foesOnly.length === 1 && m.target !== "adjacentAlly" && m.target !== "adjacentAllyOrSelf")) {
      setTargeting(m);
      setMenu("target");
      return;
    }
    const pick = foesOnly[0] ?? targets[0];
    decide({ kind: "move", index: m.index, target: pick?.loc });
  };

  const chooseSwitch = (slot: number) => {
    if (menu !== "forceSwitch" || !request) return decide({ kind: "switch", slot });
    // Replacements after a faint: one per empty spot, as long as there are Pokémon left.
    actions.current[cursor] = { kind: "switch", slot };
    const chosen = actions.current.filter((a): a is { kind: "switch"; slot: number } => a.kind === "switch").map((a) => a.slot);
    const left = request.switchable.filter((s) => !chosen.includes(s));
    if (cursor + 1 < request.replace.length && left.length) {
      setCursor(cursor + 1);
      return;
    }
    for (let k = cursor + 1; k < request.replace.length; k++) actions.current[k] = { kind: "pass" };
    void play(ctrl.submit(actions.current.slice(0, request.replace.length)));
  };

  /** Shows an error line, then lets the same Pokémon choose again. */
  const sorry = async (key: string) => {
    setMenu("none");
    await say(translate(lang, key));
    if (request) showMain(request, cursor);
  };

  const useBagItem = async (item: string, target?: number) => {
    const def = itemDef(item);
    if (!slotReq?.canBag) return sorry("battle.bagLocked");
    if (def?.category === "ball") {
      if (!wild) return sorry("battle.noBallTrainer");
      setMenu("none");
      update((d) => addItem(d, item, -1));
      lastBall.current = item;
      const caughtBefore = save.dex.caught.includes(foe[0].species);
      await play(ctrl.throwBall(item, caughtBefore));
      return;
    }
    const events = ctrl.applyItem(item, target ?? slotReq.slot);
    if (!events) return sorry("battle.noEffect");
    update((d) => addItem(d, item, -1));
    preEvents.current.push(...events);
    decide({ kind: "bag" });
  };

  const run = async () => {
    if (!wild) return sorry("battle.noRunTrainer");
    setMenu("none");
    await play(ctrl.tryRun());
  };

  // ------------------------------------------------------------------------------------------
  // End of battle

  const finish = async (outcome: NonNullable<BattleController["outcome"]>) => {
    ctrl.syncBack();
    const seen = [...seenQueue.current];
    const flawless = !playerFainted.current;
    if (outcome === "win") {
      if (tr) {
        setTrainerOnField("in");
        await say(translate(lang, "battle.win", { trainer: trainersLabel }), 500);
        const q = translateList(lang, "quotes.defeated");
        await say(tr.cls === "legend" ? "…" : q[room.seed % q.length], 700);
      } else {
        await say(translate(lang, "battle.wildFainted", { name: speciesName(foe[0].species, lang) }), 300);
      }
      music.play("victory", TRACKS.victory, 0.1);
      let results: ExpResult[] = [];
      let prize = 0;
      update((d) => {
        d.party = party;
        for (const s of seen) registerSeen(d, s);
        if (shinySeen.current) d.stats.shiniesSeen++;
        results = distributeExp(d, foe, ctrl.defeated, ctrl.faced, !wild);
        d.stats.battlesWon++;
        if (room.weather && !d.stats.weatherWins.includes(room.weather)) d.stats.weatherWins.push(room.weather);
        if (tr) {
          const amulet = [...ctrl.participants].some((i) => d.party[i]?.item === "amuletcoin");
          // Doubles pay a bit more; two trainers each pay most of their usual prize.
          const base = trainers.reduce((sum, x) => sum + trainerReward(room.level, x.cls, room.kind === "boss"), 0);
          const mult = partner ? 0.75 : double ? 1.25 : 1;
          prize = Math.round((base * mult) / 10) * 10 * (amulet ? 2 : 1);
          earn(d, prize);
          for (const x of trainers) {
            d.stats.trainersDefeated++;
            d.stats.defeated[x.id] = (d.stats.defeated[x.id] ?? 0) + 1;
          }
          if (room.kind === "boss" && flawless) d.stats.flawlessBosses++;
        } else {
          d.stats.wildDefeated++;
        }
        completeRoom(d);
      });
      if (prize) { sfx("coin"); await say(translate(lang, "battle.prize", { n: prize.toLocaleString(lang) }), 500); }
      for (const r of results) {
        const p = party.find((x) => x.uid === r.uid) ?? useGame.getState().save?.party.find((x) => x.uid === r.uid);
        if (!p) continue;
        const name = p.nickname || speciesName(p.species, lang);
        if (r.gained > 0) await say(translate(lang, "battle.exp", { name, n: r.gained }), 200);
        for (const lv of r.levels) {
          jingles.level();
          await say(translate(lang, "battle.levelUp", { name, n: lv.level }), 400);
        }
        if (r.levels.length) queueLevelUps(r.uid, r.levels);
      }
      setResults({ kind: "win" });
      setMenu("results");
    } else if (outcome === "lose") {
      await say(translate(lang, "battle.outOf"), 500);
      await say(translate(lang, "battle.blackout"), 600);
      jingles.blackout();
      update((d) => {
        d.party = party;
        for (const s of seen) registerSeen(d, s);
        endRun(d, true);
      });
      setResults({ kind: "lose" });
      setMenu("results");
    } else if (outcome === "caught") {
      const caught = foe[0];
      const st = ctrl.foeState();
      caught.hp = st.hp;
      caught.status = st.status;
      caught.metFloor = floor;
      let where: "party" | "box" = "party";
      update((d) => {
        d.party = party;
        for (const s of seen) registerSeen(d, s);
        caught.ball = lastBall.current;
        where = receivePokemon(d, caught);
        d.stats.caught++;
        if (shinySeen.current) d.stats.shiniesSeen++;
        if (caught.shiny) d.stats.shiniesCaught++;
        if (room.kind === "legend" && !d.legendsCaught.includes(caught.species)) d.legendsCaught.push(caught.species);
        claimRoom(d, floor, room.id);
        completeRoom(d);
      });
      await say(translate(lang, where === "party" ? "battle.toParty" : "battle.toBox", { name: speciesName(caught.species, lang) }), 600);
      setResults({ kind: "caught" });
      setMenu("results");
    } else {
      update((d) => {
        d.party = party;
        for (const s of seen) registerSeen(d, s);
        completeRoom(d);
      });
      setResults({ kind: "fled" });
      setMenu("results");
    }
  };

  const leave = () => {
    endBattle();
    if (results?.kind === "lose") go("lobby");
    else go("spire");
  };

  // ------------------------------------------------------------------------------------------
  // Render

  const pal = PALETTES[theme.biome];
  const weatherAmbient = weather === "raindance" ? "rain" : weather === "sandstorm" ? "sand" : weather === "hail" ? "blizzard" : weather === "sunnyday" ? "embers" : null;
  const tap = () => {
    if (shown < text.length) setShown(text.length);
    else advance.current?.();
  };
  /** Poké Balls under a foe's box: the whole team, or each trainer's own in tag battles. */
  const teamBalls = (pos: number) => {
    if (!tr) return {};
    if (!owners) return pos === foes.findIndex(Boolean) ? { balls: foe.length, fainted: ctrl.defeated.size } : {};
    const own = foe.map((_, i) => i).filter((i) => owners[i] === pos);
    return { balls: own.length, fainted: own.filter((i) => ctrl.defeated.has(i)).length };
  };
  const onField = mine.filter((v): v is SideView => !!v?.visible && v.hp > 0).map((v) => v.slot);
  const chosenSwitches = actions.current.filter((a): a is { kind: "switch"; slot: number } => a?.kind === "switch").map((a) => a.slot);
  const foeSize = double ? "h-24 w-24 sm:h-32 sm:w-32" : "h-28 w-28 sm:h-40 sm:w-40";
  const mySize = double ? "h-28 w-28 sm:h-44 sm:w-44" : "h-36 w-36 sm:h-52 sm:w-52";
  const at = (side: Side, pos: number) => ({ left: `${spot(side, pos).x * 100}%`, top: `${spot(side, pos).y * 100}%` });
  const foeMid = double ? { left: "72%", top: "36%" } : at("p2", 0);
  const myMid = double ? { left: "30%", top: "68%" } : at("p1", 0);

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      {/* Scene */}
      <div ref={sceneRef} className={`relative min-h-0 flex-1 overflow-hidden ${shake ? "animate-screen-shake" : ""}`} key={`shake-${shake}`} onClick={tap}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${pal.sky[0]} 0%, ${pal.sky[1]} 50%, ${pal.ground} 50.2%, ${pal.near} 100%)` }} />
        <div className="absolute inset-x-0 top-[34%] h-[16%] opacity-60" style={{ background: `linear-gradient(180deg, transparent, ${pal.far})` }} />
        <div className="absolute left-1/2 top-[-20%] h-[70%] w-[80%] -translate-x-1/2 rounded-full opacity-30 blur-3xl" style={{ background: `radial-gradient(closest-side, ${pal.light}, transparent)` }} />
        {weather === "sunnyday" && <div className="absolute inset-0 bg-amber-200/20 mix-blend-screen" />}
        <Particles ambient={weatherAmbient ?? theme.ambient} density={weatherAmbient ? 1 : 0.5} />

        {/* Platforms */}
        <div className={`absolute top-[46%] h-[9%] -translate-x-1/2 rounded-[50%] ${double ? "w-[50%] sm:w-[38%]" : "w-[42%] sm:w-[30%]"}`} style={{ left: foeMid.left, background: `radial-gradient(ellipse at center, ${pal.platform[0]}, ${pal.platform[1]} 70%, transparent 72%)` }} />
        <div className={`absolute top-[84%] h-[12%] -translate-x-1/2 rounded-[50%] ${double ? "w-[64%] sm:w-[48%]" : "w-[56%] sm:w-[40%]"}`} style={{ left: myMid.left, background: `radial-gradient(ellipse at center, ${pal.platform[0]}, ${pal.platform[1]} 70%, transparent 72%)` }} />

        {/* Hazards lying on each side */}
        <Hazards conds={field.sides.p2} style={{ left: foeMid.left, top: "47%" }} small />
        <Hazards conds={field.sides.p1} style={{ left: myMid.left, top: "86%" }} />

        {/* Foe trainers */}
        {trainerOnField !== "gone" && trainers.length > 0 && (
          <div className="absolute flex -translate-x-1/2 -translate-y-[60%] transition-all duration-700" style={{ ...foeMid, transform: `translate(${trainerOnField === "out" ? "60%" : "-50%"}, -60%)`, opacity: trainerOnField === "out" ? 0 : 1 }}>
            {trainers.map((x) => <TrainerSprite key={x.id} trainer={x} className="h-36 w-36 object-contain drop-shadow-xl sm:h-48 sm:w-48" />)}
          </div>
        )}

        {/* Foes */}
        {foes.map((v, pos) => v?.visible && (
          <div key={`p2-${pos}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={at("p2", pos)}>
            <div key={`${v.slot}-${v.anim}`} className={`relative ${v.anim}`}>
              {v.sub ? <SubstituteDoll className={foeSize} /> : <PokemonSprite species={v.species} shiny={v.shiny} className={`${foeSize} drop-shadow-[0_8px_6px_rgba(0,0,0,0.35)]`} />}
              {v.confused && <ConfusionDucks />}
            </div>
          </div>
        ))}
        {ball && (
          <div className="absolute -translate-x-1/2" style={{ left: at("p2", 0).left, top: `${spot("p2", 0).y * 100 + 4}%`, animation: ball.phase === "throw" ? "ball-throw 0.7s ease-out both" : ball.phase === "shake" ? "ball-shake 0.5s ease-in-out infinite" : undefined }}>
            <PokeBall size={34} kind={ball.kind} />
            {ball.phase === "caught" && <div className="absolute inset-0 rounded-full bg-yellow-200" style={{ animation: "sparkle-burst 0.8s ease-out both" }} />}
          </div>
        )}

        {/* Player */}
        {avatarOnField === "in" && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={myMid}>
            <img src={avatarUrl(save.avatar)} alt="" className="pixel h-36 w-36 object-contain sm:h-48 sm:w-48" style={{ transform: "scaleX(-1)" }} />
          </div>
        )}
        {mine.map((v, pos) => v?.visible && (
          <div key={`p1-${pos}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={at("p1", pos)}>
            <div key={`${v.slot}-${v.anim}`} className={`relative ${v.anim}`}>
              {v.sub ? <SubstituteDoll back className={mySize} /> : <PokemonSprite species={v.species} shiny={v.shiny} back className={`${mySize} drop-shadow-[0_8px_6px_rgba(0,0,0,0.35)]`} />}
              {v.confused && <ConfusionDucks />}
            </div>
          </div>
        ))}

        <MoveFx ref={fxRef} />
        {flash && <div className="absolute inset-0 bg-white" onAnimationEnd={() => setFlash(false)} style={{ animation: "fade-in 0.15s reverse both" }} />}

        {/* Info boxes */}
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 sm:left-6 sm:top-6">
          <SideChips conds={field.sides.p2} lang={lang} />
          {foes.map((v, pos) => v && (
            <InfoBox key={pos} view={v} name={speciesName(v.species, lang)} compact={double} caught={wild && save.dex.caught.includes(v.species)} {...teamBalls(pos)} />
          ))}
        </div>
        <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-1 sm:bottom-6 sm:right-6">
          <SideChips conds={field.sides.p1} lang={lang} />
          {mine.map((v, pos) => v && (
            <InfoBox key={pos} view={v} name={partyName(v.slot)} compact={double} player exp={levelProgress(party[v.slot])} active={double && menu !== "none" && menu !== "results" && slotReq?.pos === pos} />
          ))}
        </div>
        <div className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 flex-wrap justify-center gap-1">
          {weather && <span className="chip text-white">{t(`spire.weather.${weather}`)}{field.weatherTurns ? ` · ${field.weatherTurns}` : ""}</span>}
          {field.field.map((id) => <span key={id} className="chip text-white">{effectLabel(id, lang)}</span>)}
        </div>
        <button className="absolute right-2 top-2 chip text-white" onClick={(e) => { e.stopPropagation(); fast.current = !fast.current; }} data-silent>
          <Icon name="play" size={12} />{t("battle.skip")}
        </button>
      </div>

      {/* Bottom: text + menus */}
      <div className="relative z-30 bg-gradient-to-b from-[#1b2140] to-[#0e1226] p-2 safe-pad sm:p-3" style={{ minHeight: 190 }}>
        {menu === "none" || menu === "main" || menu === "forceSwitch" || menu === "results" ? (
          <div className="dialog-box mb-2 min-h-[64px] px-4 py-3 text-[15px] font-bold leading-snug sm:text-lg" onClick={tap}>
            {text.slice(0, shown)}
            {menu === "none" && shown >= text.length && <span className="ml-1 inline-block text-indigo-600 animate-bob">▼</span>}
          </div>
        ) : null}

        {menu === "main" && slotReq && (
          <div className="animate-slide-up">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MenuButton color="#e04848" icon="flame" label={t("battle.fight")} onClick={() => setMenu("fight")} />
              <MenuButton color="#e6a817" icon="bag" label={t("battle.bag")} onClick={() => setMenu("bag")} />
              <MenuButton color="#3fae5a" icon="team" label={t("battle.pokemon")} onClick={() => setMenu("party")} />
              <MenuButton color="#3f7fe0" icon="run" label={t("battle.run")} onClick={run} />
            </div>
            {previousSlot >= 0 && (
              <div className="mt-2 flex justify-end">
                <button className="btn btn-sm" onClick={() => { if (!request) return; actions.current.length = previousSlot; showMain(request, previousSlot); }}><Icon name="back" size={14} />{t("common.back")}</button>
              </div>
            )}
          </div>
        )}

        {menu === "fight" && slotReq && (
          <FightMenu moves={slotReq.moves} onBack={() => setMenu("main")} onMove={chooseMove} />
        )}

        {menu === "target" && targeting && (
          <TargetMenu
            move={targeting}
            targets={targetsFor(targeting)}
            views={{ p1: mine, p2: foes }}
            nameOf={(side, v) => (side === "p1" ? partyName(v.slot) : speciesName(v.species, lang))}
            onBack={() => setMenu("fight")}
            onPick={(loc) => { setTargeting(null); decide({ kind: "move", index: targeting.index, target: loc }); }}
          />
        )}

        {(menu === "party" || menu === "forceSwitch") && request && (
          <PartyMenu
            party={party}
            ctrl={ctrl}
            activeSlots={onField}
            taken={chosenSwitches}
            forced={menu === "forceSwitch"}
            switchable={menu === "forceSwitch" || !slotReq?.trapped ? request.switchable : []}
            trappedName={slotReq ? partyName(slotReq.slot) : ""}
            onBack={() => setMenu("main")}
            onSwitch={chooseSwitch}
          />
        )}

        {menu === "bag" && (
          <BagMenu wild={wild} party={party} ctrl={ctrl} onBack={() => setMenu("main")} onUse={(item, target) => void useBagItem(item, target)} />
        )}

        {menu === "results" && (
          <div className="flex justify-end animate-slide-up">
            <button className="btn btn-primary py-3 text-base" onClick={leave}>{t("common.continue")}<Icon name="chevron" size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBox({ view, name, player, caught, exp, balls = 0, fainted = 0, compact, active }: { view: SideView; name: string; player?: boolean; caught?: boolean; exp?: number; balls?: number; fainted?: number; compact?: boolean; active?: boolean }) {
  return (
    <div className={`info-box px-3 animate-slide-up ${compact ? "w-[min(210px,44vw)] py-1" : "w-[min(250px,48vw)] py-2"} ${active ? "ring-2 ring-accent" : ""}`}>
      <div className="flex items-center gap-1 text-sm font-black">
        <span className="truncate">{name}</span>
        <GenderIcon gender={view.gender} />
        {caught && <PokeBall size={12} />}
        <span className="ml-auto text-xs">Lv.{view.level}</span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <StatusBadge status={view.status} />
        <HpBar hp={view.hp} max={view.maxhp} className="flex-1" />
      </div>
      {player && <div className="mt-0.5 text-right text-xs font-black tabular-nums">{Math.max(0, view.hp)}/{view.maxhp}</div>}
      <Boosts boosts={view.boosts} />
      {player && exp !== undefined && !compact && <ExpBar ratio={exp} className="mt-0.5" />}
      {balls > 0 && (
        <div className="mt-1 flex gap-0.5">
          {Array.from({ length: balls }, (_, i) => <span key={i} className={i < fainted ? "opacity-30 grayscale" : ""}><PokeBall size={10} /></span>)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Field indicators

const STAT_SHORT: Record<string, [string, string]> = {
  atk: ["Atk", "Atq"], def: ["Def", "Déf"], spa: ["SpA", "AtS"], spd: ["SpD", "DéS"], spe: ["Spe", "Vit"], accuracy: ["Acc", "Pré"], evasion: ["Eva", "Esq"],
};

/** Stat stage as the multiplier it applies (accuracy and evasion use thirds). */
function stageMultiplier(stat: string, stage: number): string {
  const base = stat === "accuracy" || stat === "evasion" ? 3 : 2;
  const m = stage >= 0 ? (base + stage) / base : base / (base - stage);
  return `×${Number.isInteger(m) ? m : m.toFixed(2).replace(/0$/, "")}`;
}

function Boosts({ boosts }: { boosts: Record<string, number> }) {
  const lang = useT().lang;
  const entries = Object.entries(boosts).filter(([, v]) => v);
  if (!entries.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-0.5">
      {entries.map(([stat, v]) => (
        <span key={stat} className={`rounded px-1 text-[10px] font-black leading-4 text-white ${v > 0 ? "bg-emerald-600" : "bg-rose-600"}`}>
          {(STAT_SHORT[stat] ?? [stat, stat])[lang === "fr" ? 1 : 0]} {stageMultiplier(stat, v)}
        </span>
      ))}
    </div>
  );
}

const HAZARDS = new Set(["stealthrock", "spikes", "toxicspikes"]);

/** Screens, Tailwind & co. as chips (with turns left); hazards are drawn on the ground. */
function SideChips({ conds, lang }: { conds: Record<string, number>; lang: "en" | "fr" }) {
  const list = Object.entries(conds).filter(([id]) => !HAZARDS.has(id));
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {list.map(([id, n]) => <span key={id} className="chip !py-0 text-[10px] text-white">{effectLabel(id, lang)}{n > 1 ? ` · ${n}` : ""}</span>)}
    </div>
  );
}

/** Stealth Rock, Spikes (by layer) and Toxic Spikes, scattered on a side's platform. */
function Hazards({ conds, style, small }: { conds: Record<string, number>; style: React.CSSProperties; small?: boolean }) {
  const rocks = conds.stealthrock ? 4 : 0;
  const spikes = Math.min(3, conds.spikes ?? 0) * 2;
  const toxic = Math.min(2, conds.toxicspikes ?? 0) * 2;
  if (!rocks && !spikes && !toxic) return null;
  const items: { kind: "rock" | "spike" | "toxic"; x: number; y: number }[] = [];
  const place = (kind: "rock" | "spike" | "toxic", n: number, row: number) => {
    for (let i = 0; i < n; i++) items.push({ kind, x: (i + 0.5) / n - 0.5 + row * 0.07, y: row * 0.35 - 0.3 + (i % 2) * 0.3 });
  };
  place("rock", rocks, 0);
  place("spike", spikes, 1);
  place("toxic", toxic, 2);
  const w = small ? 200 : 300;
  return (
    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ ...style, width: w, height: w * 0.22 }}>
      {items.map((it, i) => (
        <svg key={i} viewBox="0 0 10 10" className="absolute" style={{ left: `${50 + it.x * 90}%`, top: `${50 + it.y * 60}%`, width: small ? 16 : 22, height: small ? 16 : 22, transform: "translate(-50%, -50%)" }}>
          {it.kind === "rock" ? (
            <path d="M1 9 L3 3 L5 1 L7 4 L9 9 Z" fill="#9a8c7a" stroke="#4a4036" strokeWidth="0.7" />
          ) : (
            <path d="M1 9 L5 1 L9 9 Z" fill={it.kind === "toxic" ? "#b45ad8" : "#5a5a66"} stroke={it.kind === "toxic" ? "#5a1a78" : "#202028"} strokeWidth="0.7" />
          )}
        </svg>
      ))}
    </div>
  );
}

/** The Substitute doll in place of the Pokémon. */
function SubstituteDoll({ back, className }: { back?: boolean; className: string }) {
  return <img src={`https://play.pokemonshowdown.com/sprites/substitutes/gen5${back ? "-back" : ""}/substitute.png`} alt="" className={`pixel object-contain ${className}`} draggable={false} />;
}

/** Little ducks circling over a confused Pokémon. */
function ConfusionDucks() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[8%] h-0 w-0" style={{ transform: "scaleY(0.4)" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="absolute left-0 top-0" style={{ animation: "duck-orbit 1.6s linear infinite", animationDelay: `${(-i * 1.6) / 3}s` }}>
          <svg viewBox="0 0 12 10" width="24" height="20" style={{ transform: "translate(-50%, -50%) scaleY(2.5)" }}>
            <ellipse cx="5" cy="6.5" rx="4" ry="3" fill="#ffd84a" stroke="#a07a10" strokeWidth="0.6" />
            <circle cx="8" cy="3.6" r="2.3" fill="#ffd84a" stroke="#a07a10" strokeWidth="0.6" />
            <path d="M10 3.4 L12 4 L10 4.6 Z" fill="#ff8a2a" />
            <circle cx="8.6" cy="3.1" r="0.5" fill="#222" />
          </svg>
        </div>
      ))}
    </div>
  );
}

function MenuButton({ color, icon, label, onClick }: { color: string; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      className="flex items-center justify-center gap-2 rounded-tile py-3.5 text-base font-black text-white shadow-[0_4px_0_rgba(0,0,0,0.35)] transition active:translate-y-0.5 active:shadow-none text-shadow sm:py-5"
      style={{ background: `linear-gradient(180deg, ${color}, ${color}bb)`, border: "2px solid rgb(255 255 255 / 0.25)" }}
      onClick={onClick}
    >
      <Icon name={icon} />{label}
    </button>
  );
}

function FightMenu({ moves, onBack, onMove }: { moves: MoveOption[]; onBack: () => void; onMove: (m: MoveOption) => void }) {
  const t = useT();
  return (
    <div className="animate-slide-up">
      <div className="grid grid-cols-2 gap-2">
        {moves.map((m) => {
          const move = dex.moves.get(m.id);
          return (
            <button
              key={m.index}
              disabled={m.disabled || (m.pp <= 0 && m.id !== "struggle")}
              onClick={() => onMove(m)}
              className="relative overflow-hidden rounded-tile px-3 py-2.5 text-left text-white shadow-[0_3px_0_rgba(0,0,0,0.35)] disabled:opacity-40 text-shadow"
              style={{ background: `linear-gradient(180deg, ${typeColor(move.type)}, ${typeColor(move.type)}aa)`, border: "2px solid rgb(255 255 255 / 0.25)" }}
            >
              <div className="truncate text-sm font-black sm:text-base">{moveName(m.id, t.lang)}</div>
              <div className="mt-0.5 flex items-center justify-between text-[11px] font-bold">
                <TypeBadge type={move.type} small />
                <span className="tabular-nums">{t("battle.pp")} {m.pp}/{m.maxpp}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end">
        <button className="btn btn-sm" onClick={onBack}><Icon name="back" size={14} />{t("common.back")}</button>
      </div>
    </div>
  );
}

function TargetMenu({ move, targets, views, nameOf, onBack, onPick }: { move: MoveOption; targets: TargetOption[]; views: Record<Side, Views>; nameOf: (side: Side, v: SideView) => string; onBack: () => void; onPick: (loc: number) => void }) {
  const t = useT();
  return (
    <div className="animate-slide-up">
      <div className="mb-2 text-sm font-bold text-white">{t("battle.chooseTarget", { move: moveName(move.id, t.lang) })}</div>
      <div className="grid grid-cols-2 gap-2">
        {targets.map((x) => {
          const v = views[x.side][x.pos];
          if (!v) return null;
          return (
            <button key={x.loc} className={`flex items-center gap-2 rounded-tile border-2 px-2 py-2 text-left text-white ${x.side === "p2" ? "border-red-400/50 bg-red-500/15" : "border-sky-400/50 bg-sky-500/15"}`} onClick={() => onPick(x.loc)}>
              <PokemonSprite species={v.species} shiny={v.shiny} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black">{nameOf(x.side, v)}</div>
                {x.side === "p1" && <div className="text-[10px] font-bold uppercase text-sky-200">{t("battle.ally")}</div>}
                <HpBar hp={v.hp} max={v.maxhp} />
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end">
        <button className="btn btn-sm" onClick={onBack}><Icon name="back" size={14} />{t("common.back")}</button>
      </div>
    </div>
  );
}

const typeColor = (type: string) => TYPE_COLORS[type] ?? "#888";

function PartyMenu({ party, ctrl, activeSlots, taken, forced, switchable, trappedName, onBack, onSwitch }: { party: OwnedPokemon[]; ctrl: BattleController; activeSlots: number[]; taken: number[]; forced: boolean; switchable: number[]; trappedName: string; onBack: () => void; onSwitch: (slot: number) => void }) {
  const t = useT();
  const [msg, setMsg] = useState<string | null>(forced ? t("battle.forceSwitch") : null);
  return (
    <div className="animate-slide-up">
      {msg && <div className="mb-2 text-sm font-bold text-white/90">{msg}</div>}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {party.map((p, i) => {
          const mon = ctrl.battle.p1.pokemon.find((m) => BattleController.indexOf(m) === i);
          const hp = mon ? (mon.fainted ? 0 : mon.hp) : p.hp;
          const max = mon?.maxhp ?? maxHp(p);
          const st = mon?.status as string | undefined;
          const name = p.nickname || speciesName(p.species, t.lang);
          return (
            <button
              key={p.uid}
              className={`flex items-center gap-2 rounded-tile border-2 px-2 py-1.5 text-left ${activeSlots.includes(i) ? "border-accent bg-accent/20" : taken.includes(i) ? "border-sky-300/60 bg-sky-400/15" : "border-white/15 bg-white/10"} ${hp <= 0 ? "opacity-50" : ""}`}
              onClick={() => {
                if (activeSlots.includes(i)) return setMsg(t("battle.alreadyOut", { name }));
                if (hp <= 0) return setMsg(t("battle.noEnergy", { name }));
                if (taken.includes(i)) return setMsg(t("battle.alreadyChosen", { name }));
                if (!switchable.includes(i)) return setMsg(t("battle.trappedMsg", { name: trappedName }));
                onSwitch(i);
              }}
            >
              <PokemonSprite species={p.species} shiny={p.shiny} size={40} />
              <div className="min-w-0 flex-1 text-white">
                <div className="flex items-center gap-1 truncate text-xs font-black">{name} <span className="text-white/60">Lv.{p.level}</span></div>
                <HpBar hp={hp} max={max} />
                <div className="flex items-center justify-between text-[10px] font-bold tabular-nums">
                  <StatusBadge status={st && st !== "fnt" ? st : undefined} />
                  <span className="ml-auto">{Math.max(0, hp)}/{max}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {!forced && (
        <div className="mt-2 flex justify-end">
          <button className="btn btn-sm" onClick={onBack}><Icon name="back" size={14} />{t("common.back")}</button>
        </div>
      )}
    </div>
  );
}

function BagMenu({ wild, party, ctrl, onBack, onUse }: { wild: boolean; party: OwnedPokemon[]; ctrl: BattleController; onBack: () => void; onUse: (item: string, target?: number) => void }) {
  const t = useT();
  const save = useSave();
  const [cat, setCat] = useState<"medicine" | "battle" | "ball">(wild ? "ball" : "medicine");
  const [picking, setPicking] = useState<string | null>(null);
  const items = Object.entries(save.bag).filter(([id, n]) => n > 0 && itemDef(id)?.category === cat);

  if (picking) {
    return (
      <div className="animate-slide-up">
        <div className="mb-2 text-sm font-bold text-white">{t("bag.useOn", { item: itemName(picking, t.lang) })}</div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {party.map((p, i) => {
            const mon = ctrl.battle.p1.pokemon.find((m) => BattleController.indexOf(m) === i);
            const hp = mon ? (mon.fainted ? 0 : mon.hp) : p.hp;
            const max = mon?.maxhp ?? maxHp(p);
            return (
              <button key={p.uid} className="flex items-center gap-2 rounded-tile border-2 border-white/15 bg-white/10 px-2 py-1.5 text-left text-white" onClick={() => onUse(picking, i)}>
                <PokemonSprite species={p.species} shiny={p.shiny} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-black">{p.nickname || speciesName(p.species, t.lang)}</div>
                  <HpBar hp={hp} max={max} />
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-end"><button className="btn btn-sm" onClick={() => setPicking(null)}><Icon name="back" size={14} />{t("common.back")}</button></div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-2 flex gap-1">
        {(["medicine", "battle", "ball"] as const).map((c) => (
          <button key={c} className={`rounded-pill px-3 py-1 text-xs font-black ${cat === c ? "bg-accent text-accent-foreground" : "bg-white/10 text-white"}`} onClick={() => setCat(c)}>{t(`bag.cat.${c}`)}</button>
        ))}
      </div>
      <div className="grid max-h-[180px] grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
        {items.length === 0 && <div className="col-span-full py-4 text-center text-sm text-white/60">{t("bag.empty")}</div>}
        {items.map(([id, n]) => (
          <button
            key={id}
            className="flex items-center gap-2 rounded-tile bg-white/10 px-2 py-1.5 text-left text-white hover:bg-white/20"
            onClick={() => (itemDef(id)?.category === "medicine" ? setPicking(id) : onUse(id))}
          >
            <ItemIcon id={id} size={28} />
            <span className="min-w-0 flex-1 truncate text-xs font-bold">{itemName(id, t.lang)}</span>
            <span className="text-xs font-black tabular-nums">×{n}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-end"><button className="btn btn-sm" onClick={onBack}><Icon name="back" size={14} />{t("common.back")}</button></div>
    </div>
  );
}
