import { useGame } from "@/store/game";
import { PartySheet } from "./party/PartySheet";
import { BagSheet } from "./bag/BagSheet";
import { MartSheet } from "./lobby/MartSheet";
import { PcSheet } from "./lobby/PcSheet";
import { TutorSheet } from "./lobby/TutorSheet";
import { DojoSheet } from "./lobby/DojoSheet";
import { DexSheet, JournalSheet, QuestsSheet, TrophiesSheet } from "./lobby/InfoSheets";
import { SettingsSheet } from "./SettingsSheet";

export function Overlays() {
  const overlay = useGame((s) => s.overlay);
  const hasSave = useGame((s) => !!s.save);
  const close = () => useGame.getState().open(null);
  if (!overlay) return null;
  if (overlay === "settings") return <SettingsSheet onClose={close} />;
  if (!hasSave) return null;
  switch (overlay) {
    case "party": return <PartySheet onClose={close} />;
    case "bag": return <BagSheet onClose={close} />;
    case "mart": return <MartSheet onClose={close} />;
    case "pc": return <PcSheet onClose={close} />;
    case "tutor": return <TutorSheet onClose={close} />;
    case "dojo": return <DojoSheet onClose={close} />;
    case "quests": return <QuestsSheet onClose={close} />;
    case "trophies": return <TrophiesSheet onClose={close} />;
    case "journal": return <JournalSheet onClose={close} />;
    case "dex": return <DexSheet onClose={close} />;
  }
}
