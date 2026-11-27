import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3, Color4, FreeCamera, type InstancedMesh, type Scene, TransformNode, Vector3 } from '../render/babylon.ts';
import type { PartOptions } from '../render/parts.ts';
import { setShadowArea, type World } from '../render/world.ts';
import { Actor, type ActorLook } from './actor.ts';
import { LIGHTS, type LightName } from './light.ts';

/**
 * Where a cutscene is played: its own little set at the origin, built from the same boxes as
 * the battlefields, with its own camera, light and weather. The battle map is hidden meanwhile
 * and everything is put back on `leave`.
 */

export type Weather = 'none' | 'rain' | 'snow' | 'embers' | 'motes' | 'ash';

const WEATHER = {
  rain: { count: 420, color: '#B8CCE0', size: [0.02, 0.5, 0.02], fall: 16, drift: 1.5, spread: 18, height: 12 },
  snow: { count: 360, color: '#FFFFFF', size: [0.07, 0.07, 0.07], fall: 1.2, drift: 0.6, spread: 18, height: 10 },
  embers: { count: 120, color: '#FF9A3A', size: [0.06, 0.06, 0.06], fall: -1.6, drift: 0.9, spread: 9, height: 7 },
  motes: { count: 90, color: '#FFF2C8', size: [0.035, 0.035, 0.035], fall: -0.08, drift: 0.25, spread: 8, height: 4 },
  ash: { count: 200, color: '#6A6460', size: [0.05, 0.05, 0.05], fall: 0.7, drift: 0.8, spread: 14, height: 9 },
} as const;

const FLAME_COLORS = ['#FFD24A', '#FF9A2E', '#FF5A1E'] as const;
const FIRE_FLICKER = 11;
const FIRE_RANGE = 9;
/** Even a torch lights up the people next to it. */
const FIRE_MIN_RANGE = 6;
const CAMERA_FOV = 0.7;

interface Flake {
  mesh: InstancedMesh;
  phase: number;
}

interface Fire {
  flames: InstancedMesh[];
  light: PointLight;
  base: number;
  size: number;
}

interface SavedLook {
  clear: Color4;
  fog: Color3;
  fogStart: number;
  fogEnd: number;
  hemiDiffuse: Color3;
  hemiGround: Color3;
  hemiIntensity: number;
  sunDiffuse: Color3;
  sunIntensity: number;
  sunDirection: Vector3;
  camera: Scene['activeCamera'];
}

export class Stage {
  readonly world: World;
  readonly root: TransformNode;
  readonly camera: FreeCamera;
  readonly actors = new Map<string, Actor>();
  private readonly fires: Fire[] = [];
  private flakes: Flake[] = [];
  private weatherKind: Weather = 'none';
  private readonly saved: SavedLook;
  private time = 0;
  /** Where weather falls and shadows are sharp; follows the camera's target. */
  focus = new Vector3();

  constructor(world: World) {
    this.world = world;
    const { scene } = world;
    this.saved = {
      clear: scene.clearColor.clone(),
      fog: scene.fogColor.clone(),
      fogStart: scene.fogStart,
      fogEnd: scene.fogEnd,
      hemiDiffuse: world.hemi.diffuse.clone(),
      hemiGround: world.hemi.groundColor.clone(),
      hemiIntensity: world.hemi.intensity,
      sunDiffuse: world.sun.diffuse.clone(),
      sunIntensity: world.sun.intensity,
      sunDirection: world.sun.direction.clone(),
      camera: scene.activeCamera,
    };
    this.root = new TransformNode('stage', scene);
    this.camera = new FreeCamera('cinematic-camera', new Vector3(0, 2, -6), scene);
    this.camera.fov = CAMERA_FOV;
    this.camera.minZ = 0.05;
    this.camera.maxZ = 300;
    this.camera.inputs.clear();
    world.mapRoot?.setEnabled(false);
    scene.activeCamera = this.camera;
  }

  get scene(): Scene {
    return this.world.scene;
  }

  actor(name: string, look: ActorLook): Actor {
    const actor = new Actor(this.scene, this.world.parts, name, look);
    actor.root.parent = this.root;
    this.actors.set(name, actor);
    return actor;
  }

  get(name: string): Actor {
    const actor = this.actors.get(name);
    if (!actor) throw new Error(`no actor ${name} on stage`);
    return actor;
  }

  /** A box of the set: walls, tables, floors. */
  box(color: string, size: readonly [number, number, number], position: readonly [number, number, number], rotationY = 0, options: PartOptions = {}): InstancedMesh {
    const mesh = this.world.parts.part('box', color, this.root, size, position, options);
    mesh.rotation.y = rotationY;
    return mesh;
  }

  /** Any part shape, for trees, rocks and the like. */
  shape(shape: Parameters<World['parts']['part']>[0], color: string, size: readonly [number, number, number], position: readonly [number, number, number], options: PartOptions = {}): InstancedMesh {
    return this.world.parts.part(shape, color, this.root, size, position, options);
  }

  /** A pivot on the set to hang props on, or to move a group of boxes together. */
  group(name: string, x = 0, y = 0, z = 0): TransformNode {
    const node = new TransformNode(name, this.scene);
    node.parent = this.root;
    node.position.set(x, y, z);
    return node;
  }

  ground(color: string, size = 80): void {
    this.box(color, [size, 0.1, size], [0, -0.05, 0], 0, { castShadow: false });
  }

  light(name: LightName): void {
    const preset = LIGHTS[name];
    const { scene, hemi, sun } = this.world;
    scene.clearColor = Color4.FromHexString(`${preset.sky}FF`);
    scene.fogColor = Color3.FromHexString(preset.fog);
    scene.fogStart = preset.fogStart;
    scene.fogEnd = preset.fogEnd;
    hemi.diffuse = Color3.FromHexString(preset.hemiSky);
    hemi.groundColor = Color3.FromHexString(preset.hemiGround);
    hemi.intensity = preset.hemiIntensity;
    sun.diffuse = Color3.FromHexString(preset.sun);
    sun.intensity = preset.sunIntensity;
    sun.direction = new Vector3(...preset.sunDirection).normalize();
  }

  /** A campfire or burning beam: flickering boxes and a warm light. */
  fire(x: number, z: number, size = 1, y = 0): void {
    const flames: InstancedMesh[] = [];
    const parts = this.world.parts;
    FLAME_COLORS.forEach((color, i) => {
      const material = parts.material(color);
      material.emissiveColor = Color3.FromHexString(color);
      material.disableLighting = true;
      for (let k = 0; k < 3; k++) {
        const s = size * (0.5 - i * 0.12) * (0.8 + k * 0.15);
        const mesh = parts.part('box', color, this.root, [s, s * 1.4, s], [x + (k - 1) * size * 0.18, y + s * 0.6 + i * size * 0.2, z + ((k * 7) % 3 - 1) * size * 0.12], { castShadow: false });
        mesh.rotation.y = k * 0.7 + i;
        flames.push(mesh);
      }
    });
    const light = new PointLight(`fire-${this.fires.length}`, new Vector3(x, y + size * 1.2, z), this.scene);
    light.diffuse = Color3.FromHexString('#FF9A4A');
    light.specular = Color3.Black();
    light.range = Math.max(FIRE_MIN_RANGE, FIRE_RANGE * size);
    light.intensity = 1.2;
    light.parent = this.root;
    this.fires.push({ flames, light, base: light.intensity, size });
  }

  weather(kind: Weather): void {
    for (const flake of this.flakes) flake.mesh.dispose();
    this.flakes = [];
    this.weatherKind = kind;
    if (kind === 'none') return;
    const spec = WEATHER[kind];
    const material = this.world.parts.material(spec.color);
    if (kind === 'embers' || kind === 'motes') {
      material.emissiveColor = Color3.FromHexString(spec.color);
      material.disableLighting = true;
    }
    for (let i = 0; i < spec.count; i++) {
      const mesh = this.world.parts.part('box', spec.color, this.root, spec.size, [0, 0, 0], { castShadow: false });
      mesh.position.set((Math.random() - 0.5) * spec.spread * 2, Math.random() * spec.height, (Math.random() - 0.5) * spec.spread * 2);
      this.flakes.push({ mesh, phase: Math.random() * Math.PI * 2 });
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const actor of this.actors.values()) actor.update(dt);
    for (const fire of this.fires) {
      fire.flames.forEach((flame, i) => {
        const wave = Math.sin(this.time * FIRE_FLICKER + i * 1.7) * 0.5 + Math.sin(this.time * FIRE_FLICKER * 1.9 + i) * 0.5;
        flame.scaling.y = Math.abs(flame.scaling.x) * (1.3 + wave * 0.35);
        flame.rotation.y += dt * (i % 2 === 0 ? 1.5 : -1.2);
      });
      fire.light.intensity = fire.base * (0.85 + Math.sin(this.time * FIRE_FLICKER * 1.3) * 0.1 + Math.random() * 0.08);
    }
    this.updateWeather(dt);
    setShadowArea(this.world.sun, this.focus);
  }

  private updateWeather(dt: number): void {
    if (this.weatherKind === 'none') return;
    const spec = WEATHER[this.weatherKind];
    const c = this.focus;
    for (const flake of this.flakes) {
      const p = flake.mesh.position;
      p.y -= spec.fall * dt;
      p.x += Math.sin(this.time * 0.9 + flake.phase) * spec.drift * dt;
      p.z += Math.cos(this.time * 0.7 + flake.phase) * spec.drift * dt * 0.5;
      if (p.y < 0 || p.y > spec.height) {
        p.y = spec.fall > 0 ? spec.height : 0.05;
        p.x = c.x + (Math.random() - 0.5) * spec.spread * 2;
        p.z = c.z + (Math.random() - 0.5) * spec.spread * 2;
      }
    }
  }

  /** Puts the battle world back as it was. */
  dispose(): void {
    const { scene, hemi, sun } = this.world;
    const s = this.saved;
    for (const fire of this.fires) fire.light.dispose();
    for (const actor of this.actors.values()) actor.dispose();
    this.root.dispose();
    this.camera.dispose();
    scene.clearColor = s.clear;
    scene.fogColor = s.fog;
    scene.fogStart = s.fogStart;
    scene.fogEnd = s.fogEnd;
    hemi.diffuse = s.hemiDiffuse;
    hemi.groundColor = s.hemiGround;
    hemi.intensity = s.hemiIntensity;
    sun.diffuse = s.sunDiffuse;
    sun.intensity = s.sunIntensity;
    sun.direction = s.sunDirection;
    scene.activeCamera = s.camera;
    this.world.mapRoot?.setEnabled(true);
  }
}
