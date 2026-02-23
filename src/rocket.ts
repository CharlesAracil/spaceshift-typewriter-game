import { releaseWord } from './words.ts';

export class Rocket {
  x: number;
  y: number;
  private vx: number;
  private vy: number;
  readonly word: string;
  readonly size: 'small' | 'large';
  destroyed: boolean = false;
  isTargeted: boolean = false;
  typedCount: number = 0;

  constructor(
    x: number,
    y: number,
    word: string,
    targetX: number,
    targetY: number,
    speed: number,
    size: 'small' | 'large' = 'small',
  ) {
    this.x = x;
    this.y = y;
    this.word = word;
    this.size = size;
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
  }

  update(delta: number): void {
    this.x += this.vx * (delta / 1000);
    this.y += this.vy * (delta / 1000);
  }

  hasReachedBase(canvas: HTMLCanvasElement): boolean {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const dx = this.x - cx;
    const dy = this.y - cy;
    return Math.sqrt(dx * dx + dy * dy) < 32;
  }

  destroy(): void {
    this.destroyed = true;
    releaseWord(this.word);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const angle = Math.atan2(this.vy, this.vx);
    // Small: uniform 70% scale. Large: 130% wide, 110% tall (squatter proportions).
    const scaleX = this.size === 'small' ? 0.7 : 1.3;
    const scaleY = this.size === 'small' ? 0.7 : 1.1;

    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(angle);
    ctx.scale(scaleX, scaleY);
    if (this.isTargeted) {
      // Yellow glow behind rocket body when targeted
      ctx.fillStyle = 'rgba(255, 230, 0, 0.45)';
      ctx.fillRect(-26, -14, 52, 28);
    }
    this.drawBody(ctx);
    ctx.restore();

    // Word label is always horizontal for readability
    this.drawLabel(ctx);
  }

  private drawBody(ctx: CanvasRenderingContext2D): void {
    // Flame (behind/left of rocket body) — same for both sizes
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(-28, -8, 16, 16);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(-24, -6, 10, 12);
    ctx.fillStyle = '#ffffaa';
    ctx.fillRect(-22, -4, 6, 8);

    if (this.size === 'small') {
      // Fins — cool dark blue
      ctx.fillStyle = '#112266';
      ctx.fillRect(-20, -18, 12, 10); // top fin
      ctx.fillRect(-20, 8, 12, 10);   // bottom fin

      // Main body (blue/cyan)
      ctx.fillStyle = '#2255cc';
      ctx.fillRect(-20, -8, 40, 16);

      // Top highlight stripe
      ctx.fillStyle = '#4477ee';
      ctx.fillRect(-20, -8, 40, 3);

      // Nose cone — standard stepped/pixel style, blue tones
      ctx.fillStyle = '#3366ee';
      ctx.fillRect(20, -6, 10, 12);
      ctx.fillStyle = '#5588ff';
      ctx.fillRect(30, -4, 8, 8);
      ctx.fillStyle = '#aabbff';
      ctx.fillRect(38, -2, 4, 4);
    } else {
      // Large: deep red, taller/wider fins for stockier look
      ctx.fillStyle = '#881111';
      ctx.fillRect(-20, -20, 14, 12); // top fin — taller and wider
      ctx.fillRect(-20, 8, 14, 12);   // bottom fin — taller and wider

      // Main body (deep red)
      ctx.fillStyle = '#cc2222';
      ctx.fillRect(-20, -8, 40, 16);

      // Top highlight stripe
      ctx.fillStyle = '#ee4444';
      ctx.fillRect(-20, -8, 40, 3);

      // Nose cone — shorter/stubbier for stocky look
      ctx.fillStyle = '#ee3333';
      ctx.fillRect(20, -6, 8, 12);  // shorter first step
      ctx.fillStyle = '#ff5555';
      ctx.fillRect(28, -4, 6, 8);
      ctx.fillStyle = '#ffaaaa';
      ctx.fillRect(34, -2, 4, 4);
    }

    // Porthole window — same for both sizes
    ctx.fillStyle = '#22ddff';
    ctx.fillRect(0, -6, 12, 12);
    ctx.fillStyle = '#88eeff';
    ctx.fillRect(2, -4, 8, 8);
    ctx.fillStyle = '#ccf8ff';
    ctx.fillRect(3, -3, 3, 3); // glint
  }

  private drawLabel(ctx: CanvasRenderingContext2D): void {
    ctx.font = '8px "Press Start 2P", monospace';

    const labelX = Math.round(this.x);
    // Offset label vertically to clear the rocket body based on size
    const labelOffset = this.size === 'small' ? 22 : 36;
    const labelY = Math.round(this.y) - labelOffset;
    const totalWidth = Math.ceil(ctx.measureText(this.word).width);
    const startX = labelX - Math.round(totalWidth / 2);

    // Background — highlighted border when targeted
    if (this.isTargeted) {
      ctx.fillStyle = 'rgba(255, 220, 0, 0.2)';
      ctx.fillRect(startX - 4, labelY - 14, totalWidth + 8, 20);
      ctx.strokeStyle = '#ffdd00';
      ctx.lineWidth = 2;
      ctx.strokeRect(startX - 4, labelY - 14, totalWidth + 8, 20);
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(startX - 3, labelY - 13, totalWidth + 6, 18);
    }

    // Word text: typed portion in green, remainder in white
    ctx.textAlign = 'left';
    if (this.typedCount > 0) {
      const typed = this.word.slice(0, this.typedCount);
      const remaining = this.word.slice(this.typedCount);
      const typedWidth = Math.ceil(ctx.measureText(typed).width);
      ctx.fillStyle = '#44ff88';
      ctx.fillText(typed, startX, labelY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(remaining, startX + typedWidth, labelY);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.word, startX, labelY);
    }
    ctx.textAlign = 'left';
  }
}
