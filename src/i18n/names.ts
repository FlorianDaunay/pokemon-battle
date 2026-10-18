import fr from "@/data/i18n/fr.json";
import itemsI18n from "@/data/i18n/items.json";
import { dex, toID } from "@/core/dex";
import type { Lang } from "@/store/settings";
import { CUSTOM_ITEMS } from "./strings";

/** Names of game data (species, moves, items...) in the current language. */

type Dict = Record<string, string>;
const FR = fr as unknown as Record<string, Dict>;
const ITEMS = itemsI18n as unknown as { en: Dict; fr: Dict; enDesc: Dict; frDesc: Dict };

export function speciesName(id: string, lang: Lang): string {
  const s = dex.species.get(id);
  if (lang === "fr") return FR.species[s.id] ?? FR.species[toID(s.baseSpecies)] ?? s.name;
  return s.name;
}

export function moveName(id: string, lang: Lang): string {
  const m = dex.moves.get(id);
  if (m.id.startsWith("hiddenpower") && m.id !== "hiddenpower") {
    const type = typeName(m.type, lang);
    return `${lang === "fr" ? FR.moves.hiddenpower ?? "Puissance Cachée" : "Hidden Power"} ${type}`;
  }
  return (lang === "fr" ? FR.moves[m.id] : undefined) ?? m.name;
}

export function moveDesc(id: string, lang: Lang): string {
  const m = dex.moves.get(id);
  return (lang === "fr" ? FR.moveDescs[m.id] : undefined) ?? m.shortDesc ?? m.desc ?? "";
}

export function abilityName(id: string, lang: Lang): string {
  const a = dex.abilities.get(id);
  return (lang === "fr" ? FR.abilities[a.id] : undefined) ?? a.name;
}

export function abilityDesc(id: string, lang: Lang): string {
  const a = dex.abilities.get(id);
  return (lang === "fr" ? FR.abilityDescs[a.id] : undefined) ?? a.shortDesc ?? "";
}

export function itemName(id: string, lang: Lang): string {
  const custom = CUSTOM_ITEMS[id];
  if (custom) return custom[lang].name;
  const sim = dex.items.get(id);
  if (lang === "en" && sim.exists) return sim.name;
  return (ITEMS[lang][id] ?? ITEMS.en[id] ?? (sim.exists ? sim.name : id)).replace(/Poke/g, "Poké");
}

export function itemDesc(id: string, lang: Lang): string {
  const custom = CUSTOM_ITEMS[id];
  if (custom) return custom[lang].desc;
  const d = lang === "fr" ? ITEMS.frDesc[id] : ITEMS.enDesc[id];
  return d ?? dex.items.get(id).shortDesc ?? "";
}

/** English item name, for PokeAPI sprite file names. */
export function itemEnglishName(id: string): string {
  return ITEMS.en[id] ?? dex.items.get(id).name ?? id;
}

export function natureName(id: string, lang: Lang): string {
  const n = dex.natures.get(id);
  return (lang === "fr" ? FR.natures[n.id] : undefined) ?? n.name;
}

export function typeName(type: string, lang: Lang): string {
  return (lang === "fr" ? FR.types[toID(type)] : undefined) ?? type;
}
