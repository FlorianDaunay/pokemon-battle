import type { StatusId } from "./pokemon";

export type ItemCategory = "ball" | "medicine" | "battle" | "evolution" | "held" | "berry" | "training" | "key";

export interface BallContext {
  turn: number;
  foeLevel: number;
  foeTypes: string[];
  /** Species already registered in the player's dex (Repeat Ball). */
  caughtBefore: boolean;
  /** Dark floors (caves, ghost towers) power the Dusk Ball. */
  dark: boolean;
  /** Water floors power the Dive Ball. */
  water: boolean;
}

export interface ItemDef {
  id: string;
  category: ItemCategory;
  /** Price in the shop; 0 = never sold (found or rewarded only). */
  price: number;
  /** Highest floor reached needed before the shop stocks it. */
  unlock?: number;
  /** Not a Showdown item: its name and description come from the game's own strings. */
  custom?: boolean;
  /** A sim item that can be held in battle. */
  holdable?: boolean;
  ball?: (c: BallContext) => number;
  heal?: {
    hp?: number | "full";
    status?: StatusId[] | "all";
    /** Revive with this fraction of max HP. */
    revive?: number;
    /** PP restored (one move unless allMoves). */
    pp?: number | "full";
    allMoves?: boolean;
  };
  /** X items: stat stages raised in battle. */
  boost?: Partial<Record<"atk" | "def" | "spa" | "spd" | "spe" | "accuracy", number>>;
}

const ALL_STATUS = "all" as const;

const balls: ItemDef[] = [
  { id: "pokeball", category: "ball", price: 200, ball: () => 1 },
  { id: "greatball", category: "ball", price: 600, unlock: 3, ball: () => 1.5 },
  { id: "ultraball", category: "ball", price: 1200, unlock: 10, ball: () => 2 },
  { id: "quickball", category: "ball", price: 1000, unlock: 6, ball: (c) => (c.turn <= 1 ? 5 : 1) },
  { id: "timerball", category: "ball", price: 1000, unlock: 6, ball: (c) => Math.min(4, 1 + (c.turn * 1229) / 4096) },
  { id: "duskball", category: "ball", price: 1000, unlock: 6, ball: (c) => (c.dark ? 3.5 : 1) },
  { id: "netball", category: "ball", price: 1000, unlock: 4, ball: (c) => (c.foeTypes.includes("Water") || c.foeTypes.includes("Bug") ? 3 : 1) },
  { id: "diveball", category: "ball", price: 1000, unlock: 4, ball: (c) => (c.water ? 3.5 : 1) },
  { id: "nestball", category: "ball", price: 1000, unlock: 2, ball: (c) => Math.max(1, (41 - c.foeLevel) / 10) },
  { id: "repeatball", category: "ball", price: 1000, unlock: 8, ball: (c) => (c.caughtBefore ? 3 : 1) },
  { id: "healball", category: "ball", price: 300, ball: () => 1 },
  { id: "luxuryball", category: "ball", price: 1000, unlock: 12, ball: () => 1 },
  { id: "masterball", category: "ball", price: 0, ball: () => 255 },
];

const medicine: ItemDef[] = [
  { id: "potion", category: "medicine", custom: true, price: 300, heal: { hp: 20 } },
  { id: "superpotion", category: "medicine", custom: true, price: 700, unlock: 3, heal: { hp: 50 } },
  { id: "hyperpotion", category: "medicine", custom: true, price: 1200, unlock: 8, heal: { hp: 200 } },
  { id: "maxpotion", category: "medicine", custom: true, price: 2500, unlock: 14, heal: { hp: "full" } },
  { id: "fullrestore", category: "medicine", custom: true, price: 3000, unlock: 18, heal: { hp: "full", status: ALL_STATUS } },
  { id: "antidote", category: "medicine", custom: true, price: 100, heal: { status: ["psn", "tox"] } },
  { id: "paralyzeheal", category: "medicine", custom: true, price: 200, heal: { status: ["par"] } },
  { id: "awakening", category: "medicine", custom: true, price: 250, heal: { status: ["slp"] } },
  { id: "burnheal", category: "medicine", custom: true, price: 250, heal: { status: ["brn"] } },
  { id: "iceheal", category: "medicine", custom: true, price: 250, heal: { status: ["frz"] } },
  { id: "fullheal", category: "medicine", custom: true, price: 600, unlock: 5, heal: { status: ALL_STATUS } },
  { id: "revive", category: "medicine", custom: true, price: 1500, unlock: 2, heal: { revive: 0.5 } },
  { id: "maxrevive", category: "medicine", custom: true, price: 4000, unlock: 16, heal: { revive: 1 } },
  { id: "ether", category: "medicine", custom: true, price: 1200, unlock: 6, heal: { pp: 10 } },
  { id: "maxether", category: "medicine", custom: true, price: 2000, unlock: 12, heal: { pp: "full" } },
  { id: "elixir", category: "medicine", custom: true, price: 3000, unlock: 12, heal: { pp: 10, allMoves: true } },
  { id: "maxelixir", category: "medicine", custom: true, price: 4500, unlock: 20, heal: { pp: "full", allMoves: true } },
];

const battleItems: ItemDef[] = [
  { id: "xattack", category: "battle", price: 500, unlock: 2, custom: true, boost: { atk: 1 } },
  { id: "xdefend", category: "battle", price: 550, unlock: 2, custom: true, boost: { def: 1 } },
  { id: "xspatk", category: "battle", price: 350, unlock: 2, custom: true, boost: { spa: 1 } },
  { id: "xspdef", category: "battle", price: 350, unlock: 2, custom: true, boost: { spd: 1 } },
  { id: "xspeed", category: "battle", price: 350, unlock: 2, custom: true, boost: { spe: 1 } },
  { id: "xaccuracy", category: "battle", price: 950, unlock: 2, custom: true, boost: { accuracy: 1 } },
];

const evolution: ItemDef[] = [
  ...["firestone", "waterstone", "thunderstone", "leafstone", "moonstone"].map((id) => ({ id, category: "evolution" as const, price: 2100, unlock: 4 })),
  ...["sunstone", "shinystone", "duskstone", "dawnstone", "ovalstone"].map((id) => ({ id, category: "evolution" as const, price: 3000, unlock: 10 })),
  { id: "icestone", category: "evolution", price: 3000, unlock: 10, custom: true },
  { id: "linkcable", category: "evolution", price: 3000, unlock: 8, custom: true },
  ...["kingsrock", "metalcoat", "dragonscale", "upgrade", "dubiousdisc", "protector", "electirizer", "magmarizer", "reapercloth", "razorclaw", "razorfang", "prismscale", "deepseatooth", "deepseascale"].map(
    (id) => ({ id, category: "evolution" as const, price: 3500, unlock: 12, holdable: true })
  ),
];

const held = (id: string, price: number, unlock = 0): ItemDef => ({ id, category: "held", price, unlock, holdable: true });
const heldItems: ItemDef[] = [
  held("oranberry", 0),
  held("leftovers", 6000, 8),
  held("lifeorb", 8000, 16),
  held("choiceband", 9000, 18),
  held("choicespecs", 9000, 18),
  held("choicescarf", 9000, 18),
  held("focussash", 5000, 12),
  held("expertbelt", 6000, 12),
  held("eviolite", 6000, 10),
  held("rockyhelmet", 5000, 14),
  held("airballoon", 3000, 10),
  held("blacksludge", 5000, 14),
  held("toxicorb", 3000, 16),
  held("flameorb", 3000, 16),
  held("lightclay", 4000, 14),
  held("heatrock", 3000, 12),
  held("damprock", 3000, 12),
  held("smoothrock", 3000, 12),
  held("icyrock", 3000, 12),
  held("mentalherb", 2500, 10),
  held("whiteherb", 2500, 10),
  held("powerherb", 2500, 10),
  held("redcard", 3000, 16),
  held("ejectbutton", 3000, 16),
  held("muscleband", 3500, 6),
  held("wiseglasses", 3500, 6),
  held("scopelens", 3500, 8),
  held("widelens", 3500, 8),
  held("zoomlens", 3500, 8),
  held("brightpowder", 4000, 10),
  held("quickclaw", 4000, 8),
  held("focusband", 4000, 8),
  held("shellbell", 4000, 10),
  // Held for their effect outside battle (more exp, more money).
  { ...held("luckyegg", 10000, 4), custom: true },
  { ...held("amuletcoin", 10000, 4), custom: true },
  held("lightball", 5000, 6),
  held("thickclub", 5000, 6),
  held("souldew", 0),
  held("griseousorb", 0),
  held("adamantorb", 0),
  held("lustrousorb", 0),
  // Type boosters
  ...["charcoal", "mysticwater", "magnet", "miracleseed", "nevermeltice", "blackbelt", "poisonbarb", "softsand", "sharpbeak", "twistedspoon", "silverpowder", "hardstone", "spelltag", "dragonfang", "blackglasses", "silkscarf"].map(
    (id) => held(id, 3000, 5)
  ),
];

const berry = (id: string, price: number, unlock = 0): ItemDef => ({ id, category: "berry", price, unlock, holdable: true });
const berries: ItemDef[] = [
  berry("sitrusberry", 800, 4),
  berry("lumberry", 1200, 8),
  berry("chestoberry", 400, 4),
  berry("cheriberry", 300, 2),
  berry("pechaberry", 300, 2),
  berry("rawstberry", 300, 2),
  berry("aspearberry", 300, 2),
  berry("leppaberry", 600, 6),
  berry("liechiberry", 2500, 16),
  berry("petayaberry", 2500, 16),
  berry("salacberry", 2500, 16),
  berry("ganlonberry", 2500, 16),
  berry("apicotberry", 2500, 16),
  berry("custapberry", 3500, 20),
  // Resist berries
  ...["occaberry", "passhoberry", "wacanberry", "rindoberry", "yacheberry", "chopleberry", "kebiaberry", "shucaberry", "cobaberry", "payapaberry", "tangaberry", "chartiberry", "kasibberry", "habanberry", "colburberry", "babiriberry", "chilanberry"].map(
    (id) => berry(id, 1500, 12)
  ),
];

const training: ItemDef[] = [
  { id: "rarecandy", category: "training", custom: true, price: 2400, unlock: 3 },
  { id: "ppup", category: "training", custom: true, price: 4000, unlock: 10 },
  { id: "ppmax", category: "training", custom: true, price: 10000, unlock: 20 },
  ...["hpup", "protein", "iron", "calcium", "zinc", "carbos"].map((id) => ({ id, category: "training" as const, custom: true, price: 2000, unlock: 8 })),
  { id: "abilitycapsule", category: "training", price: 12000, unlock: 15, custom: true },
  { id: "abilitypatch", category: "training", price: 30000, unlock: 22, custom: true },
  { id: "mint", category: "training", price: 8000, unlock: 15, custom: true },
  { id: "bottlecap", category: "training", price: 10000, unlock: 20, custom: true },
  { id: "goldbottlecap", category: "training", price: 50000, unlock: 26, custom: true },
];

const key: ItemDef[] = [
  { id: "shinycharm", category: "key", price: 0, custom: true },
  { id: "expcharm", category: "key", price: 0, custom: true },
  { id: "echoshard", category: "key", price: 0, custom: true },
];

export const ITEMS: ItemDef[] = [...balls, ...medicine, ...battleItems, ...evolution, ...heldItems, ...berries, ...training, ...key];
const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function itemDef(id: string): ItemDef | undefined {
  return BY_ID.get(id);
}

export const isHoldable = (id: string): boolean => !!itemDef(id)?.holdable;

/** Price the shop pays back. */
export const sellPrice = (id: string): number => Math.floor((itemDef(id)?.price ?? 0) / 2);

/** PokeAPI sprite file name for an item id. */
const ITEM_SPRITE_NAMES: Record<string, string> = {
  xspatk: "x-sp-atk", xspdef: "x-sp-def", xdefend: "x-defense", icestone: "ice-stone", linkcable: "link-cable",
  abilitycapsule: "ability-capsule", abilitypatch: "ability-patch", mint: "adamant-mint", bottlecap: "bottle-cap",
  goldbottlecap: "gold-bottle-cap", shinycharm: "shiny-charm", expcharm: "exp-charm", echoshard: "blue-shard",
  upgrade: "up-grade", kingsrock: "kings-rock", nevermeltice: "never-melt-ice", hpup: "hp-up", ppup: "pp-up", ppmax: "pp-max",
};

export function itemSpriteName(id: string, englishName: string): string {
  return ITEM_SPRITE_NAMES[id] ?? englishName.toLowerCase().replace(/[’'.]/g, "").replace(/\s+/g, "-");
}
