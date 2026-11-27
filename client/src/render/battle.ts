import { BODY, clamp, type MapId, type MatchView, type SimEvent, terrainHeightAt, type UnitView, wrapAngle } from '@tumblehorde/shared';
import { type ArmyPalette, EFFECTS } from '../visualConfig.ts';
import { paletteForArmy } from '../palettes.ts';
import { Effects } from './effects.ts';
import { Ragdolls } from './ragdolls.ts';
import {
  animateDowned,
  animateHorse,
  animatePerson,
  createHorseRig,
  createPersonRig,
  keepCelebrating,
  reactToHit,
  type Rig,
  showMarker,
  standUp,
  startCheer,
  startSpeech,
  startSwing,
} from './rigs.ts';
import type { World } from './world.ts';

const HIT_HEIGHT = 1.2;
/** A rider may twist this far in the saddle towards whatever they are fighting. */
const SADDLE_TWIST = 0.7;
const MOUTH_HEIGHT = 1.75;
/** Soldiers take up the cheer one after another, within this many seconds. */
const CHEER_SPREAD = 0.7;
const CHEER_FIRST = 0.25;

/** Turns match views and simulation events into animated characters and effects. */
export class BattleRenderer {
  private readonly rigs = new Map<number, Rig>();
  private readonly world: World;
  readonly ragdolls: Ragdolls;
  readonly effects: Effects;
  private lastView: MatchView | null = null;
  private highlightArmy: number | null = null;
  private highlightGroup: number | null = null;
  /** The unit we look out of in first person: their head is hidden. */
  private eyesOf: number | null = null;

  constructor(world: World) {
    this.world = world;
    this.ragdolls = new Ragdolls(world.scene);
    this.effects = new Effects(world.scene, world.parts);
  }

  /** Marks the soldiers of `group` in `armyId`; none when group is null (the whole army listens). */
  highlight(armyId: number | null, group: number | null): void {
    this.highlightArmy = armyId;
    this.highlightGroup = group;
  }

  setFirstPerson(unitId: number | null): void {
    if (this.eyesOf === unitId) return;
    const previous = this.eyesOf === null ? undefined : this.rigs.get(this.eyesOf);
    if (previous?.type === 'person') previous.head.setEnabled(true);
    this.eyesOf = unitId;
  }

  setMap(map: MapId): void {
    this.ragdolls.groundAt = (x, z) => terrainHeightAt(map, x, z);
  }

  private palette(view: MatchView, armyId: number): ArmyPalette {
    return paletteForArmy(view.armies, armyId, view.mode);
  }

  private createRig(view: MatchView, unit: UnitView): Rig {
    const palette = this.palette(view, unit.armyId);
    const rig =
      unit.kind === 'horse'
        ? createHorseRig(this.world.scene, this.world.parts, palette, unit.id)
        : createPersonRig(this.world.scene, this.world.parts, unit.kind, palette);
    this.rigs.set(unit.id, rig);
    return rig;
  }

  handleEvents(events: readonly SimEvent[], now: number): void {
    const units = this.lastView?.units;
    for (const event of events) {
      switch (event.type) {
        case 'swing': {
          const rig = this.rigs.get(event.unitId);
          const unit = units?.[event.unitId];
          if (rig) startSwing(rig, unit?.weapon ?? 'sword', unit?.mountId !== null && unit?.mountId !== undefined, event.bash === true);
          break;
        }
        case 'hit': {
          const target = units?.[event.targetId];
          const rig = this.rigs.get(event.targetId);
          if (rig) reactToHit(rig, event.blocked);
          if (target) this.effects.burst(event.blocked ? 'block' : 'hit', target.x, target.y + HIT_HEIGHT, target.z, event.blocked ? 7 : 5, event.knockback);
          break;
        }
        case 'death': {
          const rig = this.rigs.get(event.unitId);
          const unit = units?.[event.unitId];
          if (unit) this.effects.burst('death', unit.x, unit.y + HIT_HEIGHT, unit.z, 10, event.knockback);
          // Commanders stay where the simulation says their body lies; they get up there.
          if (rig && unit?.kind !== 'commander') {
            this.rigs.delete(event.unitId);
            this.ragdolls.add(event.unitId, rig, event.knockback, now);
          }
          break;
        }
        case 'respawn': {
          const rig = this.rigs.get(event.unitId);
          if (rig?.type === 'person') standUp(rig);
          break;
        }
        case 'rally':
          this.rally(event.armyId, event.commanderId);
          break;
        case 'banquet': {
          const commander = units?.[this.lastView?.armies[event.armyId]?.commanderId ?? -1];
          if (commander) {
            const ground = this.ragdolls.groundAt(commander.x, commander.z);
            this.effects.feast(commander.x, ground, commander.z, now + EFFECTS.feastPropSeconds);
          }
          break;
        }
        case 'pilumStuck': {
          const rig = this.rigs.get(event.targetId);
          if (rig) this.effects.stickInto(rig.root, event.pos, event.dir, now);
          break;
        }
        case 'splash': {
          const unit = units?.[event.unitId];
          if (unit) this.effects.burst('splash', unit.x, unit.y + 0.6, unit.z, 12);
          break;
        }
        case 'stumble': {
          const unit = units?.[event.unitId];
          if (unit) this.effects.burst('dust', unit.x, unit.y + 0.2, unit.z, 6);
          break;
        }
        case 'arrowLanded':
          this.effects.stickArrow(event.pos, event.dir, event.kind, now);
          this.effects.burst('dust', event.pos.x, event.pos.y + 0.1, event.pos.z, 3);
          break;
        case 'trample':
        case 'dismount': {
          const id = event.type === 'trample' ? event.targetId : event.riderId;
          const unit = units?.[id];
          if (unit) this.effects.burst('dust', unit.x, unit.y + 0.3, unit.z, 8);
          break;
        }
        default:
          break;
      }
    }
  }

  /** The commander shouts, sound rolls out of their mouth, and their soldiers cheer back. */
  private rally(armyId: number, commanderId: number): void {
    const view = this.lastView;
    const commander = view?.units[commanderId];
    const rig = this.rigs.get(commanderId);
    if (!view || !commander || !rig) return;
    startSpeech(rig);
    const saddle = commander.mountId !== null ? BODY.saddleHeight * 0.2 : 0;
    this.effects.shout(commander.x, commander.y + MOUTH_HEIGHT * rig.scale + saddle, commander.z, commander.yaw);
    for (const unit of view.units) {
      if (!unit.alive || unit.armyId !== armyId || unit.kind === 'commander' || unit.kind === 'horse') continue;
      const soldier = this.rigs.get(unit.id);
      if (soldier) startCheer(soldier, CHEER_FIRST + Math.random() * CHEER_SPREAD, unit.id);
    }
  }

  /** The battle is won and this soldier is on the winning side. */
  private celebrating(view: MatchView, unit: UnitView): boolean {
    if (view.phase === 'playing' || unit.kind === 'commander' || unit.mountId !== null) return false;
    const army = view.armies[unit.armyId];
    return army !== undefined && !army.eliminated && (view.winnerTeam === null || army.team === view.winnerTeam);
  }

  /** Riders face along their horse and only twist part of the way; commanders turn freely to block. */
  private displayYaw(view: MatchView, unit: UnitView): number {
    if (unit.mountId === null || unit.kind === 'commander') return unit.yaw;
    const horse = view.units[unit.mountId];
    if (!horse) return unit.yaw;
    return horse.yaw + clamp(wrapAngle(unit.yaw - horse.yaw), -SADDLE_TWIST, SADDLE_TWIST);
  }

  sync(view: MatchView, dt: number, now: number): void {
    this.lastView = view;
    for (const unit of view.units) {
      let rig = this.rigs.get(unit.id);
      if (!unit.alive && unit.kind === 'commander') {
        if (rig?.type === 'person') animateDowned(rig, unit, dt, now);
        continue;
      }
      if (!unit.alive) {
        if (rig) {
          // Died without us seeing the event (e.g. joined late): still let it fall.
          this.rigs.delete(unit.id);
          this.ragdolls.add(unit.id, rig, { x: 1, y: 2, z: 0 }, now);
        }
        continue;
      }
      rig ??= this.createRig(view, unit);
      const feasting = view.armies[unit.armyId]?.banquet === 'feasting' && unit.kind !== 'commander';
      const ctx = { dt, now, mounted: unit.mountId !== null, feasting, displayYaw: this.displayYaw(view, unit) };
      if (rig.type === 'horse') {
        animateHorse(rig, unit, ctx);
      } else {
        if (this.celebrating(view, unit)) keepCelebrating(rig, unit.id);
        if (unit.id === this.eyesOf) rig.head.setEnabled(false);
        animatePerson(rig, unit, ctx);
        const selected = this.highlightGroup !== null && unit.armyId === this.highlightArmy && unit.kind !== 'commander' && unit.group === this.highlightGroup;
        showMarker(rig, selected, now);
      }
    }
    this.effects.syncArrows(view.arrows);
    this.effects.update(dt, now);
    this.ragdolls.update(now);
  }

  clear(): void {
    for (const rig of this.rigs.values()) rig.root.dispose();
    this.rigs.clear();
    this.ragdolls.clear();
    this.effects.clear();
    this.lastView = null;
  }
}
