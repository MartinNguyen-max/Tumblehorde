import type { UnitView, Walker } from '@tumblehorde/shared';
import type { Stage } from '../cinematic/stage.ts';
import { animatePerson, createPersonRig, type PersonRig, startSwing } from '../render/rigs.ts';
import type { ArmyPalette } from '../visualConfig.ts';

/**
 * Cassian in the city with the very body and animations he has in battle: the same walk, the
 * same jump, the same swing. Built from a cast role, so his clothes match the scenes.
 */

const TOWN_PALETTE: ArmyPalette = { body: '#B8322A', trim: '#E0B040', name: 'town' };
/** Height of the head above the feet, for people looking at him (battle commander scale). */
const HEAD_HEIGHT = 2.0;

export class PlayerBody {
  private readonly rig: PersonRig;
  private time = 0;
  private lastHeight = 0;

  constructor(stage: Stage, role: string) {
    this.rig = createPersonRig(stage.scene, stage.world.parts, 'commander', TOWN_PALETTE, 'roman', 0, role);
    this.rig.root.parent = stage.root;
  }

  /** Moves and animates the body where the walker is; `air` is the height of a jump. */
  update(dt: number, walker: Walker): void {
    this.time += dt;
    const height = walker.air?.height ?? 0;
    const vy = dt > 0 ? (height - this.lastHeight) / dt : 0;
    this.lastHeight = height;
    const view: UnitView = {
      id: 0,
      kind: 'commander',
      armyId: 0,
      x: walker.pos.x,
      y: height,
      z: walker.pos.z,
      yaw: walker.yaw,
      vx: Math.sin(walker.yaw) * walker.speed,
      vy,
      vz: Math.cos(walker.yaw) * walker.speed,
      hp: 1,
      maxHp: 1,
      alive: true,
      onGround: walker.air === undefined,
      shieldUp: false,
      stunTimer: 0,
      action: 'none',
      actionTimer: 0,
      invulnerable: false,
      mountId: null,
      riderId: null,
      respawnTimer: 0,
      group: 0,
      // No weapon in his hands in town: the claw shows nothing.
      weapon: 'claw',
      drunk: false,
      crouching: false,
      hero: null,
    };
    animatePerson(this.rig, view, { dt, now: this.time, mounted: false, feasting: false, displayYaw: walker.yaw });
    this.rig.shield?.setEnabled(false);
  }

  /** A swing of the fist, the battle's strike animation. */
  punch(): void {
    startSwing(this.rig, 'sword', false);
  }

  headPosition(): { x: number; y: number; z: number } {
    const p = this.rig.root.position;
    return { x: p.x, y: p.y + HEAD_HEIGHT, z: p.z };
  }

  dispose(): void {
    this.rig.root.dispose();
  }
}
