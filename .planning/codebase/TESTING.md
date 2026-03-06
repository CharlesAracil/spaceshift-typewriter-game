# Testing Patterns

**Analysis Date:** 2026-03-06

## Test Framework

**Runner:**
- None configured. No test framework is installed.
- `package.json` contains no test script and no testing devDependencies.
- No `jest.config.*`, `vitest.config.*`, or similar config file exists.

**Assertion Library:**
- Not applicable.

**Run Commands:**
```bash
# No test commands available
pnpm run typecheck   # TypeScript type checking (closest to automated validation)
pnpm run lint        # ESLint static analysis
```

## Test File Organization

**Location:**
- No test files exist in the repository.
- No `*.test.ts`, `*.spec.ts`, or `__tests__/` directories are present.

**Naming:**
- Not applicable — no test files.

**Structure:**
```
src/           # Source only, no co-located tests
dist/          # Build output only
```

## Test Structure

**Suite Organization:**
- Not applicable.

**Patterns:**
- No setup, teardown, or assertion patterns exist.

## Mocking

**Framework:** None.

**Patterns:**
- Not applicable.

**What to Mock (recommendations for when tests are added):**
- `AudioContext` and Web Audio API nodes (not available in Node/jsdom without polyfills)
- `localStorage` (easily mockable with in-memory stub)
- `HTMLCanvasElement` and `CanvasRenderingContext2D` (requires canvas mock or jsdom with canvas)
- `requestAnimationFrame` (needs fake timer support)
- `Math.random` (for deterministic word selection and particle behavior)

**What NOT to Mock:**
- Pure logic in `src/spells.ts` — `SpellManager` has no DOM/browser dependencies
- Pure logic in `src/words.ts` — `getWord`, `getWordForSize`, `releaseWord` are pure module-level functions
- `formatTime()` in `src/main.ts` — pure string transformation

## Fixtures and Factories

**Test Data:**
- Not applicable — no test infrastructure exists.

**Location:**
- No fixtures directory.

## Coverage

**Requirements:** None enforced.

**View Coverage:**
```bash
# No coverage tooling configured
```

## Test Types

**Unit Tests:**
- None. The most testable units are:
  - `SpellManager` class (`src/spells.ts`) — pure cooldown logic, no browser APIs
  - `getWord` / `getWordForSize` / `releaseWord` functions (`src/words.ts`) — pure word pool logic
  - `formatTime` function (`src/main.ts`) — pure string formatting
  - `Base` class (`src/base.ts`) — HP arithmetic is pure; only `render()` uses Canvas

**Integration Tests:**
- None.

**E2E Tests:**
- `.playwright-mcp/` directory exists with screenshot artifacts, indicating Playwright was used for manual/exploratory testing via the MCP browser tool. No automated Playwright test suite is configured.

## Common Patterns

**Async Testing:**
- Not applicable.

**Error Testing:**
- Not applicable. Note: `getWord()` and `getWordForSize()` in `src/words.ts` throw `Error` when pools are exhausted — these are natural candidates for error path unit tests.

## Recommendations for Adding Tests

If a test framework is added, the recommended setup is:

**Install:**
```bash
pnpm add -D vitest
```

**Config (`vitest.config.ts`):**
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node' },
});
```

**Test script in `package.json`:**
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Highest-priority test targets:**
1. `src/spells.ts` — `SpellManager.triggerHeal()`, `triggerFreeze()`, `update()`, `reset()`, cooldown ratio calculations
2. `src/words.ts` — `getWord()`, `getWordForSize()`, `releaseWord()`, deduplication logic, pool exhaustion error
3. `formatTime()` in `src/main.ts` — edge cases: 0 sec, 60 sec, 3600 sec
4. `Base.takeDamage()` / `Base.heal()` in `src/base.ts` — HP clamping at 0 and `BASE_MAX_HP`

---

*Testing analysis: 2026-03-06*
