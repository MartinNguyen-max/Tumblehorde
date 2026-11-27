import { Color3, Color4, Mesh, MeshBuilder, type Scene, StandardMaterial, TransformNode } from '../render/babylon.ts';
import { type MapId, mapStructures, terrainHeightAt, type TimeOfDay } from '@tumblehorde/shared';
import { FIRE, LIGHTING, MAP_THEMES, TIME_OF_DAY } from '../visualConfig.ts';
import type { World } from '../render/world.ts';

/**
 * The look of a story battle beyond its map: dusk or night, flames on the burning village's
 * houses, torches round a night camp. Built when the battle starts, undone when it ends.
 */
export class BattleSet {
  private readonly root: TransformNode;
  private readonly flames: Mesh[] = [];
  /** Puffs of smoke rising from the fires, each with its own age. */
  private readonly smoke: { puff: Mesh; from: { x: number; y: number; z: number }; age: number }[] = [];
  private readonly world: World;
  private time = 0;

  /** `burning`: every house, or only those within `radius` of a spot (a whole city alight would be too much). */
  constructor(world: World, map: MapId, time: TimeOfDay, options: { burning: boolean | { x: number; z: number; radius: number }; torches: readonly { x: number; z: number }[] }) {
    this.world = world;
    this.root = new TransformNode('battle-set', world.scene);
    setTimeOfDay(world, map, time);
    if (options.burning) this.setHousesAlight(map, options.burning === true ? null : options.burning);
    for (const t of options.torches) this.addTorch(map, t.x, t.z);
  }

  /** Flames on the roof of every house and fires on the ground beside them, licking up and down. */
  private setHousesAlight(map: MapId, near: { x: number; z: number; radius: number } | null): void {
    mapStructures(map)
      .filter((s) => s.kind === 'house' && (!near || Math.hypot(s.x - near.x, s.z - near.z) < near.radius))
      .forEach((s, i) => {
        // A burning heap (hay, a cart, a fence) beside the house.
        const side = i % 2 === 0 ? 1 : -1;
        const gx = s.x + side * (s.width / 2 + FIRE.groundFireGap) * Math.cos(s.yaw);
        const gz = s.z - side * (s.width / 2 + FIRE.groundFireGap) * Math.sin(s.yaw);
        this.addFlame(gx, terrainHeightAt(map, gx, gz), gz, FIRE.groundFlame);
        const ground = terrainHeightAt(map, s.x, s.z);
        for (let k = 0; k < 3; k++) {
          const offset = (k - 1) * Math.min(s.width, s.depth) * 0.3;
          const x = s.x + offset * Math.cos(s.yaw);
          const z = s.z - offset * Math.sin(s.yaw);
          this.addFlame(x, ground + s.height * 0.7, z, FIRE.houseFlame + ((i + k) % 3) * 0.6);
          this.addSmoke(x, ground + s.height + FIRE.houseFlame, z, k / 3);
        }
      });
  }

  private addTorch(map: MapId, x: number, z: number): void {
    const ground = terrainHeightAt(map, x, z);
    const pole = MeshBuilder.CreateBox('torch-pole', { width: 0.12, height: FIRE.torchHeight, depth: 0.12 }, this.world.scene);
    pole.position.set(x, ground + FIRE.torchHeight / 2, z);
    pole.material = this.material('#5A3E2A', false);
    pole.parent = this.root;
    this.addFlame(x, ground + FIRE.torchHeight + 0.15, z, 0.45);
  }

  private addFlame(x: number, y: number, z: number, size: number): void {
    const flame = MeshBuilder.CreateBox('flame', { size: 1 }, this.world.scene);
    flame.scaling.set(size * 0.7, size, size * 0.7);
    flame.position.set(x, y + size / 2, z);
    flame.rotation.y = Math.PI / 4;
    flame.material = this.material(FIRE.flame, true);
    flame.parent = this.root;
    const core = MeshBuilder.CreateBox('flame-core', { size: 1 }, this.world.scene);
    core.scaling.set(0.55, 0.6, 0.55);
    core.position.set(0, -0.15, 0);
    core.material = this.material(FIRE.core, true);
    core.parent = flame;
    this.flames.push(flame);
  }

  private addSmoke(x: number, y: number, z: number, phase: number): void {
    const puff = MeshBuilder.CreateBox('smoke', { size: 1 }, this.world.scene);
    const material = this.material(FIRE.smoke, true);
    material.alpha = FIRE.smokeAlpha;
    puff.material = material;
    puff.parent = this.root;
    puff.isPickable = false;
    this.smoke.push({ puff, from: { x, y, z }, age: phase * FIRE.smokeLife });
  }

  private material(color: string, glowing: boolean): StandardMaterial {
    const m = new StandardMaterial(`set-${color}`, this.world.scene);
    m.diffuseColor = Color3.FromHexString(color);
    if (glowing) {
      m.emissiveColor = Color3.FromHexString(color);
      m.disableLighting = true;
    }
    return m;
  }

  update(dt: number): void {
    this.time += dt;
    for (const s of this.smoke) {
      s.age = (s.age + dt) % FIRE.smokeLife;
      const t = s.age / FIRE.smokeLife;
      s.puff.position.set(s.from.x + t * FIRE.smokeDrift, s.from.y + t * FIRE.smokeRise, s.from.z);
      s.puff.scaling.setAll(0.8 + t * 2.4);
      s.puff.rotation.y = t * 2;
    }
    this.flames.forEach((flame, i) => {
      const flicker = 1 + Math.sin(this.time * FIRE.flicker + i * 1.7) * FIRE.flickerAmount;
      flame.scaling.y = (flame.scaling.x / 0.7) * flicker;
      flame.rotation.y = Math.PI / 4 + Math.sin(this.time * 3 + i) * 0.2;
    });
  }

  dispose(): void {
    this.root.dispose(false, true);
    this.flames.length = 0;
    setTimeOfDay(this.world, this.world.map, 'day');
  }
}

/** Sky, fog and light for the time of day; 'day' puts the map's own colors back. */
export function setTimeOfDay(world: World, map: MapId | null, time: TimeOfDay): void {
  const scene: Scene = world.scene;
  const theme = map ? MAP_THEMES[map] : null;
  if (time === 'day') {
    if (theme) {
      scene.clearColor = Color4.FromHexString(`${theme.sky}FF`);
      scene.fogColor = Color3.FromHexString(theme.fog);
      world.sun.diffuse = Color3.FromHexString(theme.sun);
    }
    world.hemi.intensity = LIGHTING.hemiIntensity;
    world.sun.intensity = LIGHTING.sunIntensity;
    scene.fogStart = LIGHTING.fogStart;
    scene.fogEnd = LIGHTING.fogEnd;
    return;
  }
  const look = TIME_OF_DAY[time];
  scene.clearColor = Color4.FromHexString(`${look.sky}FF`);
  scene.fogColor = Color3.FromHexString(look.fog);
  world.hemi.intensity = look.hemi;
  world.sun.intensity = look.sun;
  world.sun.diffuse = Color3.FromHexString(look.sunColor);
  scene.fogStart = look.fogStart;
  scene.fogEnd = look.fogEnd;
}
