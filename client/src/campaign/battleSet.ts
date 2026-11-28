import { Color3, Color4, Mesh, MeshBuilder, type Scene, StandardMaterial, TransformNode } from '../render/babylon.ts';
import { CASTLE, LONGSHIP, type MapId, mapStructures, SEWERS, terrainHeightAt, type TimeOfDay, type UnitView } from '@tumblehorde/shared';
import type { ArmyPalette } from '../visualConfig.ts';
import { animatePerson, createPersonRig, type PersonRig, startCheer, startSwing } from '../render/rigs.ts';
import { buildLongship, buildSea, LONGSHIP_LOOK } from '../render/longship.ts';
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
  figureFirstId: 6000,
  greek: { body: '#2E5AA8', trim: '#E8E0CC', name: 'greek' },
  greekBlue: '#2E5AA8',
  white: '#F2EEE4',
  stone: '#8E887A',
  earth: '#0E0C0A',
  brickFloor: '#6A5444',
  brick: '#7A604A',
  sewage: '#34483C',
  pipe: '#6A5A48',
  puddle: '#3A5044',
  rockMass: '#3A3028',
  sewerLight: 0.8,
  sewerFog: '#2A2018',
  sewerFogStart: 30,
  sewerFogEnd: 80,
  swingRate: 0.8,
  climbRate: 1.3,
  climbHeight: 1.4,
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

  private readonly watchers: { rig: PersonRig; x: number; y: number; z: number; yaw: number; front: boolean; phase: number; still?: boolean; fights?: boolean; climbs?: boolean }[] = [];
  /** Map meshes hidden under a set that replaces them (the sea under the longship). */
  private readonly hidden: { isVisible: boolean }[] = [];
  private nextFigureId = SET_DECOR.figureFirstId;

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
      sewers?: boolean;
      longship?: boolean;
    },
  ) {
    this.world = world;
    this.root = new TransformNode('battle-set', world.scene);
    setTimeOfDay(world, map, time);
    if (options.burning) this.setHousesAlight(map, options.burning === true ? null : options.burning);
    for (const t of options.torches) this.addTorch(map, t.x, t.z);
    if (options.ring) this.addRing(map, options.ring);
    if (options.siege) this.addSiege(map);
    if (options.sewers) this.addSewers();
    if (options.longship) this.addLongship();
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
      if (!w.still && w.rig.cheerAge === null && Math.sin(this.time * SET_DECOR.cheerRate + w.phase) > SET_DECOR.cheerThreshold) startCheer(w.rig, 0, 0);
      // Fighters on the ship's ends strike again and again; the dead heave themselves over the rail.
      const beat = Math.floor(this.time * SET_DECOR.swingRate + w.phase);
      if (w.fights && beat !== Math.floor((this.time - dt) * SET_DECOR.swingRate + w.phase)) startSwing(w.rig, 'sword', false);
      if (w.climbs) view.y = w.y + Math.abs(Math.sin(this.time * SET_DECOR.climbRate + w.phase)) * SET_DECOR.climbHeight;
      animatePerson(w.rig, view, { dt, now: this.time, mounted: false, feasting: false, displayYaw: w.yaw });
    }
  }

  /** A soldier set into the scenery (on a ladder, on the wall): a real battle body, standing still. */
  private addFigure(map: MapId, look: string, x: number, y: number, z: number, yaw: number, palette: ArmyPalette, shieldUp: boolean, act: { fights?: boolean; climbs?: boolean } = {}): void {
    const rig = createPersonRig(this.world.scene, this.world.parts, 'swordsman', palette, 'roman', this.nextFigureId++, look);
    rig.root.parent = this.root;
    this.watchers.push({ rig, x, y: terrainHeightAt(map, x, z) + y, z, yaw, front: shieldUp, phase: this.nextFigureId * 0.7, still: true, ...act });
  }

  /**
   * The longship at sea. The map's own ground is hidden: the deck is the ground. Beyond the shield
   * walls at bow and stern the Vikings and the Mongols (or the legion) hold off the dead, who keep
   * dragging themselves over the rails.
   */
  private addLongship(): void {
    for (const mesh of this.world.mapRoot?.getChildMeshes() ?? []) {
      if (!mesh.isVisible) continue;
      mesh.isVisible = false;
      this.hidden.push(mesh);
    }
    const g = new TransformNode('longship', this.world.scene);
    g.parent = this.root;
    buildLongship(this.world.parts, g);
    buildSea(this.world.parts, g);
    const { halfLength: L, halfWidth: W } = LONGSHIP;
    const parts = this.world.parts;
    for (const dir of [-1, 1]) {
      // The shield wall across the deck.
      for (let z = -W + 0.5; z < W; z += 0.9) {
        parts.part('disc', LONGSHIP_LOOK.shields[Math.round(z + W) % LONGSHIP_LOOK.shields.length] ?? LONGSHIP_LOOK.shields[0], g, [1.1, 0.12, 1.1], [dir * (L + 0.3), 0.6, z]).rotation.z = Math.PI / 2;
      }
      // Our men behind it, facing out, and the dead coming at them from the end of the ship.
      for (let i = 0; i < 8; i++) {
        const x = dir * (L + 1.6 + (i % 2) * 1.5);
        const z = -W + 1 + Math.floor(i / 2) * ((W * 2 - 2) / 3);
        const look = i % 3 === 0 ? 'mongol' : 'viking';
        this.addFigure('longship', look, x, 0, z, dir * (Math.PI / 2), SET_DECOR.legion, i % 2 === 0, { fights: true });
      }
      for (let i = 0; i < 6; i++) {
        const z = -W + 1.2 + i * ((W * 2 - 2.4) / 5);
        this.addFigure('longship', 'risen', dir * (L + 5 + (i % 2)), 0, z, -dir * (Math.PI / 2), SET_DECOR.legion, false, { fights: true });
      }
      // More of them hauling themselves up the hull out of the sea.
      for (let i = 0; i < 4; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        this.addFigure('longship', 'risen', dir * (L + 2 + i * 1.6), LONGSHIP_LOOK.seaLevel, side * (W + 0.9), side * Math.PI, SET_DECOR.legion, false, { climbs: true });
      }
    }
    // The dead in the water all round, swimming for the ship.
    for (let i = 0; i < 10; i++) {
      const x = -L + (i * 7.3) % (L * 2);
      const side = i % 2 === 0 ? 1 : -1;
      this.addFigure('longship', 'risen', x, LONGSHIP_LOOK.seaLevel - 1.1, side * (W + 4 + (i % 3) * 2.5), side * Math.PI, SET_DECOR.legion, false, { climbs: true });
    }
  }

  /**
   * The siege: the gate smashed in (doors on the ground, rubble, the ram in the gateway), ladders
   * on the walls with men climbing them, Greek banners, braziers and spearmen on the wall tops.
   */
  private addSiege(map: MapId): void {
    const parts = this.world.parts;
    const outer = CASTLE.west - CASTLE.wallThickness / 2;
    const top = CASTLE.wallHeight;
    const g = new TransformNode('siege', this.world.scene);
    g.parent = this.root;
    const at = (x: number, z: number): number => terrainHeightAt(map, x, z);
    // Ladders: thick poles, leaning onto the wall top.
    const lean = 0.28;
    const length = top / Math.cos(lean) + 0.8;
    for (const z of [-16, -10, 10, 16]) {
      const ladder = new TransformNode('ladder', this.world.scene);
      ladder.parent = g;
      ladder.position.set(outer - Math.tan(lean) * top - 0.3, at(outer - 3, z), z);
      ladder.rotation.z = -lean;
      for (const side of [-0.45, 0.45]) parts.part('box', SET_DECOR.wood, ladder, [0.2, length, 0.2], [0, length / 2, side]);
      for (let i = 0; i < 10; i++) parts.part('box', SET_DECOR.darkWood, ladder, [0.14, 0.12, 0.9], [0, 0.6 + i * (length / 10.5), 0], { castShadow: false });
      // A man halfway up, another waiting at the foot.
      this.addFigure(map, z % 4 === 0 ? 'viking' : 'legionary', outer - Math.tan(lean) * 3.6 - 0.5, 3.6, z, Math.PI / 2, SET_DECOR.legion, false);
      this.addFigure(map, 'legionary', outer - Math.tan(lean) * top - 1.6, 0, z + 0.9, Math.PI / 2, SET_DECOR.legion, true);
    }
    // The gate, smashed: the doors flat on the ground, splinters and stones, the ram still in the gateway.
    for (const side of [-1, 1]) {
      const door = parts.part('box', SET_DECOR.darkWood, g, [0.4, 0.3, CASTLE.gateHalf * 1.1], [CASTLE.west + 1.5 + side * 0.4, at(CASTLE.west, 0) + 0.2, side * 1.6]);
      door.rotation.y = side * 0.4;
      door.rotation.z = 0.08;
    }
    for (let i = 0; i < 14; i++) {
      parts.part('rock', SET_DECOR.stone, g, [0.5 + (i % 3) * 0.25, 0.3, 0.45], [CASTLE.west - 1 + (i % 5) * 0.9, at(CASTLE.west, 0) + 0.15, -2.6 + (i * 0.37) % 5.2], { castShadow: false });
      parts.part('box', SET_DECOR.wood, g, [0.1, 0.08, 0.7 + (i % 3) * 0.3], [CASTLE.west + (i % 4) * 0.7, at(CASTLE.west, 0) + 0.05, -2 + (i * 0.53) % 4], { castShadow: false }).rotation.y = i;
    }
    const ram = new TransformNode('ram', this.world.scene);
    ram.parent = g;
    ram.position.set(outer - 2.2, at(outer - 2.2, 0), 0);
    parts.part('box', SET_DECOR.wood, ram, [4.6, 0.3, 2.2], [0, 0.7, 0]);
    for (const x of [-1.8, 1.8]) for (const z of [-1.2, 1.2]) parts.part('disc', SET_DECOR.darkWood, ram, [0.9, 0.2, 0.9], [x, 0.45, z]).rotation.x = Math.PI / 2;
    for (const x of [-2, 2]) for (const z of [-1, 1]) parts.part('box', SET_DECOR.darkWood, ram, [0.2, 2.2, 0.2], [x, 1.8, z]);
    for (const side of [-1, 1]) parts.part('box', SET_DECOR.hide, ram, [4.8, 0.12, 1.5], [0, 3.1, side * 0.6]).rotation.x = side * 0.5;
    parts.part('cylinder', SET_DECOR.log, ram, [0.32, 5.4, 0.32], [1.4, 1.4, 0]).rotation.z = Math.PI / 2;
    parts.part('box', SET_DECOR.iron, ram, [0.5, 0.7, 0.7], [4.1, 1.4, 0], { metal: true });
    // Greek banners on the gate towers, braziers burning on the walls, spearmen along the top.
    for (const z of [-CASTLE.gateHalf - 3, CASTLE.gateHalf + 3, -CASTLE.halfDepth, CASTLE.halfDepth]) {
      parts.part('box', SET_DECOR.darkWood, g, [0.14, 4, 0.14], [CASTLE.west, at(CASTLE.west, z) + CASTLE.gateTowerHeight + 2, z]);
      parts.part('box', SET_DECOR.greekBlue, g, [0.08, 1.8, 2.4], [CASTLE.west - 0.2, at(CASTLE.west, z) + CASTLE.gateTowerHeight + 2.8, z + 1.2], { castShadow: false });
      parts.part('box', SET_DECOR.white, g, [0.09, 0.4, 2.4], [CASTLE.west - 0.22, at(CASTLE.west, z) + CASTLE.gateTowerHeight + 2.8, z + 1.2], { castShadow: false });
    }
    for (const z of [-12, 12]) this.addFlame(CASTLE.west, at(CASTLE.west, z) + top + 0.4, z, 0.7);
    for (const z of [-19, -13, -7, 7, 13, 19]) this.addFigure(map, 'hoplite', CASTLE.west + 0.4, top, z, -Math.PI / 2, SET_DECOR.greek, true);
    // Smoke from where the gate was fired.
    for (let k = 0; k < 4; k++) this.addSmoke(CASTLE.west - 0.5, at(CASTLE.west, 0) + top + 1, (k - 1.5) * 1.2, k / 4);
  }

  /**
   * The sewers: a brick floor with a channel of black water down each tunnel, massive stone over the
   * walls, arches across the tunnels every few paces, pipes and grates and puddles.
   */
  private addSewers(): void {
    const parts = this.world.parts;
    const { halfLength: L, halfWidth: W, walls, height } = SEWERS;
    const g = new TransformNode('sewers', this.world.scene);
    g.parent = this.root;
    // Torchlight, not moonlight: warm, close, and the far end of the tunnel lost in brown murk.
    this.world.hemi.intensity = SET_DECOR.sewerLight;
    this.world.scene.fogColor = Color3.FromHexString(SET_DECOR.sewerFog);
    this.world.scene.fogStart = SET_DECOR.sewerFogStart;
    this.world.scene.fogEnd = SET_DECOR.sewerFogEnd;
    parts.part('box', SET_DECOR.earth, g, [L * 6, 0.1, W * 10], [0, 0.01, 0], { castShadow: false });
    parts.part('box', SET_DECOR.brickFloor, g, [L * 2, 0.06, W * 2], [0, 0.04, 0], { castShadow: false });
    const lanes = [-W, ...walls, W];
    for (let i = 0; i < lanes.length - 1; i++) {
      const z0 = lanes[i] ?? 0;
      const z1 = lanes[i + 1] ?? 0;
      const mid = (z0 + z1) / 2;
      parts.part('box', SET_DECOR.sewage, g, [L * 2, 0.04, 1.4], [0, 0.08, mid], { castShadow: false });
      for (let x = -L + 3; x < L; x += 6) {
        // An arch over the tunnel.
        parts.part('box', SET_DECOR.brick, g, [0.8, 0.7, z1 - z0], [x, height + 0.1, mid]);
        if ((x + i * 7) % 18 === 3) parts.part('box', SET_DECOR.pipe, g, [3, 0.35, 0.35], [x + 1.5, 2.6, z0 + 0.7], { metal: true, castShadow: false });
        if ((x + i * 5) % 24 === 9) parts.part('box', SET_DECOR.puddle, g, [1.6, 0.03, 1], [x, 0.07, mid + 1.6], { castShadow: false });
      }
    }
    // Massive stone over every wall, so the tunnels read as tunnels, not a maze in a field.
    for (const z of [-W, ...walls, W]) parts.part('box', SET_DECOR.rockMass, g, [L * 2 + 2, 2.2, 3.2], [0, height + 1.1, z]);
    for (const x of [-L, L]) parts.part('box', SET_DECOR.rockMass, g, [3.2, 2.2, W * 2 + 2], [x, height + 1.1, 0]);
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
    for (const mesh of this.hidden) mesh.isVisible = true;
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
