const LASER_DURATION_MS = 175; // ~150–200ms

export class LaserBeam {
  private x1: number;
  private y1: number;
  private x2: number;
  private y2: number;
  private elapsed: number;

  constructor(x1: number, y1: number, x2: number, y2: number) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.elapsed = 0;
  }

  update(delta: number): void {
    this.elapsed += delta;
  }

  isDone(): boolean {
    return this.elapsed >= LASER_DURATION_MS;
  }

  // Caller must set up shared state (save/restore, shadowBlur, strokeStyle, lineWidth)
  render(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = Math.max(0, 1 - this.elapsed / LASER_DURATION_MS);
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();
  }
}
