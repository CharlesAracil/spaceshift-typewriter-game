export const BASE_MAX_HP = 100;

const HIT_FLASH_DURATION_MS = 300;

export class Base {
  hp: number = BASE_MAX_HP;
  private hitFlashTimer: number = 0;

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlashTimer = HIT_FLASH_DURATION_MS;
  }

  update(delta: number): void {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - delta);
    }
  }

  reset(): void {
    this.hp = BASE_MAX_HP;
    this.hitFlashTimer = 0;
  }

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    const cx = Math.floor(canvas.width / 2);
    const cy = Math.floor(canvas.height / 2);

    if (this.hp > 0) {
      this.drawBase(ctx, cx, cy);
    } else {
      this.drawDestroyedBase(ctx, cx, cy);
    }

    // Hit flash: red circular overlay that fades out
    if (this.hitFlashTimer > 0) {
      const alpha = (this.hitFlashTimer / HIT_FLASH_DURATION_MS) * 0.6;
      ctx.fillStyle = `rgba(255,50,50,${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.fill();
    }

    this.drawHealthBar(ctx, cx, cy);
  }

  private drawBase(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Outer docking ring — thick dark-blue annulus
    ctx.strokeStyle = '#1e3055';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.stroke();

    // Outer ring accent glow
    ctx.strokeStyle = 'rgba(64, 196, 255, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.stroke();

    // Ring connector spokes (4 cardinal points)
    ctx.strokeStyle = '#2a4470';
    ctx.lineWidth = 3;
    for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const innerR = 28;
      const outerR = 37;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
      ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
      ctx.stroke();
    }

    // Main hull — filled circle (primary body)
    ctx.fillStyle = '#1e2d4a';
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fill();

    // Hull surface gradient highlight
    const grad = ctx.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, 28);
    grad.addColorStop(0, 'rgba(140, 200, 255, 0.30)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fill();

    // Hull edge rim
    ctx.strokeStyle = '#3a5580';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.stroke();

    // Porthole window — left
    ctx.fillStyle = '#0a1830';
    ctx.beginPath();
    ctx.arc(cx - 11, cy - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(80, 220, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(cx - 11, cy - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    // Porthole glint
    ctx.fillStyle = 'rgba(200, 240, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Porthole window — right
    ctx.fillStyle = '#0a1830';
    ctx.beginPath();
    ctx.arc(cx + 11, cy - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(80, 220, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(cx + 11, cy - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    // Porthole glint
    ctx.fillStyle = 'rgba(200, 240, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(cx + 10, cy - 7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Central reactor core
    ctx.fillStyle = '#0d1f3a';
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(64, 255, 200, 0.65)';
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    // Core pulse glow
    ctx.strokeStyle = 'rgba(64, 255, 200, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawDestroyedBase(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Shattered outer ring fragments
    ctx.strokeStyle = '#2a3344';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0.3, 1.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 2.0, 2.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 3.8, 4.7);
    ctx.stroke();

    // Destroyed hull — dark cracked sphere
    ctx.fillStyle = '#141e30';
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a3040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.stroke();

    // Crack lines across hull
    ctx.strokeStyle = '#0a1020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 18);
    ctx.lineTo(cx + 4, cy + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 8, cy - 14);
    ctx.lineTo(cx - 6, cy + 12);
    ctx.stroke();

    // Dead porthole windows — dark
    ctx.fillStyle = '#050d18';
    ctx.beginPath();
    ctx.arc(cx - 11, cy - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050d18';
    ctx.beginPath();
    ctx.arc(cx + 11, cy - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Floating debris chunks around (cx, cy)
    ctx.fillStyle = '#2a3344';
    ctx.beginPath();
    ctx.arc(cx - 32, cy + 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 30, cy - 14, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 8, cy + 36, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 18, cy + 32, 4, 0, Math.PI * 2);
    ctx.fill();

    // Flame / explosion glow remnant
    ctx.fillStyle = 'rgba(255, 80, 0, 0.20)';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHealthBar(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const barWidth = 90;
    const barHeight = 10;
    const barX = cx - barWidth / 2;
    const barY = cy - 72;
    const ratio = this.hp / BASE_MAX_HP;

    // Background track
    ctx.fillStyle = '#222';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    ctx.fillStyle = '#444';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Filled portion — green → yellow → red
    const r = Math.round(255 * (1 - ratio));
    const g = Math.round(220 * ratio);
    ctx.fillStyle = `rgb(${r},${g},0)`;
    ctx.fillRect(barX, barY, Math.round(barWidth * ratio), barHeight);

    // Border
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // HP label
    ctx.fillStyle = '#aaaacc';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`HP ${this.hp}/${BASE_MAX_HP}`, cx, barY - 5);
    ctx.textAlign = 'left';
  }
}
