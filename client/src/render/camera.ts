import { FreeCamera, type Scene, Vector3 } from './babylon.ts';
import { clamp, insideStructure, type MapId, mapObstacles, structuresNear, terrainHeightAt, wrapAngle, type Vec3 } from '@tumblehorde/shared';
import { CAMERA, FIRST_PERSON } from '../visualConfig.ts';
import type { ViewMode } from '../ui/viewSetting.ts';

const MIN_CLEARANCE = 0.6;
const ORBIT_SPEED = 0.06;
/** A point this close above a roof still counts as inside the building. */
const ROOF_MARGIN = 0.3;

/**
 * Third-person camera, or first person through the commander's eyes. `yaw` is the direction the
 * camera looks (and the commander faces); in third person the camera sits behind the focus point
 * at `distance`, pulled in when a wall is in the way.
 */
export class FollowCamera {
  readonly camera: FreeCamera;
  yaw = Math.PI / 2;
  pitch: number = CAMERA.startPitch;
  distance: number = CAMERA.distance;
  mode: ViewMode = 'third';
  private readonly focus = new Vector3();
  private smoothedYaw = this.yaw;
  private smoothedPitch = this.pitch;
  private smoothedDistance = this.distance;
  /** The distance actually used: the smoothed one, cut short by walls. */
  private clippedDistance = this.distance;
  private initialized = false;
  private smoothedSide = 0;
  map: MapId = 'meadow';

  constructor(scene: Scene) {
    this.camera = new FreeCamera('camera', new Vector3(0, 10, -10), scene);
    this.camera.fov = CAMERA.fov;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 400;
    this.camera.inputs.clear();
    scene.activeCamera = this.camera;
  }

  look(dx: number, dy: number): void {
    this.yaw = wrapAngle(this.yaw + dx * CAMERA.mouseSensitivity);
    const [min, max] = this.mode === 'first' ? [FIRST_PERSON.minPitch, FIRST_PERSON.maxPitch] : [CAMERA.minPitch, CAMERA.maxPitch];
    this.pitch = clamp(this.pitch + dy * CAMERA.mouseSensitivity, min, max);
  }

  zoom(delta: number): void {
    this.distance = clamp(this.distance + delta * CAMERA.zoomStep * this.distance, CAMERA.minDistance, CAMERA.maxDistance);
  }

  setMode(mode: ViewMode): void {
    this.mode = mode;
    this.camera.fov = mode === 'first' ? FIRST_PERSON.fov : CAMERA.fov;
    if (mode === 'third') this.pitch = clamp(this.pitch, CAMERA.minPitch, CAMERA.maxPitch);
  }

  /** Jump straight to a pose, e.g. when a battle starts. */
  snap(target: Vec3, yaw: number): void {
    this.yaw = yaw;
    this.smoothedYaw = yaw;
    this.focus.set(target.x, target.y + CAMERA.height, target.z);
    this.initialized = true;
  }

  orbit(dt: number): void {
    this.yaw = wrapAngle(this.yaw + dt * ORBIT_SPEED);
  }

  /** `sideOffset` shifts the view over the right shoulder, e.g. while aiming a bow. */
  update(dt: number, target: Vec3, heightOffset: number = CAMERA.height, sideOffset = 0): void {
    const k = 1 - Math.exp(-CAMERA.smoothing * dt);
    this.smoothedSide += (sideOffset - this.smoothedSide) * k;
    const right = { x: Math.cos(this.smoothedYaw), z: -Math.sin(this.smoothedYaw) };
    const goal = new Vector3(target.x + right.x * this.smoothedSide, target.y + heightOffset, target.z + right.z * this.smoothedSide);
    if (!this.initialized) {
      this.focus.copyFrom(goal);
      this.initialized = true;
    } else {
      this.focus.addInPlace(goal.subtract(this.focus).scale(k));
    }
    this.smoothedYaw += wrapAngle(this.yaw - this.smoothedYaw) * Math.min(1, k * 2.5);
    this.smoothedPitch += (this.pitch - this.smoothedPitch) * Math.min(1, k * 2.5);
    this.smoothedDistance += (this.distance - this.smoothedDistance) * k;

    const cosPitch = Math.cos(this.smoothedPitch);
    const back = new Vector3(-Math.sin(this.smoothedYaw) * cosPitch, Math.sin(this.smoothedPitch), -Math.cos(this.smoothedYaw) * cosPitch);
    // Walls pull the camera in at once; it eases back out once they are out of the way.
    const open = this.openDistance(this.focus, back, this.smoothedDistance);
    this.clippedDistance = open < this.clippedDistance ? open : this.clippedDistance + (open - this.clippedDistance) * k;
    const position = this.focus.add(back.scale(this.clippedDistance));
    position.y = Math.max(position.y, terrainHeightAt(this.map, position.x, position.z) + MIN_CLEARANCE);
    this.camera.position.copyFrom(position);
    this.camera.setTarget(this.focus);
  }

  /** Through the commander's eyes at `eye`: no lag, so aiming feels direct. */
  updateFirstPerson(eye: Vec3): void {
    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
    const forward = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    const down = Math.max(0, Math.sin(this.pitch));
    const ahead = FIRST_PERSON.eyeForward + FIRST_PERSON.lookDownForward * down;
    const position = new Vector3(eye.x + forward.x * ahead, eye.y - FIRST_PERSON.lookDownDrop * down, eye.z + forward.z * ahead);
    const cosPitch = Math.cos(this.pitch);
    const look = new Vector3(forward.x * cosPitch, -Math.sin(this.pitch), forward.z * cosPitch);
    this.camera.position.copyFrom(position);
    this.camera.setTarget(position.add(look));
    this.focus.copyFrom(position);
    this.clippedDistance = this.smoothedDistance;
  }

  /** How far the camera can sit from `from` along `dir` before it would be inside a building. */
  private openDistance(from: Vector3, dir: Vector3, wanted: number): number {
    for (let t = CAMERA.wallProbeStep; t <= wanted; t += CAMERA.wallProbeStep) {
      const x = from.x + dir.x * t;
      const y = from.y + dir.y * t;
      const z = from.z + dir.z * t;
      const blocked =
        structuresNear(this.map, x, z).some(
          (s) => insideStructure(s, x, z, CAMERA.wallMargin) && y < terrainHeightAt(this.map, s.x, s.z) + s.height + ROOF_MARGIN,
        ) || this.insideTree(x, y, z);
      if (blocked) return Math.max(CAMERA.wallMinDistance, t - CAMERA.wallProbeStep);
    }
    return wanted;
  }

  /** Trees are drawn much wider and taller than their trunk: keep the camera out of the branches. */
  private insideTree(x: number, y: number, z: number): boolean {
    for (const o of mapObstacles(this.map)) {
      if (o.kind !== 'tree' || o.radius <= 0) continue;
      const reach = CAMERA.treeCrown * o.scale;
      if (Math.abs(o.x - x) > reach || Math.abs(o.z - z) > reach) continue;
      if (Math.hypot(o.x - x, o.z - z) < reach && y < terrainHeightAt(this.map, o.x, o.z) + CAMERA.treeHeight * o.scale) return true;
    }
    return false;
  }

  focusPoint(): Vector3 {
    return this.focus;
  }
}
