import { Vector3 } from '../render/babylon.ts';
import {
  ARMY,
  type CommanderInput,
  distanceToEdge,
  MAP,
  type MatchView,
  type Order,
  type UnitView,
  yawToDir,
} from '@tumblehorde/shared';
import type { InputState } from '../input/input.ts';
import type { BattleRenderer } from '../render/battle.ts';
import type { FollowCamera } from '../render/camera.ts';
import { setShadowArea, type World } from '../render/world.ts';
import type { Hud } from '../ui/hud.ts';
import { CAMERA } from '../visualConfig.ts';
import type { Session } from './session.ts';

const ORDER_KEYS: Record<string, Order> = { Digit1: 'follow', Digit2: 'hold', Digit3: 'attack' };
const EDGE_FADE_DISTANCE = 12;
const EDGE_MAX_ALPHA = 0.28;
const SPECTATE_HEIGHT = 6;

export interface ControllerHooks {
  onFinished(view: MatchView): void;
  onPauseChange(paused: boolean): void;
}

/** Runs one battle on screen: reads input, drives the session, and updates camera, renderer and HUD. */
export class GameController {
  private selectedGroup: number | null = null;
  private overview = false;
  private paused = true;
  private finished = false;
  private lastFocus = { x: 0, y: 0, z: 0 };
  private cameraSnapped = false;
  readonly session: Session;
  private readonly world: World;
  private readonly renderer: BattleRenderer;
  private readonly camera: FollowCamera;
  private readonly input: InputState;
  private readonly hud: Hud;
  private readonly hooks: ControllerHooks;

  constructor(
    session: Session,
    parts: { world: World; renderer: BattleRenderer; camera: FollowCamera; input: InputState; hud: Hud },
    hooks: ControllerHooks,
  ) {
    this.session = session;
    this.world = parts.world;
    this.renderer = parts.renderer;
    this.camera = parts.camera;
    this.input = parts.input;
    this.hud = parts.hud;
    this.hooks = hooks;
    this.input.onPointerLockChange = (locked) => this.setPaused(!locked);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    if (this.finished || this.paused === paused) return;
    this.paused = paused;
    this.hooks.onPauseChange(paused);
  }

  private myCommander(view: MatchView): UnitView | undefined {
    const id = this.session.myArmyId;
    if (id === null) return undefined;
    const army = view.armies[id];
    return army ? view.units[army.commanderId] : undefined;
  }

  private handlePresses(view: MatchView | null): void {
    const army = view && this.session.myArmyId !== null ? view.armies[this.session.myArmyId] : undefined;
    for (const code of this.input.takePressed()) {
      const order = ORDER_KEYS[code];
      if (order) {
        this.session.command({ type: 'order', order, group: this.selectedGroup });
      } else if (code === 'Digit4' && army) {
        this.session.command({ type: 'split', groupCount: (army.groupCount % ARMY.maxGroups) + 1 });
        this.selectedGroup = null;
      } else if (code === 'Tab' && army) {
        this.selectedGroup = nextGroup(this.selectedGroup, army.groupCount);
      } else if (code === 'KeyE') {
        this.session.command({ type: 'mount' });
      } else if (code === 'KeyV') {
        this.overview = !this.overview;
      }
    }
    if (army && this.selectedGroup !== null && this.selectedGroup >= army.groupCount) this.selectedGroup = null;
  }

  private buildInput(): CommanderInput {
    const forward = yawToDir(this.camera.yaw);
    const right = { x: forward.z, z: -forward.x };
    const f = (this.input.isHeld('KeyW') ? 1 : 0) - (this.input.isHeld('KeyS') ? 1 : 0);
    const r = (this.input.isHeld('KeyD') ? 1 : 0) - (this.input.isHeld('KeyA') ? 1 : 0);
    let moveX = forward.x * f + right.x * r;
    let moveZ = forward.z * f + right.z * r;
    const len = Math.hypot(moveX, moveZ);
    if (len > 1) {
      moveX /= len;
      moveZ /= len;
    }
    return {
      moveX,
      moveZ,
      faceYaw: this.camera.yaw,
      jump: this.input.isHeld('Space'),
      attack: this.input.mouseLeft,
      shield: this.input.mouseRight,
    };
  }

  frame(dt: number, now: number): void {
    const active = !this.paused || this.session.online;
    const before = this.session.view();
    if (!this.paused) {
      this.handlePresses(before);
      const look = this.input.takeLook();
      this.camera.look(look.x, look.y);
      this.camera.zoom(this.input.takeWheel());
      this.session.setInput(this.buildInput());
    } else {
      this.session.setInput({ moveX: 0, moveZ: 0, faceYaw: this.camera.yaw, jump: false, attack: false, shield: false });
    }
    if (active) this.session.update(dt);

    const events = this.session.takeEvents();
    this.renderer.handleEvents(events, now);
    if (this.session.myArmyId !== null) this.hud.handleEvents(events, this.session.myArmyId);

    const view = this.session.view();
    if (!view) return;
    this.renderer.sync(view, active ? dt : 0, now);
    this.updateCamera(view, dt);
    this.updateEdgeWalls(view);
    if (this.session.myArmyId !== null) {
      this.hud.update({ view, myArmyId: this.session.myArmyId, selectedGroup: this.selectedGroup, scene: this.world.scene, dt });
    }
    if (view.phase === 'over' && !this.finished) {
      this.finished = true;
      this.input.exitLock();
      this.hooks.onFinished(view);
    }
  }

  private updateCamera(view: MatchView, dt: number): void {
    const me = this.myCommander(view);
    if (me?.alive) {
      this.lastFocus = { x: me.x, y: me.y, z: me.z };
      if (!this.cameraSnapped) {
        this.camera.snap(this.lastFocus, me.yaw);
        this.cameraSnapped = true;
      }
    } else {
      const center = this.armyFocus(view);
      if (center) this.lastFocus = center;
    }
    const height = this.overview ? CAMERA.overviewHeight : me?.alive ? CAMERA.height : SPECTATE_HEIGHT;
    this.camera.update(dt, this.lastFocus, height);
    const f = this.camera.focusPoint();
    setShadowArea(this.world.sun, new Vector3(f.x, 0, f.z));
  }

  /** Where to look while the commander is down: our own army, or whoever is left. */
  private armyFocus(view: MatchView): { x: number; y: number; z: number } | null {
    const mine = this.session.myArmyId;
    const pick = (filter: (u: UnitView) => boolean): { x: number; y: number; z: number } | null => {
      let x = 0;
      let y = 0;
      let z = 0;
      let n = 0;
      for (const u of view.units) {
        if (!u.alive || u.kind === 'horse' || !filter(u)) continue;
        x += u.x;
        y += u.y;
        z += u.z;
        n++;
      }
      return n > 0 ? { x: x / n, y: y / n, z: z / n } : null;
    };
    return pick((u) => u.armyId === mine) ?? pick(() => true);
  }

  private updateEdgeWalls(view: MatchView): void {
    const me = this.myCommander(view);
    const distance = me?.alive ? distanceToEdge(me.x, me.z) : MAP.halfSize;
    const t = 1 - Math.min(1, Math.max(0, distance / EDGE_FADE_DISTANCE));
    this.world.edgeMaterial.alpha = t * EDGE_MAX_ALPHA;
  }

  dispose(): void {
    this.input.onPointerLockChange = null;
    this.session.dispose();
  }
}

function nextGroup(current: number | null, groupCount: number): number | null {
  if (groupCount <= 1) return null;
  if (current === null) return 0;
  return current + 1 >= groupCount ? null : current + 1;
}
