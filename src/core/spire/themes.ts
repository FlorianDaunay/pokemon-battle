import type { WeatherId } from "../battle/engine";

/**
 * Floor themes. Each one sets the scenery, the ambient particles, the weather battles start in,
 * the wild Pokémon that roam it, and which trainers' echoes appear (the boss guards the exit).
 */

export type Biome =
  | "forest" | "cave" | "coast" | "sky" | "hideout" | "power" | "dojo" | "tower" | "volcano" | "abyss"
  | "sanctum" | "ice" | "desert" | "marsh" | "space" | "foundry" | "arena" | "den" | "shadow" | "frigate"
  | "league" | "summit";

export type Ambient = "leaves" | "dust" | "rain" | "storm" | "feathers" | "smoke" | "sparks" | "petals" | "wisps" | "embers" | "sparkles" | "snow" | "sand" | "spores" | "stars" | "steam" | "confetti" | "mist" | "shadows" | "aurora" | "motes" | "blizzard";

export interface ThemeDef {
  id: string;
  name: string;
  fr: string;
  biome: Biome;
  ambient: Ambient;
  weather?: WeatherId;
  /** Chance that a given battle on this floor happens in `weather`. */
  weatherChance?: number;
  /** Powers Dusk Balls / Dive Balls. */
  dark?: boolean;
  water?: boolean;
  /** Wild species (any stage: they're adjusted to the floor's level). */
  pool: string[];
  trainers: string[];
  boss: string;
  /** Legendaries that may haunt this theme in late floors. */
  legends: string[];
}

const th = (o: Omit<ThemeDef, "pool" | "trainers" | "legends"> & { pool: string; trainers: string; legends?: string }): ThemeDef => ({
  ...o,
  pool: o.pool.split(" "),
  trainers: o.trainers.split(" "),
  legends: o.legends ? o.legends.split(" ") : [],
});

export const THEMES: ThemeDef[] = [
  th({ id: "viridian", name: "Verdant Woods", fr: "Bois Verdoyant", biome: "forest", ambient: "leaves", boss: "erika",
    pool: "caterpie weedle pidgey oddish bellsprout pikachu hoothoot ledyba spinarak sunkern wurmple seedot shroomish budew combee sewaddle venipede cottonee petilil foongus treecko chikorita bulbasaur turtwig snivy",
    trainers: "bugsy gardenia burgh cilan", legends: "celebi shaymin virizion" }),
  th({ id: "caverns", name: "Shale Caverns", fr: "Cavernes de Schiste", biome: "cave", ambient: "dust", dark: true, boss: "roark",
    pool: "geodude onix zubat diglett sandshrew larvitar aron nosepass makuhita whismur roggenrola drilbur woobat timburr dwebble cranidos shieldon bronzor rhyhorn phanpy",
    trainers: "brock roxanne roark clay", legends: "regirock terrakion" }),
  th({ id: "coast", name: "Tidal Shore", fr: "Rivage des Marées", biome: "coast", ambient: "rain", weather: "raindance", weatherChance: 0.4, water: true, boss: "misty",
    pool: "psyduck poliwag tentacool shellder krabby horsea staryu magikarp marill wooper corphish wingull lotad buizel shellos tympole ducklett frillish squirtle totodile mudkip piplup oshawott",
    trainers: "misty crasherwake cress marlon", legends: "suicune manaphy keldeo" }),
  th({ id: "skygarden", name: "Sky Garden", fr: "Jardin Céleste", biome: "sky", ambient: "feathers", boss: "winona",
    pool: "pidgey spearow doduo hoothoot natu taillow swablu starly murkrow pidove woobat ducklett rufflet vullaby emolga tropius skarmory noctowl farfetchd chatot",
    trainers: "falkner winona skyla", legends: "articuno zapdos moltres tornadus" }),
  th({ id: "rocket", name: "Rocket Hideout", fr: "Repaire Rocket", biome: "hideout", ambient: "smoke", dark: true, boss: "giovanni",
    pool: "rattata ekans zubat meowth koffing grimer drowzee voltorb houndour murkrow sneasel magnemite porygon mankey gastly",
    trainers: "proton petrel ariana archer", legends: "mewtwo mew" }),
  th({ id: "powerplant", name: "Thunder Works", fr: "Centrale Foudre", biome: "power", ambient: "sparks", boss: "elesa",
    pool: "pikachu magnemite voltorb electabuzz mareep elekid electrike plusle minun shinx pachirisu blitzle joltik tynamo emolga rotom chinchou porygon",
    trainers: "ltsurge wattson volkner elesa", legends: "zapdos raikou thundurus" }),
  th({ id: "dojo", name: "Fighting Dojo", fr: "Dojo des Poings", biome: "dojo", ambient: "petals", boss: "maylene",
    pool: "mankey machop tyrogue makuhita meditite riolu croagunk timburr throh sawk mienfoo scraggy heracross hitmonlee hitmonchan shroomish poliwag",
    trainers: "chuck brawly maylene marshal", legends: "cobalion terrakion virizion" }),
  th({ id: "tower", name: "Lilac Tower", fr: "Tour Lilas", biome: "tower", ambient: "wisps", dark: true, boss: "morty",
    pool: "gastly misdreavus shuppet duskull drifloon spiritomb litwick yamask frillish golett sableye zubat murkrow",
    trainers: "morty fantina shauntal agatha", legends: "giratina darkrai" }),
  th({ id: "magma", name: "Magma Caldera", fr: "Caldeira Magma", biome: "volcano", ambient: "embers", weather: "sunnyday", weatherChance: 0.7, boss: "maxie",
    pool: "vulpix growlithe ponyta slugma magby numel torkoal houndour darumaka litwick heatmor larvesta charmander cyndaquil torchic chimchar tepig",
    trainers: "tabitha courtney flannery blaine chili", legends: "entei heatran moltres groudon victini" }),
  th({ id: "aqua", name: "Abyssal Trench", fr: "Fosse Abyssale", biome: "abyss", ambient: "storm", weather: "raindance", weatherChance: 0.8, water: true, boss: "archie",
    pool: "tentacool seel horsea goldeen magikarp chinchou carvanha wailmer barboach clamperl relicanth finneon mantyke frillish alomomola basculin lanturn sharpedo",
    trainers: "matt shelly juan", legends: "kyogre lugia phione" }),
  th({ id: "sanctum", name: "Psychic Sanctum", fr: "Sanctuaire Psy", biome: "sanctum", ambient: "sparkles", boss: "sabrina",
    pool: "abra drowzee exeggcute slowpoke natu girafarig ralts spoink baltoy chingling bronzor munna sigilyph gothita solosis elgyem mrmime smoochum",
    trainers: "sabrina tateandliza will lucian", legends: "mewtwo uxie mesprit azelf cresselia jirachi" }),
  th({ id: "frost", name: "Frost Hollow", fr: "Grotte Givrée", biome: "ice", ambient: "snow", weather: "hail", weatherChance: 0.8, boss: "pryce",
    pool: "seel shellder jynx swinub sneasel delibird snorunt spheal snover vanillite cubchoo cryogonal lapras smoochum",
    trainers: "pryce candice brycen glacia", legends: "articuno regice kyurem" }),
  th({ id: "desert", name: "Mirage Desert", fr: "Désert Mirage", biome: "desert", ambient: "sand", weather: "sandstorm", weatherChance: 0.85, boss: "clay",
    pool: "sandshrew diglett cubone trapinch cacnea baltoy hippopotas gible sandile darumaka maractus dwebble scraggy sigilyph yamask phanpy skorupi",
    trainers: "clay bertha", legends: "groudon landorus regirock" }),
  th({ id: "marsh", name: "Venom Marsh", fr: "Marais Venin", biome: "marsh", ambient: "spores", boss: "koga",
    pool: "ekans nidoranf nidoranm zubat grimer koffing venonat tentacool gulpin seviper stunky skorupi croagunk trubbish venipede foongus qwilfish spinarak",
    trainers: "koga janine roxie", legends: "darkrai" }),
  th({ id: "galactic", name: "Galactic Station", fr: "Station Galaxie", biome: "space", ambient: "stars", boss: "cyrus",
    pool: "clefairy staryu porygon lunatone solrock beldum bronzor elgyem stunky glameow murkrow sneasel golbat drifloon",
    trainers: "mars jupiter saturn charon", legends: "deoxys dialga palkia uxie mesprit azelf" }),
  th({ id: "ironworks", name: "Iron Works", fr: "Forge de Fer", biome: "foundry", ambient: "steam", boss: "byron",
    pool: "magnemite onix forretress skarmory aron beldum bronzor shieldon klink ferroseed pawniard durant mawile scizor steelix",
    trainers: "jasmine byron", legends: "registeel cobalion jirachi genesect" }),
  th({ id: "arena", name: "Grand Arena", fr: "Grande Arène", biome: "arena", ambient: "confetti", boss: "norman",
    pool: "rattata meowth eevee snorlax tauros kangaskhan aipom dunsparce teddiursa miltank slakoth zangoose spinda bidoof buneary patrat lillipup minccino audino bouffalant",
    trainers: "whitney norman lenora cheren", legends: "regigigas" }),
  th({ id: "den", name: "Dragon's Den", fr: "Antre Dragon", biome: "den", ambient: "mist", boss: "drayden",
    pool: "dratini horsea bagon swablu trapinch gible axew druddigon deino feebas vibrava altaria kingdra",
    trainers: "clair drayden drake", legends: "latias latios rayquaza" }),
  th({ id: "shadow", name: "Shadow Sanctuary", fr: "Sanctuaire Ténèbres", biome: "shadow", ambient: "shadows", dark: true, boss: "karen",
    pool: "murkrow sneasel houndour umbreon sableye absol poochyena carvanha purrloin sandile scraggy zorua pawniard vullaby deino",
    trainers: "karen grimsley sidney", legends: "darkrai" }),
  th({ id: "plasma", name: "Plasma Frigate", fr: "Frégate Plasma", biome: "frigate", ambient: "aurora", boss: "ghetsis",
    pool: "purrloin patrat trubbish sandile scraggy pawniard klink zorua vanillite cubchoo golett deino frillish",
    trainers: "zinzolin shadowtriad colress n", legends: "reshiram zekrom kyurem genesect" }),
  // Elite halls
  th({ id: "indigo", name: "Indigo Hall", fr: "Hall Indigo", biome: "league", ambient: "motes", boss: "lance",
    pool: "lapras dragonite gengar machamp cloyster dewgong hitmonlee hitmonchan golem arcanine alakazam gyarados",
    trainers: "lorelei bruno agatha koga", legends: "articuno zapdos moltres mewtwo" }),
  th({ id: "johtohall", name: "Silver Hall", fr: "Hall Argent", biome: "league", ambient: "motes", boss: "silver",
    pool: "xatu umbreon espeon houndoom crobat tyranitar heracross scizor ampharos kingdra skarmory",
    trainers: "will karen bruno janine", legends: "raikou entei suicune lugia hooh celebi" }),
  th({ id: "hoennhall", name: "Ever Grande Hall", fr: "Hall Éternara", biome: "league", ambient: "motes", boss: "steven",
    pool: "absol banette dusclops glalie walrein salamence flygon metagross milotic aggron sharpedo",
    trainers: "sidney phoebe glacia drake", legends: "regirock regice registeel latias latios kyogre groudon rayquaza" }),
  th({ id: "sinnohhall", name: "Lily Hall", fr: "Hall Lys", biome: "league", ambient: "motes", boss: "barry",
    pool: "drapion hippowdon infernape gallade bronzong garchomp lucario togekiss roserade spiritomb weavile",
    trainers: "aaron bertha flint lucian", legends: "uxie mesprit azelf heatran regigigas cresselia" }),
  th({ id: "unovahall", name: "Opelucid Hall", fr: "Hall Janusia", biome: "league", ambient: "motes", boss: "alder",
    pool: "chandelure cofagrigus bisharp krookodile gothitelle reuniclus conkeldurr mienshao volcarona hydreigon haxorus",
    trainers: "shauntal grimsley caitlin marshal", legends: "cobalion terrakion virizion tornadus thundurus landorus" }),
  // Summit
  th({ id: "rivals", name: "Rivals' Bridge", fr: "Pont des Rivaux", biome: "arena", ambient: "confetti", boss: "blue",
    pool: "pidgeot arcanine gyarados alakazam feraligatr staraptor empoleon samurott unfezant",
    trainers: "silver barry hugh cheren", legends: "hooh lugia" }),
  th({ id: "champions1", name: "Hall of Tides", fr: "Hall des Marées", biome: "coast", ambient: "rain", weather: "raindance", weatherChance: 0.3, water: true, boss: "wallace",
    pool: "milotic ludicolo wailord whiscash tentacruel metagross skarmory aggron armaldo cradily claydol",
    trainers: "steven juan winona", legends: "kyogre groudon rayquaza" }),
  th({ id: "champions2", name: "Dragonspiral Peak", fr: "Pic Dracospire", biome: "den", ambient: "mist", boss: "iris",
    pool: "haxorus hydreigon archeops druddigon zoroark klinklang carracosta vanilluxe",
    trainers: "n drayden alder", legends: "reshiram zekrom kyurem" }),
  th({ id: "champions3", name: "Spear Pillar", fr: "Colonnes Lances", biome: "space", ambient: "stars", boss: "cynthia",
    pool: "garchomp spiritomb togekiss lucario milotic roserade gastrodon",
    trainers: "cyrus lucian volkner", legends: "dialga palkia giratina arceus" }),
  th({ id: "silverpeak", name: "Silver Peak", fr: "Sommet Argenté", biome: "summit", ambient: "blizzard", boss: "red",
    pool: "pikachu snorlax lapras espeon venusaur charizard blastoise tyranitar larvitar donphan ursaring",
    trainers: "blue lance", legends: "mew mewtwo hooh lugia" }),
];

const BY_ID = new Map(THEMES.map((x) => [x.id, x]));
export const themeById = (id: string): ThemeDef => BY_ID.get(id) ?? THEMES[0];

export const themeName = (t: ThemeDef, lang: string): string => (lang === "fr" ? t.fr : t.name);

/** The designed climb: floor N (1-based) uses MAIN_FLOORS[N-1]. Beyond, the Apex mixes everything. */
export const MAIN_FLOORS = [
  "viridian", "caverns", "coast", "skygarden", "rocket",
  "powerplant", "dojo", "tower", "magma", "aqua",
  "sanctum", "frost", "desert", "marsh", "galactic",
  "ironworks", "arena", "den", "shadow", "plasma",
  "indigo", "johtohall", "hoennhall", "sinnohhall", "unovahall",
  "rivals", "champions1", "champions2", "champions3", "silverpeak",
];

export const LAST_MAIN_FLOOR = MAIN_FLOORS.length;
