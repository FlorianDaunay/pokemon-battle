/**
 * The remarkable trainers of Gen 1–5 whose echoes live in the Spire. Rosters list the ace first;
 * smaller teams keep the ace and the first members, and the ace is always sent out last.
 * Species are given in their final form; teams devolve automatically at low levels.
 */

export type TrainerClass = "gym" | "elite" | "champion" | "admin" | "boss" | "rival" | "legend";

export interface TrainerDef {
  id: string;
  name: string;
  /** French name when it differs. */
  fr?: string;
  /** Showdown trainer sprite file (without .png). */
  sprite: string;
  cls: TrainerClass;
  region: "kanto" | "johto" | "hoenn" | "sinnoh" | "unova";
  roster: string[];
}

const t = (id: string, name: string, fr: string | undefined, sprite: string, cls: TrainerClass, region: TrainerDef["region"], roster: string): TrainerDef => ({
  id, name, fr, sprite, cls, region, roster: roster.split(" "),
});

export const TRAINERS: TrainerDef[] = [
  // Kanto
  t("brock", "Brock", "Pierre", "brock", "gym", "kanto", "steelix golem omastar kabutops rhyperior aerodactyl"),
  t("misty", "Misty", "Ondine", "misty", "gym", "kanto", "starmie gyarados lapras golduck quagsire politoed"),
  t("ltsurge", "Lt. Surge", "Major Bob", "ltsurge", "gym", "kanto", "raichu electrode magnezone electivire jolteon lanturn"),
  t("erika", "Erika", "Érika", "erika", "gym", "kanto", "vileplume victreebel tangrowth bellossom jumpluff roserade"),
  t("koga", "Koga", undefined, "koga", "gym", "kanto", "crobat weezing muk venomoth forretress ariados"),
  t("sabrina", "Sabrina", "Morgane", "sabrina", "gym", "kanto", "alakazam espeon mrmime jynx exeggutor gardevoir"),
  t("blaine", "Blaine", "Auguste", "blaine", "gym", "kanto", "magmortar arcanine rapidash ninetales magcargo houndoom"),
  t("giovanni", "Giovanni", undefined, "giovanni", "boss", "kanto", "rhyperior nidoking nidoqueen dugtrio honchkrow persian"),
  t("lorelei", "Lorelei", "Olga", "lorelei", "elite", "kanto", "lapras cloyster dewgong jynx slowbro walrein"),
  t("bruno", "Bruno", "Aldo", "bruno", "elite", "kanto", "machamp hitmonlee hitmonchan steelix hitmontop poliwrath"),
  t("agatha", "Agatha", undefined, "agatha-gen3", "elite", "kanto", "gengar mismagius crobat arbok banette dusknoir"),
  t("lance", "Lance", "Peter", "lance", "champion", "kanto", "dragonite gyarados aerodactyl charizard salamence kingdra"),
  t("blue", "Blue", undefined, "blue", "champion", "kanto", "pidgeot alakazam rhyperior exeggutor gyarados arcanine"),
  t("red", "Red", undefined, "red", "legend", "kanto", "pikachu venusaur charizard blastoise snorlax espeon"),
  t("archer", "Archer", "Amos", "archer", "admin", "kanto", "houndoom crobat weezing arbok"),
  t("ariana", "Ariana", "Ariane", "ariana", "admin", "kanto", "arbok vileplume honchkrow weezing"),
  t("proton", "Proton", "Lance", "proton", "admin", "kanto", "weezing crobat raticate muk"),
  t("petrel", "Petrel", "Lambda", "petrel", "admin", "kanto", "weezing raticate muk persian"),
  // Johto
  t("falkner", "Falkner", "Albert", "falkner", "gym", "johto", "pidgeot noctowl swellow staraptor skarmory xatu"),
  t("bugsy", "Bugsy", "Hector", "bugsy", "gym", "johto", "scizor heracross yanmega ariados beedrill butterfree"),
  t("whitney", "Whitney", "Blanche", "whitney", "gym", "johto", "miltank clefable wigglytuff girafarig ursaring tauros"),
  t("morty", "Morty", "Mortimer", "morty", "gym", "johto", "gengar mismagius drifblim dusknoir spiritomb noctowl"),
  t("chuck", "Chuck", undefined, "chuck", "gym", "johto", "poliwrath primeape machamp hitmontop hariyama medicham"),
  t("jasmine", "Jasmine", undefined, "jasmine", "gym", "johto", "steelix magnezone skarmory ampharos forretress bronzong"),
  t("pryce", "Pryce", "Frédo", "pryce", "gym", "johto", "mamoswine dewgong weavile cloyster lapras glalie"),
  t("clair", "Clair", "Sandra", "clair", "gym", "johto", "kingdra dragonite gyarados altaria flygon charizard"),
  t("will", "Will", "Clément", "will", "elite", "johto", "xatu exeggutor slowbro jynx bronzong wobbuffet"),
  t("karen", "Karen", "Marion", "karen", "elite", "johto", "umbreon houndoom honchkrow weavile gengar vileplume"),
  t("janine", "Janine", "Jeannine", "janine", "gym", "johto", "crobat venomoth ariados weezing drapion toxicroak"),
  t("silver", "Silver", undefined, "silver", "rival", "johto", "feraligatr weavile crobat magnezone gengar alakazam"),
  // Hoenn
  t("roxanne", "Roxanne", undefined, "roxanne", "gym", "hoenn", "probopass golem kabutops omastar aerodactyl cradily"),
  t("brawly", "Brawly", "Bastien", "brawly", "gym", "hoenn", "hariyama medicham breloom machamp hitmonchan poliwrath"),
  t("wattson", "Wattson", "Voltère", "wattson", "gym", "hoenn", "manectric magnezone electrode ampharos lanturn electivire"),
  t("flannery", "Flannery", "Adriane", "flannery", "gym", "hoenn", "torkoal camerupt magcargo ninetales houndoom rapidash"),
  t("norman", "Norman", undefined, "norman", "gym", "hoenn", "slaking blissey kangaskhan tauros ursaring swellow"),
  t("winona", "Winona", "Alizée", "winona", "gym", "hoenn", "altaria skarmory swellow pelipper tropius xatu"),
  t("tateandliza", "Tate & Liza", "Lévy & Tatia", "tateandliza-gen3", "gym", "hoenn", "solrock lunatone claydol xatu gardevoir metagross"),
  t("juan", "Juan", undefined, "juan", "gym", "hoenn", "kingdra whiscash walrein crawdaunt gyarados lanturn"),
  t("sidney", "Sidney", "Damien", "sidney", "elite", "hoenn", "absol shiftry cacturne crawdaunt sharpedo mightyena"),
  t("phoebe", "Phoebe", "Spectra", "phoebe-gen3", "elite", "hoenn", "dusknoir banette sableye drifblim mismagius froslass"),
  t("glacia", "Glacia", undefined, "glacia", "elite", "hoenn", "walrein glalie froslass abomasnow cloyster jynx"),
  t("drake", "Drake", "Aragon", "drake-gen3", "elite", "hoenn", "salamence flygon altaria kingdra dragonite druddigon"),
  t("steven", "Steven", "Pierre Rochard", "steven", "champion", "hoenn", "metagross skarmory aggron claydol cradily armaldo"),
  t("wallace", "Wallace", "Marc", "wallace", "champion", "hoenn", "milotic gyarados ludicolo tentacruel whiscash wailord"),
  t("maxie", "Maxie", "Max", "maxie-gen6", "boss", "hoenn", "camerupt crobat mightyena weezing torkoal houndoom"),
  t("archie", "Archie", "Arthur", "archie-gen6", "boss", "hoenn", "sharpedo crobat mightyena muk tentacruel wailord"),
  t("tabitha", "Tabitha", "Kelvin", "tabitha", "admin", "hoenn", "camerupt mightyena crobat weezing"),
  t("courtney", "Courtney", undefined, "courtney", "admin", "hoenn", "swalot camerupt mightyena houndoom"),
  t("matt", "Matt", undefined, "matt", "admin", "hoenn", "sharpedo mightyena crobat tentacruel"),
  t("shelly", "Shelly", undefined, "shelly", "admin", "hoenn", "crawdaunt mightyena crobat pelipper"),
  // Sinnoh
  t("roark", "Roark", "Pierrick", "roark", "gym", "sinnoh", "rampardos golem probopass aerodactyl aggron rhyperior"),
  t("gardenia", "Gardenia", "Flo", "gardenia", "gym", "sinnoh", "roserade cherrim torterra tangrowth leafeon jumpluff"),
  t("maylene", "Maylene", "Mélina", "maylene", "gym", "sinnoh", "lucario medicham machamp gallade toxicroak infernape"),
  t("crasherwake", "Crasher Wake", "Lovis", "crasherwake", "gym", "sinnoh", "floatzel gyarados quagsire gastrodon ludicolo mantine"),
  t("fantina", "Fantina", "Kiméra", "fantina", "gym", "sinnoh", "mismagius drifblim gengar dusknoir rotomwash froslass"),
  t("byron", "Byron", "Charles", "byron", "gym", "sinnoh", "bastiodon steelix bronzong magnezone skarmory forretress"),
  t("candice", "Candice", "Gladys", "candice", "gym", "sinnoh", "froslass abomasnow weavile mamoswine medicham glaceon"),
  t("volkner", "Volkner", "Tanguy", "volkner", "gym", "sinnoh", "luxray electivire jolteon raichu rotomheat magnezone"),
  t("aaron", "Aaron", undefined, "aaron", "elite", "sinnoh", "drapion scizor heracross vespiquen yanmega armaldo"),
  t("bertha", "Bertha", "Terry", "bertha", "elite", "sinnoh", "hippowdon gliscor rhyperior golem quagsire whiscash"),
  t("flint", "Flint", "Adrien", "flint", "elite", "sinnoh", "infernape rapidash magmortar houndoom flareon arcanine"),
  t("lucian", "Lucian", "Lucio", "lucian", "elite", "sinnoh", "gallade bronzong alakazam espeon mrmime girafarig"),
  t("cynthia", "Cynthia", undefined, "cynthia", "champion", "sinnoh", "garchomp spiritomb roserade togekiss lucario milotic"),
  t("cyrus", "Cyrus", "Hélio", "cyrus", "boss", "sinnoh", "weavile honchkrow crobat gyarados houndoom magnezone"),
  t("mars", "Mars", undefined, "mars", "admin", "sinnoh", "purugly bronzong crobat skuntank"),
  t("jupiter", "Jupiter", undefined, "jupiter", "admin", "sinnoh", "skuntank crobat bronzong honchkrow"),
  t("saturn", "Saturn", "Saturne", "saturn", "admin", "sinnoh", "toxicroak alakazam bronzong crobat"),
  t("charon", "Charon", undefined, "charon", "admin", "sinnoh", "rotomwash electrode bronzong magnezone"),
  t("barry", "Barry", undefined, "barry", "rival", "sinnoh", "empoleon staraptor heracross roserade floatzel snorlax"),
  // Unova
  t("cilan", "Cilan", "Rachid", "cilan", "gym", "unova", "simisage lilligant whimsicott sawsbuck ferrothorn amoonguss"),
  t("chili", "Chili", "Armando", "chili", "gym", "unova", "simisear darmanitan heatmor chandelure emboar arcanine"),
  t("cress", "Cress", "Noa", "cress", "gym", "unova", "simipour samurott jellicent seismitoad carracosta swanna"),
  t("lenora", "Lenora", "Aloé", "lenora", "gym", "unova", "stoutland watchog cinccino bouffalant audino braviary"),
  t("burgh", "Burgh", "Artie", "burgh", "gym", "unova", "leavanny scolipede crustle escavalier accelgor durant"),
  t("elesa", "Elesa", "Inezia", "elesa", "gym", "unova", "zebstrika emolga eelektross galvantula ampharos rotomheat"),
  t("clay", "Clay", "Bardane", "clay", "gym", "unova", "excadrill krookodile seismitoad golurk gigalith sandslash"),
  t("skyla", "Skyla", "Carolina", "skyla", "gym", "unova", "swanna unfezant swoobat sigilyph skarmory archeops"),
  t("brycen", "Brycen", "Zhu", "brycen", "gym", "unova", "beartic cryogonal vanilluxe cloyster weavile walrein"),
  t("drayden", "Drayden", "Watson", "drayden", "gym", "unova", "haxorus druddigon flygon altaria salamence kingdra"),
  t("roxie", "Roxie", "Strykna", "roxie", "gym", "unova", "scolipede garbodor toxicroak amoonguss seviper drapion"),
  t("marlon", "Marlon", "Amana", "marlon", "gym", "unova", "jellicent carracosta wailord mantine samurott crustle"),
  t("cheren", "Cheren", "Tcheren", "cheren", "gym", "unova", "stoutland liepard unfezant serperior simipour cinccino"),
  t("iris", "Iris", undefined, "iris", "champion", "unova", "haxorus hydreigon archeops aggron lapras druddigon"),
  t("shauntal", "Shauntal", "Anis", "shauntal", "elite", "unova", "chandelure cofagrigus golurk jellicent drifblim froslass"),
  t("grimsley", "Grimsley", "Pieris", "grimsley", "elite", "unova", "bisharp krookodile scrafty liepard houndoom honchkrow"),
  t("caitlin", "Caitlin", "Percila", "caitlin", "elite", "unova", "gothitelle reuniclus musharna sigilyph metagross bronzong"),
  t("marshal", "Marshal", "Kunz", "marshal", "elite", "unova", "conkeldurr throh sawk mienshao lucario hariyama"),
  t("alder", "Alder", "Goyah", "alder", "champion", "unova", "volcarona bouffalant accelgor escavalier vanilluxe druddigon"),
  t("n", "N", undefined, "n", "boss", "unova", "zekrom zoroark carracosta vanilluxe archeops klinklang"),
  t("ghetsis", "Ghetsis", "Ghetis", "ghetsis", "boss", "unova", "hydreigon cofagrigus bouffalant seismitoad bisharp eelektross"),
  t("colress", "Colress", "Nikolaï", "colress", "admin", "unova", "klinklang magnezone metagross beheeyem rotomwash porygonz"),
  t("zinzolin", "Zinzolin", undefined, "zinzolin", "admin", "unova", "weavile cryogonal beartic vanilluxe"),
  t("shadowtriad", "Shadow Triad", "Triple Ombre", "shadowtriad", "admin", "unova", "bisharp zoroark absol liepard"),
  t("hugh", "Hugh", "Matis", "hugh", "rival", "unova", "samurott unfezant bouffalant simisear flygon eelektross"),
];

const BY_ID = new Map(TRAINERS.map((x) => [x.id, x]));

export function trainer(id: string): TrainerDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown trainer ${id}`);
  return found;
}

export function trainerName(tr: TrainerDef, lang: string): string {
  return lang === "fr" ? tr.fr ?? tr.name : tr.name;
}

export const trainerSpriteUrl = (tr: TrainerDef): string => `https://play.pokemonshowdown.com/sprites/trainers/${tr.sprite}.png`;
