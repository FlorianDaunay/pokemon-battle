/**
 * Downloads the overworld (walking) sprites of the trainer echoes and camp NPCs from the
 * Bulbagarden Archives into public/ow/, preferring Black 2 / White 2, then older generations,
 * then a trainer-class look-alike. Writes src/data/ow-sprites.json (id → file). Run once:
 *   node scripts/fetch-ow-sprites.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const API = "https://archives.bulbagarden.net/w/api.php";
const src = readFileSync("src/core/spire/trainers.ts", "utf8");
const trainers = [...src.matchAll(/t\("([a-z]+)", "([^"]+)", [^,]+, "[^"]*", "([a-z]+)"/g)].map(([, id, name, cls]) => ({ id, name, cls }));
const FEMALE = new Set("misty erika sabrina lorelei agatha ariana whitney jasmine clair karen janine roxanne flannery winona phoebe glacia courtney shelly gardenia maylene fantina candice bertha cynthia mars jupiter lenora elesa skyla roxie iris shauntal caitlin".split(" "));
const CLASS = {
  gym: ["Ace Trainer m V OD", "Ace Trainer f V OD"], elite: ["Veteran m OD", "Veteran f OD"], champion: ["Ace Trainer m V OD", "Ace Trainer f V OD"],
  admin: ["Team Plasma M OD", "Team Plasma F OD"], boss: ["Gentleman OD", "Psychic f OD"], rival: ["School Kid m OD", "School Kid f OD"], legend: ["Psychic m OD", "Psychic f OD"],
};
const SPECIAL = { tateandliza: "Tate", ltsurge: "Lt Surge", crasherwake: "Crasher Wake", n: "N", shadowtriad: "Shadow Triad" };

// Hoenn's teams keep their own Emerald sprites (see Walker.tsx).
const EMERALD = new Set(["maxie", "archie", "tabitha", "courtney", "matt", "shelly"]);
const wanted = trainers.filter(({ id }) => !EMERALD.has(id)).map(({ id, name, cls }) => {
  const n = SPECIAL[id] ?? name.replace(/\./g, "");
  const flat = n.replace(/\s+/g, "");
  return { id, candidates: [`${n} OD`, `${n} V OD`, `${n} OD 2`, `${n} B2W2 OD`, `${n} IV OD`, `${flat}walkdown`, `${flat}HGSSwalkdown`, `${flat}Ptwalkdown`, `${n} E OD`, `${n} III OD`, CLASS[cls][FEMALE.has(id) ? 1 : 0]] };
});
wanted.push(
  { id: "liza", candidates: ["Liza OD"] },
  { id: "nurse", candidates: ["Nurse OD", "Pokémon Center lady OD"] },
  { id: "clerk", candidates: ["Clerk m OD"] },
  { id: "formchanger", candidates: ["Scientist m OD"] },
  { id: "tutor", candidates: ["Move Reminder V OD"] },
  { id: "blackbelt", candidates: ["Black Belt OD"] },
  { id: "guide", candidates: ["Gym guide V OD"] },
  { id: "curator", candidates: ["Veteran m OD"] },
  { id: "professor", candidates: ["Juniper OD", "Professor Juniper OD", "Scientist f OD"] },
  { id: "hilbert", candidates: ["Hilbert OD"] }, { id: "hilda", candidates: ["Hilda OD"] },
  { id: "nate", candidates: ["Nate OD"] }, { id: "rosa", candidates: ["Rosa OD"] },
);

async function existing(titles) {
  const found = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40).map((t) => `File:${t}.png`);
    const r = await fetch(`${API}?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(batch.join("|"))}`);
    const j = await r.json();
    const norm = new Map((j.query.normalized ?? []).map((x) => [x.to, x.from]));
    for (const p of Object.values(j.query.pages)) if (p.imageinfo) found.set(p.title.replace(/^File:/, "").replace(/\.png$/, ""), p.imageinfo[0].url);
    void norm;
  }
  return found;
}

const all = [...new Set(wanted.flatMap((w) => w.candidates))];
const found = await existing(all);
mkdirSync("public/ow", { recursive: true });
const manifest = {};
for (const w of wanted) {
  const pick = w.candidates.find((c) => found.has(c));
  if (!pick) { console.warn("missing", w.id); continue; }
  const r = await fetch(found.get(pick));
  writeFileSync(`public/ow/${w.id}.png`, Buffer.from(await r.arrayBuffer()));
  manifest[w.id] = pick;
  console.log(w.id.padEnd(14), pick);
}
writeFileSync("src/data/ow-sprites.json", JSON.stringify(manifest, null, 1) + "\n");
