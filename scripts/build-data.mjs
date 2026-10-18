// Builds src/data/i18n/fr.json (French names + short descriptions) and src/data/species-meta.json
// (catch rate, base exp, growth rate, legendary flag) from the PokeAPI CSV dumps,
// keyed by Showdown ids so the game can translate anything the simulator gives it.
// Run with `npm run data`; the output is committed, so the game never fetches it at runtime.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { Dex } from "@pkmn/sim";

const BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
const FR = "5";
const EN = "9";
// French flavour text: Black 2/White 2 first, then later games for anything newer.
const VERSION_PREFERENCE = ["14", "11", "16", "15", "17", "18", "10", "9"];

const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

async function csv(name) {
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return parseCsv(await res.text());
}

const clean = (s) => s.replace(/[­]\s*/g, "").replace(/\s+/g, " ").trim();

/** Maps PokeAPI id -> {en, fr} name for a `*_names.csv` file. */
async function names(file, idCol, nameCol = "name") {
  const map = new Map();
  for (const r of await csv(file)) {
    const entry = map.get(r[idCol]) ?? {};
    if (r.local_language_id === EN) entry.en = r[nameCol];
    if (r.local_language_id === FR) entry.fr = r[nameCol];
    map.set(r[idCol], entry);
  }
  return map;
}

/** Maps PokeAPI id -> French flavour text, best version first. */
async function flavor(file, idCol, textCol = "flavor_text") {
  const best = new Map();
  for (const r of await csv(file)) {
    if (r.language_id !== FR) continue;
    const rank = VERSION_PREFERENCE.indexOf(r.version_group_id);
    if (rank < 0) continue;
    const prev = best.get(r[idCol]);
    if (!prev || rank < prev.rank) best.set(r[idCol], { rank, text: clean(r[textCol]) });
  }
  return new Map([...best].map(([k, v]) => [k, v.text]));
}

function byShowdownId(pokeapiNames, flavors, known) {
  const names = {};
  const descs = {};
  for (const [id, n] of pokeapiNames) {
    if (!n.en || !n.fr) continue;
    const sid = toID(n.en);
    if (!known.has(sid)) continue;
    names[sid] = n.fr;
    const d = flavors?.get(id);
    if (d) descs[sid] = d;
  }
  return { names, descs };
}

const dex = Dex.forGen(5);
const knownMoves = new Set(dex.moves.all().map((m) => m.id));
const knownAbilities = new Set(dex.abilities.all().map((a) => a.id));
const knownItems = new Set(dex.items.all().map((i) => i.id));

console.log("downloading PokeAPI CSVs…");
const [speciesNames, moveNames, moveFlavor, abilityNames, abilityFlavor, itemNames, itemFlavor, natureNames, typeNames] =
  await Promise.all([
    names("pokemon_species_names.csv", "pokemon_species_id"),
    names("move_names.csv", "move_id"),
    flavor("move_flavor_text.csv", "move_id"),
    names("ability_names.csv", "ability_id"),
    flavor("ability_flavor_text.csv", "ability_id"),
    names("item_names.csv", "item_id"),
    flavor("item_flavor_text.csv", "item_id"),
    names("nature_names.csv", "nature_id"),
    names("type_names.csv", "type_id"),
  ]);

// Species are matched by National Dex number: names like Nidoran♀ or Mr. Mime differ in spelling.
const species = {};
for (const s of dex.species.all()) {
  if (s.num < 1 || s.num > 649) continue;
  const fr = speciesNames.get(String(s.num))?.fr;
  if (!fr) continue;
  species[s.id] = s.forme ? `${fr}-${s.forme}` : fr;
}

const moves = byShowdownId(moveNames, moveFlavor, knownMoves);
const abilities = byShowdownId(abilityNames, abilityFlavor, knownAbilities);
const items = byShowdownId(itemNames, itemFlavor, knownItems);
const natures = Object.fromEntries([...natureNames.values()].filter((n) => n.en && n.fr).map((n) => [toID(n.en), n.fr]));
const types = Object.fromEntries([...typeNames.values()].filter((n) => n.en && n.fr).map((n) => [toID(n.en), n.fr]));

const out = {
  species,
  moves: moves.names,
  moveDescs: moves.descs,
  abilities: abilities.names,
  abilityDescs: abilities.descs,
  natures,
  types,
};
mkdirSync("src/data/i18n", { recursive: true });
writeFileSync("src/data/i18n/fr.json", JSON.stringify(out));
console.log(
  Object.entries(out).map(([k, v]) => `${k}: ${Object.keys(v).length}`).join(", ")
);

// Game data the simulator lacks: catch rate, base experience yield and growth rate, by species id.
const [speciesRows, pokemonRows] = await Promise.all([csv("pokemon_species.csv"), csv("pokemon.csv")]);
const baseExp = new Map(pokemonRows.filter((r) => r.is_default === "1").map((r) => [r.species_id, Number(r.base_experience)]));
const byNum = new Map(speciesRows.map((r) => [r.id, r]));
const meta = {};
for (const s of dex.species.all()) {
  if (s.num < 1 || s.num > 649 || s.isNonstandard) continue;
  const r = byNum.get(String(s.num));
  if (!r) continue;
  meta[s.id] = [Number(r.capture_rate), baseExp.get(r.id) ?? 64, Number(r.growth_rate_id), r.is_legendary === "1" || r.is_mythical === "1" ? 1 : 0];
}
writeFileSync("src/data/species-meta.json", JSON.stringify(meta));
console.log(`species meta: ${Object.keys(meta).length}`);

// Every item PokeAPI knows (Showdown lacks medicine, Lucky Egg...): names and descriptions, both languages.
async function flavorLang(file, idCol, lang) {
  const best = new Map();
  for (const r of await csv(file)) {
    if (r.language_id !== lang) continue;
    const rank = VERSION_PREFERENCE.indexOf(r.version_group_id);
    if (rank < 0) continue;
    const prev = best.get(r[idCol]);
    if (!prev || rank < prev.rank) best.set(r[idCol], { rank, text: clean(r.flavor_text) });
  }
  return best;
}
const itemsEnFlavor = await flavorLang("item_flavor_text.csv", "item_id", EN);
// Only items the game can show: everything the sim knows plus the ids listed in items.ts.
const listed = new Set([...readFileSync("src/core/items.ts", "utf8").matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]));
const allItems = { en: {}, fr: {}, enDesc: {}, frDesc: {} };
for (const [id, n] of itemNames) {
  if (!n.en) continue;
  const sid = toID(n.en);
  if (!knownItems.has(sid) && !listed.has(sid)) continue;
  allItems.en[sid] = n.en;
  if (n.fr) allItems.fr[sid] = n.fr;
  const de = itemsEnFlavor.get(id)?.text;
  if (de) allItems.enDesc[sid] = de;
  const df = itemFlavor.get(id);
  if (df) allItems.frDesc[sid] = df;
}
writeFileSync("src/data/i18n/items.json", JSON.stringify(allItems));
console.log(`all items: ${Object.keys(allItems.en).length}`);
