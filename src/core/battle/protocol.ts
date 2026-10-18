/**
 * Turns Showdown protocol lines into small events the battle scene can animate and narrate.
 * Only player-side ("p1") secret lines are kept, so HP values are exact.
 */

export type Side = "p1" | "p2";

export type BattleEvent =
  | { t: "switch"; side: Side; slot: number; hp: number; maxhp: number; drag?: boolean }
  | { t: "move"; side: Side; move: string; target?: Side; miss?: boolean; still?: boolean }
  | { t: "damage"; side: Side; hp: number; maxhp: number; from?: string; of?: Side }
  | { t: "heal"; side: Side; hp: number; maxhp: number; from?: string }
  | { t: "sethp"; side: Side; hp: number; maxhp: number }
  | { t: "status"; side: Side; status: string; from?: string }
  | { t: "curestatus"; side: Side; status: string }
  | { t: "boost"; side: Side; stat: string; amount: number }
  | { t: "faint"; side: Side }
  | { t: "effectiveness"; side: Side; kind: "super" | "resisted" | "immune" }
  | { t: "crit"; side: Side }
  | { t: "miss"; side: Side }
  | { t: "fail"; side: Side }
  | { t: "weather"; weather: string; upkeep: boolean }
  | { t: "cant"; side: Side; reason: string; move?: string }
  | { t: "effect"; kind: string; side?: Side; effect: string; of?: Side; extra?: string }
  | { t: "item"; side: Side; item: string; end?: boolean; from?: string; eat?: boolean }
  | { t: "ability"; side: Side; ability: string }
  | { t: "transform"; side: Side; into: Side }
  | { t: "forme"; side: Side; species: string }
  | { t: "hitcount"; side: Side; count: number }
  | { t: "turn"; n: number }
  | { t: "win"; side: Side | null }
  // Synthetic events the controller adds (not from the sim)
  | { t: "bag"; item: string; target: number }
  | { t: "ball"; ball: string; shakes: number; caught: boolean }
  | { t: "run"; ok: boolean }
  | { t: "message"; key: string; params?: Record<string, string | number> };

export function sideOf(ident: string | undefined): Side | undefined {
  if (!ident) return undefined;
  if (ident.startsWith("p1")) return "p1";
  if (ident.startsWith("p2")) return "p2";
  return undefined;
}

/** Slot index from our nicknames ("S0".."S5"). */
export function slotOf(ident: string): number {
  const m = /: S(\d+)/.exec(ident);
  return m ? Number(m[1]) : 0;
}

function parseHp(cond: string | undefined): { hp: number; maxhp: number; status?: string } {
  if (!cond) return { hp: 0, maxhp: 1 };
  const [hpPart, status] = cond.split(" ");
  if (hpPart === "0" || cond.startsWith("0 ")) return { hp: 0, maxhp: 1, status: "fnt" };
  const [hp, maxhp] = hpPart.split("/").map(Number);
  return { hp: hp || 0, maxhp: maxhp || 100, status };
}

/** Value of a `[from] effect` / `[of] ident` keyword argument. */
function kwarg(args: string[], key: string): string | undefined {
  const found = args.find((a) => a.startsWith(`[${key}]`));
  return found?.slice(key.length + 2).trim();
}

const effectName = (s: string | undefined) => (s ?? "").replace(/^(move|ability|item): /, "");

/** Splits the raw log into the lines visible to p1 (secret lines win over public ones). */
export function visibleLines(log: string[], from: number): string[] {
  const out: string[] = [];
  for (let i = from; i < log.length; i++) {
    const line = log[i];
    if (line.startsWith("|split|")) {
      const side = line.slice(7);
      // split|pN is followed by the secret line then the public one
      out.push(side === "p1" || side === "p2" ? log[i + 1] : log[i + 2]);
      i += 2;
      continue;
    }
    out.push(line);
  }
  return out;
}

export function parseLines(lines: string[]): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const line of lines) {
    if (!line || !line.startsWith("|")) continue;
    const parts = line.slice(1).split("|");
    const [cmd, a1, a2, a3] = parts;
    const rest = parts.slice(1);
    const side = sideOf(a1);
    switch (cmd) {
      case "switch":
      case "drag":
      case "replace": {
        const { hp, maxhp } = parseHp(a3);
        events.push({ t: "switch", side: side!, slot: slotOf(a1), hp, maxhp, drag: cmd === "drag" });
        break;
      }
      case "move": {
        if (a2 === "bagaction" || a2 === "Bag Action") break;
        events.push({
          t: "move",
          side: side!,
          move: a2,
          target: sideOf(a3),
          miss: rest.includes("[miss]"),
          still: rest.includes("[still]"),
        });
        break;
      }
      case "-damage": {
        const { hp, maxhp } = parseHp(a2);
        events.push({ t: "damage", side: side!, hp, maxhp, from: effectName(kwarg(rest, "from")), of: sideOf(kwarg(rest, "of")) });
        break;
      }
      case "-heal": {
        const { hp, maxhp } = parseHp(a2);
        events.push({ t: "heal", side: side!, hp, maxhp, from: effectName(kwarg(rest, "from")) });
        break;
      }
      case "-sethp": {
        const { hp, maxhp } = parseHp(a2);
        events.push({ t: "sethp", side: side!, hp, maxhp });
        break;
      }
      case "-status":
        events.push({ t: "status", side: side!, status: a2, from: effectName(kwarg(rest, "from")) });
        break;
      case "-curestatus":
        if (side) events.push({ t: "curestatus", side, status: a2 });
        break;
      case "-boost":
      case "-unboost": {
        const amount = Number(a3) * (cmd === "-unboost" ? -1 : 1);
        events.push({ t: "boost", side: side!, stat: a2, amount });
        break;
      }
      case "faint":
        events.push({ t: "faint", side: side! });
        break;
      case "-supereffective":
        events.push({ t: "effectiveness", side: side!, kind: "super" });
        break;
      case "-resisted":
        events.push({ t: "effectiveness", side: side!, kind: "resisted" });
        break;
      case "-immune":
        events.push({ t: "effectiveness", side: side!, kind: "immune" });
        break;
      case "-crit":
        events.push({ t: "crit", side: side! });
        break;
      case "-miss":
        events.push({ t: "miss", side: sideOf(a2) ?? side! });
        break;
      case "-fail":
        events.push({ t: "fail", side: side! });
        break;
      case "-weather":
        events.push({ t: "weather", weather: a1, upkeep: rest.includes("[upkeep]") });
        break;
      case "cant":
        events.push({ t: "cant", side: side!, reason: effectName(a2), move: a3 });
        break;
      case "-start":
      case "-end":
      case "-activate":
      case "-singleturn":
      case "-singlemove":
        if (side) events.push({ t: "effect", kind: cmd.slice(1), side, effect: effectName(a2), of: sideOf(kwarg(rest, "of")), extra: a3 });
        break;
      case "-sidestart":
      case "-sideend":
        events.push({ t: "effect", kind: cmd.slice(1), side: a1.startsWith("p1") ? "p1" : "p2", effect: effectName(a2) });
        break;
      case "-fieldstart":
      case "-fieldend":
        events.push({ t: "effect", kind: cmd.slice(1), effect: effectName(a1) });
        break;
      case "-item":
        events.push({ t: "item", side: side!, item: a2, from: effectName(kwarg(rest, "from")) });
        break;
      case "-enditem":
        events.push({ t: "item", side: side!, item: a2, end: true, eat: rest.includes("[eat]"), from: effectName(kwarg(rest, "from")) });
        break;
      case "-ability":
        events.push({ t: "ability", side: side!, ability: a2 });
        break;
      case "-transform":
        events.push({ t: "transform", side: side!, into: sideOf(a2)! });
        break;
      case "-formechange":
      case "detailschange":
        events.push({ t: "forme", side: side!, species: a2.split(",")[0] });
        break;
      case "-hitcount":
        events.push({ t: "hitcount", side: side!, count: Number(a2) });
        break;
      case "-clearallboost":
        events.push({ t: "effect", kind: "clearallboost", effect: "clearallboost" });
        break;
      case "-clearboost":
      case "-clearnegativeboost":
        if (side) events.push({ t: "effect", kind: cmd.slice(1), side, effect: cmd.slice(1) });
        break;
      case "-prepare":
        events.push({ t: "effect", kind: "prepare", side: side!, effect: a2 });
        break;
      case "-mustrecharge":
        events.push({ t: "effect", kind: "mustrecharge", side: side!, effect: "recharge" });
        break;
      case "turn":
        events.push({ t: "turn", n: Number(a1) });
        break;
      case "win":
        events.push({ t: "win", side: a1 === "Player" ? "p1" : "p2" });
        break;
      case "tie":
        events.push({ t: "win", side: null });
        break;
    }
  }
  return events;
}
