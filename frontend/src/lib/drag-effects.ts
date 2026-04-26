interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
  alpha: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  width: number;
  height: number;
}

interface GlowTarget {
  rect: DOMRect;
  intensity: number;
}

const CYAN = "34,211,238";
const GREEN = "0,255,200";

export class DragEffectsEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private lastTime = 0;

  private ambient: Particle[] = [];
  private readonly AMBIENT_COUNT = 35;

  private trail: Particle[] = [];
  private dragging = false;

  private glow: GlowTarget | null = null;
  private glowIntensity = 0;

  private shockwaves: Shockwave[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.initAmbient();
  }

  resize(w: number, h: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  start(): void {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  onDragStart(mouseX: number, mouseY: number, rect: DOMRect | null): void {
    this.dragging = true;
    this.trail = [];
    if (rect) {
      this.glow = { rect, intensity: 1 };
    }
    this.emitTrailBurst(mouseX, mouseY, 8);
  }

  onDragMove(mouseX: number, mouseY: number, rect: DOMRect | null): void {
    if (!this.dragging) return;
    this.emitTrailParticles(mouseX, mouseY, 2);
    if (rect) {
      this.glow = { rect, intensity: 1 };
    }
  }

  onDragStop(mouseX: number, mouseY: number, rect: DOMRect | null): void {
    this.dragging = false;
    this.emitTrailBurst(mouseX, mouseY, 15);
    if (rect) {
      this.shockwaves.push({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        radius: 0,
        maxRadius: Math.max(rect.width, rect.height) * 1.2,
        life: 1,
        width: rect.width,
        height: rect.height,
      });
    }
    this.glow = null;
  }

  private initAmbient(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.ambient = Array.from({ length: this.AMBIENT_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 8,
      life: 1,
      decay: 0,
      size: 1 + Math.random() * 1.5,
      color: Math.random() > 0.5 ? CYAN : GREEN,
      alpha: 0.15 + Math.random() * 0.2,
    }));
  }

  private emitTrailParticles(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.trail.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 40,
        vy: -20 - Math.random() * 50,
        life: 1,
        decay: 1.5 + Math.random() * 1.0,
        size: 1.5 + Math.random() * 2.5,
        color: CYAN,
        alpha: 0.7 + Math.random() * 0.3,
      });
    }
  }

  private emitTrailBurst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      this.trail.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 1.2 + Math.random() * 0.8,
        size: 2 + Math.random() * 3,
        color: GREEN,
        alpha: 0.8,
      });
    }
  }

  private update(dt: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const p of this.ambient) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0) p.x += w;
      if (p.x > w) p.x -= w;
      if (p.y < 0) p.y += h;
      if (p.y > h) p.y -= h;
      p.alpha = 0.15 + Math.sin(performance.now() * 0.001 + p.x * 0.01) * 0.1;
    }

    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.trail.splice(i, 1);
      }
    }

    if (this.glow) {
      this.glowIntensity += (this.glow.intensity - this.glowIntensity) * 0.15;
    } else {
      this.glowIntensity *= 0.9;
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.maxRadius * dt * 2.5;
      sw.life -= dt * 2;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  private draw(): void {
    const { ctx } = this;
    const w = this.canvas.style.width ? parseInt(this.canvas.style.width) : window.innerWidth;
    const h = this.canvas.style.height ? parseInt(this.canvas.style.height) : window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    this.drawAmbient(ctx);
    this.drawTrail(ctx);
    this.drawGlow(ctx);
    this.drawShockwaves(ctx);
  }

  private drawAmbient(ctx: CanvasRenderingContext2D): void {
    for (const p of this.ambient) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.fill();
    }
  }

  private drawTrail(ctx: CanvasRenderingContext2D): void {
    for (const p of this.trail) {
      const a = p.alpha * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${a})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${a * 0.15})`;
      ctx.fill();
    }
  }

  private drawGlow(ctx: CanvasRenderingContext2D): void {
    if (this.glowIntensity < 0.01) return;
    const g = this.glow;
    if (!g) return;

    const { rect } = g;
    const a = this.glowIntensity;

    ctx.save();
    ctx.shadowColor = `rgba(${CYAN},${0.6 * a})`;
    ctx.shadowBlur = 25 * a;
    ctx.strokeStyle = `rgba(${CYAN},${0.4 * a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rect.left, rect.top, rect.width, rect.height, 8);
    ctx.stroke();
    ctx.restore();

    const cornerLen = 12;
    ctx.strokeStyle = `rgba(${GREEN},${0.7 * a})`;
    ctx.lineWidth = 2;
    const corners = [
      [rect.left, rect.top],
      [rect.right, rect.top],
      [rect.right, rect.bottom],
      [rect.left, rect.bottom],
    ];
    const dirs = [
      [1, 1], [-1, 1], [-1, -1], [1, -1],
    ];
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = corners[i];
      const [dx, dy] = dirs[i];
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * cornerLen);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * cornerLen, cy);
      ctx.stroke();
    }
  }

  private drawShockwaves(ctx: CanvasRenderingContext2D): void {
    for (const sw of this.shockwaves) {
      const a = sw.life * 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(${CYAN},${a})`;
      ctx.lineWidth = 2 * sw.life;
      ctx.shadowColor = `rgba(${CYAN},${a * 0.5})`;
      ctx.shadowBlur = 15 * sw.life;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y, sw.radius, sw.radius * (sw.height / sw.width), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  dispose(): void {
    this.stop();
    this.trail = [];
    this.shockwaves = [];
    this.ambient = [];
  }
}
