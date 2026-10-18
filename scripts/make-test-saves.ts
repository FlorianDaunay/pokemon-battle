/**
 * Writes save files at several stages of progression to the repo root (save-*.json, ignored by
 * git), to import from the Save slots screen when testing.
 *   npm run test-saves
 */
import { writeFileSync } from "node:fs";
import { newSave } from "@/core/save";
import type { SaveData } from "@/core/save";
import { createPokemon, fullIvs, healFully, setLevel } from "@/core/pokemon";
import type { OwnedPokemon } from "@/core/pokemon";
import { Rng } from "@/core/rng";
import { PLAYABLE_SPECIES, defaultMoves, stageForLevel } from "@/core/dex";
import { pickMoves } from "@/core/spire/teams";
import { floorSeed } from "@/core/game";
import { TRAINERS } from "@/core/spire/trainers";
import { MAIN_FLOORS, themeById } from "@/core/spire/themes";

const rng = new Rng(2024);

function mon(species: string, level: number, opts: { strong?: boolean; item?: string; shiny?: boolean } = {}): OwnedPokemon {
  const id = stageForLevel(species, level);
  const p = createPokemon({
    species: id,
    level,
    rng,
    ivs: opts.strong ? fullIvs() : undefined,
    moves: opts.strong ? pickMoves(id, level, true, rng) : defaultMoves(id, level),
    item: opts.item,
    shiny: opts.shiny,
    metFloor: 1 + rng.int(0, 10),
  });
  if (opts.strong) p.evs = { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 };
  setLevel(p, level);
  healFully(p);
  return p;
}

function beatTrainersUpTo(s: SaveData, floor: number) {
  for (let f = 1; f <= Math.min(floor, MAIN_FLOORS.length); f++) {
    const th = themeById(MAIN_FLOORS[f - 1]);
    for (const id of [...th.trainers, th.boss]) s.stats.defeated[id] = (s.stats.defeated[id] ?? 0) + 1;
  }
  s.stats.trainersDefeated = Object.values(s.stats.defeated).reduce((a, b) => a + b, 0);
}

function catchSome(s: SaveData, count: number) {
  const pool = rng.shuffle(PLAYABLE_SPECIES).slice(0, count);
  for (const id of pool) {
    if (!s.dex.caught.includes(id)) s.dex.caught.push(id);
    if (!s.dex.seen.includes(id)) s.dex.seen.push(id);
  }
  s.stats.caught = s.dex.caught.length;
}

function progress(s: SaveData, best: number, cleared = false) {
  s.progress.best = best;
  s.progress.checkpoint = best;
  s.progress.cleared = cleared;
  s.progress.runs = Math.ceil(best / 2);
  for (let f = 1; f <= best; f++) floorSeed(s, f);
  s.stats.floorsCleared = best - 1;
}

function write(name: string, s: SaveData) {
  s.name = name.replace("save-", "").replace(/^\w/, (c) => c.toUpperCase());
  writeFileSync(`${name}.json`, JSON.stringify(s, null, 2));
  console.log(`${name}.json — best floor ${s.progress.best}, team ${s.party.map((p) => `${p.species} ${p.level}`).join(", ")}`);
}

// Early: floor 4, a small team.
{
  const s = newSave("Early", "hilda", "chikorita", 1);
  s.party = [mon("chikorita", 14), mon("pidgey", 12), mon("geodude", 13)];
  s.money = 4500;
  s.bag = { pokeball: 8, greatball: 2, potion: 5, superpotion: 1, antidote: 2, rarecandy: 1 };
  progress(s, 4);
  catchSome(s, 6);
  beatTrainersUpTo(s, 3);
  write("save-early", s);
}

// Mid: floor 15, full team with held items.
{
  const s = newSave("Mid", "hilbert", "charmander", 2);
  s.party = [
    mon("charizard", 40, { item: "charcoal" }), mon("ampharos", 38, { item: "magnet" }), mon("gyarados", 39, { item: "leftovers" }),
    mon("gardevoir", 37), mon("lucario", 38, { item: "blackbelt" }), mon("garchomp", 36),
  ];
  s.box = ["rattata", "zubat", "geodude", "pikachu", "eevee", "oddish", "machop", "abra"].map((x) => mon(x, 20 + rng.int(0, 10)));
  s.money = 42000;
  s.bag = { pokeball: 10, greatball: 15, ultraball: 5, hyperpotion: 6, revive: 4, fullheal: 3, rarecandy: 3, firestone: 1, thunderstone: 1, ppup: 1 };
  progress(s, 15);
  catchSome(s, 45);
  beatTrainersUpTo(s, 14);
  s.lore = ["arrival", "echoes", "rocket", "memory"];
  write("save-mid", s);
}

// Late: floor 28, competitive team.
{
  const s = newSave("Late", "rosa", "oshawott", 3);
  s.party = [
    mon("samurott", 72, { strong: true, item: "lifeorb" }), mon("metagross", 72, { strong: true, item: "choiceband" }),
    mon("salamence", 71, { strong: true, item: "leftovers" }), mon("gengar", 71, { strong: true, item: "focussash" }),
    mon("scizor", 70, { strong: true, item: "choicescarf" }), mon("blissey", 70, { strong: true, item: "leftovers" }),
  ];
  s.box = PLAYABLE_SPECIES.filter((_, i) => i % 17 === 0).slice(0, 40).map((x) => mon(x, 40 + rng.int(0, 25)));
  s.money = 220000;
  s.bag = { ultraball: 30, maxpotion: 10, fullrestore: 8, maxrevive: 5, maxelixir: 4, rarecandy: 10, mint: 2, bottlecap: 2, abilitycapsule: 1, lumberry: 3, sitrusberry: 5 };
  progress(s, 28);
  catchSome(s, 130);
  beatTrainersUpTo(s, 27);
  s.lore = ["arrival", "echoes", "rocket", "memory", "galaxy", "ideals", "elite"];
  write("save-late", s);
}

// Apex: summit cleared, legends, shiny charm.
{
  const s = newSave("Apex", "nate", "snivy", 4);
  s.party = [
    mon("serperior", 88, { strong: true, item: "leftovers" }), mon("dragonite", 88, { strong: true, item: "lifeorb", shiny: true }),
    mon("mewtwo", 86, { strong: true, item: "choicespecs" }), mon("tyranitar", 87, { strong: true, item: "choiceband" }),
    mon("starmie", 86, { strong: true, item: "lifeorb" }), mon("ferrothorn", 85, { strong: true, item: "leftovers" }),
  ];
  s.legendsCaught = ["mewtwo", "articuno", "suicune"];
  s.money = 500000;
  s.bag = { masterball: 1, ultraball: 40, fullrestore: 20, maxrevive: 10, shinycharm: 1, expcharm: 1, goldbottlecap: 1, abilitypatch: 1 };
  progress(s, 36, true);
  catchSome(s, 210);
  beatTrainersUpTo(s, 30);
  for (const t of TRAINERS) s.stats.defeated[t.id] ??= 1;
  s.stats.shiniesSeen = 3;
  s.stats.shiniesCaught = 1;
  write("save-apex", s);
}

// Mid-climb: in the middle of floor 10 (tests resuming a run).
{
  const s = newSave("Climbing", "dawn", "piplup", 5);
  s.party = [mon("prinplup", 28), mon("staravia", 27), mon("luxio", 27), mon("kirlia", 26)];
  s.party[0].hp = Math.floor(s.party[0].hp / 2);
  s.party[2].status = "par";
  s.money = 12000;
  s.bag = { pokeball: 6, greatball: 8, superpotion: 4, revive: 2, paralyzeheal: 1 };
  progress(s, 10);
  catchSome(s, 18);
  beatTrainersUpTo(s, 9);
  s.run = { floor: 10, step: 3, path: ["10-0-0", "10-1-0", "10-2-0"], current: null, startedAt: Date.now(), earned: 2100 };
  write("save-midclimb", s);
}
