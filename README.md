# Echo Spire

A fan-made Pokémon roguelike for PC and phone, in the style of the Gen 4–5 games.

A tower has risen from the sea off Undella Town. Inside, its floors rebuild themselves each time you enter, and they hold *echoes* of the greatest trainers from Kanto to Unova: Gym Leaders, Elite Four members, Champions, and the bosses and admins of every evil team. Climb as high as you can. If you black out, you go back to camp with everything you earned, and the next climb starts on the floor where you fell.

## Features

- **Gen 5 battle rules** from the [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) simulator (`@pkmn/sim`): every move, ability, held item and weather effect.
- **649 Pokémon** (Gen 1–5), shown with their animated Black/White sprites.
- **The Spire.** 30 themed floors (forest, caves, Rocket Hideout, Magma Caldera, Frost Hollow, the Elite halls, Silver Peak…), then the endless *Apex*. Each floor has five steps of doors (a trainer echo, a wild Pokémon, treasure, a rest spot, a merchant, or sometimes a legendary), and its guardian waits at the top.
- **Progression that carries over.** Floors come from a seed stored in your save, so when you return to a floor, the same trainers are there, with the same shinies.
- **Strategic late game.** Trainer AI gets sharper as you climb. Late echoes field competitive sets (natures, EVs, items). You can shape your own team at the Move Tutor and Training Dojo, and with mints, bottle caps and ability capsules.
- **Weather** (rain, sun, sandstorm, hail) affects battles and drives the ambient particles.
- **Original music**, synthesized live with WebAudio: 4 battle themes of rising intensity, 3 exploration themes, camp, title, victory and jingles. Cries come from PokeAPI.
- Catching, shinies (1/256, doubled by the Shiny Charm), evolutions (by level, stones, or trade items), a shop, PC boxes, side quests, achievements and a short lore journal.
- **3 save slots** with JSON import/export. English and French.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (engine, content, soundtrack)
npm run build      # static site in dist/
```

Test saves at different stages (`save-early.json`, `save-mid.json`, `save-late.json`, `save-apex.json`, `save-midclimb.json`) are generated at the repo root by `npm run test-saves`. Git ignores them. To use one, go to **Save slots → Import**.

`npm run data` regenerates `src/data/` (French names and descriptions, catch rates, exp yields) from PokeAPI's CSV dumps.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes to GitHub Pages. One-time setup: in the repo, go to **Settings → Pages → Source** and pick **GitHub Actions**.

## Layout

```
src/core/      pure game logic (no React): dex, Pokémon, items, save, quests
  battle/      Showdown wrapper (bag/catch/run), protocol parser, AI
  spire/       trainers, themes, floor generation, NPC teams
src/audio/     WebAudio engine, synth instruments, MML sequencer, compositions
src/fx/        particles (weather & ambience), painted scenery
src/features/  screens: title, lobby, spire, battle, menus
src/i18n/      UI strings (EN/FR) and data names
src/themes/    token-based UI theme system
```

## Credits

Fan-made, non-commercial. Pokémon © Nintendo / Creatures / GAME FREAK. Battle engine: Pokémon Showdown (MIT) via `@pkmn`. Sprites and cries are loaded at runtime from [PokeAPI](https://github.com/PokeAPI). Trainer sprites come from Pokémon Showdown. The music is original.
