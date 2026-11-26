import {
  Color3,
  type InstancedMesh,
  Mesh,
  MeshBuilder,
  type Node,
  type Scene,
  type ShadowGenerator,
  StandardMaterial,
} from '@babylonjs/core';

export type PartShape = 'box' | 'cone' | 'cylinder' | 'rock' | 'bush';

/**
 * Every visible piece of the low-poly world is an instance of a shared source mesh,
 * one per shape and color. Thousands of parts then render in a handful of draw calls.
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

  material(color: string): StandardMaterial {
    const existing = this.materials.get(color);
    if (existing) return existing;
    const mat = new StandardMaterial(`mat-${color}`, this.scene);
    mat.diffuseColor = Color3.FromHexString(color);
    mat.specularColor = Color3.Black();
    this.materials.set(color, mat);
    return mat;
  }

  private source(shape: PartShape, color: string): Mesh {
    const key = `${shape}:${color}`;
    const existing = this.sources.get(key);
    if (existing) return existing;
    const mesh = this.buildShape(shape, key);
    mesh.material = this.material(color);
    mesh.isVisible = false;
    mesh.receiveShadows = true;
    this.shadows.addShadowCaster(mesh);
    this.sources.set(key, mesh);
    return mesh;
  }

  private buildShape(shape: PartShape, name: string): Mesh {
    switch (shape) {
      case 'box':
        return MeshBuilder.CreateBox(name, { size: 1 }, this.scene);
      case 'cone':
        return flat(MeshBuilder.CreateCylinder(name, { diameterTop: 0, diameterBottom: 2, height: 1, tessellation: 6 }, this.scene));
      case 'cylinder':
        return flat(MeshBuilder.CreateCylinder(name, { diameter: 2, height: 1, tessellation: 6 }, this.scene));
      case 'rock':
        return flat(MeshBuilder.CreateIcoSphere(name, { radius: 1, subdivisions: 1, flat: true }, this.scene));
      case 'bush':
        return flat(MeshBuilder.CreateIcoSphere(name, { radius: 1, subdivisions: 1, flat: true }, this.scene));
    }
  }

  /** A new instance of `shape` in `color`, scaled and placed relative to `parent`. */
  part(
    shape: PartShape,
    color: string,
    parent: Node | null,
    size: readonly [number, number, number],
    position: readonly [number, number, number],
  ): InstancedMesh {
    const instance = this.source(shape, color).createInstance(`${shape}-part`);
    instance.parent = parent;
    instance.scaling.set(size[0], size[1], size[2]);
    instance.position.set(position[0], position[1], position[2]);
    return instance;
  }
}

function flat(mesh: Mesh): Mesh {
  mesh.convertToFlatShadedMesh();
  return mesh;
}
