# Technology Stack

**Analysis Date:** 2026-03-06

## Languages

**Primary:**
- TypeScript 5.9.3 - All game logic in `src/`
- HTML5 - Single entry point `index.html`
- CSS - Inline styles only within `index.html` (no external stylesheet)

## Runtime

**Environment:**
- Browser (vanilla — no Node.js server component)
- Target: ES2022 (`tsconfig.json` `"target": "ES2022"`)
- Module format: ESNext (`"module": "ESNext"`)

**Package Manager:**
- pnpm (lockfile: `pnpm-lock.yaml`, lockfileVersion 9.0)
- Lockfile: present and committed

## Frameworks

**Core:**
- None — pure vanilla TypeScript. All rendering uses the browser Canvas 2D API (`CanvasRenderingContext2D`). All audio uses the Web Audio API (`AudioContext`).

**Testing:**
- None — no test framework installed or configured.

**Build/Dev:**
- Vite 7.3.1 — dev server and production bundler (`vite.config.ts`)
  - Base path configured: `/spaceshift-typewriter-game/` (GitHub Pages deployment path)
  - No plugins configured

## Key Dependencies

**devDependencies only — zero runtime dependencies:**
- `typescript` ~5.9.3 — type checking (`tsc --noEmit`)
- `vite` ^7.3.1 — dev server, HMR, production build
- `eslint` ^9.0.0 — linting with flat config (`eslint.config.js`)
- `@eslint/js` ^9.0.0 — ESLint JS recommended rules
- `typescript-eslint` ^8.0.0 — TypeScript-aware lint rules
- `gh-pages` ^6.0.0 — `pnpm publish:gh` script for GitHub Pages deployment

**No npm dependencies shipped to users.** The entire game is a single compiled JS bundle.

## Configuration

**TypeScript (`tsconfig.json`):**
- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- `erasableSyntaxOnly: true` — disallows enums and namespaces (use const objects/union types)
- `noUncheckedSideEffectImports: true`
- `moduleResolution: "bundler"` — relies on Vite for resolution
- `allowImportingTsExtensions: true` — imports use `.ts` extensions explicitly

**ESLint (`eslint.config.js`):**
- Flat config format (ESLint v9)
- `js.configs.recommended` + `tseslint.configs.recommended`
- `@typescript-eslint/no-unused-vars`: error (args prefixed `_` are exempt)

**Vite (`vite.config.ts`):**
- `base: '/spaceshift-typewriter-game/'` — required for GitHub Pages sub-path hosting

**Build scripts (`package.json`):**
```bash
pnpm dev          # Vite dev server with HMR
pnpm build        # tsc --noEmit && vite build → dist/
pnpm preview      # Serve built dist/ locally
pnpm typecheck    # tsc --noEmit only
pnpm lint         # eslint src
pnpm publish:gh   # pnpm build && gh-pages -d dist
```

## Browser APIs Used

These are not npm packages but are critical platform dependencies:

- **Canvas 2D API** (`HTMLCanvasElement`, `CanvasRenderingContext2D`) — all game rendering (`src/main.ts`, `src/rocket.ts`, `src/base.ts`, `src/explosion.ts`, `src/laser.ts`)
- **Web Audio API** (`AudioContext`, `OscillatorNode`, `GainNode`, `BiquadFilterNode`, `AudioBufferSourceNode`) — all sound and music (`src/audio.ts`)
- **localStorage** — leaderboard persistence, audio settings persistence (`src/main.ts`, `src/audio.ts`)
- **requestAnimationFrame** — main game loop (`src/main.ts`)
- **document.fonts.ready** — waits for "Press Start 2P" font before starting game loop (`src/main.ts`)

## External Font

- **Press Start 2P** — loaded from Google Fonts CDN at runtime
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  ```
  Referenced throughout drawing code as `'"Press Start 2P", monospace'` (constant `PX_FONT` in `src/main.ts`)

## Platform Requirements

**Development:**
- Node.js (compatible with pnpm v9 lockfile)
- pnpm

**Production:**
- Static file hosting only (no server required)
- Deployed to GitHub Pages via `pnpm publish:gh`
- Deployment target URL path: `/spaceshift-typewriter-game/`

---

*Stack analysis: 2026-03-06*
