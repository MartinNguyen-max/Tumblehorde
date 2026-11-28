import { Color3, Color4, Mesh, MeshBuilder, type Scene, StandardMaterial, TransformNode } from '../render/babylon.ts';
import { CASTLE, type MapId, mapStructures, terrainHeightAt, type TimeOfDay, type UnitView } from '@tumblehorde/shared';
import { animatePerson, createPersonRig, type PersonRig, startCheer } from '../render/rigs.ts';
import { FIRE, LIGHTING, MAP_THEMES, TIME_OF_DAY } from '../visualConfig.ts';
import type { World } from '../render/world.ts';

/**
 * The look of a story battle beyond its map: dusk or night, flames on the burning village's
 * houses, torches round a night camp. Built when the battle starts, undone when it ends.
 */
/** The story's set pieces in battle: the duel's ring of legionaries, the siege's ladders and ram. */
const SET_DECOR = {
  legion: { body: '#B8322A', trim: '#E0B040', name: 'legion' },
  /** Unit ids for the ring's rigs, far above any real unit's, so their looks vary but never clash. */
  ringFirstId: 5000,
  ringRowGap: 1.3,
  ringSpacing: 1.05,
  cheerRate: 0.9,
  cheerThreshold: 0.92,
  wood: '#8A5A32',
  darkWood: '#5E3E22',
  log: '#6A4A2A',
  hide: '#8A6A48',
  iron: '#3A3A3E',
} as const;

/** A soldier standing still in the ring: shield up in the front row, spear on the shoulder behind. */
function standingView(x: number, y: number, z: number, yaw: number, shieldUp: boolean): UnitView {
  return {
    id: 0, kind: 'swordsman', armyId: 0, x, y, z, yaw, vx: 0, vy: 0, vz: 0, hp: 1, maxHp: 1, alive: true, onGround: true,
    shieldUp, stunTimer: 0, action: 'none', actionTimer: 0, invulnerable: false, mountId: null, riderId: null,
    respawnTimer: 0, group: 0, weapon: 'spear', drunk: false, crouching: false, hero: null,
  };
}

export class BattleSet {
  private readonly root: TransformNode;
  private readonly flames: Mesh[] = [];
  /** Puffs of smoke rising from the fires, each with its own age. */
  private readonly smoke: { puff: Mesh; from: { x: number; y: number; z: number }; age: number }[] = [];
  private readonly world: World;
  private time = 0;

  private readonly watchers: { rig: PersonRig; x: number; y: number; z: number; yaw: number; front: boolean; phase: number }[] = [];

  /**
   * `burning`: every house, or only those within `radius` of a spot (a whole city alight would be too much).
   * `ring`: soldiers standing in a ring of shields round a duel. `siege`: ladders on the castle wall and a ram at the gate.
   */
  constructor(
    world: World,
    map: MapId,
    time: TimeOfDay,
    options: {
      burning: boolean | { x: number; z: number; radius: number };
      torches: readonly { x: number; z: number }[];
      ring?: { x: number; z: number; radius: number };
      siege?: boolean;
    },
  ) {
    this.world = world;
    this.root = new TransformNode('battle-set', world.scene);
    setTimeOfDay(world, map, time);
    if (options.burning) this.setHousesAlight(map, options.burning === true ? null : options.burning);
    for (const t of options.torches) this.addTorch(map, t.x, t.z);
    if (options.ring) this.addRing(map, options.ring);
    if (options.siege) this.addSiege(map);
  }

  /** Cassian's own legionaries shoulder to shoulder round the duel, shields up, cheering him on. */
  private addRing(map: MapId, ring: { x: number; z: number; radius: number }): void {
    let id = SET_DECOR.ringFirstId;
    for (let row = 0; row < 2; row++) {
      const r = ring.radius + row * SET_DECOR.ringRowGap;
      const count = Math.floor((2 * Math.PI * r) / SET_DECOR.ringSpacing);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + row * 0.15;
        const x = ring.x + Math.sin(a) * r;
        const z = ring.z + Math.cos(a) * r;
        const rig = createPersonRig(this.world.scene, this.world.parts, 'swordsman', SET_DECOR.legion, 'roman', id++, 'legionary');
        rig.root.parent = this.root;
        this.watchers.push({ rig, x, y: terrainHeightAt(map, x, z), z, yaw: a + Math.PI, front: row === 0, phase: i * 0.7 });
      }
    }
  }

  /** The ring cheers in waves; the front row keeps its shields up. */
  private animateWatchers(dt: number): void {
    for (const w of this.watchers) {
      const view = standingView(w.x, w.y, w.z, w.yaw, w.front);
      if (w.rig.cheerAge === null && Math.sin(this.time * SET_DECOR.cheerRate + w.phase) > SET_DECOR.cheerThreshold) startCheer(w.rig, 0, 0);
      animatePerson(w.rig, view, { dt, now: this.time, mounted: false, feasting: false, displayYaw: w.yaw });
    }
  }

  /** Ladders against the castle's west wall, and a covered ram rolled up to the gate. */
  private addSiege(map: MapId): void {
    const parts = this.world.parts;
    const wallX = CASTLE.west - CASTLE.wallThickness / 2;
    for (const z of [-15, -9, 9, 15]) {
      const ladder = new TransformNode('ladder', this.world.scene);
      ladder.parent = this.root;
      ladder.position.set(wallX - 1.6, terrainHeightAt(map, wallX, z), z);
      ladder.rotation.z = -0.32;
      for (const side of [-0.4, 0.4]) parts.part('box', SET_DECOR.wood, ladder, [0.14, CASTLE.wallHeight + 1.6, 0.14], [0, (CASTLE.wallHeight + 1.6) / 2, side]);
      for (let i = 0; i < 9; i++) parts.part('box', SET_DECOR.wood, ladder, [0.1, 0.1, 0.8], [0, 0.6 + i * 0.95, 0], { castShadow: false });
    }
    const ram = new TransformNode('ram', this.world.scene);
    ram.parent = this.root;
    ram.position.set(wallX - 3.2, terrainHeightAt(map, wallX - 3.2, 0), 0);
    parts.part('box', SET_DECOR.wood, ram, [4.6, 0.3, 2.2], [0, 0.7, 0]);
    for (const x of [-1.8, 1.8]) for (const z of [-1.2, 1.2]) parts.part('disc', SET_DECOR.darkWood, ram, [0.9, 0.2, 0.9], [x, 0.45, z]).rotation.x = Math.PI / 2;
    for (const x of [-2, 2]) for (const z of [-1, 1]) parts.part('box', SET_DECOR.darkWood, ram, [0.2, 2.2, 0.2], [x, 1.8, z]);
    for (const side of [-1, 1]) {
      const roof = parts.part('box', SET_DECOR.hide, ram, [4.8, 0.12, 1.5], [0, 3.1, side * 0.6]);
      roof.rotation.x = side * 0.5;
    }
    parts.part('cylinder', SET_DECOR.log, ram, [0.32, 5.4, 0.32], [0.8, 1.4, 0]).rotation.z = Math.PI / 2;
    parts.part('box', SET_DECOR.iron, ram, [0.5, 0.7, 0.7], [3.5, 1.4, 0], { metal: true });
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
    this.animateWatchers(dt);
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
