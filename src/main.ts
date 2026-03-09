import { Base } from './base.ts';
import { Explosion, HealBurst, FreezeBurst } from './explosion.ts';
import { LaserBeam } from './laser.ts';
import { Rocket } from './rocket.ts';
import { getWordForSize, type WordTier } from './words.ts';
import { AudioManager } from './audio.ts';
import { SpellManager, SPELL_WORDS, HEAL_AMOUNT, FREEZE_DURATION_MS } from './spells.ts';

const audio = new AudioManager();
const spellManager = new SpellManager();

// Pixel-art font used throughout
const PX_FONT = '"Press Start 2P", monospace';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Disable anti-aliasing for pixel-art aesthetic
ctx.imageSmoothingEnabled = false;

// ---- Starfield background ----

interface Star {
  px: number;   // 0–1 percentage of canvas width
  py: number;   // 0–1 percentage of canvas height
  size: number;
  alpha: number;
}

const stars: Star[] = Array.from({ length: 180 }, () => ({
  px: Math.random(),
  py: Math.random(),
  size: Math.random() < 0.85 ? 1 : 2,
  alpha: 0.2 + Math.random() * 0.8,
}));

function drawBackground(): void {
  ctx.fillStyle = '#050515';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillRect(
      Math.round(star.px * canvas.width),
      Math.round(star.py * canvas.height),
      star.size,
      star.size,
    );
  }
  ctx.globalAlpha = 1;
}

// ---- Game entities ----

const base = new Base();
const rockets: Rocket[] = [];
const lasers: LaserBeam[] = [];
const explosions: Explosion[] = [];
const healBursts: HealBurst[] = [];
const freezeBursts: FreezeBurst[] = [];

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

const floatingTexts: FloatingText[] = [];

const ROCKET_DAMAGE = 10; // HP lost per rocket impact

let screenFlashTimer = 0;
let screenFlashColor = '#ffffff';

let spawnTimer = 0;
let typedBuffer = '';
let targetedRocket: Rocket | null = null;
let gameElapsedSec = 0;
let score = 0;

const POINTS_PER_CHAR = 10;

// ---- Game State ----

type GameState = 'start' | 'playing' | 'paused' | 'entering-name' | 'leaderboard';
let gameState: GameState = 'start';

let playerName = '';
let submittedName = '';
let finalScore = 0;
let finalTimeSec = 0;

// ---- Leaderboard ----

interface LeaderboardEntry {
  name: string;
  score: number;
  timeSec: number;
}

const LEADERBOARD_KEY = 'rocket-typing-leaderboard';
const MAX_NAME_LENGTH = 10;
const MAX_LEADERBOARD_ENTRIES = 10;

function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

function saveToLeaderboard(entry: LeaderboardEntry): void {
  const entries = loadLeaderboard();
  entries.push(entry);
  entries.sort((a, b) => b.score - a.score);
  const top = entries.slice(0, MAX_LEADERBOARD_ENTRIES);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(top));
}

// ---- Helpers ----

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---- Difficulty ----

// Exponential difficulty curve constants — tweak these to tune game feel.
// Spawn interval: SPAWN_INITIAL * e^(-t / SPAWN_TAU) + SPAWN_MIN
const SPAWN_INITIAL = 1800;  // ms added on top of floor at t=0 (initial = 1800+600 = 2400ms)
const SPAWN_MIN     = 600;   // ms floor — fastest spawn rate, reached ~5 min
const SPAWN_TAU     = 90;    // seconds — time constant for exponential decay

// Rocket speed: SPEED_MAX - SPEED_RANGE * e^(-t / SPEED_TAU)
const SPEED_MAX   = 160;  // px/s ceiling
const SPEED_RANGE = 90;   // px/s range (initial speed = SPEED_MAX - SPEED_RANGE = 70)
const SPEED_TAU   = 90;   // seconds — time constant for exponential growth

// Level display: integer 1–MAX_LEVEL, one level per 30 seconds, plateau at 5 min
const LEVEL_STEP_SEC = 30;
const MAX_LEVEL      = 10;

// Word tier thresholds (seconds) — adjusted for the extended 5–8 min session
const TIER_SHORT_MAX_SEC  = 90;   // short → medium transition
const TIER_MEDIUM_MAX_SEC = 180;  // medium → long transition

interface DifficultyParams {
  spawnIntervalMs: number;
  rocketSpeed: number;
  wordTier: WordTier;
  level: number;
}

let _difficultyCache: { elapsed: number; params: DifficultyParams } | null = null;

function getDifficulty(): DifficultyParams {
  if (_difficultyCache !== null && _difficultyCache.elapsed === gameElapsedSec) {
    return _difficultyCache.params;
  }
  const t = gameElapsedSec;

  // Spawn interval: continuous exponential decay from ~2400ms → ~600ms over 5+ min
  const spawnIntervalMs = SPAWN_INITIAL * Math.exp(-t / SPAWN_TAU) + SPAWN_MIN;

  // Rocket speed: continuous exponential rise from 70 px/s → 160 px/s over 5+ min
  const rocketSpeed = SPEED_MAX - SPEED_RANGE * Math.exp(-t / SPEED_TAU);

  // Word tier: short < 90s, medium 90–180s, long ≥ 180s
  const wordTier: WordTier =
    t < TIER_SHORT_MAX_SEC ? 'short' : t < TIER_MEDIUM_MAX_SEC ? 'medium' : 'long';

  // Display level 1–10 derived from elapsed time (one level per 30 s)
  const level = Math.min(MAX_LEVEL, Math.floor(t / LEVEL_STEP_SEC) + 1);

  const params = { spawnIntervalMs, rocketSpeed, wordTier, level };
  _difficultyCache = { elapsed: t, params };
  return params;
}

// ---- Typing mechanics ----

function findTarget(): Rocket | null {
  if (typedBuffer.length === 0) return null;

  const matches = rockets.filter(r => r.word.startsWith(typedBuffer));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // Multiple matches: return the one closest to the base
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  let closest = matches[0];
  let minDist = Infinity;
  for (const r of matches) {
    const dx = r.x - cx;
    const dy = r.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      closest = r;
    }
  }
  return closest;
}

function updateTarget(): void {
  const newTarget = findTarget();

  // Clear previous targeting state on all rockets
  for (const r of rockets) {
    r.isTargeted = false;
    r.typedCount = 0;
  }

  if (newTarget !== null) {
    newTarget.isTargeted = true;
    newTarget.typedCount = typedBuffer.length;
    targetedRocket = newTarget;
  } else {
    targetedRocket = null;
  }
}

function handleKeyDown(e: KeyboardEvent): void {
  if (gameState === 'start') {
    if (e.key === 'Enter') {
      gameState = 'playing';
      audio.playGameStart();
      audio.startMusic();
    }
    return;
  }

  if (gameState === 'paused') {
    if (e.key === 'Escape') {
      gameState = 'playing';
      audio.resumeMusic();
    }
    return;
  }

  if (gameState === 'playing') {
    if (e.key === 'Escape') {
      gameState = 'paused';
      audio.pauseMusic();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      typedBuffer = '';
      targetedRocket = null;
      updateTarget();
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      typedBuffer = typedBuffer.slice(0, -1);
      updateTarget();
      return;
    }

    // Only handle lowercase letters
    if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;

    const newBuffer = typedBuffer + e.key.toLowerCase();

    // Reject the character if no rocket or spell word matches the new prefix
    if (!rockets.some(r => r.word.startsWith(newBuffer)) && !SPELL_WORDS.some(w => w.startsWith(newBuffer))) {
      typedBuffer = '';
      updateTarget();
      return;
    }

    typedBuffer = newBuffer;
    updateTarget();
    audio.playTyping();

    // Check for spell word completion
    if (typedBuffer === 'heal') {
      if (spellManager.triggerHeal()) {
        base.heal(HEAL_AMOUNT);
        healBursts.push(new HealBurst(canvas.width / 2, canvas.height / 2));
        floatingTexts.push({
          x: canvas.width / 2,
          y: canvas.height / 2 - 60,
          text: `+${HEAL_AMOUNT}`,
          color: '#44ff88',
          life: 1200,
          maxLife: 1200,
        });
        audio.playKill();
      }
      typedBuffer = '';
      updateTarget();
      return;
    }
    if (typedBuffer === 'freeze') {
      if (spellManager.triggerFreeze()) {
        for (const rocket of rockets) {
          rocket.freeze(FREEZE_DURATION_MS);
        }
        screenFlashTimer = 400;
        screenFlashColor = '#ffffff';
        freezeBursts.push(new FreezeBurst(canvas.width / 2, canvas.height / 2));
      }
      typedBuffer = '';
      updateTarget();
      return;
    }

    // Check if the typed buffer completes the targeted rocket's word
    if (targetedRocket !== null && targetedRocket.word === typedBuffer) {
      score += targetedRocket.word.length * POINTS_PER_CHAR;
      lasers.push(new LaserBeam(canvas.width / 2, canvas.height / 2, targetedRocket.x, targetedRocket.y));
      explosions.push(new Explosion(targetedRocket.x, targetedRocket.y));
      audio.playKill();
      audio.playExplosion();
      targetedRocket.destroy();
      const idx = rockets.indexOf(targetedRocket);
      if (idx !== -1) rockets.splice(idx, 1);
      typedBuffer = '';
      targetedRocket = null;
    }
  } else if (gameState === 'entering-name') {
    if (e.key === 'Enter') {
      submitName();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      playerName = playerName.slice(0, -1);
    } else if (e.key.length === 1 && playerName.length < MAX_NAME_LENGTH) {
      playerName += e.key;
    }
  } else if (gameState === 'leaderboard') {
    if (e.key === 'Enter') {
      resetGame();
    }
  }
}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Backspace') e.preventDefault();
}, { capture: true });

window.addEventListener('keydown', handleKeyDown);

// ---- Game Over / Name Entry / Leaderboard ----

function triggerGameOver(): void {
  finalScore = score;
  finalTimeSec = gameElapsedSec;
  playerName = '';
  gameState = 'entering-name';
  audio.playGameOver();
  audio.stopMusic();
}

function submitName(): void {
  submittedName = playerName.trim() === '' ? 'ANONYMOUS' : playerName.trim();
  saveToLeaderboard({ name: submittedName, score: finalScore, timeSec: finalTimeSec });
  gameState = 'leaderboard';
}

function resetGame(): void {
  for (const r of rockets) {
    r.destroy();
  }
  rockets.length = 0;
  lasers.length = 0;
  explosions.length = 0;
  healBursts.length = 0;
  freezeBursts.length = 0;
  floatingTexts.length = 0;
  screenFlashTimer = 0;
  base.reset();
  spellManager.reset();
  spawnTimer = 0;
  typedBuffer = '';
  targetedRocket = null;
  gameElapsedSec = 0;
  score = 0;
  playerName = '';
  finalScore = 0;
  finalTimeSec = 0;
  gameState = 'start';
}

// Play Again button bounds (updated each frame during drawLeaderboard)
let playAgainBtn = { x: 0, y: 0, w: 0, h: 0 };

// Pause overlay control bounds (updated each frame during drawPauseOverlay)
const musicMuteBtn = { x: 0, y: 0, w: 0, h: 0 };
const musicSlider  = { x: 0, y: 0, w: 0, h: 0 };
const sfxMuteBtn   = { x: 0, y: 0, w: 0, h: 0 };
const sfxSlider    = { x: 0, y: 0, w: 0, h: 0 };
let activeSlider: 'music' | 'sfx' | null = null;

// FPS counter
const FPS_STORAGE_KEY = 'rocket-typing-show-fps';
let showFps: boolean = localStorage.getItem(FPS_STORAGE_KEY) === 'true';
let fpsDisplay = 0;
let fpsSampleTime = 0;
let fpsFrameCount = 0;
const fpsBtnBounds = { x: 0, y: 0, w: 0, h: 0 };

canvas.addEventListener('click', (e: MouseEvent) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (gameState === 'paused') {
    if (activeSlider === null) {
      if (hitTest(mx, my, musicMuteBtn)) {
        audio.musicMuted = !audio.musicMuted;
      } else if (hitTest(mx, my, sfxMuteBtn)) {
        audio.sfxMuted = !audio.sfxMuted;
      } else if (hitTest(mx, my, fpsBtnBounds)) {
        showFps = !showFps;
        localStorage.setItem(FPS_STORAGE_KEY, showFps ? 'true' : 'false');
      }
    }
    return;
  }

  if (gameState !== 'leaderboard') return;
  if (
    mx >= playAgainBtn.x &&
    mx <= playAgainBtn.x + playAgainBtn.w &&
    my >= playAgainBtn.y &&
    my <= playAgainBtn.y + playAgainBtn.h
  ) {
    resetGame();
  }
});

// ---- Volume slider drag ----

function hitTest(mx: number, my: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

function applyMusicVolumeFromMouseX(mx: number): void {
  audio.musicVolume = Math.max(0, Math.min(1, (mx - musicSlider.x) / musicSlider.w));
}

function applySfxVolumeFromMouseX(mx: number): void {
  audio.sfxVolume = Math.max(0, Math.min(1, (mx - sfxSlider.x) / sfxSlider.w));
}

canvas.addEventListener('mousedown', (e: MouseEvent) => {
  if (gameState !== 'paused') return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (hitTest(mx, my, musicSlider)) {
    activeSlider = 'music';
    applyMusicVolumeFromMouseX(mx);
  } else if (hitTest(mx, my, sfxSlider)) {
    activeSlider = 'sfx';
    applySfxVolumeFromMouseX(mx);
  }
});

window.addEventListener('mousemove', (e: MouseEvent) => {
  if (activeSlider === null) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  if (activeSlider === 'music') {
    applyMusicVolumeFromMouseX(mx);
  } else {
    applySfxVolumeFromMouseX(mx);
  }
});

window.addEventListener('mouseup', () => {
  activeSlider = null;
});

// ---- Spawning ----

function spawnRocket(): void {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  const margin = 30;

  switch (edge) {
    case 0: // top
      x = Math.random() * canvas.width;
      y = -margin;
      break;
    case 1: // right
      x = canvas.width + margin;
      y = Math.random() * canvas.height;
      break;
    case 2: // bottom
      x = Math.random() * canvas.width;
      y = canvas.height + margin;
      break;
    default: // left
      x = -margin;
      y = Math.random() * canvas.height;
      break;
  }

  const { rocketSpeed } = getDifficulty();
  // 60% small / 40% large spawn ratio
  const size = Math.random() < 0.6 ? 'small' : 'large';

  try {
    const word = getWordForSize(size);
    rockets.push(new Rocket(x, y, word, canvas.width / 2, canvas.height / 2, rocketSpeed, size));
  } catch {
    // Word pool exhausted — skip this spawn cycle
  }
}

// ---- Canvas ----

function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let lastTime = 0;

function update(delta: number): void {
  if (gameState !== 'playing') return;

  spellManager.update(delta);
  base.update(delta);

  // Advance elapsed time (in seconds)
  gameElapsedSec += delta / 1000;

  // Spawn timer — uses current difficulty's dynamic interval
  const { spawnIntervalMs } = getDifficulty();
  spawnTimer += delta;
  if (spawnTimer >= spawnIntervalMs) {
    spawnTimer -= spawnIntervalMs;
    spawnRocket();
  }

  // Move all rockets
  for (const rocket of rockets) {
    rocket.update(delta);
  }

  // Remove rockets that have reached the base; deal damage
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    if (r.hasReachedBase(canvas)) {
      base.takeDamage(ROCKET_DAMAGE);
      audio.playExplosion();
      r.destroy();
      rockets.splice(i, 1);
      if (base.hp <= 0) {
        triggerGameOver();
        break;
      }
    }
  }

  // If the targeted rocket was removed (reached the base), clear state
  if (targetedRocket !== null && !rockets.includes(targetedRocket)) {
    targetedRocket = null;
    typedBuffer = '';
    updateTarget();
  }

  // Update lasers
  for (const laser of lasers) {
    laser.update(delta);
  }
  for (let i = lasers.length - 1; i >= 0; i--) {
    if (lasers[i].isDone()) lasers.splice(i, 1);
  }

  // Update explosions
  for (const exp of explosions) {
    exp.update(delta);
  }
  for (let i = explosions.length - 1; i >= 0; i--) {
    if (explosions[i].isDone()) explosions.splice(i, 1);
  }

  // Update heal bursts
  for (const hb of healBursts) {
    hb.update(delta);
  }
  for (let i = healBursts.length - 1; i >= 0; i--) {
    if (healBursts[i].isDone()) healBursts.splice(i, 1);
  }

  // Update freeze bursts
  for (const fb of freezeBursts) {
    fb.update(delta);
  }
  for (let i = freezeBursts.length - 1; i >= 0; i--) {
    if (freezeBursts[i].isDone()) freezeBursts.splice(i, 1);
  }

  // Update screen flash
  if (screenFlashTimer > 0) {
    screenFlashTimer = Math.max(0, screenFlashTimer - delta);
  }

  // Update floating texts
  for (const ft of floatingTexts) {
    ft.y -= 40 * (delta / 1000);
    ft.life -= delta;
  }
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
  }
}

// ---- Drawing ----

function drawNameEntry(): void {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.textAlign = 'center';
  ctx.globalAlpha = 1;

  // "GAME OVER" heading — drop shadow for logo effect
  ctx.font = `20px ${PX_FONT}`;
  ctx.fillStyle = '#550000';
  ctx.fillText('GAME OVER', cx + 2, cy - 76 + 2);
  ctx.fillStyle = '#ff3333';
  ctx.fillText('GAME OVER', cx, cy - 76);

  // Final score
  ctx.fillStyle = '#ffd700';
  ctx.font = `14px ${PX_FONT}`;
  ctx.fillText(`SCORE: ${finalScore}`, cx, cy - 44);

  // Time survived
  ctx.fillStyle = '#8888aa';
  ctx.font = `8px ${PX_FONT}`;
  ctx.fillText(`TIME: ${formatTime(finalTimeSec)}`, cx, cy - 22);

  // Name entry prompt
  ctx.fillStyle = '#aaaacc';
  ctx.fillText('ENTER YOUR NAME:', cx, cy - 4);

  // Name input box
  const boxW = 300;
  const boxH = 40;
  const boxX = cx - boxW / 2;
  const boxY = cy + 12;

  ctx.fillStyle = 'rgba(5,15,5,0.92)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = '#44ff88';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // Name text with blinking cursor
  const cursor = Math.floor(Date.now() / 500) % 2 === 0 ? '_' : ' ';
  ctx.fillStyle = '#44ff88';
  ctx.font = `10px ${PX_FONT}`;
  ctx.fillText(`${playerName}${cursor}`, cx, boxY + 27);

  // Enter hint
  ctx.fillStyle = '#445566';
  ctx.font = `8px ${PX_FONT}`;
  ctx.fillText('PRESS ENTER TO SUBMIT', cx, cy + 66);

  ctx.textAlign = 'left';
}

function drawStartScreen(): void {
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const topMargin = Math.max(30, canvas.height / 2 - 230);
  let y = topMargin;

  ctx.textAlign = 'center';
  ctx.globalAlpha = 1;

  // Game title — pixel-art logo with drop shadow
  ctx.font = `20px ${PX_FONT}`;
  ctx.fillStyle = '#554400';
  ctx.fillText('ROCKET TYPING', cx + 2, y + 2);
  ctx.fillStyle = '#ffd700';
  ctx.fillText('ROCKET TYPING', cx, y);
  y += 34;

  ctx.fillStyle = '#441100';
  ctx.fillText('DEFENSE', cx + 2, y + 2);
  ctx.fillStyle = '#ff6644';
  ctx.fillText('DEFENSE', cx, y);
  y += 30;

  // Pixel-art separator line
  ctx.strokeStyle = '#222244';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 240, y);
  ctx.lineTo(cx + 240, y);
  ctx.stroke();
  y += 20;

  // Leaderboard section
  const entries = loadLeaderboard();

  if (entries.length === 0) {
    ctx.fillStyle = '#445566';
    ctx.font = `8px ${PX_FONT}`;
    ctx.fillText('No scores yet - be first!', cx, y);
    y += 24;
  } else {
    ctx.fillStyle = '#8888bb';
    ctx.font = `10px ${PX_FONT}`;
    ctx.fillText('TOP 10', cx, y);
    y += 22;

    ctx.font = `8px ${PX_FONT}`;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      ctx.fillStyle = i === 0 ? '#ffd700' : '#8888bb';
      const rank = `${i + 1}.`.padEnd(3);
      const name = entry.name.padEnd(11);
      const sc = String(entry.score).padStart(6);
      const tm = formatTime(entry.timeSec);
      ctx.fillText(`${rank} ${name} ${sc}  ${tm}`, cx, y);
      y += 16;
    }
  }

  y += 14;

  // Blinking "PRESS ENTER" prompt
  const blink = Math.floor(Date.now() / 600) % 2 === 0;
  ctx.fillStyle = blink ? '#44ff88' : '#1a5533';
  ctx.font = `10px ${PX_FONT}`;
  ctx.fillText('PRESS ENTER TO START', cx, y);

  ctx.textAlign = 'left';
}

function drawLeaderboard(): void {
  ctx.fillStyle = 'rgba(0,0,0,0.90)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const topMargin = Math.max(40, canvas.height / 2 - 210);
  let y = topMargin;

  ctx.textAlign = 'center';
  ctx.globalAlpha = 1;

  // Title
  ctx.fillStyle = '#ffd700';
  ctx.font = `16px ${PX_FONT}`;
  ctx.fillText('LEADERBOARD', cx, y);
  y += 32;

  // Separator
  ctx.strokeStyle = '#222244';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 240, y);
  ctx.lineTo(cx + 240, y);
  ctx.stroke();
  y += 20;

  // Entries
  const entries = loadLeaderboard();
  ctx.font = `8px ${PX_FONT}`;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isCurrentPlayer = entry.name === submittedName && entry.score === finalScore;

    if (i === 0) {
      ctx.fillStyle = '#ffd700';
    } else if (isCurrentPlayer) {
      ctx.fillStyle = '#44ff88';
    } else {
      ctx.fillStyle = '#8888bb';
    }

    const rank = `${i + 1}.`.padEnd(3);
    const name = entry.name.padEnd(11);
    const sc = String(entry.score).padStart(6);
    const tm = formatTime(entry.timeSec);
    ctx.fillText(`${rank} ${name} ${sc}  ${tm}`, cx, y);
    y += 18;
  }

  if (entries.length === 0) {
    ctx.fillStyle = '#445566';
    ctx.fillText('No scores yet', cx, y);
    y += 22;
  }

  y += 14;

  // Play Again button
  const btnW = 220;
  const btnH = 42;
  const btnX = cx - btnW / 2;
  const btnY = y;
  playAgainBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

  ctx.fillStyle = '#050f05';
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = '#44ff88';
  ctx.lineWidth = 2;
  ctx.strokeRect(btnX, btnY, btnW, btnH);

  ctx.fillStyle = '#44ff88';
  ctx.font = `10px ${PX_FONT}`;
  ctx.fillText('PLAY AGAIN', cx, btnY + 28);

  ctx.fillStyle = '#334455';
  ctx.font = `8px ${PX_FONT}`;
  ctx.fillText('or press ENTER', cx, btnY + btnH + 18);

  ctx.textAlign = 'left';
}

function drawHeartIcon(cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const s = size / 2;
  ctx.moveTo(cx, cy + s * 0.8);
  ctx.bezierCurveTo(cx - s * 1.2, cy, cx - s * 1.2, cy - s * 0.9, cx, cy - s * 0.25);
  ctx.bezierCurveTo(cx + s * 1.2, cy - s * 0.9, cx + s * 1.2, cy, cx, cy + s * 0.8);
  ctx.fill();
  ctx.restore();
}

function drawSnowflakeIcon(cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  const r = size / 2;
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.lineTo(cx - Math.cos(angle) * r, cy - Math.sin(angle) * r);
    ctx.stroke();
  }
  const branchR = r * 0.55;
  const branchLen = r * 0.28;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const bx = cx + Math.cos(angle) * branchR;
    const by = cy + Math.sin(angle) * branchR;
    const perpAngle = angle + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(perpAngle) * branchLen, by + Math.sin(perpAngle) * branchLen);
    ctx.lineTo(bx - Math.cos(perpAngle) * branchLen, by - Math.sin(perpAngle) * branchLen);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpellHUD(): void {
  const rowH = 28;
  const panelW = 190;
  const panelH = rowH * 2 + 16;
  const panelX = 16;
  // Position just above the typing HUD (panelH=60, marginBottom=16, gap=8)
  const panelY = canvas.height - 60 - 16 - panelH - 8;
  const radius = 6;

  ctx.save();
  ctx.globalAlpha = 1;

  // Dark semi-transparent background
  ctx.fillStyle = 'rgba(2,10,20,0.88)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, radius);
  ctx.fill();

  // Cyan border
  ctx.strokeStyle = '#22ddff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, radius);
  ctx.stroke();

  // 'SPELLS' label
  ctx.fillStyle = '#22ddff';
  ctx.globalAlpha = 0.65;
  ctx.font = `6px ${PX_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('SPELLS', panelX + 4, panelY - 4);
  ctx.globalAlpha = 1;

  const spells = [
    { name: 'heal',   ratio: spellManager.healCooldownRatio,   ready: spellManager.healReady,   color: '#44ff88', dimColor: '#225533' },
    { name: 'freeze', ratio: spellManager.freezeCooldownRatio, ready: spellManager.freezeReady, color: '#44aaff', dimColor: '#223355' },
  ];

  const iconSize = 10;
  const iconCX = panelX + 14;
  const wordX = iconCX + iconSize / 2 + 6;
  const barW = 72;
  const barH = 5;
  const barX = panelX + panelW - barW - 10;

  for (let i = 0; i < spells.length; i++) {
    const spell = spells[i];
    const rowCY = panelY + 8 + i * rowH + rowH / 2;

    // Icon
    if (spell.name === 'heal') {
      ctx.globalAlpha = spell.ready ? 1 : 0.45;
      drawHeartIcon(iconCX, rowCY, iconSize, spell.color);
    } else {
      ctx.globalAlpha = spell.ready ? 1 : 0.45;
      drawSnowflakeIcon(iconCX, rowCY, iconSize, spell.color);
    }
    ctx.globalAlpha = 1;

    // Word text
    ctx.font = `7px ${PX_FONT}`;
    ctx.textAlign = 'left';
    if (spell.ready) {
      const blink = Math.floor(Date.now() / 600) % 2 === 0;
      ctx.globalAlpha = blink ? 1.0 : 0.7;
      ctx.fillStyle = spell.color;
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#556677';
    }
    ctx.fillText(spell.name.toUpperCase(), wordX, rowCY + 3);
    ctx.globalAlpha = 1;

    // Cooldown bar background
    const barY = rowCY - barH / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#223344';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Cooldown bar fill (left to right as ratio goes 0→1)
    const fillW = Math.round(barW * spell.ratio);
    if (fillW > 0) {
      ctx.fillStyle = spell.ready ? spell.color : spell.dimColor;
      ctx.fillRect(barX, barY, fillW, barH);
    }
  }

  ctx.textAlign = 'left';
  ctx.restore();
}

function drawTypingHUD(): void {
  const panelW = Math.min(500, canvas.width * 0.6);
  const panelH = 60;
  const panelX = canvas.width / 2 - panelW / 2;
  const panelY = canvas.height - panelH - 16;
  const radius = 8;
  const bracketLen = 12;

  ctx.save();
  ctx.globalAlpha = 1;

  // Dark semi-transparent background with rounded corners
  ctx.fillStyle = 'rgba(2,10,20,0.88)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, radius);
  ctx.fill();

  // Cyan border
  ctx.strokeStyle = '#22ddff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, radius);
  ctx.stroke();

  // Gold corner accent brackets
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  const bxl = panelX;
  const byt = panelY;
  const bxr = panelX + panelW;
  const byb = panelY + panelH;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(bxl + bracketLen, byt);
  ctx.lineTo(bxl, byt);
  ctx.lineTo(bxl, byt + bracketLen);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(bxr - bracketLen, byt);
  ctx.lineTo(bxr, byt);
  ctx.lineTo(bxr, byt + bracketLen);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(bxl + bracketLen, byb);
  ctx.lineTo(bxl, byb);
  ctx.lineTo(bxl, byb - bracketLen);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(bxr - bracketLen, byb);
  ctx.lineTo(bxr, byb);
  ctx.lineTo(bxr, byb - bracketLen);
  ctx.stroke();

  // 'INPUT' label above-left of panel
  ctx.fillStyle = '#22ddff';
  ctx.globalAlpha = 0.65;
  ctx.font = `6px ${PX_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('INPUT', panelX + 4, panelY - 4);
  ctx.globalAlpha = 1;

  // Typed text centered in panel with blinking cursor
  const cursor = Math.floor(Date.now() / 500) % 2 === 0 ? '_' : ' ';
  const display = typedBuffer.length > 0 ? typedBuffer + cursor : cursor;
  ctx.fillStyle = '#44ff88';
  ctx.font = `12px ${PX_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(display, canvas.width / 2, panelY + panelH / 2 + 5);

  ctx.textAlign = 'left';
  ctx.restore();
}

interface BoundsRect { x: number; y: number; w: number; h: number; }

// Draws a horizontal audio row: LABEL  [ON/OFF]  [=========|===]
// rowY is the vertical center of the row
function drawAudioRow(opts: {
  label: string; rowY: number;
  rowLeft: number; rowRight: number;
  btnW: number; btnH: number; sliderH: number;
  muted: boolean; volume: number;
  btnRef: BoundsRect; sliderRef: BoundsRect;
}): void {
  const { label, rowY, rowLeft, rowRight, btnW, btnH, sliderH, muted, volume } = opts;
  const labelW = 52;
  const gap = 12;
  const availableW = rowRight - rowLeft - labelW - gap - btnW - gap;
  const sliderW = Math.max(availableW, 60);

  const labelX = rowLeft + labelW / 2;
  const btnX = rowLeft + labelW + gap;
  const sliderX = btnX + btnW + gap;

  // Label
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8899bb';
  ctx.font = `9px ${PX_FONT}`;
  ctx.fillText(label, labelX, rowY + 4);

  // Toggle button
  const btnY = rowY - btnH / 2;
  opts.btnRef.x = btnX; opts.btnRef.y = btnY; opts.btnRef.w = btnW; opts.btnRef.h = btnH;
  ctx.fillStyle = 'rgba(5,5,15,0.9)';
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = '#22ddff';
  ctx.lineWidth = 2;
  ctx.strokeRect(btnX, btnY, btnW, btnH);
  ctx.fillStyle = muted ? '#ff4444' : '#44ff88';
  ctx.font = `10px ${PX_FONT}`;
  ctx.fillText(muted ? 'OFF' : 'ON', btnX + btnW / 2, rowY + 4);

  // Slider track
  const sliderY = rowY - sliderH / 2;
  opts.sliderRef.x = sliderX; opts.sliderRef.y = sliderY; opts.sliderRef.w = sliderW; opts.sliderRef.h = sliderH;
  ctx.fillStyle = 'rgba(5,5,15,0.9)';
  ctx.fillRect(sliderX, sliderY, sliderW, sliderH);
  ctx.strokeStyle = '#22ddff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sliderX, sliderY, sliderW, sliderH);

  // Volume fill
  const fillW = sliderW * volume;
  ctx.fillStyle = muted ? '#1a2a33' : '#22ddff';
  ctx.fillRect(sliderX, sliderY, fillW, sliderH);

  // Thumb indicator
  const thumbX = sliderX + fillW;
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(thumbX, sliderY - 3);
  ctx.lineTo(thumbX, sliderY + sliderH + 3);
  ctx.stroke();
}

function drawPauseOverlay(): void {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Layout constants
  const panelW = 340;
  const padding = 20;
  const rowH = 32;           // height of each audio row
  const rowGap = 14;         // gap between the two audio rows
  const btnW = 52;
  const btnH = 24;
  const sliderH = 12;
  const fpsBtnW = panelW - padding * 2;
  const fpsBtnH = 26;
  const headerH = 64;        // title + subtitle
  const footerH = fpsBtnH + 24;

  const panelH = headerH + rowH + rowGap + rowH + rowGap + footerH + padding;
  const panelX = cx - panelW / 2;
  const panelY = cy - panelH / 2;
  const rowLeft = panelX + padding;
  const rowRight = panelX + panelW - padding;

  // Panel background
  ctx.fillStyle = 'rgba(4,4,20,0.92)';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = '#22ddff';
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.textAlign = 'center';
  ctx.globalAlpha = 1;

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = `22px ${PX_FONT}`;
  ctx.fillText('PAUSED', cx, panelY + 30);

  // Subtitle
  ctx.fillStyle = '#7788aa';
  ctx.font = `9px ${PX_FONT}`;
  ctx.fillText('ESC  TO  RESUME', cx, panelY + 50);

  // Divider under header
  const dividerY = panelY + headerH;
  ctx.strokeStyle = 'rgba(34,221,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + padding, dividerY);
  ctx.lineTo(panelX + panelW - padding, dividerY);
  ctx.stroke();

  // Audio rows — vertically centered within their slot
  const row1Y = dividerY + rowGap + rowH / 2;
  const row2Y = row1Y + rowH + rowGap;

  drawAudioRow({
    label: 'MUSIC', rowY: row1Y, rowLeft, rowRight,
    btnW, btnH, sliderH,
    muted: audio.musicMuted, volume: audio.musicVolume,
    btnRef: musicMuteBtn, sliderRef: musicSlider,
  });

  drawAudioRow({
    label: 'SFX', rowY: row2Y, rowLeft, rowRight,
    btnW, btnH, sliderH,
    muted: audio.sfxMuted, volume: audio.sfxVolume,
    btnRef: sfxMuteBtn, sliderRef: sfxSlider,
  });

  // Divider before footer
  const footerDividerY = row2Y + rowH / 2 + rowGap;
  ctx.strokeStyle = 'rgba(34,221,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + padding, footerDividerY);
  ctx.lineTo(panelX + panelW - padding, footerDividerY);
  ctx.stroke();

  // FPS toggle button
  const fpsBtnX = panelX + padding;
  const fpsBtnY = footerDividerY + 10;
  fpsBtnBounds.x = fpsBtnX;
  fpsBtnBounds.y = fpsBtnY;
  fpsBtnBounds.w = fpsBtnW;
  fpsBtnBounds.h = fpsBtnH;

  ctx.fillStyle = 'rgba(5,5,15,0.9)';
  ctx.fillRect(fpsBtnX, fpsBtnY, fpsBtnW, fpsBtnH);
  ctx.strokeStyle = '#22ddff';
  ctx.lineWidth = 2;
  ctx.strokeRect(fpsBtnX, fpsBtnY, fpsBtnW, fpsBtnH);

  const fpsMidY = fpsBtnY + fpsBtnH / 2 + 4;
  ctx.font = `9px ${PX_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8899bb';
  ctx.fillText('FPS COUNTER', fpsBtnX + 10, fpsMidY);

  const fpsStatus = showFps ? 'ON' : 'OFF';
  ctx.fillStyle = showFps ? '#44ff88' : '#ff4444';
  ctx.font = `10px ${PX_FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(fpsStatus, fpsBtnX + fpsBtnW - 10, fpsMidY);

  ctx.textAlign = 'left';
}

const TIER_LABELS: Record<WordTier, string> = { short: 'EASY', medium: 'MEDIUM', long: 'HARD' };
const TIER_COLORS: Record<WordTier, string> = { short: '#44ff88', medium: '#ffcc44', long: '#ff6644' };

function drawHUD(): void {
  const { level, wordTier } = getDifficulty();
  const timeStr = formatTime(gameElapsedSec);

  ctx.textAlign = 'left';

  // Background panel
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(8, 8, 180, 82);

  ctx.font = `8px ${PX_FONT}`;

  // Score (prominent, golden color)
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`SCORE ${score}`, 16, 26);

  // Time
  ctx.fillStyle = '#8888bb';
  ctx.fillText(`TIME  ${timeStr}`, 16, 42);

  // Level
  ctx.fillStyle = '#8888bb';
  ctx.fillText(`LVL   ${level}`, 16, 58);

  // Tier (colored by difficulty)
  ctx.fillStyle = TIER_COLORS[wordTier];
  ctx.fillText(TIER_LABELS[wordTier], 16, 74);
}

function render(): void {
  ctx.globalAlpha = 1;
  drawBackground();

  // Screen flash (after background, before game entities)
  if (screenFlashTimer > 0) {
    ctx.globalAlpha = (screenFlashTimer / 400) * 0.5;
    ctx.fillStyle = screenFlashColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  base.render(ctx, canvas);

  if (lasers.length > 0) {
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#aaffff';
    ctx.strokeStyle = '#aaffff';
    ctx.lineWidth = 2.5;
    for (const laser of lasers) {
      laser.render(ctx);
    }
    ctx.restore();
  }

  for (const rocket of rockets) {
    rocket.render(ctx);
  }

  for (const exp of explosions) {
    exp.render(ctx);
  }

  for (const hb of healBursts) {
    hb.render(ctx);
  }

  for (const fb of freezeBursts) {
    fb.render(ctx);
  }

  // Floating texts
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `12px ${PX_FONT}`;
  for (const ft of floatingTexts) {
    const alpha = ft.life / ft.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.restore();

  drawHUD();

  if (gameState === 'start') {
    drawStartScreen();
  } else if (gameState === 'paused') {
    drawPauseOverlay();
  } else if (gameState === 'entering-name') {
    drawNameEntry();
  } else if (gameState === 'leaderboard') {
    drawLeaderboard();
  }

  // FPS counter (top-right, always on top when enabled)
  if (showFps) {
    const fpsText = `${fpsDisplay} FPS`;
    ctx.font = `7px ${PX_FONT}`;
    const fpsW = ctx.measureText(fpsText).width;
    const fpsPadX = 8;
    const fpsPadY = 6;
    const fpsBgW = fpsW + fpsPadX * 2;
    const fpsBgH = 18;
    const fpsBgX = canvas.width - fpsBgW - 8;
    const fpsBgY = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(fpsBgX, fpsBgY, fpsBgW, fpsBgH);
    ctx.fillStyle = fpsDisplay >= 50 ? '#44ff88' : fpsDisplay >= 30 ? '#ffcc44' : '#ff6644';
    ctx.textAlign = 'right';
    ctx.fillText(fpsText, canvas.width - 8 - fpsPadX, fpsBgY + fpsBgH - fpsPadY);
    ctx.textAlign = 'left';
  }

  // Spell HUD — only during active play (not paused)
  if (gameState === 'playing') {
    drawSpellHUD();
  }

  // Typing HUD drawn last so it's always on top
  if (gameState === 'playing' || gameState === 'paused') {
    drawTypingHUD();
  }
}

function gameLoop(timestamp: number): void {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  // FPS sampling: average over 500 ms
  fpsFrameCount++;
  fpsSampleTime += delta;
  if (fpsSampleTime >= 500) {
    fpsDisplay = Math.round(fpsFrameCount * 1000 / fpsSampleTime);
    fpsFrameCount = 0;
    fpsSampleTime = 0;
  }

  update(delta);
  render();

  requestAnimationFrame(gameLoop);
}

// Wait for Press Start 2P font to load before starting the game loop
document.fonts.ready.then(() => {
  requestAnimationFrame(gameLoop);
}).catch(() => {
  // Font failed to load — start anyway with fallback font
  requestAnimationFrame(gameLoop);
});
