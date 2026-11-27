import type { District, Npc, Vec2 } from '@tumblehorde/shared';
import { MINIMAP } from '../visualConfig.ts';

/** The city's minimap: the same corner map as in battle, with a yellow dot for where to go. */
export const CITY_MAP = {
  /** The map shows this much of the city around the middle (meters, half). */
  halfSize: 52,
  ground: 'rgba(120, 112, 98, 0.85)',
  building: 'rgba(196, 106, 68, 0.95)',
  guard: '#C8423A',
  person: 'rgba(240, 234, 220, 0.9)',
  target: '#FFD23A',
  /** The goal dot pulses this fast (per second). */
  pulse: 4,
} as const;

export class CityMap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly background: HTMLCanvasElement;
  private time = 0;
  private redraw = 0;

  constructor(district: District) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'city-map';
    const px = MINIMAP.size * window.devicePixelRatio;
    this.canvas.width = px;
    this.canvas.height = px;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d canvas');
    this.ctx = ctx;
    this.background = this.drawBackground(district);
    document.body.append(this.canvas);
  }

  /** North (-z), where the temple stands and Cassian first looks, is up. */
  private toCanvas(x: number, z: number): [number, number] {
    const scale = this.canvas.width / (CITY_MAP.halfSize * 2);
    return [(CITY_MAP.halfSize - x) * scale, (z + CITY_MAP.halfSize) * scale];
  }

  private drawBackground(district: District): HTMLCanvasElement {
    const bg = document.createElement('canvas');
    bg.width = this.canvas.width;
    bg.height = this.canvas.height;
    const ctx = bg.getContext('2d');
    if (!ctx) return bg;
    ctx.fillStyle = CITY_MAP.ground;
    ctx.fillRect(0, 0, bg.width, bg.height);
    const scale = this.canvas.width / (CITY_MAP.halfSize * 2);
    ctx.fillStyle = CITY_MAP.building;
    for (const f of district.footprints) {
      const [px, py] = this.toCanvas(f.x, f.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(f.yaw);
      ctx.fillRect((-f.width / 2) * scale, (-f.depth / 2) * scale, f.width * scale, f.depth * scale);
      ctx.restore();
    }
    return bg;
  }

  update(dt: number, me: Vec2, lookYaw: number, people: readonly Npc[], target: Vec2 | null): void {
    this.time += dt;
    this.redraw -= dt;
    if (this.redraw > 0) return;
    this.redraw = MINIMAP.redrawEvery;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio;
    ctx.drawImage(this.background, 0, 0);
    const dot = MINIMAP.dot * dpr;
    for (const npc of people) {
      const [px, py] = this.toCanvas(npc.pos.x, npc.pos.z);
      ctx.fillStyle = npc.role === 'guard' ? CITY_MAP.guard : CITY_MAP.person;
      ctx.fillRect(px - dot / 2, py - dot / 2, dot, dot);
    }
    if (target) {
      const [px, py] = this.toCanvas(target.x, target.z);
      const r = (MINIMAP.arrow + Math.sin(this.time * CITY_MAP.pulse) * 1.5) * dpr;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = CITY_MAP.target;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = dpr;
      ctx.fill();
      ctx.stroke();
    }
    this.drawMe(me, lookYaw);
  }

  private drawMe(me: Vec2, lookYaw: number): void {
    const ctx = this.ctx;
    const [px, py] = this.toCanvas(me.x, me.z);
    const r = MINIMAP.arrow * window.devicePixelRatio;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(lookYaw - Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.7, r * 0.8);
    ctx.lineTo(0, r * 0.4);
    ctx.lineTo(-r * 0.7, r * 0.8);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = window.devicePixelRatio;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  dispose(): void {
    this.canvas.remove();
  }
}
