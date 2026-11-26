import { FreeCamera, type Scene, Vector3 } from './babylon.ts';
import { clamp, terrainHeightAt, wrapAngle, type Vec3 } from '@tumblehorde/shared';
import { CAMERA } from '../visualConfig.ts';

const MIN_CLEARANCE = 0.6;
const ORBIT_SPEED = 0.06;

/**
 * Third-person camera. `yaw` is the direction the camera looks (and the commander faces);
 * the camera sits behind the focus point at `distance`.
 */
export class FollowCamera {
  readonly camera: FreeCamera;
  yaw = Math.PI / 2;
  pitch: number = CAMERA.startPitch;
  distance: number = CAMERA.distance;
  private readonly focus = new Vector3();
  private smoothedYaw = this.yaw;
  private smoothedPitch = this.pitch;
  private smoothedDistance = this.distance;
  private initialized = false;

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
    this.pitch = clamp(this.pitch + dy * CAMERA.mouseSensitivity, CAMERA.minPitch, CAMERA.maxPitch);
  }

  zoom(delta: number): void {
    this.distance = clamp(this.distance + delta * CAMERA.zoomStep * this.distance, CAMERA.minDistance, CAMERA.maxDistance);
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

  update(dt: number, target: Vec3, heightOffset: number = CAMERA.height): void {
    const goal = new Vector3(target.x, target.y + heightOffset, target.z);
    const k = 1 - Math.exp(-CAMERA.smoothing * dt);
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
    const position = new Vector3(
      this.focus.x - Math.sin(this.smoothedYaw) * cosPitch * this.smoothedDistance,
      this.focus.y + Math.sin(this.smoothedPitch) * this.smoothedDistance,
      this.focus.z - Math.cos(this.smoothedYaw) * cosPitch * this.smoothedDistance,
    );
    position.y = Math.max(position.y, terrainHeightAt(position.x, position.z) + MIN_CLEARANCE);
    this.camera.position.copyFrom(position);
    this.camera.setTarget(this.focus);
  }

  focusPoint(): Vector3 {
    return this.focus;
  }
}
