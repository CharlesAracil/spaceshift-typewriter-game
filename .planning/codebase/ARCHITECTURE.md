# Architecture

**Analysis Date:** 2026-03-06

## Pattern Overview

**Overall:** Monolithic single-file game loop with extracted entity classes

**Key Characteristics:**
- No framework — pure TypeScript targeting the Canvas 2D API directly
- All game state lives as module-level variables in `src/main.ts`
- Entity classes (Rocket, Base, LaserBeam, Explosion, etc.) own their own `update()` and `render()` logic
- A `requestAnimationFrame` loop in `src/main.ts` drives everything via `update(delta)` → `render()`
- No runtime dependencies — zero npm packages in production bundle

## Layers

**Entry Point / Orchestrator:**
- Purpose: Holds all game state, drives the game loop, handles all input events, and calls entity methods
- Location: `src/main.ts`
- Contains: Game loop, state machine (`GameState`), spawner, difficulty curve, HUD draw functions, leaderboard read/write, all event listeners
- Depends on: All other modules
- Used by: `index.html` via `<script type="module">`

**Entity Classes:**
- Purpose: Encapsulate the state and behavior of discrete game objects
- Location: `src/rocket.ts`, `src/base.ts`, `src/laser.ts`, `src/explosion.ts`
- Contains: Constructor, `update(delta)`, `render(ctx)`, and lifecycle helpers (`destroy()`, `isDone()`, `hasReachedBase()`)
- Depends on: `src/words.ts` (Rocket calls `releaseWord` on destroy)
- Used by: `src/main.ts` (instantiated and stored in module-level arrays)

**Word Pool:**
- Purpose: Manages assignment and release of words to rockets, preventing duplicates
- Location: `src/words.ts`
- Contains: Three static word lists (`SHORT_WORDS`, `MEDIUM_WORDS`, `LONG_WORDS`), two size-based pools, an `activeWords` Set, and exported functions `getWord`, `getWordForSize`, `releaseWord`
- Depends on: `src/spells.ts` (imports `SPELL_WORDS` to exclude them from the pool)
- Used by: `src/main.ts` (spawn logic), `src/rocket.ts` (`releaseWord` on destroy)

**Spell System:**
- Purpose: Tracks cooldowns and ready-state for the two player spells (HEAL, FREEZE)
- Location: `src/spells.ts`
- Contains: `SpellManager` class with timer state and `triggerHeal()` / `triggerFreeze()` methods; exported constants `SPELL_WORDS`, `HEAL_AMOUNT`, `FREEZE_DURATION_MS`, `FREEZE_COOLDOWN_MS`, `HEAL_COOLDOWN_MS`
- Depends on: Nothing
- Used by: `src/main.ts` (instantiated as `spellManager`), `src/words.ts` (imports `SPELL_WORDS`)

**Audio System:**
- Purpose: Synthesizes all music and SFX using the Web Audio API; persists volume/mute state in `localStorage`
- Location: `src/audio.ts`
- Contains: `AudioManager` class with lazy `AudioContext` initialization, separate music and SFX gain buses, procedural arpeggio sequencer, and individual play methods
- Depends on: Nothing (uses browser Web Audio API directly)
- Used by: `src/main.ts` (instantiated as `audio`)

## Data Flow

**Game Loop:**

1. `document.fonts.ready` resolves → `requestAnimationFrame(gameLoop)` starts
2. Each frame: `gameLoop(timestamp)` computes `delta` → calls `update(delta)` → calls `render()`
3. `update()` is a no-op unless `gameState === 'playing'`; when playing it advances all entity arrays and checks collisions
4. `render()` always draws background, then entities in z-order, then HUD, then state-specific overlays

**Typing → Kill Flow:**

1. `keydown` event fires → `handleKeyDown()` appends to `typedBuffer`
2. `updateTarget()` scans `rockets[]` for prefix match; sets `isTargeted` and `typedCount` on the closest match
3. When `typedBuffer === targetedRocket.word`, a `LaserBeam` and `Explosion` are pushed to their arrays, `score` is incremented, `targetedRocket.destroy()` is called (which calls `releaseWord`), and the rocket is spliced out
4. When `typedBuffer` equals a spell word (`'heal'` or `'freeze'`), `spellManager.trigger*()` is called; on success, effects are applied to `base` and/or all `rockets[]`

**Rocket Reaches Base Flow:**

1. `update()` calls `rocket.hasReachedBase(canvas)` for each rocket
2. If true: `base.takeDamage(ROCKET_DAMAGE)` is called, rocket is destroyed and removed
3. If `base.hp <= 0`: `triggerGameOver()` transitions state to `'entering-name'`

**State Machine:**

- States: `'start'` → `'playing'` ↔ `'paused'` → `'entering-name'` → `'leaderboard'` → `'start'`
- Transitions are driven entirely by `handleKeyDown()` and canvas click handlers in `src/main.ts`

**State Management:**
- All mutable game state is plain module-level variables in `src/main.ts` (e.g., `rockets[]`, `score`, `gameElapsedSec`, `typedBuffer`, `targetedRocket`)
- No reactive framework or store pattern — state is read and written directly inside the game loop functions

## Key Abstractions

**Entity Contract (`update` / `render` / `isDone`):**
- Purpose: All transient visual effects share the same lifecycle interface
- Examples: `src/laser.ts`, `src/explosion.ts` (`Explosion`, `HealBurst`, `FreezeBurst`)
- Pattern: Constructor populates internal state → `update(delta)` advances it → `isDone()` returns true when finished → `render(ctx)` draws to canvas. Main loop removes entities once `isDone()` is true.

**Word Pool (Set-based deduplication):**
- Purpose: Guarantees no two live rockets share the same word label
- Examples: `src/words.ts` (`activeWords` Set, `getWordForSize`, `releaseWord`)
- Pattern: Words are claimed on rocket spawn (`activeWords.add`) and released on rocket destroy (`activeWords.delete`)

**Difficulty Params:**
- Purpose: Centralises all tunable parameters behind a single function
- Examples: `src/main.ts` → `getDifficulty()` returns `DifficultyParams`
- Pattern: Reads `gameElapsedSec` and returns spawn interval, rocket speed, word tier, and display level as computed values; all callers read from this object

## Entry Points

**Browser Entry:**
- Location: `index.html` → `<script type="module" src="/src/main.ts">`
- Triggers: Page load
- Responsibilities: Obtains the `<canvas>`, sets up the starfield and entity arrays, registers event listeners, waits for font load, then starts the `requestAnimationFrame` loop

## Error Handling

**Strategy:** Silent fallback — errors are caught and ignored to keep the game running

**Patterns:**
- Rocket spawn wraps `getWordForSize` in a try/catch; if the word pool is exhausted, the spawn cycle is skipped silently (`src/main.ts` lines 512–517)
- `loadLeaderboard` wraps `JSON.parse` in try/catch, returning `[]` on any parse error (`src/main.ts` lines 108–116)
- Font load failure is caught on the `document.fonts.ready` promise and the game starts anyway with the fallback font

## Cross-Cutting Concerns

**Logging:** None — no console logging in production paths
**Validation:** Input is validated inline (e.g., only `[a-z]` characters accepted in `handleKeyDown`; `typedBuffer` is reset if no prefix match is found)
**Audio initialization:** `AudioContext` is created lazily on first user interaction to comply with browser autoplay policies (`src/audio.ts` `_ensureCtx()`)
**Persistence:** `localStorage` is used directly in `src/audio.ts` (volume/mute prefs) and `src/main.ts` (leaderboard, FPS toggle)

---

*Architecture analysis: 2026-03-06*
