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

    // Hit flash: red overlay that fades out
    if (this.hitFlashTimer > 0) {
      const alpha = (this.hitFlashTimer / HIT_FLASH_DURATION_MS) * 0.6;
      ctx.fillStyle = `rgba(255,50,50,${alpha.toFixed(2)})`;
      ctx.fillRect(cx - 36, cy - 56, 72, 82);
    }

    this.drawHealthBar(ctx, cx, cy);
  }

  private drawBase(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Main body
    ctx.fillStyle = '#3355bb';
    ctx.fillRect(cx - 30, cy - 20, 60, 50);

    // Tower
    ctx.fillStyle = '#2244aa';
    ctx.fillRect(cx - 14, cy - 44, 28, 28);

    // Battlements (pixel-art top)
    ctx.fillStyle = '#4466cc';
    ctx.fillRect(cx - 14, cy - 52, 8, 10);
    ctx.fillRect(cx - 2, cy - 52, 8, 10);
    ctx.fillRect(cx + 8, cy - 52, 8, 10);

    // Window/aperture
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(cx - 6, cy - 38, 12, 10);

    // Door
    ctx.fillStyle = '#111122';
    ctx.fillRect(cx - 8, cy + 10, 16, 20);

    // Pixel highlight (top-left edge)
    ctx.fillStyle = '#6688ee';
    ctx.fillRect(cx - 30, cy - 20, 2, 50);
    ctx.fillRect(cx - 14, cy - 44, 2, 28);
  }

  private drawDestroyedBase(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Rubble pile
    ctx.fillStyle = '#444455';
    ctx.fillRect(cx - 30, cy + 10, 60, 20);

    // Broken walls
    ctx.fillStyle = '#333344';
    ctx.fillRect(cx - 28, cy - 10, 20, 22);
    ctx.fillRect(cx + 10, cy - 5, 18, 17);

    // Charred / crumbled top
    ctx.fillStyle = '#222233';
    ctx.fillRect(cx - 12, cy - 18, 10, 12);
    ctx.fillRect(cx + 4, cy - 14, 8, 9);

    // Debris dots
    ctx.fillStyle = '#555566';
    ctx.fillRect(cx - 36, cy + 22, 4, 4);
    ctx.fillRect(cx + 28, cy + 20, 6, 4);
    ctx.fillRect(cx - 4, cy + 26, 4, 4);

    // Flame-hint (orange tint at ruins)
    ctx.fillStyle = 'rgba(255, 80, 0, 0.25)';
    ctx.fillRect(cx - 14, cy - 10, 28, 24);
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
