import { useState } from "react";
import { useGame, useSave } from "@/store/game";
import { changeForme } from "@/core/game";
import { formesOf, species } from "@/core/dex";
import { speciesName, typeName, useT } from "@/i18n";
import type { Lang } from "@/store/settings";
import { PokemonSprite } from "@/ui/sprites";
import { Sheet } from "@/ui/layout";
import { sfx } from "@/audio/sfx";

// Forme names (the base forme gets the name the games give it).
const FORME_NAMES: Record<string, [string, string]> = {
  rotom: ["Normal", "Normale"], rotomheat: ["Heat", "Chaleur"], rotomwash: ["Wash", "Lavage"], rotomfrost: ["Frost", "Froid"],
  rotomfan: ["Fan", "Hélice"], rotommow: ["Mow", "Tonte"],
  deoxys: ["Normal", "Normale"], deoxysattack: ["Attack", "Attaque"], deoxysdefense: ["Defense", "Défense"], deoxysspeed: ["Speed", "Vitesse"],
  giratina: ["Altered", "Alternative"], giratinaorigin: ["Origin", "Originelle"],
  shaymin: ["Land", "Terrestre"], shayminsky: ["Sky", "Céleste"],
  tornadus: ["Incarnate", "Avatar"], tornadustherian: ["Therian", "Totémique"],
  thundurus: ["Incarnate", "Avatar"], thundurustherian: ["Therian", "Totémique"],
  landorus: ["Incarnate", "Avatar"], landorustherian: ["Therian", "Totémique"],
  kyurem: ["Kyurem", "Kyurem"], kyuremblack: ["Black", "Noir"], kyuremwhite: ["White", "Blanc"],
};

export function formeName(id: string, lang: Lang): string {
  return FORME_NAMES[id]?.[lang === "fr" ? 1 : 0] ?? species(id).forme ?? species(id).name;
}

/** Lets Pokémon with several formes switch between them (party and boxes). */
export function FormsSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const toast = useGame((s) => s.toast);
  const all = [...save.party, ...save.box].filter((p) => formesOf(p.species).length);
  const [sel, setSel] = useState<string | null>(all[0]?.uid ?? null);
  const mon = all.find((p) => p.uid === sel);
  const nameOf = (p: { nickname?: string; species: string }) => p.nickname || speciesName(species(p.species).baseSpecies, t.lang);

  const change = (forme: string) => {
    if (!mon) return;
    sfx("sparkle");
    update((d) => {
      const p = [...d.party, ...d.box].find((x) => x.uid === mon.uid);
      if (p) changeForme(d, p, forme);
    });
    toast("forms.changed", { name: nameOf(mon), forme: formeName(forme, t.lang) }, "sparkle");
  };

  return (
    <Sheet title={t("forms.title")} onClose={onClose} wide>
      <p className="mb-3 text-sm text-text-secondary">{t("forms.intro")}</p>
      {all.length === 0 ? (
        <p className="py-10 text-center text-text-muted">{t("forms.none")}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <div className="flex flex-wrap gap-1.5 md:flex-col">
            {all.map((p) => (
              <button key={p.uid} className={`flex items-center gap-2 rounded-tile border-2 p-1.5 text-left ${p.uid === sel ? "border-accent bg-accent/10" : "border-transparent bg-canvas/40 hover:bg-surface-hover"}`} onClick={() => setSel(p.uid)}>
                <PokemonSprite species={p.species} shiny={p.shiny} size={44} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black">{nameOf(p)}</div>
                  <div className="text-xs text-text-muted">{formeName(p.species, t.lang)} · {t("common.lv")}{p.level}</div>
                </div>
              </button>
            ))}
          </div>
          {mon && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {formesOf(mon.species).map((f) => (
                <button key={f} disabled={f === mon.species} className={`card flex flex-col items-center gap-1 p-2 transition ${f === mon.species ? "border-accent" : "hover:-translate-y-0.5 hover:border-accent/60"}`} onClick={() => change(f)}>
                  <PokemonSprite species={f} shiny={mon.shiny} size={88} />
                  <span className="text-sm font-black">{formeName(f, t.lang)}</span>
                  <span className="text-[10px] text-text-muted">{species(f).types.map((x) => typeName(x, t.lang)).join(" / ")}</span>
                  {f === mon.species && <span className="badge bg-accent text-accent-foreground">{t("forms.current")}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
