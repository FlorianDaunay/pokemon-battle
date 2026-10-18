import { useState } from "react";
import { useGame } from "@/store/game";
import { lastSlot, readSlot } from "@/store/saves";
import { useT } from "@/i18n";
import { Scenery } from "@/fx/Scenery";
import { Particles } from "@/fx/Particles";
import { PokemonSprite } from "@/ui/sprites";
import { unlockAudio } from "@/audio/engine";
import { sfx } from "@/audio/sfx";

const SHOWCASE = ["charizard", "lucario", "garchomp", "zekrom", "rayquaza", "gengar", "milotic", "metagross"];

export function TitleScreen() {
  const t = useT();
  const go = useGame((s) => s.go);
  const open = useGame((s) => s.open);
  const load = useGame((s) => s.load);
  const [started, setStarted] = useState(false);
  const last = lastSlot();
  const [mon] = useState(() => SHOWCASE[Math.floor(Math.random() * SHOWCASE.length)]);

  const start = () => {
    unlockAudio();
    sfx("confirm");
    setStarted(true);
  };

  return (
    <div className="absolute inset-0" onClick={started ? undefined : start}>
      <Scenery biome="summit" seed={7} />
      <Particles ambient="motes" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 safe-pad">
        <div className="relative flex flex-col items-center animate-fade">
          <div className="absolute -inset-20 rounded-full bg-amber-300/20 blur-3xl" />
          <h1 className="relative text-center font-black leading-none tracking-tight text-glow" style={{ fontSize: "clamp(44px, 10vw, 104px)" }}>
            <span className="bg-gradient-to-b from-amber-100 via-amber-300 to-orange-500 bg-clip-text text-transparent">Echo Spire</span>
          </h1>
          <p className="relative mt-2 text-center font-bold text-white/85 text-shadow">{t("title.tagline")}</p>
        </div>
        <PokemonSprite species={mon} className="h-36 w-36 animate-float drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] sm:h-44 sm:w-44" />
        {!started ? (
          <p className="animate-pulse font-pixel text-xs text-white text-shadow">{t("title.press")}</p>
        ) : (
          <div className="flex w-full max-w-xs flex-col gap-2 animate-slide-up">
            {last && (
              <button className="btn btn-primary py-3 text-base" onClick={() => { const s = readSlot(last); if (s) load(last, s); }}>
                {t("title.continue")}
              </button>
            )}
            <button className="btn py-3 text-base" onClick={() => go("slots")}>{t("title.load")} / {t("title.new")}</button>
            <button className="btn btn-ghost text-white" onClick={() => open("settings")}>{t("title.settings")}</button>
          </div>
        )}
      </div>
      <div className="absolute bottom-2 right-3 text-[10px] text-white/50">v{__APP_VERSION__}</div>
    </div>
  );
}
