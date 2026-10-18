import type { Rng } from "../rng";

/**
 * Gen 5 capture: returns how many times the ball shakes (0–3) and whether it caught.
 * `ballMult` 255 means a Master Ball.
 */
export function rollCatch(o: {
  maxhp: number;
  hp: number;
  catchRate: number;
  ballMult: number;
  status?: string;
  rng: Rng;
  /** Late-game bonus for the Echo Shard key item and similar. */
  bonus?: number;
}): { shakes: number; caught: boolean } {
  if (o.ballMult >= 255) return { shakes: 3, caught: true };
  const statusMult = o.status === "slp" || o.status === "frz" ? 2.5 : o.status ? 1.5 : 1;
  const a = (((3 * o.maxhp - 2 * o.hp) * o.catchRate * o.ballMult) / (3 * o.maxhp)) * statusMult * (o.bonus ?? 1);
  if (a >= 255) return { shakes: 3, caught: true };
  const b = 65536 / Math.pow(255 / a, 3 / 16);
  let shakes = 0;
  while (shakes < 3 && o.rng.next() * 65536 < b) shakes++;
  // Gen 5 needs three successful checks plus the final one.
  const caught = shakes === 3 && o.rng.next() * 65536 < b;
  return { shakes, caught };
}

/** Gen 5 flee odds (wild battles only). */
export function rollRun(o: { mySpeed: number; foeSpeed: number; attempts: number; rng: Rng }): boolean {
  if (o.mySpeed >= o.foeSpeed) return true;
  const f = Math.floor((o.mySpeed * 128) / Math.max(1, o.foeSpeed)) + 30 * o.attempts;
  return f > 255 || o.rng.int(0, 255) < f;
}
