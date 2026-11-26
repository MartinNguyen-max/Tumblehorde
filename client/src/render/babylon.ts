// The single entry point for Babylon.js. Deep imports keep the bundle small; the two
// side-effect imports register the scene components the root package would pull in.
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';

export { Engine } from '@babylonjs/core/Engines/engine';
export { Scene } from '@babylonjs/core/scene';
export { Node } from '@babylonjs/core/node';
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
export { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
export { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
export { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
export { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
export { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
export { Mesh } from '@babylonjs/core/Meshes/mesh';
export { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
export { TransformNode } from '@babylonjs/core/Meshes/transformNode';
export { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
export { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
export { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody';
export { PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
export { PhysicsShapeBox, PhysicsShapeMesh } from '@babylonjs/core/Physics/v2/physicsShape';
