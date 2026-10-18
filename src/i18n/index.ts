import { useSettings } from "@/store/settings";
import type { Lang } from "@/store/settings";
import { EN, FR } from "./strings";

export * from "./names";

type Params = Record<string, string | number>;

function lookup(root: unknown, key: string): unknown {
  let cur: unknown = root;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

export function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

/** Translates a dotted key; falls back to English, then the key itself. */
export function translate(lang: Lang, key: string, params?: Params): string {
  const v = lookup(lang === "fr" ? FR : EN, key) ?? lookup(EN, key);
  return typeof v === "string" ? format(v, params) : key;
}

/** A list value (quotes, [title, text] pairs). */
export function translateList(lang: Lang, key: string): string[] {
  const v = lookup(lang === "fr" ? FR : EN, key) ?? lookup(EN, key);
  return Array.isArray(v) ? (v as string[]) : [];
}

export function currentLang(): Lang {
  return useSettings.getState().lang;
}

/** Non-React translation with the current language. */
export function t(key: string, params?: Params): string {
  return translate(currentLang(), key, params);
}

export function useLang(): Lang {
  return useSettings((s) => s.lang);
}

export function useT() {
  const lang = useLang();
  const tr = (key: string, params?: Params) => translate(lang, key, params);
  tr.list = (key: string) => translateList(lang, key);
  tr.lang = lang;
  return tr;
}

/** Formats money the way each language writes it. */
export function money(n: number, lang: Lang): string {
  const s = Math.floor(n).toLocaleString(lang === "fr" ? "fr-FR" : "en-US");
  return lang === "fr" ? `${s} ₽` : `₽${s}`;
}
