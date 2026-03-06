# Coding Conventions

**Analysis Date:** 2026-03-06

## Naming Patterns

**Files:**
- `camelCase.ts` for all source files: `main.ts`, `words.ts`, `audio.ts`, `spells.ts`, `laser.ts`, `rocket.ts`, `explosion.ts`, `base.ts`
- Single-concept per file: one class or one tightly-related group of classes per module

**Functions:**
- `camelCase` for all functions: `drawBackground()`, `findTarget()`, `updateTarget()`, `handleKeyDown()`, `formatTime()`, `spawnRocket()`
- `draw*` prefix for all canvas rendering functions: `drawHUD()`, `drawStartScreen()`, `drawLeaderboard()`, `drawSpellHUD()`, `drawTypingHUD()`, `drawPauseOverlay()`, `drawNameEntry()`
- `_camelCase` (underscore prefix) for private class methods: `_stopMusicNodes()`, `_ensureCtx()`, `_applyMusicGain()`, `_applySfxGain()`, `drawBody()`, `drawLabel()`, `drawBase()`, `drawDestroyedBase()`, `drawHealthBar()`

**Variables:**
- `camelCase` for local variables and module-level state: `spawnTimer`, `typedBuffer`, `targetedRocket`, `gameElapsedSec`, `screenFlashTimer`
- `_camelCase` (underscore prefix) for private class fields: `_ctx`, `_sfxBusGain`, `_musicGain`, `_healCooldown`, `_freezeCooldown`
- `SCREAMING_SNAKE_CASE` for module-level constants: `ROCKET_DAMAGE`, `POINTS_PER_CHAR`, `SPAWN_INITIAL`, `SPAWN_MIN`, `SPAWN_TAU`, `LEADERBOARD_KEY`, `MAX_NAME_LENGTH`, `HEAL_AMOUNT`, `HEAL_COOLDOWN_MS`, `FREEZE_DURATION_MS`

**Types and Interfaces:**
- `PascalCase` for classes: `Rocket`, `Base`, `LaserBeam`, `Explosion`, `HealBurst`, `FreezeBurst`, `AudioManager`, `SpellManager`
- `PascalCase` for interfaces: `Star`, `FloatingText`, `LeaderboardEntry`, `DifficultyParams`, `BoundsRect`, `Particle`
- `PascalCase` for type aliases: `WordTier`, `GameState`
- String union types for discriminated states: `type GameState = 'start' | 'playing' | 'paused' | 'entering-name' | 'leaderboard'`
- String union types for domain enums: `type WordTier = 'short' | 'medium' | 'long'`

**Constants (object/record-typed):**
- `PascalCase` for record-typed display maps: `TIER_LABELS`, `TIER_COLORS`

## Code Style

**Formatting:**
- No Prettier config detected; formatting is enforced manually
- Trailing commas in multiline function calls and array literals
- Single quotes for strings throughout
- 2-space indentation
- Semicolons used consistently

**Linting:**
- ESLint 9 with `typescript-eslint` recommended rules (`eslint.config.js`)
- `@typescript-eslint/no-unused-vars` set to `error` with `argsIgnorePattern: '^_'`
- Unused arguments prefixed with `_` to suppress the rule

**TypeScript strictness:**
- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`, `erasableSyntaxOnly: true`
- `verbatimModuleSyntax: true` — use `import type` when importing types only
- `noUncheckedSideEffectImports: true`
- No path aliases configured; all imports use relative paths with `.ts` extension

## Import Organization

**Order (observed pattern in `main.ts`):**
1. Local module imports (all relative, `.ts` extension required)
2. Named imports grouped by source module
3. Type imports use `import { ..., type Foo }` syntax inline

**Examples from `src/main.ts`:**
```typescript
import { Base } from './base.ts';
import { Explosion, HealBurst, FreezeBurst } from './explosion.ts';
import { LaserBeam } from './laser.ts';
import { Rocket } from './rocket.ts';
import { getWordForSize, type WordTier } from './words.ts';
import { AudioManager } from './audio.ts';
import { SpellManager, SPELL_WORDS, HEAL_AMOUNT, FREEZE_DURATION_MS } from './spells.ts';
```

**Path Aliases:**
- None configured. Use relative paths from `./` always.

## Error Handling

**Patterns:**
- `try/catch` with empty catch blocks for expected failures: word pool exhaustion in `spawnRocket()` swallows the thrown `Error` silently
- `try/catch` with fallback return for localStorage: `loadLeaderboard()` returns `[]` on parse failure
- Optional chaining for nullable AudioContext state: `this._ctx?.state === 'running'`
- `void` prefix for fire-and-forget promises: `void this._ctx.suspend()`
- `try/catch` with empty block to suppress already-stopped oscillator errors in `_stopMusicNodes()`
- Non-null assertion `!` used when context is guaranteed: `canvas.getContext('2d')!`
- `Math.max(0, ...)` / `Math.min(1, ...)` clamping used consistently for bounded values

**Error throwing:**
- `throw new Error(message)` for unrecoverable logic errors (exhausted word pools in `src/words.ts`)
- Callers catch thrown errors rather than pre-checking conditions

## Logging

**Framework:** None. No logging library is used.

**Patterns:**
- No `console.log` calls in production code (enforced implicitly by `noUnusedLocals`)
- Errors are swallowed silently or handled via fallback values; no observability tooling

## Comments

**When to Comment:**
- Section-header comments using `// ---- Section Name ----` to divide long files into logical zones (used extensively in `src/main.ts`)
- Inline comments for non-obvious constant values: tuning parameters, magic numbers, timing values
- JSDoc-style block comments (`/** ... */`) used only for exported utility functions in `src/words.ts`
- Inline `/* legacy */` annotations to document migration context

**Examples:**
```typescript
// Exponential difficulty curve constants — tweak these to tune game feel.
// Spawn interval: SPAWN_INITIAL * e^(-t / SPAWN_TAU) + SPAWN_MIN
const SPAWN_INITIAL = 1800;  // ms added on top of floor at t=0 (initial = 1800+600 = 2400ms)
```

```typescript
/**
 * Returns a random word from the given tier that is not currently in use.
 * Throws if all words in the tier are exhausted.
 */
export function getWord(tier: WordTier): string {
```

## Function Design

**Size:** Functions are allowed to be large when they represent a single drawing concern (e.g., `drawPauseOverlay()` is ~100 lines). Logic functions are kept short.

**Parameters:** Prefer named options objects for functions with many parameters:
```typescript
function drawAudioRow(opts: {
  label: string; rowY: number;
  rowLeft: number; rowRight: number;
  btnW: number; btnH: number; sliderH: number;
  muted: boolean; volume: number;
  btnRef: BoundsRect; sliderRef: BoundsRect;
}): void {
```

**Return Values:**
- `void` for all side-effectful functions
- Boolean returns for trigger/guard methods: `triggerHeal(): boolean`, `triggerFreeze(): boolean`
- Null returns for optional lookups: `findTarget(): Rocket | null`

## Module Design

**Exports:**
- Named exports only; no default exports from class/utility modules
- `src/main.ts` is the entry point and exports nothing — it attaches event listeners directly
- Each module exports one primary class and any related constants/types it owns

**Class structure pattern:**
- Public mutable state as class fields (no `readonly` unless truly immutable)
- Private state prefixed with `_`
- Getters/setters for properties with side effects (persistence, audio updates)
- `update(delta: number): void` method on all game entities for frame updates
- `render(ctx: CanvasRenderingContext2D): void` method on all game entities for drawing
- `isDone(): boolean` on transient effects (`LaserBeam`, `Explosion`, `HealBurst`, `FreezeBurst`)
- `reset(): void` on stateful managers (`Base`, `SpellManager`)
- `destroy(): void` on entities that need cleanup on removal (`Rocket`)

**Barrel Files:** None used.

---

*Convention analysis: 2026-03-06*
