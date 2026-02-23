import { Base } from './base.ts';
import { Explosion } from './explosion.ts';
import { LaserBeam } from './laser.ts';
import { Rocket } from './rocket.ts';
import { getWordForSize, type WordTier } from './words.ts';

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

const ROCKET_DAMAGE = 10; // HP lost per rocket impact

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

interface DifficultyParams {
  spawnIntervalMs: number;
  rocketSpeed: number;
  wordTier: WordTier;
  level: number;
}

function getDifficulty(): DifficultyParams {
  // Step increases every 30 seconds (0, 1, 2, …)
  const step = Math.floor(gameElapsedSec / 30);

  // Spawn interval: 4000ms → 750ms, decreasing 650ms per step, capped at 750ms
  const spawnIntervalMs = Math.max(750, 4000 - step * 650);

  // Rocket speed: 70 → 145 px/s (+15 per step), capped at 150
  const rocketSpeed = Math.min(150, 70 + step * 15);

  // Word tier: short < 60s, medium 60–120s, long ≥ 120s
  const wordTier: WordTier =
    gameElapsedSec < 60 ? 'short' : gameElapsedSec < 120 ? 'medium' : 'long';

  // Display level 1–6 (mirrors the 6 difficulty steps 0–5)
  const level = Math.min(6, step + 1);

  return { spawnIntervalMs, rocketSpeed, wordTier, level };
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
    }
    return;
  }

  if (gameState === 'paused') {
    if (e.key === 'Escape') {
      gameState = 'playing';
    }
    return;
  }

  if (gameState === 'playing') {
    if (e.key === 'Escape') {
      gameState = 'paused';
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

    // Reject the character if no rocket matches the new prefix
    if (!rockets.some(r => r.word.startsWith(newBuffer))) {
      typedBuffer = '';
      updateTarget();
      return;
    }

    typedBuffer = newBuffer;
    updateTarget();

    // Check if the typed buffer completes the targeted rocket's word
    if (targetedRocket !== null && targetedRocket.word === typedBuffer) {
      score += targetedRocket.word.length * POINTS_PER_CHAR;
      lasers.push(new LaserBeam(canvas.width / 2, canvas.height / 2, targetedRocket.x, targetedRocket.y));
      explosions.push(new Explosion(targetedRocket.x, targetedRocket.y));
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
  base.reset();
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

canvas.addEventListener('click', (e: MouseEvent) => {
  if (gameState !== 'leaderboard') return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (
    mx >= playAgainBtn.x &&
    mx <= playAgainBtn.x + playAgainBtn.w &&
    my >= playAgainBtn.y &&
    my <= playAgainBtn.y + playAgainBtn.h
  ) {
    resetGame();
  }
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

function drawPauseOverlay(): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.textAlign = 'center';
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#ffffff';
  ctx.font = `20px ${PX_FONT}`;
  ctx.fillText('PAUSED', cx, cy - 10);

  ctx.fillStyle = '#aaaacc';
  ctx.font = `10px ${PX_FONT}`;
  ctx.fillText('[ ESC to resume ]', cx, cy + 20);

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

  base.render(ctx, canvas);

  for (const laser of lasers) {
    laser.render(ctx);
  }

  for (const rocket of rockets) {
    rocket.render(ctx);
  }

  for (const exp of explosions) {
    exp.render(ctx);
  }

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

  // Typing HUD drawn last so it's always on top
  if (gameState === 'playing' || gameState === 'paused') {
    drawTypingHUD();
  }
}

function gameLoop(timestamp: number): void {
  const delta = timestamp - lastTime;
  lastTime = timestamp;

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
