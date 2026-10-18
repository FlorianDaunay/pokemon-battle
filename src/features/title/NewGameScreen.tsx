import { useState } from "react";
import { useGame } from "@/store/game";
import { STARTERS, newSave } from "@/core/save";
import { species } from "@/core/dex";
import { speciesName, useT } from "@/i18n";
import { Scenery } from "@/fx/Scenery";
import { Particles } from "@/fx/Particles";
import { PokemonSprite, TypeBadge } from "@/ui/sprites";
import { Icon } from "@/ui/Icon";
import { cry } from "@/audio/sfx";
import { newGameSlot } from "./SlotsScreen";

export const AVATARS = ["hilbert", "hilda", "nate", "rosa", "lucas", "dawn", "ethan", "lyra", "brendan", "may"];
export const avatarUrl = (id: string) => `https://play.pokemonshowdown.com/sprites/trainers/${id}.png`;

export function NewGameScreen() {
  const t = useT();
  const go = useGame((s) => s.go);
  const load = useGame((s) => s.load);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("hilbert");
  const [starter, setStarter] = useState("charmander");

  const intro = [t("newgame.intro1"), t("newgame.intro2"), t("newgame.intro3"), t("newgame.intro4")];

  const begin = () => {
    const save = newSave(name || t("newgame.namePlaceholder"), avatar, starter);
    load(newGameSlot.value, save);
  };

  return (
    <div className="absolute inset-0">
      <Scenery biome="coast" seed={11} />
      <Particles ambient="feathers" density={0.6} />
      <div className="absolute inset-0 flex flex-col items-center overflow-y-auto safe-pad">
        <div className="flex w-full max-w-3xl items-center gap-2 py-2">
          <button className="btn btn-ghost text-white" onClick={() => (step ? setStep(step - 1) : go("slots"))}><Icon name="back" /></button>
          <h1 className="text-2xl font-black text-white text-shadow">{t("newgame.title")}</h1>
        </div>

        {step < 4 && (
          <div className="mt-auto mb-6 w-full max-w-2xl animate-slide-up" key={step}>
            <div className="dialog-box p-4 sm:p-5" onClick={() => setStep(step + 1)}>
              <div className="mb-1 text-xs font-black uppercase tracking-wider text-indigo-700">{t("newgame.profName")}</div>
              <p className="text-base font-semibold leading-relaxed sm:text-lg">{intro[step]}</p>
              <div className="mt-2 text-right text-indigo-700 animate-bob">▼</div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="card my-auto w-full max-w-2xl p-4 animate-pop">
            <label className="label">{t("newgame.name")}</label>
            <input className="input mt-1 w-full text-lg font-bold" maxLength={12} value={name} placeholder={t("newgame.namePlaceholder")} onChange={(e) => setName(e.target.value)} />
            <div className="label mt-4">{t("newgame.look")}</div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {AVATARS.map((a) => (
                <button key={a} className={`rounded-tile border-2 p-1 transition ${avatar === a ? "border-accent bg-accent/15" : "border-transparent hover:bg-surface-hover"}`} onClick={() => setAvatar(a)}>
                  <img src={avatarUrl(a)} alt="" className="pixel mx-auto h-16 w-16 object-contain sm:h-20 sm:w-20" />
                  <div className="truncate text-center text-[10px] font-bold">{t(`avatar.${a}`)}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn btn-primary" onClick={() => setStep(5)}>{t("common.continue")}<Icon name="chevron" size={16} /></button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="card my-auto w-full max-w-3xl p-4 animate-pop">
            <div className="label">{t("newgame.partner")}</div>
            <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row">
              <div className="relative grid h-40 w-40 place-items-center">
                <div className="absolute bottom-3 h-6 w-28 rounded-[50%] bg-black/25 blur-sm" />
                <PokemonSprite species={starter} size={120} className="relative animate-float" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="text-2xl font-black">{speciesName(starter, t.lang)}</div>
                <div className="mt-1 flex justify-center gap-1 sm:justify-start">{species(starter).types.map((ty) => <TypeBadge key={ty} type={ty} />)}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1 sm:grid-cols-9">
              {STARTERS.map((s) => (
                <button key={s} className={`grid place-items-center rounded-tile border-2 p-1 ${starter === s ? "border-accent bg-accent/15" : "border-transparent hover:bg-surface-hover"}`} onClick={() => { setStarter(s); cry(s); }}>
                  <PokemonSprite species={s} size={48} />
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn btn-primary py-3 text-base" onClick={begin}>{t("newgame.begin")}<Icon name="tower" size={18} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
