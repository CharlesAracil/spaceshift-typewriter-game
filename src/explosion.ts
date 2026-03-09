interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
}

const PARTICLE_COLORS = [
  '#ff4400', '#ff8800', '#ffcc00', '#ffff88', '#ffffff', '#ff2222',
];

const HEAL_COLORS = ['#44ff88', '#00ff66', '#aaffcc', '#ffffff'];

const FREEZE_COLORS = ['#aaddff', '#66bbff', '#ffffff', '#0088ff'];

export class FreezeBurst {
  private particles: Particle[] = [];

  constructor(x: number, y: number) {
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 50 + Math.random() * 100;
      const life = 500 + Math.random() * 500;
      const colorIndex = Math.floor(Math.random() * FREEZE_COLORS.length);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: FREEZE_COLORS[colorIndex] ?? '#aaddff',
        life,
        maxLife: life,
      });
    }
  }

  update(delta: number): void {
    for (const p of this.particles) {
      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      p.life -= delta;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (this.particles[i]!.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
      }
    }
  }

  isDone(): boolean {
    return this.particles.length === 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }
}

export class HealBurst {
  private particles: Particle[] = [];

  constructor(x: number, y: number) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 40 + Math.random() * 80;
      const life = 600 + Math.random() * 600;
      const colorIndex = Math.floor(Math.random() * HEAL_COLORS.length);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: HEAL_COLORS[colorIndex] ?? '#44ff88',
        life,
        maxLife: life,
      });
    }
  }

  update(delta: number): void {
    for (const p of this.particles) {
      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      p.life -= delta;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (this.particles[i]!.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
      }
    }
  }

  isDone(): boolean {
    return this.particles.length === 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }
}

export class Explosion {
  private particles: Particle[] = [];

  constructor(x: number, y: number) {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 120;
      const life = 400 + Math.random() * 300;
      const colorIndex = Math.floor(Math.random() * PARTICLE_COLORS.length);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: PARTICLE_COLORS[colorIndex] ?? '#ff8800',
        life,
        maxLife: life,
      });
    }
  }

  update(delta: number): void {
    for (const p of this.particles) {
      p.x += p.vx * (delta / 1000);
      p.y += p.vy * (delta / 1000);
      p.life -= delta;
      p.vy += 40 * (delta / 1000); // gravity
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (this.particles[i]!.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1]!;
        this.particles.pop();
      }
    }
  }

  isDone(): boolean {
    return this.particles.length === 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }
}
