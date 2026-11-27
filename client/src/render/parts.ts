import {
  Color3,
  InstancedMesh,
  Matrix,
  Mesh,
  MeshBuilder,
  type Node,
  type Scene,
  Quaternion,
  type ShadowGenerator,
  StandardMaterial,
  TransformNode,
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
  | 'eye'
  // Smooth shapes for characters: armor and skin read better without facets.
  | 'roundSphere'
  | 'roundCapsule'
  | 'roundCylinder'
  | 'roundDome'
  | 'frustum'
  | 'tube';

export interface PartOptions {
  castShadow?: boolean;
  /** Shiny plastic finish, used for characters. */
  gloss?: boolean;
  /** Polished metal: a strong, tight highlight. Wins over gloss. */
  metal?: boolean;
  /** Glows in the dark (the eyes of the dead). Wins over everything. */
  glow?: boolean;
}

type Finish = 'matte' | 'gloss' | 'metal' | 'glow';

const FINISH: Record<Finish, { specular: number; power: number }> = {
  matte: { specular: 0, power: 1 },
  gloss: { specular: 0.28, power: 24 },
  metal: { specular: 0.45, power: 40 },
  glow: { specular: 0, power: 1 },
};

function finishOf(options: PartOptions): Finish {
  if (options.glow) return 'glow';
  if (options.metal) return 'metal';
  return options.gloss ? 'gloss' : 'matte';
}

/** An empty pivot under `parent`, for building and animating characters. */
export function childNode(name: string, parent: TransformNode, x = 0, y = 0, z = 0): TransformNode {
  const n = new TransformNode(name, parent.getScene());
  n.parent = parent;
  n.position.set(x, y, z);
  return n;
}

/**
 * Every visible piece of the world is an instance of a shared source mesh, one per shape,
 * color and finish. Thousands of parts then render in a handful of draw calls.
 */
export class PartFactory {
  private readonly sources = new Map<string, Mesh>();
  /** Merged rigid pieces of characters, one per character look and body node. Null: could not merge. */
  private readonly baked = new Map<string, Mesh | null>();
  private readonly materials = new Map<string, StandardMaterial>();
  private readonly scene: Scene;
  private readonly shadows: ShadowGenerator;

  constructor(scene: Scene, shadows: ShadowGenerator) {
    this.scene = scene;
    this.shadows = shadows;
  }

  material(color: string, finish: Finish | boolean = 'matte'): StandardMaterial {
    const kind: Finish = finish === true ? 'gloss' : finish === false ? 'matte' : finish;
    const key = `${color}:${kind}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    const mat = new StandardMaterial(`mat-${key}`, this.scene);
    mat.diffuseColor = Color3.FromHexString(color);
    const { specular, power } = FINISH[kind];
    mat.specularColor = new Color3(specular, specular, specular);
    mat.specularPower = power;
    if (kind === 'glow') {
      mat.emissiveColor = Color3.FromHexString(color);
      mat.disableLighting = true;
    }
    this.materials.set(key, mat);
    return mat;
  }

  private source(shape: PartShape, color: string, finish: Finish): Mesh {
    const key = `${shape}:${color}:${finish}`;
    const existing = this.sources.get(key);
    if (existing) return existing;
    const mesh = this.buildShape(shape, key);
    mesh.material = this.material(color, finish);
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
      case 'roundSphere':
        return MeshBuilder.CreateSphere(name, { diameter: 1, segments: 5 }, s);
      case 'roundCapsule':
        return roundCapsule(name, s);
      case 'roundCylinder':
        return MeshBuilder.CreateCylinder(name, { diameter: 1, height: 1, tessellation: 12 }, s);
      case 'roundDome':
        return MeshBuilder.CreateSphere(name, { diameter: 1, segments: 5, slice: 0.5 }, s);
      case 'frustum':
        return MeshBuilder.CreateCylinder(name, { diameterTop: 0.82, diameterBottom: 1, height: 1, tessellation: 12 }, s);
      case 'tube':
        return MeshBuilder.CreateTorus(name, { diameter: 1, thickness: 0.08, tessellation: 14 }, s);
    }
  }

  /**
   * Thousands of tiny parts cost a lot of CPU every frame. A character's parts that move
   * together (everything directly under one of its nodes) are merged into one mesh, built
   * once per `look` and then instanced. Parts in `keep` stay separate because they are
   * animated or toggled on their own.
   */
  bake(root: TransformNode, look: string, keep: ReadonlySet<InstancedMesh>): void {
    const nodes = [root, ...root.getChildTransformNodes(false)];
    nodes.forEach((node, index) => {
      const pieces = node.getChildMeshes(true).filter((m): m is InstancedMesh => m instanceof InstancedMesh && !keep.has(m));
      if (pieces.length < 2) return;
      const key = `${look}#${index}:${node.name}`;
      let merged = this.baked.get(key);
      if (merged === undefined) {
        merged = mergePieces(pieces, key);
        this.baked.set(key, merged);
      }
      if (!merged) return;
      const castShadow = pieces.some((p) => this.casts(p));
      for (const piece of pieces) piece.dispose();
      const instance = merged.createInstance(`${key}-baked`);
      instance.parent = node;
      if (castShadow) this.castShadow(instance);
    });
  }

  private casts(mesh: InstancedMesh): boolean {
    return this.shadows.getShadowMap()?.renderList?.includes(mesh) ?? false;
  }

  private castShadow(instance: InstancedMesh): void {
    this.shadows.addShadowCaster(instance, false);
    instance.onDisposeObservable.addOnce(() => this.shadows.removeShadowCaster(instance, false));
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
    const instance = this.source(shape, color, finishOf(options)).createInstance(`${shape}-part`);
    instance.parent = parent;
    instance.scaling.set(size[0], size[1], size[2]);
    instance.position.set(position[0], position[1], position[2]);
    if (options.castShadow ?? true) this.castShadow(instance);
    return instance;
  }
}

/**
 * A pill one unit wide and tall. Built narrow and stretched, because a capsule whose height
 * equals its diameter has a degenerate middle ring that shades as a dark band.
 */
function roundCapsule(name: string, scene: Scene): Mesh {
  const mesh = MeshBuilder.CreateCapsule(name, { height: 1, radius: 0.25, tessellation: 10, capSubdivisions: 3 }, scene);
  mesh.scaling.set(2, 1, 2);
  mesh.bakeCurrentTransformIntoVertices();
  return mesh;
}

/** One hidden mesh from several instanced pieces, each piece keeping its own material. */
function mergePieces(pieces: readonly InstancedMesh[], name: string): Mesh | null {
  const copies = pieces.map((piece) => {
    const copy = piece.sourceMesh.clone(`${name}-piece`, null, true);
    copy.makeGeometryUnique();
    const r = piece.rotation;
    const rotation = piece.rotationQuaternion ?? Quaternion.RotationYawPitchRoll(r.y, r.x, r.z);
    copy.bakeTransformIntoVertices(Matrix.Compose(piece.scaling, rotation, piece.position));
    return copy;
  });
  const merged = Mesh.MergeMeshes(copies, true, true, undefined, false, true);
  if (!merged) return null;
  merged.name = name;
  merged.isVisible = false;
  merged.receiveShadows = true;
  return merged;
}

function flat(mesh: Mesh): Mesh {
  mesh.convertToFlatShadedMesh();
  return mesh;
}
