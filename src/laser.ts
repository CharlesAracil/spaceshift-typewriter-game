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

  render(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.max(0, 1 - this.elapsed / LASER_DURATION_MS);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#aaffff';
    ctx.strokeStyle = '#aaffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();
    ctx.restore();
  }
}
