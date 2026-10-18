import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame, useSave } from "@/store/game";
import { useSettings } from "@/store/settings";
import { BattleController } from "@/core/battle/engine";
import type { PlayerRequest } from "@/core/battle/engine";
import type { BattleEvent, Side } from "@/core/battle/protocol";
import type { AiLevel } from "@/core/battle/ai";
import { claimRoom, completeRoom, distributeExp, earn, endRun, getFloor, shinyRate } from "@/core/game";
import type { ExpResult } from "@/core/game";
import { addItem, receivePokemon, registerSeen } from "@/core/save";
import { buildNpcPokemon, buildTrainerTeam, qualityFor } from "@/core/spire/teams";
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
import { narrate } from "./narrate";

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
}

type Menu = "none" | "main" | "fight" | "bag" | "party" | "forceSwitch" | "results";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PHYSICAL_CONTACT_KINDS = new Set(["Fighting", "Normal", "Bug", "Dark", "Steel", "Rock", "Ground", "Flying", "Dragon", "Poison", "Grass", "Water", "Fire", "Ice", "Electric", "Psychic", "Ghost"]);

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
    const rate = shinyRate(save);
    let foe: OwnedPokemon[];
    if (tr) foe = buildTrainerTeam(tr.id, floor, room.level, room.kind === "boss", room.seed, rate);
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
    });
    return { room, floor, tr, foe, party, ctrl, theme };
  }, [req]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!setup) return null;
  return <BattleView key={setup.room.id + setup.room.seed} {...setup} />;
}

type Setup = {
  room: NonNullable<ReturnType<typeof useGame.getState>["battle"]>["room"];
  floor: number;
  tr: TrainerDef | null;
  foe: OwnedPokemon[];
  party: OwnedPokemon[];
  ctrl: BattleController;
  theme: ReturnType<typeof getFloor>["theme"];
};

function BattleView({ room, floor, tr, foe, party, ctrl, theme }: Setup) {
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

  const [me, setMe] = useState<SideView | null>(null);
  const [foeView, setFoe] = useState<SideView | null>(null);
  const [text, setText] = useState("");
  const [shown, setShown] = useState(0);
  const [menu, setMenu] = useState<Menu>("none");
  const [weather, setWeather] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState(false);
  const [trainerOnField, setTrainerOnField] = useState<"in" | "out" | "gone">(tr ? "in" : "gone");
  const [avatarOnField, setAvatarOnField] = useState<"in" | "out">("in");
  const [ball, setBall] = useState<null | { kind: string; phase: "throw" | "shake" | "caught" | "broke" }>(null);
  const [request, setRequest] = useState<PlayerRequest | null>(null);
  const [results, setResults] = useState<null | { kind: "win" | "lose" | "caught" | "fled" }>(null);

  const sceneRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<MoveFxHandle>(null);
  const advance = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const meRef = useRef<SideView | null>(null);
  const foeRef = useRef<SideView | null>(null);
  const lastEff = useRef<"super" | "resisted" | "immune" | undefined>(undefined);
  const playerFainted = useRef(false);
  const fast = useRef(false);
  const lastBall = useRef("pokeball");

  meRef.current = me;
  foeRef.current = foeView;

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

  const nameOf = useCallback((side: Side) => {
    const v = side === "p1" ? meRef.current : foeRef.current;
    if (!v) return "";
    if (side === "p1") return party[v.slot]?.nickname || speciesName(v.species, lang);
    const n = speciesName(v.species, lang);
    return translate(lang, wild ? "battle.wild" : "battle.foe", { name: n });
  }, [party, lang, wild]);

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

  const point = useCallback((side: Side): FxPoint => {
    const r = sceneRef.current?.getBoundingClientRect();
    const w = r?.width ?? 800, h = r?.height ?? 450;
    return side === "p2" ? { x: w * 0.72, y: h * 0.36 } : { x: w * 0.27, y: h * 0.68 };
  }, []);

  const setSide = (side: Side, patch: Partial<SideView> | ((v: SideView) => Partial<SideView>)) => {
    const set = side === "p1" ? setMe : setFoe;
    const ref = side === "p1" ? meRef : foeRef;
    set((v) => {
      if (!v) return v;
      const next = { ...v, ...(typeof patch === "function" ? patch(v) : patch) };
      ref.current = next;
      return next;
    });
  };

  const viewFor = (side: Side, slot: number, hp: number, maxhp: number): SideView => {
    const p = side === "p1" ? party[slot] : foe[slot];
    const mon = (side === "p1" ? ctrl.battle.p1 : ctrl.battle.p2).pokemon.find((m) => BattleController.indexOf(m) === slot);
    const st = mon?.status as string | undefined;
    return { slot, species: p.species, level: p.level, hp, maxhp, status: st && st !== "fnt" ? st : undefined, shiny: p.shiny, gender: p.gender, anim: "animate-send-out", visible: true };
  };

  /** Plays one event: text, sound and animation. */
  const step = async (e: BattleEvent) => {
    if (!alive.current) return;
    const ctx = { lang, name: nameOf, partyName, wild };
    switch (e.t) {
      case "switch": {
        const v = viewFor(e.side, e.slot, e.hp, e.maxhp);
        if (e.side === "p1") {
          setAvatarOnField("out");
          meRef.current = v;
          setMe(v);
          sfx("throw");
          if (criesOn) cry(v.species);
          await say(translate(lang, "battle.go", { name: partyName(e.slot) }), 300);
        } else {
          const first = !foeRef.current;
          foeRef.current = v;
          setFoe(v);
          setTrainerOnField((s) => (s === "in" ? "out" : s));
          if (criesOn) cry(v.species);
          registerSeenLater(v.species);
          if (v.shiny) { sfx("sparkle"); markShinySeen(); }
          if (wild && first) break;
          await say(translate(lang, "battle.sendOut", { trainer: tr ? trainerName(tr, lang) : "", name: speciesName(v.species, lang) }), 300);
        }
        if (v.shiny) await sleep(500);
        break;
      }
      case "move": {
        lastEff.current = undefined;
        await say(narrate(e, ctx), 250);
        const move = dex.moves.get(e.move);
        const target: Side = e.target ?? (e.side === "p1" ? "p2" : "p1");
        const selfTarget = move.target === "self" || move.target === "allySide" || move.target === "allies" || target === e.side;
        if (e.miss || e.still) break;
        if (move.category === "Status") {
          await fxRef.current?.play({ kind: "aura", type: move.type, from: point(selfTarget ? e.side : target), to: point(target) });
        } else if (move.category === "Physical" && PHYSICAL_CONTACT_KINDS.has(move.type) && move.flags.contact) {
          setSide(e.side, { anim: e.side === "p1" ? "animate-lunge-r" : "animate-lunge-l" });
          await sleep(160);
          await fxRef.current?.play({ kind: move.type === "Dark" || move.type === "Steel" || move.type === "Bug" ? "slash" : "impact", type: move.type, from: point(e.side), to: point(target), big: move.basePower >= 90 });
        } else if (move.type === "Electric") {
          await fxRef.current?.play({ kind: "bolt", type: move.type, from: point(e.side), to: point(target), big: move.basePower >= 90 });
        } else if ((move.type === "Rock" || move.type === "Ground" || move.type === "Ice") && move.category === "Physical") {
          await fxRef.current?.play({ kind: "rain", type: move.type, from: point(e.side), to: point(target) });
        } else {
          await fxRef.current?.play({ kind: "projectile", type: move.type, from: point(e.side), to: point(target), big: move.basePower >= 90 });
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
          setSide(e.side, { anim: "animate-blink" });
          if (lastEff.current === "super" || pendingCrit.current) setShake((s) => s + 1);
        }
        setSide(e.side, (v) => ({ hp: e.hp, maxhp: e.hp === 0 ? v.maxhp : e.maxhp }));
        await sleep(e.from ? 200 : 650);
        if (pendingCrit.current) { pendingCrit.current = false; await say(translate(lang, "battle.crit"), 400); }
        if (pendingEffText.current) { const l = pendingEffText.current; pendingEffText.current = null; await say(l, 400); }
        await say(narrate(e, ctx));
        break;
      }
      case "heal":
      case "sethp":
        if (e.t === "heal") sfx("heal");
        setSide(e.side, { hp: e.hp, maxhp: e.maxhp });
        await sleep(400);
        if (e.t === "heal") await say(narrate(e, ctx));
        break;
      case "status":
        sfx("status");
        setSide(e.side, { status: e.status });
        await say(narrate(e, ctx));
        break;
      case "curestatus":
        setSide(e.side, { status: undefined });
        await say(narrate(e, ctx));
        break;
      case "boost":
        sfx(e.amount > 0 ? "statUp" : "statDown");
        await fxRef.current?.play({ kind: "aura", type: e.amount > 0 ? "Water" : "Fighting", from: point(e.side), to: point(e.side) });
        await say(narrate(e, ctx));
        break;
      case "faint":
        if (e.side === "p1") playerFainted.current = true;
        setSide(e.side, { anim: "animate-faint", hp: 0 });
        sfx("faint");
        await sleep(500);
        await say(narrate(e, ctx));
        setSide(e.side, { visible: false });
        break;
      case "weather":
        setWeather(e.weather === "none" ? null : toID(e.weather));
        await say(narrate(e, ctx), e.upkeep ? 300 : 650);
        break;
      case "bag":
        await say(translate(lang, "battle.usedItem", { item: itemName(e.item, lang) }), 300);
        break;
      case "ball": {
        const name = speciesName(foeRef.current?.species ?? "", lang);
        await say(translate(lang, "battle.threw", { ball: itemName(e.ball, lang) }), 100);
        setBall({ kind: e.ball, phase: "throw" });
        sfx("throw");
        await sleep(700);
        setSide("p2", { anim: "animate-recall" });
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
          setSide("p2", { anim: "animate-send-out" });
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
    setRequest(r);
    if (r.kind === "move" && r.locked) {
      void play(ctrl.chooseMove(r.moves[0]?.index ?? 1));
      return;
    }
    if (r.kind === "switch") {
      setText(translate(lang, "battle.forceSwitch"));
      setShown(999);
      setMenu("forceSwitch");
    } else {
      setText(translate(lang, "battle.whatDo", { name: nameOf("p1") }));
      setShown(999);
      setMenu("main");
    }
  };

  // Intro
  useEffect(() => {
    void (async () => {
      const start = ctrl.drain();
      await sleep(400);
      if (tr) {
        const special = translate(lang, `special.${tr.id}`);
        const quotes = translateList(lang, `quotes.${tr.cls}`);
        await say(translate(lang, "battle.challenge", { trainer: `${translate(lang, `trainerClass.${tr.cls}`)} ${trainerName(tr, lang)}` }), 500);
        await say(special.startsWith("special.") ? quotes[room.seed % quotes.length] : special, 900);
      } else {
        const sp = foe[0].species;
        const v = viewFor("p2", 0, foe[0].hp, maxHp(foe[0]));
        foeRef.current = v;
        setFoe(v);
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

  const chooseMove = (index: number) => void play(ctrl.chooseMove(index));

  const chooseSwitch = async (slot: number, forced: boolean) => {
    setMenu("none");
    if (!forced && meRef.current) {
      await say(translate(lang, "battle.comeBack", { name: partyName(meRef.current.slot) }), 200);
      setSide("p1", { anim: "animate-recall" });
      await sleep(350);
    }
    await play(ctrl.chooseSwitch(slot));
  };

  const useBagItem = async (item: string, target?: number) => {
    setMenu("none");
    const def = itemDef(item);
    if (!ctrl.canUseBag()) {
      await say(translate(lang, "battle.bagLocked"));
      afterPlayback();
      return;
    }
    if (def?.category === "ball") {
      if (!wild) {
        await say(translate(lang, "battle.noBallTrainer"));
        afterPlayback();
        return;
      }
      update((d) => addItem(d, item, -1));
      lastBall.current = item;
      const caughtBefore = save.dex.caught.includes(foe[0].species);
      await play(ctrl.throwBall(item, caughtBefore));
      return;
    }
    const events = ctrl.useItem(item, target ?? meRef.current?.slot ?? 0);
    if (!events) {
      await say(translate(lang, "battle.noEffect"));
      afterPlayback();
      return;
    }
    update((d) => addItem(d, item, -1));
    // Bench heals change no visible HP; the active one animates through the event.
    await play(events);
  };

  const run = async () => {
    setMenu("none");
    if (!wild) {
      await say(translate(lang, "battle.noRunTrainer"));
      afterPlayback();
      return;
    }
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
        await say(translate(lang, "battle.win", { trainer: trainerName(tr, lang) }), 500);
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
          prize = trainerReward(room.level, tr.cls, room.kind === "boss") * (amulet ? 2 : 1);
          earn(d, prize);
          d.stats.trainersDefeated++;
          d.stats.defeated[tr.id] = (d.stats.defeated[tr.id] ?? 0) + 1;
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
        <div className="absolute left-[72%] top-[46%] h-[9%] w-[42%] -translate-x-1/2 rounded-[50%] sm:w-[30%]" style={{ background: `radial-gradient(ellipse at center, ${pal.platform[0]}, ${pal.platform[1]} 70%, transparent 72%)` }} />
        <div className="absolute left-[27%] top-[84%] h-[12%] w-[56%] -translate-x-1/2 rounded-[50%] sm:w-[40%]" style={{ background: `radial-gradient(ellipse at center, ${pal.platform[0]}, ${pal.platform[1]} 70%, transparent 72%)` }} />

        {/* Foe */}
        <div className="absolute left-[72%] top-[36%] -translate-x-1/2 -translate-y-1/2">
          {tr && trainerOnField !== "gone" && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] transition-all duration-700" style={{ transform: `translate(${trainerOnField === "out" ? "160%" : "-50%"}, -60%)`, opacity: trainerOnField === "out" ? 0 : 1 }}>
              <TrainerSprite trainer={tr} className="h-36 w-36 object-contain drop-shadow-xl sm:h-48 sm:w-48" />
            </div>
          )}
          {foeView?.visible && (
            <div key={`${foeView.slot}-${foeView.anim}`} className={foeView.anim}>
              <PokemonSprite species={foeView.species} shiny={foeView.shiny} className="h-28 w-28 drop-shadow-[0_8px_6px_rgba(0,0,0,0.35)] sm:h-40 sm:w-40" />
            </div>
          )}
          {ball && (
            <div className="absolute left-1/2 top-[60%] -translate-x-1/2" style={{ animation: ball.phase === "throw" ? "ball-throw 0.7s ease-out both" : ball.phase === "shake" ? "ball-shake 0.5s ease-in-out infinite" : undefined }}>
              <PokeBall size={34} kind={ball.kind} />
              {ball.phase === "caught" && <div className="absolute inset-0 rounded-full bg-yellow-200" style={{ animation: "sparkle-burst 0.8s ease-out both" }} />}
            </div>
          )}
        </div>

        {/* Player */}
        <div className="absolute left-[27%] top-[68%] -translate-x-1/2 -translate-y-1/2">
          {avatarOnField === "in" && (
            <img src={avatarUrl(save.avatar)} alt="" className="pixel h-36 w-36 object-contain sm:h-48 sm:w-48" style={{ transform: "scaleX(-1)" }} />
          )}
          {me?.visible && (
            <div key={`${me.slot}-${me.anim}`} className={me.anim}>
              <PokemonSprite species={me.species} shiny={me.shiny} back className="h-36 w-36 drop-shadow-[0_8px_6px_rgba(0,0,0,0.35)] sm:h-52 sm:w-52" />
            </div>
          )}
        </div>

        <MoveFx ref={fxRef} />
        {flash && <div className="absolute inset-0 bg-white" onAnimationEnd={() => setFlash(false)} style={{ animation: "fade-in 0.15s reverse both" }} />}

        {/* Info boxes */}
        {foeView && (
          <InfoBox view={foeView} name={speciesName(foeView.species, lang)} className="left-2 top-2 sm:left-6 sm:top-6" caught={wild && save.dex.caught.includes(foeView.species)} balls={tr ? foe.length : 0} fainted={tr ? ctrl.defeated.size : 0} />
        )}
        {me && (
          <InfoBox view={me} name={partyName(me.slot)} className="bottom-2 right-2 sm:bottom-6 sm:right-6" player exp={levelProgress(party[me.slot])} />
        )}
        {weather && <div className="absolute left-1/2 top-2 -translate-x-1/2 chip text-white">{t(`spire.weather.${weather}`)}</div>}
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

        {menu === "main" && request && (
          <div className="grid grid-cols-2 gap-2 animate-slide-up sm:grid-cols-4">
            <MenuButton color="#e04848" icon="flame" label={t("battle.fight")} onClick={() => setMenu("fight")} />
            <MenuButton color="#e6a817" icon="bag" label={t("battle.bag")} onClick={() => setMenu("bag")} />
            <MenuButton color="#3fae5a" icon="team" label={t("battle.pokemon")} onClick={() => setMenu("party")} />
            <MenuButton color="#3f7fe0" icon="run" label={t("battle.run")} onClick={run} />
          </div>
        )}

        {menu === "fight" && request && (
          <FightMenu request={request} onBack={() => setMenu("main")} onMove={chooseMove} />
        )}

        {(menu === "party" || menu === "forceSwitch") && request && (
          <PartyMenu party={party} ctrl={ctrl} activeSlot={me?.slot ?? -1} forced={menu === "forceSwitch"} request={request} onBack={() => setMenu("main")} onSwitch={(s) => void chooseSwitch(s, menu === "forceSwitch")} />
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

function InfoBox({ view, name, className, player, caught, exp, balls = 0, fainted = 0 }: { view: SideView; name: string; className: string; player?: boolean; caught?: boolean; exp?: number; balls?: number; fainted?: number }) {
  return (
    <div className={`info-box absolute z-10 w-[min(250px,48vw)] px-3 py-2 animate-slide-up ${className}`}>
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
      {player && exp !== undefined && <ExpBar ratio={exp} className="mt-0.5" />}
      {balls > 0 && (
        <div className="mt-1 flex gap-0.5">
          {Array.from({ length: balls }, (_, i) => <span key={i} className={i < fainted ? "opacity-30 grayscale" : ""}><PokeBall size={10} /></span>)}
        </div>
      )}
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

function FightMenu({ request, onBack, onMove }: { request: PlayerRequest; onBack: () => void; onMove: (i: number) => void }) {
  const t = useT();
  return (
    <div className="animate-slide-up">
      <div className="grid grid-cols-2 gap-2">
        {request.moves.map((m) => {
          const move = dex.moves.get(m.id);
          return (
            <button
              key={m.index}
              disabled={m.disabled || (m.pp <= 0 && m.id !== "struggle")}
              onClick={() => onMove(m.index)}
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

const typeColor = (type: string) => TYPE_COLORS[type] ?? "#888";

function PartyMenu({ party, ctrl, activeSlot, forced, request, onBack, onSwitch }: { party: OwnedPokemon[]; ctrl: BattleController; activeSlot: number; forced: boolean; request: PlayerRequest; onBack: () => void; onSwitch: (slot: number) => void }) {
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
          return (
            <button
              key={p.uid}
              className={`flex items-center gap-2 rounded-tile border-2 px-2 py-1.5 text-left ${i === activeSlot ? "border-accent bg-accent/20" : "border-white/15 bg-white/10"} ${hp <= 0 ? "opacity-50" : ""}`}
              onClick={() => {
                if (i === activeSlot) return setMsg(t("battle.alreadyOut", { name: p.nickname || speciesName(p.species, t.lang) }));
                if (hp <= 0) return setMsg(t("battle.noEnergy", { name: p.nickname || speciesName(p.species, t.lang) }));
                if (!request.switchable.includes(i)) return setMsg(t("battle.trappedMsg", { name: speciesName(party[activeSlot]?.species ?? p.species, t.lang) }));
                onSwitch(i);
              }}
            >
              <PokemonSprite species={p.species} shiny={p.shiny} size={40} />
              <div className="min-w-0 flex-1 text-white">
                <div className="flex items-center gap-1 truncate text-xs font-black">{p.nickname || speciesName(p.species, t.lang)} <span className="text-white/60">Lv.{p.level}</span></div>
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

