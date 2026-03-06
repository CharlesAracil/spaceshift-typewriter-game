# Codebase Structure

**Analysis Date:** 2026-03-06

## Directory Layout

```
spaceshift-typewriter/
├── src/                  # All TypeScript source files
│   ├── main.ts           # Game loop, state machine, all orchestration
│   ├── rocket.ts         # Rocket entity class
│   ├── base.ts           # Player base entity class
│   ├── laser.ts          # LaserBeam visual effect class
│   ├── explosion.ts      # Explosion, HealBurst, FreezeBurst visual effect classes
│   ├── spells.ts         # SpellManager class + spell constants
│   ├── audio.ts          # AudioManager class (Web Audio API)
│   └── words.ts          # Word pool data and management functions
├── public/               # Static assets served as-is (vite.svg favicon)
├── dist/                 # Build output (generated, not committed)
│   └── assets/           # Hashed JS/CSS bundles
├── .planning/            # GSD planning documents
│   └── codebase/         # Codebase analysis docs (this file)
├── tasks/                # GSD task/user-story files
├── index.html            # HTML shell — single canvas element, font import
├── package.json          # Project manifest and scripts
├── pnpm-lock.yaml        # Lockfile
├── tsconfig.json         # TypeScript compiler configuration
├── vite.config.ts        # Vite build configuration (base path for gh-pages)
├── eslint.config.js      # ESLint flat config
└── README.md             # Project documentation
```

## Directory Purposes

**`src/`:**
- Purpose: All game source code — no subdirectories, flat module layout
- Contains: 8 TypeScript files, one per logical concern
- Key files: `src/main.ts` (orchestrator), `src/words.ts` (large data file with ~1000+ words)

**`public/`:**
- Purpose: Static files Vite copies verbatim to `dist/`
- Contains: `vite.svg` favicon
- Key files: None game-critical

**`dist/`:**
- Purpose: Production build output
- Generated: Yes — produced by `pnpm build` (`tsc && vite build`)
- Committed: No (in `.gitignore`)

**`.planning/`:**
- Purpose: GSD planning documents used by `/gsd:plan-phase` and `/gsd:execute-phase`
- Contains: `codebase/` subdirectory with analysis markdown files
- Committed: Yes

**`tasks/`:**
- Purpose: GSD user-story and task definition files
- Committed: Yes

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell, loads font from Google Fonts CDN, mounts `<canvas id="game-canvas">`, imports `src/main.ts`
- `src/main.ts`: Game bootstrap — registers event listeners, starts `requestAnimationFrame` loop after font load

**Configuration:**
- `vite.config.ts`: Sets `base: '/spaceshift-typewriter-game/'` for GitHub Pages deployment
- `tsconfig.json`: TypeScript strict mode configuration
- `eslint.config.js`: ESLint flat config with TypeScript rules

**Core Logic:**
- `src/main.ts`: Game loop (`gameLoop`), state machine (`handleKeyDown`), difficulty (`getDifficulty`), all HUD draw functions, leaderboard persistence
- `src/words.ts`: Word data (SHORT_WORDS, MEDIUM_WORDS, LONG_WORDS arrays) and the `activeWords` Set that prevents duplicate assignments
- `src/spells.ts`: Spell cooldown logic and exported constants consumed by both `main.ts` and `words.ts`

**Entities:**
- `src/rocket.ts`: `Rocket` class — movement, freeze state, pixel-art rendering, word label
- `src/base.ts`: `Base` class — HP, hit/heal flash, pixel-art station rendering, health bar
- `src/laser.ts`: `LaserBeam` class — short-lived line effect from base to destroyed rocket
- `src/explosion.ts`: `Explosion`, `HealBurst`, `FreezeBurst` — particle burst effects

**Audio:**
- `src/audio.ts`: `AudioManager` — all SFX and procedurally generated music via Web Audio API; reads/writes `localStorage` for volume prefs

## Naming Conventions

**Files:**
- All lowercase, single-word names matching their primary export: `rocket.ts` exports `Rocket`, `base.ts` exports `Base`, etc.
- No barrel files — each module is imported directly by path

**Classes:**
- PascalCase: `Rocket`, `Base`, `LaserBeam`, `AudioManager`, `SpellManager`, `Explosion`, `HealBurst`, `FreezeBurst`

**Functions:**
- camelCase: `getWordForSize`, `releaseWord`, `getDifficulty`, `spawnRocket`, `handleKeyDown`, `drawHUD`, `drawSpellHUD`

**Constants:**
- SCREAMING_SNAKE_CASE: `HEAL_AMOUNT`, `FREEZE_DURATION_MS`, `SPELL_WORDS`, `ROCKET_DAMAGE`, `LEADERBOARD_KEY`

**Interfaces:**
- PascalCase: `Star`, `FloatingText`, `LeaderboardEntry`, `DifficultyParams`, `BoundsRect`

**Type aliases:**
- PascalCase: `WordTier`, `GameState`

## Where to Add New Code

**New game entity (enemy type, projectile, effect):**
- Create: `src/<entityname>.ts` following the `update(delta) / render(ctx) / isDone()` pattern
- Register: Add an array in `src/main.ts` module scope; call `update()` and `render()` in the respective loop sections; splice out when `isDone()` returns true

**New spell:**
- Add the spell word to `SPELL_WORDS` in `src/spells.ts` and add cooldown tracking fields to `SpellManager`
- Handle the completed word in the `handleKeyDown` spell-check block in `src/main.ts`
- Add a row to `drawSpellHUD()` in `src/main.ts`

**New HUD element:**
- Add a dedicated `draw*()` function in `src/main.ts`; call it from `render()` in the appropriate z-order position

**New word list or tier:**
- Add data arrays in `src/words.ts`; update `WORD_TIERS` and/or the size pool filters
- Update `WordTier` type and `getDifficulty()` tier thresholds in `src/main.ts`

**Utilities / pure helpers:**
- Add to the relevant module or create a new `src/<name>.ts` file; there is no shared `utils.ts`

## Special Directories

**`dist/`:**
- Purpose: Vite build output — hashed JS bundle + copied public assets
- Generated: Yes (by `pnpm build`)
- Committed: No

**`.planning/codebase/`:**
- Purpose: Codebase analysis docs consumed by GSD commands
- Generated: By `/gsd:map-codebase`
- Committed: Yes

**`node_modules/`:**
- Purpose: Dev-only dependencies (Vite, TypeScript, ESLint)
- Generated: Yes (by `pnpm install`)
- Committed: No

---

*Structure analysis: 2026-03-06*
