import { useEffect } from "react";
import { useGame } from "@/store/game";
import { useSettings } from "@/store/settings";
import { setVolumes, unlockAudio } from "@/audio/engine";
import { sfx } from "@/audio/sfx";
import { Toasts } from "@/ui/layout";
import { TitleScreen } from "@/features/title/TitleScreen";
import { SlotsScreen } from "@/features/title/SlotsScreen";
import { NewGameScreen } from "@/features/title/NewGameScreen";
import { LobbyScreen } from "@/features/lobby/LobbyScreen";
import { SpireScreen } from "@/features/spire/SpireScreen";
import { BattleScreen } from "@/features/battle/BattleScreen";
import { Overlays } from "@/features/Overlays";
import { PendingQueue } from "@/features/progress/PendingQueue";
import { MusicDirector } from "@/features/MusicDirector";

export function App() {
  const screen = useGame((s) => s.screen);
  const music = useSettings((s) => s.music);
  const sfxVol = useSettings((s) => s.sfx);

  useEffect(() => setVolumes(music, sfxVol), [music, sfxVol]);

  // Audio can only start after a gesture; buttons click.
  useEffect(() => {
    const onDown = (e: PointerEvent | KeyboardEvent) => {
      unlockAudio();
      const target = e.target as HTMLElement | null;
      if (e instanceof PointerEvent && target?.closest("button:not([data-silent])")) sfx("select");
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onDown);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onDown);
    };
  }, []);

  // Count play time while a game is loaded.
  useEffect(() => {
    const id = window.setInterval(() => {
      const { save } = useGame.getState();
      if (save && document.visibilityState === "visible") useGame.getState().update((d) => void (d.playTimeMs += 30000));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MusicDirector />
      {screen === "title" && <TitleScreen />}
      {screen === "slots" && <SlotsScreen />}
      {screen === "newgame" && <NewGameScreen />}
      {screen === "lobby" && <LobbyScreen />}
      {screen === "spire" && <SpireScreen />}
      {screen === "battle" && <BattleScreen />}
      <Overlays />
      <PendingQueue />
      <Toasts />
    </div>
  );
}
