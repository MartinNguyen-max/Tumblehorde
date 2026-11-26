import {
  CASTLE,
  distanceXZ,
  inWater,
  lineOfSight,
  MAP,
  MAPS,
  type MapId,
  mapStructures,
  type MatchView,
  PERCEPTION,
  type UnitView,
} from '@tumblehorde/shared';
import { paletteForArmy } from '../palettes.ts';
import { COLORS, MINIMAP } from '../visualConfig.ts';

/**
 * A small map in the top left corner: buildings and water, every army as colored dots, and an
 * arrow for you pointing where you look. In the city only enemies your army can see are shown.
 */
export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement | null = null;
  private map: MapId | null = null;
  private redrawTimer = 0;
  /** Enemies seen at the last sight check (city only), by id. */
  private seen = new Set<number>();
  private sightTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = MINIMAP.size * window.devicePixelRatio;
    canvas.height = MINIMAP.size * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D canvas');
    this.ctx = ctx;
  }

  private toCanvas(x: number, z: number): [number, number] {
    const scale = this.canvas.width / MAP.size;
    return [(x + MAP.halfSize) * scale, (MAP.halfSize - z) * scale];
  }

  setMap(map: MapId): void {
    this.map = map;
    this.background = this.drawBackground(map);
  }

  /** Buildings and water never change: drawn once per map. */
  private drawBackground(map: MapId): HTMLCanvasElement {
    const bg = document.createElement('canvas');
    bg.width = this.canvas.width;
    bg.height = this.canvas.height;
    const ctx = bg.getContext('2d');
    if (!ctx) return bg;
    const scale = bg.width / MAP.size;
    ctx.fillStyle = MINIMAP.ground;
    ctx.fillRect(0, 0, bg.width, bg.height);
    if (MAPS[map].layout === 'siege') {
      ctx.fillStyle = COLORS.water;
      const step = 2;
      for (let x = CASTLE.centerX - CASTLE.moatOuter; x <= CASTLE.centerX + CASTLE.moatOuter; x += step) {
        for (let z = -CASTLE.moatOuter; z <= CASTLE.moatOuter; z += step) {
          if (!inWater(map, x, z)) continue;
          const [px, py] = this.toCanvas(x, z);
          ctx.fillRect(px - (step * scale) / 2, py - (step * scale) / 2, step * scale + 0.5, step * scale + 0.5);
        }
      }
    }
    ctx.fillStyle = MINIMAP.building;
    for (const s of mapStructures(map)) {
      const [px, py] = this.toCanvas(s.x, s.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(s.yaw);
      ctx.fillRect((-s.width / 2) * scale, (-s.depth / 2) * scale, s.width * scale, s.depth * scale);
      ctx.restore();
    }
    return bg;
  }

  /** In the city, an enemy shows only if you or one of your soldiers has it in sight. */
  private updateSight(view: MatchView, myArmyId: number): void {
    this.seen.clear();
    if (!this.map) return;
    const map = this.map;
    const mine = view.units.filter((u) => u.alive && u.armyId === myArmyId && u.kind !== 'horse');
    for (const u of view.units) {
      if (!u.alive || u.kind === 'horse' || u.armyId === myArmyId) continue;
      const watcher = mine.find((m) => distanceXZ(m, u) <= PERCEPTION.sightRange && lineOfSight(map, m, u));
      if (watcher) this.seen.add(u.id);
    }
  }

  update(view: MatchView, myArmyId: number, lookYaw: number, dt: number): void {
    if (!this.map || !this.background) return;
    this.redrawTimer -= dt;
    this.sightTimer -= dt;
    if (this.redrawTimer > 0) return;
    this.redrawTimer = MINIMAP.redrawEvery;
    const fog = MAPS[this.map].layout === 'city';
    if (fog && this.sightTimer <= 0) {
      this.sightTimer = MINIMAP.sightEvery;
      this.updateSight(view, myArmyId);
    }
    const ctx = this.ctx;
    ctx.drawImage(this.background, 0, 0);
    const allies = new Set(view.armies[myArmyId]?.allies ?? []);
    const myTeam = view.armies[myArmyId]?.team;
    const dot = MINIMAP.dot * window.devicePixelRatio;
    let me: UnitView | null = null;
    for (const u of view.units) {
      if (!u.alive || u.kind === 'horse') continue;
      const friendly = u.armyId === myArmyId || allies.has(u.armyId) || view.armies[u.armyId]?.team === myTeam;
      if (fog && !friendly && !this.seen.has(u.id)) continue;
      if (u.kind === 'commander' && u.armyId === myArmyId) {
        me = u;
        continue;
      }
      const [px, py] = this.toCanvas(u.x, u.z);
      ctx.fillStyle = paletteForArmy(view.armies, u.armyId, view.mode).body;
      const size = u.kind === 'commander' ? dot * 1.8 : dot;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
    }
    if (me) this.drawMe(me, lookYaw);
  }

  /** You: a white arrow pointing where you look. */
  private drawMe(me: UnitView, lookYaw: number): void {
    const ctx = this.ctx;
    const [px, py] = this.toCanvas(me.x, me.z);
    const r = MINIMAP.arrow * window.devicePixelRatio;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(lookYaw);
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
}
