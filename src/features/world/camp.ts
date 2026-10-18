/**
 * The camp is the Pokémon League's lobby from Emerald: the nurse and the clerk at their counters,
 * a PC, and the great door at the back that now opens onto the Spire. People in the hall offer
 * the other services, in mirrored pairs around the room's middle.
 */

export const CAMP_MAP = "EverGrandeCity_PokemonLeague_1F";

/** Where things are on the camp map (cells). */
export const CAMP = {
  /** The great door (two cells wide). */
  door: { x: 9, y: 1, w: 2 },
  spawn: { x: 9, y: 10 },
  /** Behind their counters: two cells tall so you can talk across the counter. */
  nurse: { x: 3, y: 2, h: 2 },
  clerk: { x: 16, y: 2, h: 2 },
  pc: { x: 6, y: 1 },
  trophies: { x: 7, y: 3 },
  journal: { x: 12, y: 3 },
  tutor: { x: 6, y: 5 },
  dojo: { x: 13, y: 5 },
  quests: { x: 6, y: 8 },
  forms: { x: 13, y: 8 },
};
