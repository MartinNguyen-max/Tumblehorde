import {
  Color3,
  type InstancedMesh,
  Mesh,
  MeshBuilder,
  type Node,
  type Scene,
  type ShadowGenerator,
  StandardMaterial,
} from './babylon.ts';

/**
 * Everything is faceted (flat-shaded, few sides) so characters sit between blocky and round:
 * chunky and clean like the world, still a bit goofy. Only eyes stay smooth, to read as googly.
 */
export type PartShape =
  | 'box'
  | 'cone'
  | 'cylinder'
  | 'rock'
  | 'bush'
  | 'sphere'
  | 'capsule'
  | 'dome'
  | 'disc'
  | 'torus'
  | 'smoothCone'
  | 'eye';

export interface PartOptions {
  castShadow?: boolean;
  /** Shiny plastic finish, used for characters. */
  gloss?: boolean;
}

const GLOSS_SPECULAR = 0.28;
const GLOSS_POWER = 24;

/**
 * Every visible piece of the world is an instance of a shared source mesh, one per shape,
 * color and finish. Thousands of parts then render in a handful of draw calls.
 */
export class PartFactory {
  private readonly sources = new Map<string, Mesh>();
  private readonly materials = new Map<string, StandardMaterial>();
  private readonly scene: Scene;
  private readonly shadows: ShadowGenerator;

  constructor(scene: Scene, shadows: ShadowGenerator) {
    this.scene = scene;
    this.shadows = shadows;
  }

  material(color: string, gloss = false): StandardMaterial {
    const key = `${color}:${gloss}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    const mat = new StandardMaterial(`mat-${key}`, this.scene);
    mat.diffuseColor = Color3.FromHexString(color);
    mat.specularColor = gloss ? new Color3(GLOSS_SPECULAR, GLOSS_SPECULAR, GLOSS_SPECULAR) : Color3.Black();
    mat.specularPower = GLOSS_POWER;
    this.materials.set(key, mat);
    return mat;
  }

  private source(shape: PartShape, color: string, gloss: boolean): Mesh {
    const key = `${shape}:${color}:${gloss}`;
    const existing = this.sources.get(key);
    if (existing) return existing;
    const mesh = this.buildShape(shape, key);
    mesh.material = this.material(color, gloss);
    mesh.isVisible = false;
    mesh.receiveShadows = true;
    this.sources.set(key, mesh);
    return mesh;
  }

  private buildShape(shape: PartShape, name: string): Mesh {
    const s = this.scene;
    switch (shape) {
      case 'box':
        return MeshBuilder.CreateBox(name, { size: 1 }, s);
      case 'cone':
        return flat(MeshBuilder.CreateCylinder(name, { diameterTop: 0, diameterBottom: 2, height: 1, tessellation: 6 }, s));
      case 'cylinder':
        return flat(MeshBuilder.CreateCylinder(name, { diameter: 2, height: 1, tessellation: 6 }, s));
      case 'rock':
      case 'bush':
        return flat(MeshBuilder.CreateIcoSphere(name, { radius: 1, subdivisions: 1, flat: true }, s));
      case 'sphere':
        return flat(MeshBuilder.CreateIcoSphere(name, { radius: 0.5, subdivisions: 1, flat: true }, s));
      case 'capsule':
        return flat(MeshBuilder.CreateCapsule(name, { height: 1, radius: 0.5, tessellation: 8, capSubdivisions: 2 }, s));
      case 'dome':
        return flat(MeshBuilder.CreateSphere(name, { diameter: 1, segments: 3, slice: 0.5 }, s));
      case 'disc':
        return flat(MeshBuilder.CreateCylinder(name, { diameter: 1, height: 1, tessellation: 8 }, s));
      case 'torus':
        return flat(MeshBuilder.CreateTorus(name, { diameter: 1, thickness: 0.14, tessellation: 8 }, s));
      case 'smoothCone':
        return flat(MeshBuilder.CreateCylinder(name, { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 6 }, s));
      case 'eye':
        return MeshBuilder.CreateSphere(name, { diameter: 1, segments: 6 }, s);
    }
  }

  /**
   * A new instance of `shape` in `color`, scaled and placed relative to `parent`.
   * The shadow pass only draws what is in its render list, so each instance that should
   * cast a shadow registers itself (the hidden source mesh never draws).
   */
  part(
    shape: PartShape,
    color: string,
    parent: Node | null,
    size: readonly [number, number, number],
    position: readonly [number, number, number],
    options: PartOptions = {},
  ): InstancedMesh {
    const instance = this.source(shape, color, options.gloss ?? false).createInstance(`${shape}-part`);
    instance.parent = parent;
    instance.scaling.set(size[0], size[1], size[2]);
    instance.position.set(position[0], position[1], position[2]);
    if (options.castShadow ?? true) {
      this.shadows.addShadowCaster(instance, false);
      instance.onDisposeObservable.addOnce(() => this.shadows.removeShadowCaster(instance, false));
    }
    return instance;
  }
}

function flat(mesh: Mesh): Mesh {
  mesh.convertToFlatShadedMesh();
  return mesh;
}
