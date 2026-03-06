# External Integrations

**Analysis Date:** 2026-03-06

## APIs & External Services

**Font CDN:**
- Google Fonts — delivers the "Press Start 2P" pixel-art font
  - Loaded via `<link>` tags in `index.html`
  - Preconnect hints: `https://fonts.googleapis.com`, `https://fonts.gstatic.com`
  - No API key required; public CDN
  - Fallback: game starts anyway if font fails to load (`.catch()` branch in `src/main.ts` line 1367)

No other external APIs or third-party services are used. There are no HTTP calls in the source code.

## Data Storage

**Databases:**
- None — no server-side database

**Browser Storage (localStorage):**
- Leaderboard entries: key `'rocket-typing-leaderboard'` — JSON array of `LeaderboardEntry` (`src/main.ts`)
- Audio music muted: key `'audio_music_muted'` (`src/audio.ts`)
- Audio music volume: key `'audio_music_volume'` (`src/audio.ts`)
- Audio SFX muted: key `'audio_sfx_muted'` (`src/audio.ts`)
- Audio SFX volume: key `'audio_sfx_volume'` (`src/audio.ts`)
- FPS counter toggle: key `'rocket-typing-show-fps'` (`src/main.ts`)
- Legacy keys read once for migration: `'audio_muted'`, `'audio_volume'` (`src/audio.ts`)

All storage is client-side only. No data leaves the user's browser.

**File Storage:**
- Local filesystem only — static assets served from `public/` (`public/vite.svg`)

**Caching:**
- Browser cache only (no service worker, no explicit cache headers configured)

## Authentication & Identity

**Auth Provider:**
- None — no user authentication
- Player names are entered locally after game over and stored only in localStorage

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or equivalent

**Logs:**
- None configured — no console logging instrumentation in source files

## CI/CD & Deployment

**Hosting:**
- GitHub Pages
  - Deploy script: `pnpm publish:gh` → `pnpm build && gh-pages -d dist`
  - Vite base path set to `/spaceshift-typewriter-game/` in `vite.config.ts`
  - Built output: `dist/` directory

**CI Pipeline:**
- None detected — no `.github/workflows/` directory or other CI configuration files

## Environment Configuration

**Required env vars:**
- None — the application has no environment variables. All configuration is compile-time (Vite config) or runtime browser APIs.

**Secrets location:**
- No secrets — no API keys, tokens, or credentials of any kind

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Summary

This is a fully self-contained static browser game. The only external network dependency is the Google Fonts CDN for the pixel-art font. All game state is stored in the user's browser localStorage. There are no backend services, databases, authentication systems, or external API calls.

---

*Integration audit: 2026-03-06*
