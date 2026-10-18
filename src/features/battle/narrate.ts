import { dex, toID } from "@/core/dex";
import type { BattleEvent, Side } from "@/core/battle/protocol";
import { abilityName, itemName, moveName, translate, typeName } from "@/i18n";
import type { Lang } from "@/store/settings";

/** Turns battle events into the lines shown in the text box. */

export interface NarrateCtx {
  lang: Lang;
  /** Display name of the active Pokémon on a side, already prefixed ("The opposing Onix"). */
  name: (side: Side) => string;
  /** Plain name of a party member (bag messages). */
  partyName: (slot: number) => string;
  wild: boolean;
}

const EFFECT_KEYS: Record<string, string> = {
  confusion: "confusion", substitute: "substitute", taunt: "taunt", encore: "encore", leechseed: "leechseed",
  protect: "protect", detect: "protect", endure: "endure", focusenergy: "focusenergy", attract: "attract", yawn: "yawn",
  perishsong: "perishsong", stealthrock: "stealthrock", spikes: "spikes", toxicspikes: "toxicspikes", reflect: "reflect",
  lightscreen: "lightscreen", tailwind: "tailwind", safeguard: "safeguard", trickroom: "trickroom", destinybond: "destinybond",
  wish: "wish", trapped: "trapped",
};

/** Best-effort translation of an effect name (move, ability, item or condition). */
export function effectLabel(raw: string, lang: Lang): string {
  const id = toID(raw);
  if (!id) return raw;
  if (dex.moves.get(id).exists) return moveName(id, lang);
  if (dex.abilities.get(id).exists) return abilityName(id, lang);
  if (dex.items.get(id).exists) return itemName(id, lang);
  if (id === "psn" || id === "tox") return lang === "fr" ? "le poison" : "poison";
  if (id === "brn") return lang === "fr" ? "sa brûlure" : "its burn";
  return raw;
}

export function narrate(e: BattleEvent, c: NarrateCtx): string | null {
  const t = (key: string, params?: Record<string, string | number>) => translate(c.lang, key, params);
  switch (e.t) {
    case "move":
      return t("battle.used", { name: c.name(e.side), move: moveName(e.move, c.lang) });
    case "damage": {
      if (!e.from) return null;
      const id = toID(e.from);
      const direct = translate(c.lang, `battle.hurt.${e.from}`);
      if (!direct.startsWith("battle.")) return direct.replace("{name}", c.name(e.side));
      const byId = translate(c.lang, `battle.hurt.${id}`);
      if (!byId.startsWith("battle.")) return byId.replace("{name}", c.name(e.side));
      return t("battle.hurtBy", { name: c.name(e.side), effect: effectLabel(e.from, c.lang) });
    }
    case "heal":
      if (e.from && dex.items.get(e.from).exists) return t("battle.healedBy", { name: c.name(e.side), effect: itemName(toID(e.from), c.lang) });
      if (e.from && dex.abilities.get(e.from).exists) return t("battle.healedBy", { name: c.name(e.side), effect: abilityName(e.from, c.lang) });
      if (e.from === "drain" || !e.from) return t("battle.healed", { name: c.name(e.side) });
      return t("battle.healed", { name: c.name(e.side) });
    case "status":
      return t(`battle.status.${e.status}`, { name: c.name(e.side) });
    case "curestatus":
      return t(`battle.cure.${e.status}`, { name: c.name(e.side) });
    case "boost": {
      const amount = Math.max(-3, Math.min(3, e.amount));
      return t(`battle.boost.${amount}`, { name: c.name(e.side), stat: t(`battle.stats.${e.stat}`) });
    }
    case "faint":
      return t("battle.fainted", { name: c.name(e.side) });
    case "effectiveness":
      return e.kind === "super" ? t("battle.super") : e.kind === "resisted" ? t("battle.resisted") : t("battle.immune", { name: c.name(e.side) });
    case "crit":
      return t("battle.crit");
    case "miss":
      return t("battle.miss", { name: c.name(e.side) });
    case "fail":
      return t("battle.fail");
    case "hitcount":
      return t("battle.hitCount", { n: e.count });
    case "weather": {
      if (e.weather === "none") return null;
      return t(`battle.weather.${e.upkeep ? "upkeep" : "start"}.${e.weather}`);
    }
    case "cant": {
      const r = toID(e.reason);
      const key = ["par", "slp", "frz", "flinch", "recharge", "nopp", "truant", "taunt", "disable", "attract"].includes(r) ? r : "generic";
      return t(`battle.cant.${key}`, { name: c.name(e.side), move: e.move ? moveName(e.move, c.lang) : "" });
    }
    case "effect": {
      const id = toID(e.effect);
      const side = e.side ? (e.side === "p1" ? t("battle.yourTeam") : t("battle.foeTeam")) : "";
      const name = e.side ? c.name(e.side) : "";
      if (e.kind === "clearallboost") return t("battle.effects.clearallboost");
      if (e.kind === "mustrecharge") return t("battle.effects.recharge", { name });
      if (e.kind === "prepare") return t("battle.prepare", { name });
      if (e.kind === "start" || e.kind === "sidestart" || e.kind === "fieldstart" || e.kind === "singleturn" || e.kind === "singlemove") {
        if (id.startsWith("perish")) return id === "perish3" ? t("battle.effects.perishsong") : null;
        const k = EFFECT_KEYS[id];
        if (k) return t(`battle.effects.${k}`, { name, side });
        if (e.kind === "sidestart") return t("battle.sideStart", { effect: effectLabel(e.effect, c.lang), side });
        if (e.kind === "fieldstart") return t("battle.fieldStart", { effect: effectLabel(e.effect, c.lang) });
        if (id === "typechange" || id === "typeadd") return t("battle.effectStart", { name, effect: typeName(e.extra ?? "", c.lang) });
        return t("battle.effectStart", { name, effect: effectLabel(e.effect, c.lang) });
      }
      if (e.kind === "end" || e.kind === "sideend" || e.kind === "fieldend") {
        if (id === "confusion") return t("battle.effects.confusionEnd", { name });
        if (id === "substitute") return t("battle.effects.substituteEnd", { name });
        if (id === "trickroom") return t("battle.effects.trickroomEnd");
        if (e.kind === "sideend") return t("battle.sideEnd", { effect: effectLabel(e.effect, c.lang), side });
        if (e.kind === "fieldend") return t("battle.fieldEnd", { effect: effectLabel(e.effect, c.lang) });
        if (id === "leechseed" || id === "partiallytrapped" || id.startsWith("perish")) return null;
        return t("battle.effectEnd", { name, effect: effectLabel(e.effect, c.lang) });
      }
      if (e.kind === "activate") {
        if (id === "protect" || id === "detect") return t("battle.effects.protectBlock", { name });
        if (id === "confusion") return c.lang === "fr" ? `${name} est confus !` : `${name} is confused!`;
        if (id === "substitute") return c.lang === "fr" ? `Le clone de ${name} encaisse le coup !` : `The substitute took damage for ${name}!`;
        if (id === "endure") return c.lang === "fr" ? `${name} encaisse le coup !` : `${name} endured the hit!`;
        if (id === "focussash" || id === "focusband") return t("battle.itemActivated", { name, item: itemName(id, c.lang) });
        return null;
      }
      return null;
    }
    case "item": {
      const item = itemName(toID(e.item), c.lang);
      if (e.eat) return t("battle.ate", { name: c.name(e.side), item });
      if (e.end && e.from && toID(e.from) !== toID(e.item)) return t("battle.itemLost", { name: c.name(e.side), item });
      if (e.end) return t("battle.itemActivated", { name: c.name(e.side), item });
      return t("battle.itemFrisk", { name: c.name(e.side), item });
    }
    case "ability":
      return t("battle.ability", { name: c.name(e.side), ability: abilityName(e.ability, c.lang) });
    case "transform":
      return t("battle.transformed", { name: c.name(e.side) });
    case "forme":
      return t("battle.changed", { name: c.name(e.side) });
    case "message":
      return t(e.key, { ...e.params, name: e.params?.slot !== undefined ? c.partyName(Number(e.params.slot)) : "" });
    default:
      return null;
  }
}
