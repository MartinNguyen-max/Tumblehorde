import { Color3, Mesh, type Scene, StandardMaterial, type Vector3, VertexData } from './babylon.ts';
import { createRandom, MAP, nextRandom } from '@tumblehorde/shared';
import { SNOW } from '../visualConfig.ts';

/**
 * Falling snow without a particle system: one mesh of many tiny cubes, drawn twice, one above the
 * other, following the camera and sliding down (and a little sideways) on a loop.
 */
export class Snowfall {
  private readonly layers: Mesh[];
  private time = 0;

  /** Not part of the map's frozen scenery: the flakes move every frame. */
  constructor(scene: Scene) {
    const material = new StandardMaterial('snow', scene);
    material.emissiveColor = Color3.FromHexString(SNOW.color);
    material.disableLighting = true;
    const flakes = snowFlakes(scene);
    flakes.material = material;
    flakes.isPickable = false;
    const second = flakes.clone('snow-2');
    this.layers = [flakes, second];
  }

  dispose(): void {
    this.layers[0]?.material?.dispose();
    for (const layer of this.layers) layer.dispose();
  }

  update(dt: number, camera: Vector3): void {
    this.time += dt;
    const fall = (this.time * SNOW.fallSpeed) % SNOW.height;
    const drift = Math.sin(this.time * 0.4) * SNOW.drift * 3;
    // Snap to a grid so the pattern does not swim along with the camera.
    const step = SNOW.radius;
    const x = Math.round(camera.x / step) * step + drift;
    const z = Math.round(camera.z / step) * step;
    this.layers.forEach((layer, i) => layer.position.set(x, camera.y - SNOW.height / 2 - fall + i * SNOW.height, z));
  }
}

/** Tiny cubes scattered through a box twice the snow radius wide and one snow height tall. */
function snowFlakes(scene: Scene): Mesh {
  const rng = createRandom(MAP.seed + 7);
  const positions: number[] = [];
  const indices: number[] = [];
  const s = SNOW.size / 2;
  const corners: [number, number, number][] = [
    [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
    [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s],
  ];
  const faces = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2];
  const span = SNOW.radius * 2;
  for (let f = 0; f < SNOW.flakes; f++) {
    const cx = (nextRandom(rng) - 0.5) * span;
    const cy = nextRandom(rng) * SNOW.height;
    const cz = (nextRandom(rng) - 0.5) * span;
    const base = positions.length / 3;
    for (const [x, y, z] of corners) positions.push(cx + x, cy + y, cz + z);
    for (const i of faces) indices.push(base + i);
  }
  const mesh = new Mesh('snow', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.applyToMesh(mesh);
  return mesh;
}
