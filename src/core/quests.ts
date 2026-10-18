import { species } from "./dex";
import type { SaveData } from "./save";

/**
 * Side quests (claimable rewards, on the lobby's board) and achievements (milestones, shown in
 * the trophy hall). Both are pure checks on the save, so they can't drift out of sync.
 */

export interface Reward {
  money?: number;
  items?: Record<string, number>;
}

export interface QuestDef {
  id: string;
  /** Progress towards `goal`, computed from the save. */
  progress: (s: SaveData) => number;
  goal: number;
  reward: Reward;
  /** Hidden until this floor has been reached. */
  unlock?: number;
}

const beaten = (s: SaveData, ids: string[]) => ids.filter((id) => (s.stats.defeated[id] ?? 0) > 0).length;
const caughtOfType = (s: SaveData, type: string) => s.dex.caught.filter((id) => species(id).types.includes(type)).length;

export const GYMS: Record<string, string[]> = {
  kanto: ["brock", "misty", "ltsurge", "erika", "koga", "sabrina", "blaine", "giovanni"],
  johto: ["falkner", "bugsy", "whitney", "morty", "chuck", "jasmine", "pryce", "clair"],
  hoenn: ["roxanne", "brawly", "wattson", "flannery", "norman", "winona", "tateandliza", "juan"],
  sinnoh: ["roark", "gardenia", "maylene", "crasherwake", "fantina", "byron", "candice", "volkner"],
  unova: ["cilan", "lenora", "burgh", "elesa", "clay", "skyla", "brycen", "drayden"],
};

export const TEAMS: Record<string, string[]> = {
  rocket: ["giovanni", "archer", "ariana", "proton", "petrel"],
  magma: ["maxie", "tabitha", "courtney"],
  aqua: ["archie", "matt", "shelly"],
  galactic: ["cyrus", "mars", "jupiter", "saturn", "charon"],
  plasma: ["ghetsis", "colress", "zinzolin", "shadowtriad"],
};

export const CHAMPIONS = ["blue", "lance", "steven", "wallace", "cynthia", "alder", "iris", "red"];

export const QUESTS: QuestDef[] = [
  { id: "firstCatch", progress: (s) => s.stats.caught, goal: 1, reward: { money: 500, items: { pokeball: 5 } } },
  { id: "bugCatcher", progress: (s) => caughtOfType(s, "Bug"), goal: 3, reward: { money: 1500, items: { netball: 5 } } },
  { id: "birdKeeper", progress: (s) => caughtOfType(s, "Flying"), goal: 4, reward: { money: 2000, items: { sharpbeak: 1 } }, unlock: 3 },
  { id: "collector20", progress: (s) => s.dex.caught.length, goal: 20, reward: { money: 5000, items: { ultraball: 5 } }, unlock: 4 },
  { id: "collector60", progress: (s) => s.dex.caught.length, goal: 60, reward: { items: { expcharm: 1 } }, unlock: 10 },
  { id: "collector120", progress: (s) => s.dex.caught.length, goal: 120, reward: { items: { shinycharm: 1 } }, unlock: 15 },
  { id: "rocketBuster", progress: (s) => beaten(s, TEAMS.rocket), goal: TEAMS.rocket.length, reward: { money: 6000, items: { masterball: 1 } }, unlock: 5 },
  { id: "magmaAqua", progress: (s) => beaten(s, [...TEAMS.magma, ...TEAMS.aqua]), goal: 6, reward: { money: 8000, items: { heatrock: 1, damprock: 1 } }, unlock: 9 },
  { id: "galacticBuster", progress: (s) => beaten(s, TEAMS.galactic), goal: TEAMS.galactic.length, reward: { money: 10000, items: { abilitycapsule: 1 } }, unlock: 15 },
  { id: "plasmaBuster", progress: (s) => beaten(s, TEAMS.plasma), goal: TEAMS.plasma.length, reward: { money: 12000, items: { masterball: 1 } }, unlock: 20 },
  ...Object.entries(GYMS).map(([region, ids]) => ({
    id: `gyms_${region}`,
    progress: (s: SaveData) => beaten(s, ids),
    goal: ids.length,
    reward: { money: 8000, items: { rarecandy: 3, ppup: 1 } },
    unlock: 3,
  })),
  { id: "weatherMaster", progress: (s) => s.stats.weatherWins.length, goal: 4, reward: { money: 5000, items: { heatrock: 1, smoothrock: 1, icyrock: 1, damprock: 1 } }, unlock: 9 },
  { id: "evolver", progress: (s) => s.stats.evolutions, goal: 10, reward: { money: 3000, items: { rarecandy: 2 } } },
  { id: "flawless", progress: (s) => s.stats.flawlessBosses, goal: 3, reward: { items: { lifeorb: 1 } }, unlock: 6 },
  { id: "veteran", progress: (s) => s.stats.trainersDefeated, goal: 50, reward: { items: { luckyegg: 1, amuletcoin: 1 } }, unlock: 8 },
  { id: "shinySpotter", progress: (s) => s.stats.shiniesSeen, goal: 1, reward: { money: 5000, items: { quickball: 3 } } },
  { id: "champions", progress: (s) => beaten(s, CHAMPIONS), goal: CHAMPIONS.length, reward: { items: { goldbottlecap: 1, abilitypatch: 1 } }, unlock: 21 },
  { id: "historian", progress: (s) => s.lore.length, goal: 6, reward: { money: 4000, items: { mint: 1 } }, unlock: 10 },
];

export function questProgress(s: SaveData, q: QuestDef): number {
  return Math.min(q.goal, q.progress(s));
}

export function questReady(s: SaveData, q: QuestDef): boolean {
  return !s.quests[q.id]?.claimed && questProgress(s, q) >= q.goal;
}

export function claimQuest(s: SaveData, id: string): Reward | null {
  const q = QUESTS.find((x) => x.id === id);
  if (!q || !questReady(s, q)) return null;
  s.quests[id] = { done: true, claimed: true };
  if (q.reward.money) s.money += q.reward.money;
  for (const [item, n] of Object.entries(q.reward.items ?? {})) s.bag[item] = (s.bag[item] ?? 0) + n;
  return q.reward;
}

// ---------------------------------------------------------------------------------------------

export interface AchievementDef {
  id: string;
  check: (s: SaveData) => boolean;
  icon: string;
}

const floorAch = (n: number): AchievementDef => ({ id: `floor${n}`, check: (s) => s.progress.best >= n, icon: "tower" });

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "firstSteps", check: (s) => s.progress.best >= 1, icon: "boot" },
  floorAch(5), floorAch(10), floorAch(15), floorAch(20), floorAch(25),
  { id: "summit", check: (s) => s.progress.cleared, icon: "crown" },
  floorAch(40), floorAch(50),
  { id: "firstShiny", check: (s) => s.stats.shiniesSeen > 0, icon: "sparkle" },
  { id: "shinyCaught", check: (s) => s.stats.shiniesCaught > 0, icon: "sparkle" },
  { id: "dex50", check: (s) => s.dex.caught.length >= 50, icon: "book" },
  { id: "dex151", check: (s) => s.dex.caught.length >= 151, icon: "book" },
  { id: "legend", check: (s) => s.legendsCaught.length > 0, icon: "star" },
  { id: "legend5", check: (s) => s.legendsCaught.length >= 5, icon: "star" },
  { id: "rich", check: (s) => s.money >= 100000, icon: "coin" },
  { id: "allGyms", check: (s) => Object.values(GYMS).every((ids) => ids.every((id) => (s.stats.defeated[id] ?? 0) > 0)), icon: "badge" },
  { id: "allChampions", check: (s) => CHAMPIONS.every((id) => (s.stats.defeated[id] ?? 0) > 0), icon: "trophy" },
  { id: "redBeaten", check: (s) => (s.stats.defeated.red ?? 0) > 0, icon: "cap" },
  { id: "persistent", check: (s) => s.stats.blackouts >= 10, icon: "heart" },
  { id: "evolver", check: (s) => s.stats.evolutions >= 25, icon: "dna" },
];

/** Grants any newly met achievements; returns their ids. */
export function updateAchievements(s: SaveData): string[] {
  const gained: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements[a.id] && a.check(s)) {
      s.achievements[a.id] = Date.now();
      gained.push(a.id);
    }
  }
  return gained;
}

// ---------------------------------------------------------------------------------------------

/** Journal entries unlock with the highest floor reached. */
export const LORE = [
  { id: "arrival", floor: 0 },
  { id: "echoes", floor: 1 },
  { id: "rocket", floor: 5 },
  { id: "memory", floor: 10 },
  { id: "galaxy", floor: 15 },
  { id: "ideals", floor: 20 },
  { id: "elite", floor: 25 },
  { id: "silence", floor: 30 },
  { id: "apex", floor: 31 },
];

export const unlockedLore = (s: SaveData) => LORE.filter((l) => s.progress.best >= l.floor);
