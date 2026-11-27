import { Vector3 } from '../render/babylon.ts';
import {
  type CommanderInput,
  COMMANDER_WEAPONS,
  HALVES,
  neutralInput,
  distanceToEdge,
  MAP,
  type MatchView,
  type Order,
  terrainHeightAt,
  type UnitView,
  type Vec3,
  yawToDir,
} from '@tumblehorde/shared';
import type { BattleAudio } from '../audio/battleAudio.ts';
import type { AudioEngine } from '../audio/engine.ts';
import { FormationWheel } from '../input/formationWheel.ts';
import type { InputState } from '../input/input.ts';
import type { BattleRenderer } from '../render/battle.ts';
import type { FollowCamera } from '../render/camera.ts';
import { setShadowArea, type World } from '../render/world.ts';
import type { Hud } from '../ui/hud.ts';
import { readViewMode, storeViewMode } from '../ui/viewSetting.ts';
import { CAMERA, FIRST_PERSON } from '../visualConfig.ts';
import type { Session } from './session.ts';

/** `2` (Hold) is handled by the formation wheel. */
const ORDER_KEYS: Record<string, Order> = { Digit1: 'follow', Digit3: 'attack' };
const HOLD_KEY = 'Digit2';
const EDGE_FADE_DISTANCE = 12;
const EDGE_MAX_ALPHA = 0.28;
const SPECTATE_HEIGHT = 6;
const CORPSE_CAMERA_HEIGHT = 2.5;
const BOW_SHOULDER_OFFSET = 0.9;
const AIM_STEP = 1;
const AIM_MAX_DISTANCE = 90;
const AIM_FALLBACK_DISTANCE = 60;

export interface ControllerHooks {
  onFinished(view: MatchView): void;
  onPauseChange(paused: boolean): void;
}

/** Runs one battle on screen: reads input, drives the session, and updates camera, renderer and HUD. */
export class GameController {
  private overview = false;
  private paused = true;
  private finished = false;
  private lastFocus = { x: 0, y: 0, z: 0 };
  private cameraSnapped = false;
  private readonly wheel = new FormationWheel();
  /** After a split: which half listens to orders (0 or 1), or null for the whole army. */
  private selectedGroup: number | null = null;
  /** A click that picked a formation must not also swing the sword. */
  private swallowClick = false;
  readonly session: Session;
  private readonly world: World;
  private readonly renderer: BattleRenderer;
  private readonly camera: FollowCamera;
  private readonly input: InputState;
  private readonly hud: Hud;
  private readonly audio: BattleAudio;
  private readonly listener: AudioEngine;
  private readonly hooks: ControllerHooks;

  constructor(
    session: Session,
    parts: { world: World; renderer: BattleRenderer; camera: FollowCamera; input: InputState; hud: Hud; audio: BattleAudio; listener: AudioEngine },
    hooks: ControllerHooks,
  ) {
    this.session = session;
    this.world = parts.world;
    this.renderer = parts.renderer;
    this.camera = parts.camera;
    this.input = parts.input;
    this.hud = parts.hud;
    this.audio = parts.audio;
    this.listener = parts.listener;
    this.hooks = hooks;
    this.input.onPointerLockChange = (locked) => this.setPaused(!locked);
    this.camera.setMode(readViewMode());
  }

  /** `T`: first person ⇄ third person, remembered for next time. */
  private toggleView(): void {
    const mode = this.camera.mode === 'first' ? 'third' : 'first';
    this.camera.setMode(mode);
    storeViewMode(mode);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    if (this.finished || this.paused === paused) return;
    this.paused = paused;
    this.hooks.onPauseChange(paused);
  }

  private myCommander(view: MatchView | null): UnitView | undefined {
    const id = this.session.myArmyId;
    if (id === null || !view) return undefined;
    const commanderId = view.armies[id]?.commanderId ?? null;
    return commanderId === null ? undefined : view.units[commanderId];
  }

  /** The army is split in halves right now (by this player, and not merged since). */
  private isSplit(): boolean {
    const id = this.session.myArmyId;
    const army = id === null ? undefined : this.session.view()?.armies[id];
    return army?.groupCount === HALVES;
  }

  /** Orders go to the selected half, or to the whole army (which joins the halves again). */
  private listening(): number | null {
    return this.isSplit() ? this.selectedGroup : null;
  }

  private order(order: Order): void {
    this.session.command({ type: 'order', order, group: this.listening() });
  }

  /** `4`: split the army in two; pressed again, it switches between half A, half B and the whole army. */
  private splitOrCycle(): void {
    if (!this.isSplit()) {
      this.session.command({ type: 'split', groupCount: HALVES });
      this.selectedGroup = 0;
      return;
    }
    this.selectedGroup = this.selectedGroup === null ? 0 : this.selectedGroup === 0 ? 1 : null;
  }

  private handleKeys(dt: number): void {
    for (const code of this.input.takePressed()) {
      const order = ORDER_KEYS[code];
      if (order) {
        this.order(order);
      } else if (code === HOLD_KEY) {
        this.wheel.press();
      } else if (code === 'KeyR') {
        this.session.command({ type: 'volley', at: this.aimPoint(), group: this.listening() });
      } else if (code === 'KeyF') {
        this.session.command({ type: 'advance', group: this.listening() });
      } else if (code === 'Digit4') {
        this.splitOrCycle();
      } else if (code === 'Digit5') {
        this.session.command({ type: 'banquet' });
      } else if (code === 'Digit6') {
        this.session.command({ type: 'rally' });
      } else if (code === 'KeyE') {
        this.session.command({ type: 'mount' });
      } else if (code === 'KeyV') {
        this.overview = !this.overview;
      } else if (code === 'KeyT') {
        this.toggleView();
      } else if (code === 'KeyQ') {
        this.cycleWeapon();
      }
    }
    for (const code of this.input.takeReleased()) {
      if (code === HOLD_KEY && this.wheel.isPressed) this.closeWheel();
    }
    this.wheel.tick(dt);
    if (this.wheel.isOpen && this.input.mouseLeft && !this.swallowClick) {
      this.swallowClick = true;
      this.closeWheel();
    }
    if (!this.input.mouseLeft) this.swallowClick = false;
  }

  /** A picked formation holds in that shape; otherwise Hold uses the last one picked. */
  private closeWheel(): void {
    const formation = this.wheel.release();
    if (formation) this.session.command({ type: 'formation', formation, group: this.listening() });
    else this.order('hold');
  }

  private cycleWeapon(): void {
    const me = this.myCommander(this.session.view());
    if (!me) return;
    const index = COMMANDER_WEAPONS.findIndex((w) => w === me.weapon);
    const next = COMMANDER_WEAPONS[(index + 1) % COMMANDER_WEAPONS.length] ?? 'sword';
    this.session.command({ type: 'weapon', weapon: next });
  }

  /** Where the middle of the screen meets the ground: the bow's target. */
  private aimPoint(): Vec3 {
    const cam = this.world.scene.activeCamera;
    if (!cam) return { x: 0, y: 0, z: 0 };
    const origin = cam.position;
    const dir = cam.getDirection(Vector3.Forward());
    for (let t = AIM_STEP; t <= AIM_MAX_DISTANCE; t += AIM_STEP) {
      const x = origin.x + dir.x * t;
      const y = origin.y + dir.y * t;
      const z = origin.z + dir.z * t;
      if (y <= terrainHeightAt(this.session.map, x, z)) return { x, y, z };
    }
    return { x: origin.x + dir.x * AIM_FALLBACK_DISTANCE, y: origin.y + dir.y * AIM_FALLBACK_DISTANCE, z: origin.z + dir.z * AIM_FALLBACK_DISTANCE };
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
      attack: this.input.mouseLeft && !this.wheel.isOpen && !this.swallowClick,
      shield: this.input.mouseRight,
      crouch: this.input.isHeld('ControlLeft') || this.input.isHeld('ControlRight'),
      aim: this.aimPoint(),
    };
  }

  frame(dt: number, now: number): void {
    const active = !this.paused || this.session.online;
    if (!this.paused) {
      this.handleKeys(dt);
      const look = this.input.takeLook();
      if (this.wheel.isOpen) this.wheel.move(look.x, look.y);
      else this.camera.look(look.x, look.y);
      this.camera.zoom(this.input.takeWheel());
      this.session.setInput(this.buildInput());
    } else {
      this.wheel.cancel();
      this.session.setInput(neutralInput(this.camera.yaw));
    }
    if (active) this.session.update(dt);

    const events = this.session.takeEvents();
    this.renderer.handleEvents(events, now);
    this.audio.handle(events, this.session.view(), this.session.myArmyId);
    if (this.session.myArmyId !== null) this.hud.handleEvents(events, this.session.myArmyId);

    const view = this.session.view();
    if (!view) return;
    if (!this.isSplit()) this.selectedGroup = null;
    this.renderer.highlight(this.session.myArmyId, this.listening());
    this.renderer.sync(view, active ? dt : 0, now);
    this.updateCamera(view, dt);
    const ear = this.camera.camera.position;
    this.listener.setListener(ear.x, ear.z, this.camera.yaw);
    this.audio.update(view, active ? dt : 0);
    this.updateEdgeWalls(view);
    if (this.session.myArmyId !== null) {
      this.hud.update({ view, myArmyId: this.session.myArmyId, wheel: this.wheel, selectedGroup: this.listening(), lookYaw: this.camera.yaw, scene: this.world.scene, dt });
    }
    if (view.phase === 'over' && !this.finished) {
      this.finished = true;
      this.input.exitLock();
      this.hooks.onFinished(view);
    }
  }

  private updateCamera(view: MatchView, dt: number): void {
    const me = this.myCommander(view);
    let height: number = CAMERA.height;
    if (me?.alive) {
      this.lastFocus = { x: me.x, y: me.y, z: me.z };
      if (!this.cameraSnapped) {
        this.camera.snap(this.lastFocus, me.yaw);
        this.cameraSnapped = true;
      }
    } else if (me && !view.armies[me.armyId]?.eliminated) {
      // Stay with the body while the commander patches themselves up.
      this.lastFocus = { x: me.x, y: me.y, z: me.z };
      height = CORPSE_CAMERA_HEIGHT;
    } else {
      const center = this.armyFocus(view);
      if (center) this.lastFocus = center;
      height = SPECTATE_HEIGHT;
    }
    if (this.overview) height = CAMERA.overviewHeight;
    const throughEyes = this.camera.mode === 'first' && me?.alive === true && !this.overview;
    this.renderer.setFirstPerson(throughEyes && me ? me.id : null);
    if (throughEyes && me) {
      this.camera.updateFirstPerson({ x: me.x, y: me.y + FIRST_PERSON.eyeHeight, z: me.z });
    } else {
      const aiming = me?.alive === true && me.weapon === 'bow';
      this.camera.update(dt, this.lastFocus, height, aiming ? BOW_SHOULDER_OFFSET : 0);
    }
    const f = this.camera.focusPoint();
    setShadowArea(this.world.sun, new Vector3(f.x, 0, f.z));
  }

  /** Where to look once your army is out: whoever is left. */
  private armyFocus(view: MatchView): { x: number; y: number; z: number } | null {
    let x = 0;
    let y = 0;
    let z = 0;
    let n = 0;
    for (const u of view.units) {
      if (!u.alive || u.kind === 'horse') continue;
      x += u.x;
      y += u.y;
      z += u.z;
      n++;
    }
    return n > 0 ? { x: x / n, y: y / n, z: z / n } : null;
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
