import { arp, bass, drums, hats, pad, rest, stabs } from "./compose";
import type { Chart } from "./compose";
import type { Track } from "./sequencer";

/**
 * The soundtrack: original compositions in the spirit of the Gen 4–5 scores. Each battle theme
 * opens with a run into a looping section; intensity rises from wild → trainer → boss → champion.
 */

// ---------------------------------------------------------------------------------------------
// Wild battle — A minor, 168 bpm

const WILD_A: Chart = ["a3 c4 e4", "f3 a3 c4", "g3 b3 d4", "e3 g+3 b3", "a3 c4 e4", "f3 a3 c4", "d3 f3 a3", "e3 g+3 b3"];
const WILD_B: Chart = ["f3 a3 c4", "g3 b3 d4", "e3 g3 b3", "a3 c4 e4", "f3 a3 c4", "g3 b3 d4", "e3 g+3 b3", "e3 g+3 b3"];

export const battleWild: Track = {
  bpm: 168,
  parts: [
    {
      inst: "lead",
      mml: `o6 l16 e d+ d c+ c o5 b a+ a g+ g f+ f e d+ d c+
        o4 a8 r8 o5 a8 r8 o4 a8 o5 a8 o6 a4
        o5 a8 a8 r8 a8 r8 a8 g8 a8
        o5 b4 o6 c4 d4 e4 |
        o5 a4. e8 a8 b8 o6 c8 o5 b8
        o5 a4 f4 c4 f8 a8
        o5 g4. d8 g8 a8 b8 o6 d8
        o5 b2 g+4 e4
        o5 a4. e8 a8 b8 o6 c8 d8
        o6 e4 c4 o5 a4 o6 c8 e8
        o6 f4. e8 d8 c8 o5 a8 o6 d8
        o6 e2. o5 g+8 b8
        o6 c4. o5 a8 f4 a4
        o5 b4. g8 d4 g4
        o5 b4 o6 e4 d4 c4
        o5 a2 o6 c4 e4
        o6 f4. e8 c4 f4
        o6 g4. f8 d4 g4
        o6 g+4. f8 e4 d4
        o6 e2 o5 b4 g+4`,
    },
    { inst: "lead2", vol: 0.8, pan: 0.3, mml: `${rest(2)} o5 e8 e8 r8 e8 r8 e8 d8 e8 o5 g+4 a4 b4 o6 c4 | ${arp([...WILD_A, ...WILD_B], "8", "up")}` },
    { inst: "bass", mml: `r1 o2 a8 r8 a8 r8 a8 a8 a4 ${bass(["a2", "e2"], "oct")} | ${bass([...WILD_A, ...WILD_B], "oct")}` },
    { inst: "brass", vol: 0.8, pan: -0.25, mml: `${rest(1)} r1 ${pad(["a3 c4 e4", "e3 g+3 b3"])} | ${stabs(WILD_A, "x..x..x.")} ${pad(WILD_B)}` },
    { inst: "strings", vol: 0.7, mml: `${rest(2)} ${pad(["a3 c4 e4", "e3 g+3 b3"])} | ${pad([...WILD_A, ...WILD_B])}` },
    { inst: "kick", mml: `r2 j16 j16 m16 m16 n16 n16 n16 n16 x4 r4 k8 k8 s8 s8 ${drums(2, "rock", 2, false)} | ${drums(16, "rock")}` },
    { inst: "hat", vol: 0.6, mml: `${rest(2)} ${hats(2)} | ${hats(16)}` },
  ],
};

// ---------------------------------------------------------------------------------------------
// Trainer battle — D minor, 172 bpm

const TR_A: Chart = ["d3 f3 a3", "b-2 d3 f3", "c3 e3 g3", "a2 c+3 e3", "d3 f3 a3", "b-2 d3 f3", "g2 b-2 d3", "a2 c+3 e3"];
const TR_B: Chart = ["b-2 d3 f3", "c3 e3 g3", "a2 c3 e3", "d3 f3 a3", "g2 b-2 d3", "a2 c+3 e3", "d3 f3 a3", "a2 c+3 e3"];

export const battleTrainer: Track = {
  bpm: 172,
  parts: [
    {
      inst: "lead",
      mml: `o4 l16 a b- b o5 c c+ d d+ e f f+ g g+ a b- b o6 c
        o6 c+8 r8 c+8 r8 c+8 c+8 r4
        o5 d8 d8 r8 d8 f8 r8 a8 r8
        o5 g8 g8 r8 g8 o6 c+4 e4 |
        o5 d8 f8 a4 o6 d8 c8 o5 a8 f8
        o5 b-4. a8 b-8 o6 d8 c8 o5 b-8
        o5 c4. e8 g4 o6 c8 e8
        o6 c+2 o5 a4 e4
        o5 d8 f8 a4 o6 d8 e8 f8 e8
        o6 d4. c8 o5 b-4 o6 d4
        o6 c4 o5 b-8 a8 g4 b-8 o6 d8
        o6 c+4. d8 e2
        o6 f4. e8 d4 o5 b-4
        o6 e4. d8 c4 o5 g4
        o6 c4 o5 a8 b8 o6 c4 e4
        o6 d2. r4
        o6 d4 o5 b-8 o6 c8 d4 g4
        o6 e4 c+8 d8 e4 a4
        o6 f4. e8 d8 c8 o5 a8 o6 d8
        o6 c+2 e4 o5 a4`,
    },
    { inst: "lead2", vol: 0.7, pan: 0.35, mml: `${rest(4)} | ${arp([...TR_A, ...TR_B], "16", "updown")}` },
    { inst: "bass", mml: `o2 a1 o2 a8 r8 a8 r8 a8 a8 r4 ${bass(["d2"], "oct")} ${bass([["g2", 2], ["a2", 2]], "oct")} | ${bass([...TR_A, ...TR_B], "pump")}` },
    { inst: "brass", vol: 0.85, pan: -0.3, mml: `${rest(1)} ${stabs(["a3 c+4 e4"], "x.x.xx..")} ${pad(["d3 f3 a3", ["g3 b-3 d4", 2], ["a3 c+4 e4", 2]])} | ${stabs(TR_A, "x..x.x..")} ${pad(TR_B)}` },
    { inst: "strings", vol: 0.6, mml: `${pad(["a3 c+4 e4", "a3 c+4 e4", "d3 f3 a3", "a3 c+4 e4"])} | ${pad([...TR_A, ...TR_B])}` },
    { inst: "kick", mml: `${rest(1)} x8 r8 x8 r8 k8 k8 s8 s8 ${drums(2, "drive", 2, false)} | ${drums(16, "drive")}` },
    { inst: "hat", vol: 0.6, mml: `${rest(2)} ${hats(2)} | ${hats(16)}` },
  ],
};

// ---------------------------------------------------------------------------------------------
// Boss battle (Gym Leaders, admins, team bosses) — E minor, 176 bpm

const BOSS_A: Chart = ["e3 g3 b3", "c3 e3 g3", "d3 f+3 a3", "b2 d+3 f+3", "e3 g3 b3", "c3 e3 g3", "a2 c3 e3", "b2 d+3 f+3"];
const BOSS_B: Chart = ["c3 e3 g3", "d3 f+3 a3", "b2 d3 f+3", "e3 g3 b3", "a2 c3 e3", "b2 d+3 f+3", "c3 e3 g3", "b2 d+3 f+3"];

export const battleBoss: Track = {
  bpm: 176,
  parts: [
    {
      inst: "lead",
      mml: `o5 l16 e f+ g a b o6 c d e f+ g a b o7 c d e f+
        o6 e8 r8 e8 r8 d+8 r8 d8 r8
        o6 c+8 r8 c8 r8 o5 b4 a+4
        o5 b8 b8 b8 b8 b4 r4 |
        o5 e8 g8 b8 o6 e4 d8 o5 b8 g8
        o6 c4. o5 b8 a8 g8 e4
        o5 f+4. a8 d4 f+8 a8
        o5 b2 o6 d+4 f+4
        o6 e8 d8 o5 b8 g8 o6 e4 g4
        o6 g4. f+8 e4 c4
        o6 e4. d8 c4 o5 a4
        o5 b2. o6 d+8 f+8
        o6 g4 e8 g8 o7 c4 o6 b4
        o6 a4 f+8 a8 o7 d4 c4
        o6 b4. a8 f+4 d4
        o6 e2 g4 b4
        o7 c4. o6 b8 a4 e4
        o6 f+4. g8 a4 d+4
        o6 g4. f+8 e8 d8 c8 e8
        o6 d+2 f+4 b4`,
    },
    { inst: "brass", vol: 0.9, pan: -0.3, mml: `${rest(1)} ${stabs(["e3 g3 b3", "b2 d+3 f+3"], "x.x.x.x.")} ${pad(["b2 d+3 f+3"])} | ${stabs([...BOSS_A, ...BOSS_B], "x..x..x.")}` },
    { inst: "lead2", vol: 0.65, pan: 0.35, mml: `${rest(4)} | ${arp([...BOSS_A, ...BOSS_B], "16", "up")}` },
    { inst: "bass", mml: `o2 e1 ${bass(["e2", "b1"], "oct")} o2 b8 b8 b8 b8 b4 r4 | ${bass([...BOSS_A, ...BOSS_B], "gallop")}` },
    { inst: "strings", vol: 0.65, mml: `${pad(["e3 g3 b3", "e3 g3 b3", "b2 d+3 f+3", "b2 d+3 f+3"])} | ${pad([...BOSS_A, ...BOSS_B])}` },
    { inst: "timpani", vol: 0.8, mml: `o2 [e16]16 e4 r4 b4 r4 o2 e4 r4 o1 b4 r4 o1 b4 b4 b4 r4 | ${rest(16)}` },
    { inst: "kick", mml: `${rest(3)} k8 k8 s8 s8 s16 s16 s16 s16 s8 x8 | ${drums(16, "drive")}` },
    { inst: "hat", vol: 0.6, mml: `${rest(4)} | ${hats(16)}` },
  ],
};

// ---------------------------------------------------------------------------------------------
// Champion battle (Champions, Red, legendaries) — C minor, 180 bpm

const CH_A: Chart = ["c3 e-3 g3", "a-2 c3 e-3", "b-2 d3 f3", "g2 b2 d3", "c3 e-3 g3", "a-2 c3 e-3", "f2 a-2 c3", "g2 b2 d3"];
const CH_B: Chart = ["a-2 c3 e-3", "b-2 d3 f3", "g2 b-2 d3", "c3 e-3 g3", "f2 a-2 c3", "g2 b2 d3", ["a-2 c3 e-3", 2], ["b-2 d3 f3", 2], "g2 b2 d3"];

export const battleChampion: Track = {
  bpm: 180,
  parts: [
    {
      inst: "lead",
      mml: `o4 l16 c c c c e- e- e- e- g g g g o5 c c c c
        o5 e- e- e- e- g g g g o6 c c c c e- e- e- e-
        o6 g4 f+4 f4 e4
        o6 e-8 r8 d8 r8 o5 b4 g4 |
        o5 c8 e-8 g8 o6 c8 o5 b-8 g8 o6 c4
        o6 c4. o5 b-8 a-4 e-4
        o5 d8 f8 b-8 o6 d8 f4 e-8 d8
        o5 b2 o6 d4 g4
        o6 c8 d8 e-8 f8 g4 e-4
        o6 a-4. g8 f4 e-4
        o6 f4 a-4 g8 f8 e-8 d8
        o6 d2 o5 b4 g4
        o6 e-4. f8 g4 a-4
        o6 f4. e-8 d4 b-4
        o6 b-4 a-8 g8 d4 g4
        o6 c2 e-4 g4
        o6 a-4. g8 f4 c4
        o6 b4. o7 c8 d4 o6 b4
        o7 c4 o6 a-4 b-4 o7 d4
        o6 g2 b4 o7 d4`,
    },
    { inst: "brass", vol: 1, pan: -0.25, mml: `${rest(2)} ${pad(["g3 b3 d4"])} ${stabs(["g3 b3 d4"], "x.x.x.x.")} | ${pad([...CH_A, ...CH_B])}` },
    { inst: "lead2", vol: 0.6, pan: 0.35, mml: `${rest(4)} | ${arp([...CH_A, ...CH_B], "16", "updown")}` },
    { inst: "bass", mml: `${bass(["c2", "c2", "g1"], "oct")} o2 e-8 r8 d8 r8 o1 b4 g4 | ${bass([...CH_A, ...CH_B], "gallop")}` },
    { inst: "strings", vol: 0.75, mml: `${pad(["c3 e-3 g3", "c3 e-3 g3", "g2 b2 d3", "g2 b2 d3"])} | ${arp([...CH_A, ...CH_B], "8", "updown")}` },
    { inst: "timpani", vol: 0.9, mml: `o2 c4 r4 c4 r4 c4 r4 c4 c4 o1 g8 g8 g8 g8 g8 g8 g8 g8 o1 g4 r4 g4 g4 | o2 [c4 r4 r2]2 ${rest(14)}` },
    { inst: "kick", mml: `${rest(2)} [s16]16 x8 r8 x8 r8 s16 s16 s16 s16 x4 | ${drums(16, "drive")}` },
    { inst: "hat", vol: 0.6, mml: `${rest(4)} | ${hats(16)}` },
  ],
};

// ---------------------------------------------------------------------------------------------
// Victory — C major, 132 bpm (fanfare then a loop while results show)

const VIC: Chart = ["c3 e3 g3", "f3 a3 c4", "g3 b3 d4", "c3 e3 g3", "a2 c3 e3", "f3 a3 c4", "g3 b3 d4", "c3 e3 g3"];

export const victory: Track = {
  bpm: 132,
  parts: [
    {
      inst: "lead",
      mml: `o5 l16 c e g o6 c o5 g o6 c e g c2
        o6 c4 r8 c8 d8 r8 e4 |
        o5 e4 g4 o6 c4. o5 b8
        o5 a4 f4 a4 o6 c4
        o5 b4. a8 g4 f4
        o5 e2 g2
        o5 a4 o6 c4 e4. d8
        o6 c4 o5 a4 f4 a4
        o5 g4. a8 b4 o6 d4
        o6 c2. r4`,
    },
    { inst: "brass", vol: 0.7, pan: -0.25, mml: `r2 {o4ceg}2 {o4ceg}4 r8 {o4ceg}8 {o4dfa}8 r8 {o4egb}4 | ${stabs(VIC, "x...x...")}` },
    { inst: "bass", mml: `o2 c2 c2 c4 r8 c8 d8 r8 e4 | ${bass(VIC, "walk")}` },
    { inst: "bell", vol: 0.6, pan: 0.3, mml: `${rest(2)} | ${arp(VIC, "8", "up")}` },
    { inst: "kick", mml: `r2 x2 k8 r8 s8 r8 s8 s8 x4 | ${drums(8, "light", 8, true)}` },
  ],
};

// ---------------------------------------------------------------------------------------------
// Camp (lobby) — F major, 96 bpm

const CAMP: Chart = [
  "f3 a3 c4", "a3 c4 e4", "b-3 d4 f4", "c4 e4 g4", "f3 a3 c4", "d3 f3 a3", ["b-3 d4 f4", 2], ["c4 e4 g4", 2], "f3 a3 c4",
  "d3 f3 a3", "a3 c4 e4", "b-3 d4 f4", "f3 a3 c4", "g3 b-3 d4", "c4 e4 g4", "b-3 d4 f4", "c4 e4 b-4",
];

export const camp: Track = {
  bpm: 96,
  parts: [
    {
      inst: "bell",
      mml: `|
        o5 a4 o6 c4 f4. e8
        o6 e4 c4 o5 a2
        o5 b-4 o6 d4 f4 d4
        o6 c2. r4
        o5 a4 o6 c4 f4 g8 a8
        o6 f4 d4 o5 a4 o6 d4
        o6 d4 c4 e4 g4
        o6 f2. r4
        o6 a4. g8 f4 d4
        o6 e4. d8 c4 o5 a4
        o6 d4 f4 b-4 a8 g8
        o6 a2 f4 c4
        o6 b-4. a8 g4 d4
        o6 e4. f8 g4 c4
        o6 f4 e4 d4 o5 b-4
        o6 c2 o5 g4 b-4`,
    },
    { inst: "flute", vol: 0.5, pan: -0.3, mml: `| ${rest(8)} o5 f2 a2 g2 e2 f1 f2 a2 g1 e1 d2 f2 e2 g2` },
    { inst: "piano", vol: 0.6, pan: 0.25, mml: `| ${stabs(CAMP, "..x...x.")}` },
    { inst: "bass", vol: 0.8, mml: `| ${bass(CAMP, "walk", 2)}` },
    { inst: "pad", vol: 0.6, mml: `| ${pad(CAMP)}` },
    { inst: "kick", vol: 0.55, mml: `| ${drums(16, "light", 8, false)}` },
  ],
};

// ---------------------------------------------------------------------------------------------
// Title — D major, 100 bpm

const TITLE: Chart = ["d3 f+3 a3", "b2 d3 f+3", "g2 b2 d3", "a2 c+3 e3", "d3 f+3 a3", "f+2 a2 c+3", ["g2 b2 d3", 2], ["a2 c+3 e3", 2], "d3 f+3 a3"];

export const title: Track = {
  bpm: 100,
  parts: [
    {
      inst: "brass",
      mml: `${rest(2)} |
        o5 d4. a8 a4 o6 d4
        o6 c+4. o5 b8 f+2
        o5 g4. b8 o6 d4 g4
        o6 e2. r4
        o6 f+4. e8 d4 a4
        o6 a4 g+8 f+8 c+2
        o6 d4 e4 c+4 e4
        o6 d2. r4`,
    },
    { inst: "lead", vol: 0.55, pan: 0.3, mml: `${rest(2)} | ${rest(4)} o6 a4. g8 f+4 d4 o6 c+4 e4 a2 o6 b4 a4 g4 e4 o6 f+1` },
    { inst: "strings", vol: 0.8, mml: `${pad(["d3 f+3 a3", "d3 f+3 a3"])} | ${pad(TITLE)}` },
    { inst: "bass", mml: `o2 d1 d1 | ${bass(TITLE, "half", 2)}` },
    { inst: "timpani", mml: `o2 a8 a8 a8 a8 a8 a8 a8 a8 o2 d1 | o2 d4 r4 r2 ${rest(3)} o2 d4 r4 r2 ${rest(3)}` },
    { inst: "kick", vol: 0.7, mml: `${rest(2)} | ${drums(8, "march", 4, true)}` },
  ],
};

// ---------------------------------------------------------------------------------------------
// Spire exploration: bright floors (A minor, 116 bpm)

const SPA: Chart = ["a2 c3 e3", "g2 b2 d3", "f2 a2 c3", "g2 b2 d3", "a2 c3 e3", "g2 b2 d3", "f2 a2 c3", "e2 g+2 b2", "d3 f3 a3", "a2 c3 e3", "f2 a2 c3", "c3 e3 g3", "d3 f3 a3", "e3 g+3 b3", "f3 a3 c4", "e3 g+3 b3"];

export const spireBright: Track = {
  bpm: 116,
  parts: [
    {
      inst: "flute",
      mml: `|
        o5 e4 a4 b4 o6 c8 d8
        o6 d4. c8 o5 b4 g4
        o5 a4 f4 a4 o6 c4
        o5 b2. r4
        o5 e4 a4 b4 o6 c8 e8
        o6 d4. e8 d4 o5 b4
        o6 c4 o5 a4 o6 c4 f4
        o6 e2. r4
        o6 f4. e8 d4 a4
        o6 e4. d8 c4 o5 a4
        o6 c4 f4 a4 g8 f8
        o6 e2 g4 e4
        o6 d4. e8 f4 a4
        o6 g+2 b4 g+4
        o6 a4. g8 f4 c4
        o6 e2. r4`,
    },
    { inst: "pluck", vol: 0.8, pan: 0.3, mml: `| ${arp(SPA, "16", "updown")}` },
    { inst: "strings", vol: 0.6, pan: -0.2, mml: `| ${pad(SPA)}` },
    { inst: "bass", vol: 0.9, mml: `| ${bass(SPA, "pump", 2)}` },
    { inst: "kick", vol: 0.6, mml: `| ${drums(16, "half", 8, true)}` },
  ],
};

// Dark floors (hideouts, towers, shadows) — D minor, 100 bpm

const SPD: Chart = ["d3 f3 a3", "d3 f3 a3", "b-2 d3 f3", "a2 c+3 e3", "d3 f3 a3", "g2 b-2 d3", "b-2 d3 f3", "a2 c+3 e3"];

export const spireDark: Track = {
  bpm: 100,
  parts: [
    {
      inst: "lead2",
      mml: `|
        o5 d2 f4 e4
        o5 d4 a4 g4 f4
        o5 f2 d4 f4
        o5 e2. c+4
        o5 d4 f4 a4 o6 d4
        o6 c4. o5 b-8 g2
        o5 f4 g4 a4 b-4
        o5 a1
        o6 d2 f4 e4
        o6 d4 a4 g4 f4
        o6 f2 d4 f4
        o6 e2. c+4
        o6 d4 f4 a4 o7 d4
        o7 c4. o6 b-8 g2
        o6 f4 e4 d4 c+4
        o6 d1`,
    },
    { inst: "bell", vol: 0.45, pan: 0.35, mml: `| ${arp([...SPD, ...SPD], "8", "up")}` },
    { inst: "pad", vol: 0.8, mml: `| ${pad([...SPD, ...SPD])}` },
    { inst: "bass", vol: 0.8, mml: `| ${bass([...SPD, ...SPD], "half", 2)}` },
    { inst: "kick", vol: 0.5, mml: `| ${rest(8)} ${drums(8, "half", 8, false)}` },
  ],
};

// League halls and the summit — G minor, 108 bpm

const SPH: Chart = ["g2 b-2 d3", "e-3 g3 b-3", "f2 a2 c3", "d3 f+3 a3", "g2 b-2 d3", "e-3 g3 b-3", "c3 e-3 g3", "d3 f+3 a3"];

export const spireHigh: Track = {
  bpm: 108,
  parts: [
    {
      inst: "brass",
      mml: `|
        o5 g4. a8 b-4 o6 d4
        o6 e-2 d4 c4
        o6 c4. d8 c4 o5 a4
        o5 f+2. a4
        o5 g4 b-4 o6 d4 g4
        o6 g4. f8 e-2
        o6 e-4 d4 c4 o5 g4
        o5 a2 f+2`,
    },
    { inst: "strings", vol: 0.8, mml: `| ${arp(SPH, "8", "updown")}` },
    { inst: "pad", vol: 0.5, mml: `| ${pad(SPH)}` },
    { inst: "bass", mml: `| ${bass(SPH, "oct", 2)}` },
    { inst: "timpani", vol: 0.7, mml: `| [o2 g4 r4 r2 r1]4` },
    { inst: "kick", vol: 0.6, mml: `| ${drums(8, "march", 4, true)}` },
  ],
};

// ---------------------------------------------------------------------------------------------
// Jingles

export const jingleHeal: Track = {
  bpm: 120,
  loop: false,
  parts: [
    { inst: "bell", mml: "o5 l8 c e g o6 c4 o5 g8 o6 c4 e4 c2" },
    { inst: "pad", mml: "{o4ceg}2 {o4ceg}2 {o4ceg}2" },
  ],
};

export const jingleItem: Track = {
  bpm: 140,
  loop: false,
  parts: [
    { inst: "lead", mml: "o5 l16 g o6 c e g8 e8 g4 r4" },
    { inst: "brass", vol: 0.6, mml: "r4 {o4egb}8 {o4egb}8 {o4ceg}2" },
    { inst: "kick", mml: "r4 s8 s8 x2" },
  ],
};

export const jingleCaught: Track = {
  bpm: 132,
  loop: false,
  parts: [
    { inst: "lead", mml: "o5 l8 g g g o6 c4 o5 b8 o6 c8 d8 e2" },
    { inst: "brass", vol: 0.7, mml: "{o4ceg}4 r8 {o4ceg}4 {o4dgb}4 {o4egc}2" },
    { inst: "bass", mml: "o3 c4 r8 c4 g4 c2" },
    { inst: "kick", mml: "k8 s8 s8 k8 s8 s8 s8 s8 x2" },
  ],
};

export const jingleFloor: Track = {
  bpm: 126,
  loop: false,
  parts: [
    { inst: "brass", mml: "o5 l8 d d d f+4 a4 o6 d4. c+8 d2" },
    { inst: "lead", vol: 0.7, mml: "o6 l8 f+ f+ f+ a4 o7 c+4 d4. e8 f+2" },
    { inst: "strings", mml: "{o4df+a}2. {o4df+a}2 {o4ac+e}4. {o4df+a}2" },
    { inst: "timpani", mml: "o2 d8 d8 d8 d4 a4 d4. a8 d2" },
    { inst: "kick", mml: "s8 s8 s8 k4 k4 s4. s8 x2" },
  ],
};

export const jingleBlackout: Track = {
  bpm: 80,
  loop: false,
  parts: [
    { inst: "lead2", mml: "o5 l4 e d c o4 b2. a1" },
    { inst: "pad", mml: "{o3ace}2. {o3g+bd}2. {o3ace}1" },
  ],
};

export const jingleEvolve: Track = {
  bpm: 140,
  loop: false,
  parts: [
    { inst: "lead", mml: "o5 l8 c e g o6 c e g o7 c4 o6 g8 o7 c2." },
    { inst: "brass", vol: 0.7, mml: "{o4ceg}2. {o4fac}4 {o4egc}2." },
    { inst: "kick", mml: "r2. s8 s8 x2." },
  ],
};

export const evolutionLoop: Track = {
  bpm: 120,
  parts: [
    { inst: "bell", mml: `| o5 l16 [c e g o6 c e c o5 g e]2 [d f a o6 d f d o5 a f]2 [e g b o6 e g e o5 b g]2 [f a o6 c f a f c o5 a]2` },
    { inst: "pad", mml: `| {o4ceg}1 {o4dfa}1 {o4egb}1 {o4fa>c}1` },
  ],
};

export const TRACKS = {
  title, camp, spireBright, spireDark, spireHigh, battleWild, battleTrainer, battleBoss, battleChampion, victory, evolutionLoop,
} satisfies Record<string, Track>;

export type TrackId = keyof typeof TRACKS;
