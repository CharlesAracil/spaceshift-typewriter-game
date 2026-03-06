# Codebase Concerns

**Analysis Date:** 2026-03-06

## Tech Debt

**Spell words hardcoded as string literals in main.ts:**
- Issue: Spell activation checks `typedBuffer === 'heal'` and `typedBuffer === 'freeze'` as raw string literals at lines 282 and 300 of `src/main.ts`. The `SPELL_WORDS` array is imported from `src/spells.ts` for prefix filtering but never used to drive dispatch. Adding a new spell requires touching both `src/spells.ts` (to register the word) and `src/main.ts` (to add another `if (typedBuffer === '...')` branch).
- Files: `src/main.ts` (lines 282–311), `src/spells.ts` (line 6)
- Impact: Extending the spell system requires changes in two places; easy to have `SPELL_WORDS` and the hardcoded checks go out of sync.
- Fix approach: Build a dispatch map in `src/spells.ts` keyed by word, and iterate over it in the `handleKeyDown` handler instead of using literal comparisons.

**Spell HUD display hardcoded to two named spells:**
- Issue: `drawSpellHUD()` in `src/main.ts` (lines 909–963) builds a static array `[{name:'heal',...},{name:'freeze',...}]` referencing `spellManager` getters individually by name. The spell icon branching at line 926 (`if (spell.name === 'heal')`) is also hardcoded.
- Files: `src/main.ts` (lines 909–963)
- Impact: Any new spell requires surgery in `drawSpellHUD` and a new icon-drawing function.
- Fix approach: Have `SpellManager` expose an iterable list of spell descriptors (name, cooldownRatio, ready, color, icon type) that `drawSpellHUD` can loop over generically.

**`main.ts` is a 1370-line monolith:**
- Issue: Game state machine, all rendering functions, all input handling, all entity management, difficulty math, leaderboard, UI overlays, and spell logic are all in a single file `src/main.ts`.
- Files: `src/main.ts`
- Impact: High cognitive load when modifying any single concern. Adding features requires reading the entire file to find safe insertion points. Risk of naming collisions increases as the file grows.
- Fix approach: Extract rendering functions into a `src/renderer.ts` or split by concern (e.g., `src/hud.ts`, `src/ui.ts`). Extract game state and entity management to a `src/game.ts`.

**`getWord` function is unused (dead export):**
- Issue: `src/words.ts` exports both `getWord(tier: WordTier)` and `getWordForSize(size)`. Only `getWordForSize` is called from `src/main.ts`. `getWord` is never imported.
- Files: `src/words.ts` (lines 345–354)
- Impact: Dead code adds surface area and confusion about intended API. The tier-based and size-based pools are separate, making the relationship between `wordTier` difficulty param (used only for HUD display) and actual word selection non-obvious.
- Fix approach: Remove `getWord` if not intended for future use, or document that `wordTier` controls HUD label only and `getWordForSize` controls actual word selection.

## Known Bugs

**Duplicate word `'vertical'` in LONG_WORDS pool:**
- Symptoms: `'vertical'` appears twice on line 291 of `src/words.ts`. If `'vertical'` is randomly assigned to a rocket and then destroyed/released, the second duplicate in the pool may allow it to be selected again before the first slot is cleared from `activeWords`.
- Files: `src/words.ts` (line 291)
- Trigger: Occurs probabilistically whenever the long-word pool is used during a game session reaching the `'long'` word tier.
- Workaround: None. The `activeWords` Set prevents double-assignment at runtime, but the duplicate wastes a slot in the pool array.

**Word `'faint'` appears in both SHORT_WORDS and MEDIUM_WORDS:**
- Symptoms: `'faint'` is listed in `SHORT_WORDS` at line 55 (`'faint'` inside the 4-letter group) and also in `MEDIUM_WORDS` at line 158 (`'faint'`). Because `SMALL_WORD_POOL` is built from `[...SHORT_WORDS, ...MEDIUM_WORDS].filter(w => w.length <= 6)`, `'faint'` appears twice in that pool. The `activeWords` Set prevents double-assignment, but the pool array has a ghost slot.
- Files: `src/words.ts` (line 55, line 158)
- Trigger: Benign during normal play but wastes pool capacity.
- Workaround: None active.

**Player identity collision in leaderboard highlight:**
- Symptoms: In `drawLeaderboard()` (`src/main.ts` line 787), the current player's entry is highlighted using `entry.name === submittedName && entry.score === finalScore`. If two different players submit identical names and scores, both entries are highlighted green.
- Files: `src/main.ts` (lines 784–801)
- Trigger: Two game sessions producing the same name and exact score.
- Workaround: Cosmetic only — no data loss.

**First game loop frame produces a large delta:**
- Symptoms: `gameLoop` computes `delta = timestamp - lastTime` where `lastTime` is initialized to `0` (`src/main.ts` line 530). On the first frame, `timestamp` is the time since page load in ms (potentially hundreds of ms), producing a spike delta that causes `gameElapsedSec` to jump forward and the spawn timer to advance significantly.
- Files: `src/main.ts` (lines 530, 1345–1362)
- Trigger: Every page load — first frame of any game session.
- Workaround: Game starts on `'start'` screen so `update()` returns early while `gameState !== 'playing'`. The spike is absorbed on the first frame after the player presses Enter, but `spawnTimer` could advance up to one spawn cycle too early.

## Security Considerations

**localStorage leaderboard data is not validated on read:**
- Risk: `loadLeaderboard()` in `src/main.ts` (lines 108–116) does `JSON.parse(raw) as LeaderboardEntry[]` with a bare TypeScript cast. Any manually crafted or corrupted localStorage value will be accepted as a valid `LeaderboardEntry[]`. String fields with extreme lengths or non-string types could cause rendering artifacts in the canvas text calls.
- Files: `src/main.ts` (lines 108–116, 731–741, 784–803)
- Current mitigation: `try/catch` around the parse returns `[]` on JSON parse failure only. No schema validation.
- Recommendations: Validate each entry's shape (name is string, score is finite number, timeSec is finite number) before trusting values for rendering. Clamp name length to `MAX_NAME_LENGTH` on load.

**No Content Security Policy:**
- Risk: The game is served as a static SPA. There is no CSP header configured in `vite.config.ts` or `index.html`. An XSS vector (if the codebase ever accepts external input beyond localStorage) would have no script-injection mitigations.
- Files: `index.html`, `vite.config.ts`
- Current mitigation: None. All input is keyboard-only and locally scoped.
- Recommendations: Low priority for a local game, but worth adding `<meta http-equiv="Content-Security-Policy">` for GitHub Pages deployment.

## Performance Bottlenecks

**New AudioNode objects created on every keypress:**
- Problem: `playTyping()` in `src/audio.ts` (lines 84–96) creates a fresh `OscillatorNode` and `GainNode` on every keystroke. In a fast typist session this can produce dozens of nodes per second. Web Audio garbage collection of disconnected nodes is implementation-dependent.
- Files: `src/audio.ts` (lines 84–96, 98–130)
- Cause: No node pooling or reuse. Same pattern in `playKill()` and `playExplosion()` (new buffer source per call).
- Improvement path: Use a small pool of pre-allocated oscillator nodes that are restarted rather than recreated, or use `AudioBufferSourceNode` reuse where the spec allows.

**`ctx.shadowBlur` in laser render called every frame per active laser:**
- Problem: `LaserBeam.render()` in `src/laser.ts` (lines 26–38) sets `ctx.shadowBlur = 14` inside a `ctx.save()/ctx.restore()` pair on every frame per laser beam. Shadow rendering is expensive on the 2D canvas path and scales with the number of simultaneous beams.
- Files: `src/laser.ts` (lines 26–38)
- Cause: No batching or conditional shadow disabling at low quality settings.
- Improvement path: Only apply shadowBlur once per frame for all lasers drawn in a single `save/restore` context, or add a quality toggle.

**`getDifficulty()` called multiple times per frame:**
- Problem: `getDifficulty()` in `src/main.ts` (lines 162–179) is called at least twice per frame during gameplay: once in `update()` (line 542) for `spawnIntervalMs` and once in `drawHUD()` (line 1227) for `level` and `wordTier`. It performs two `Math.exp()` operations each call.
- Files: `src/main.ts` (lines 162–179, 508, 542, 1227)
- Cause: No caching of the computed difficulty params for the current frame.
- Improvement path: Compute once at the top of the game loop and pass the result down, or memoize with a per-frame dirty flag.

**Particle arrays rebuilt on every `update` call via `.filter()`:**
- Problem: `Explosion`, `HealBurst`, and `FreezeBurst` in `src/explosion.ts` all call `this.particles = this.particles.filter(p => p.life > 0)` each frame (lines 42–47, 86–92, 131–138). This creates a new array allocation per active effect per frame.
- Files: `src/explosion.ts` (lines 42–47, 86–92, 131–138)
- Cause: Functional-style filtering used for simplicity.
- Improvement path: Swap-and-pop in-place removal to avoid allocation churn (same as the approach used for `rockets`, `lasers` arrays in `main.ts`).

## Fragile Areas

**`activeWords` Set in words.ts is module-level global state:**
- Files: `src/words.ts` (line 339)
- Why fragile: The `activeWords` set persists across game resets. `resetGame()` in `src/main.ts` calls `r.destroy()` on all rockets (which calls `releaseWord()`), but if any rocket is removed from the `rockets` array without calling `.destroy()` (e.g., via `rockets.length = 0` directly, which does NOT call destroy), words will leak into `activeWords` and be permanently excluded for the rest of the browser session. Currently `resetGame` iterates and calls `destroy()` correctly, but this is an easy regression target.
- Safe modification: Always remove rockets through `destroy()` before clearing the array. Never use `rockets.length = 0` without a preceding iteration calling `r.destroy()`.
- Test coverage: None — no automated tests exist.

**`targetedRocket` reference can become stale:**
- Files: `src/main.ts` (lines 555–573)
- Why fragile: `targetedRocket` is a direct object reference. When a rocket reaches the base and is spliced from the `rockets` array, the stale-reference cleanup logic at line 570 (`if (targetedRocket !== null && !rockets.includes(targetedRocket))`) uses `Array.includes()` which is O(n). If a rocket is removed by any path that doesn't go through this cleanup (e.g., future code calling `rockets.splice()` directly), `targetedRocket` silently points to a destroyed object and `typedBuffer` is not cleared.
- Safe modification: Route all rocket removal through a single helper function that always nulls `targetedRocket` when the removed rocket matches.
- Test coverage: None.

**Spell activation dispatch tied to exact string constants:**
- Files: `src/main.ts` (lines 282–312)
- Why fragile: If `SPELL_WORDS` in `src/spells.ts` is ever modified (e.g., a word renamed), the hardcoded `=== 'heal'` and `=== 'freeze'` checks in `main.ts` will silently stop triggering — no compile error, no runtime error, just dead spell keys.
- Safe modification: Drive dispatch from `SPELL_WORDS` rather than literals. Add a lint rule or type narrowing to catch mismatches.
- Test coverage: None.

## Scaling Limits

**Word pool exhaustion at high rocket counts:**
- Current capacity: `SMALL_WORD_POOL` has ~600 entries (SHORT_WORDS + MEDIUM_WORDS ≤6 chars). `LARGE_WORD_POOL` has ~450 entries (MEDIUM_WORDS + LONG_WORDS ≥6 chars).
- Limit: If more rockets are simultaneously alive than the pool size, `getWordForSize()` throws and the spawn is silently skipped (caught at `src/main.ts` line 515). The game continues but stops spawning new enemies.
- Scaling path: In practice, rocket count never approaches pool size during a 5–8 min session. However, adding more enemy types or persistence across sessions could expose this limit. A word recycling strategy (allow re-use of destroyed words immediately) is already in place via `releaseWord()`.

## Dependencies at Risk

**No test framework present:**
- Risk: There are zero automated tests. The entire project is production-only code with manual verification. All regression checking relies on Playwright screenshots (visual smoke tests only, based on `.playwright-mcp/` artifacts).
- Impact: Any refactor or new feature risks breaking existing behavior with no safety net.
- Migration plan: Add Vitest (already aligned with Vite toolchain) for unit tests on `words.ts`, `spells.ts`, `base.ts`, and `rocket.ts` logic.

**`gh-pages` deploy script has no pre-deploy health check:**
- Risk: `pnpm publish:gh` in `package.json` (line 12) runs `pnpm build && gh-pages -d dist` with no typecheck step. A broken build that TypeScript missed at emit time (rare but possible with `isolatedModules` edge cases) could be deployed.
- Files: `package.json` (line 12)
- Impact: Broken production deploy.
- Migration plan: Change to `pnpm typecheck && pnpm build && gh-pages -d dist`.

## Missing Critical Features

**No audio cleanup on page unload:**
- Problem: `AudioContext` and all oscillator nodes are never explicitly closed. The `AudioManager` has no `dispose()` or page-unload handler.
- Blocks: Clean teardown for SPAs that embed the game, or future server-side rendering contexts.

**No mobile / touch input support:**
- Problem: All input is keyboard-only via `keydown` events. There is no virtual keyboard or touch handler.
- Blocks: The game is completely unplayable on mobile devices.

## Test Coverage Gaps

**All game logic is untested:**
- What's not tested: Difficulty curve math, word pool exhaustion, spell cooldown timing, base damage and healing cap, leaderboard sort and persistence, targeted rocket stale-reference cleanup, rocket freeze behavior.
- Files: `src/main.ts`, `src/words.ts`, `src/spells.ts`, `src/base.ts`, `src/rocket.ts`
- Risk: Any modification to core game logic can silently break behavior. There is no regression barrier.
- Priority: High — particularly for `src/words.ts` (pool deduplication, release/acquire correctness) and `src/spells.ts` (cooldown state machine).

---

*Concerns audit: 2026-03-06*
