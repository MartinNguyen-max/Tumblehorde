import {
  advanceDialogue,
  chooseOption,
  clamp,
  createNpc,
  createRandom,
  type Dialogue,
  type DialogueCursor,
  districtWalkable,
  endTalk,
  facedNpc,
  type Line,
  type Npc,
  NPC,
  nextRandom,
  openDialogue,
  punchNpc,
  type RandomSource,
  resolveDistrict,
  startTalk,
  stepNpc,
  stepWalker,
  talkableNpc,
  viewDialogue,
  WORKOUT,
  type Workout,
  workoutPress,
  workoutResult,
  workoutTick,
  startWorkout,
  type Walkable,
  type Walker,
} from '@tumblehorde/shared';
import { Vector3 } from '../render/babylon.ts';
import type { InputState } from '../input/input.ts';
import type { Actor, ActorLook } from '../cinematic/actor.ts';
import type { CinematicOverlay } from '../cinematic/overlay.ts';
import type { CinematicSound } from '../cinematic/script.ts';
import { Stage } from '../cinematic/stage.ts';
import { SMALL_TALK } from './dialogues.ts';
import type { DistrictSet, Spot } from './districts.ts';

/**
 * Walking around the city as Cassian: WASD and the mouse, E to talk, left click to punch.
 * Punched townsfolk lie dazed for a moment and their neighbours run; only a few people have
 * more to say than a line of small talk.
 */

const VIEW = {
  sensitivity: 0.0024,
  distance: 4.6,
  height: 1.55,
  minPitch: -0.3,
  maxPitch: 1.1,
  startPitch: 0.22,
  smoothing: 10,
  /** Samples along the line from the player to the camera, to keep walls out of the view. */
  collisionSteps: 12,
  wallMargin: 0.3,
  talkDistance: 4.2,
  talkHeight: 1.35,
  fov: 0.8,
} as const;
const PUNCH_TIME = 0.32;
const NPC_TURN_RATE = 8;
const PLAYER_NAME = 'Cassian';
/** Idle townsfolk turn their heads to the player when this close. */
const NOTICE_DISTANCE = 6;

interface Talk {
  npc: Npc;
  dialogue: Dialogue;
  cursor: DialogueCursor;
  effect: string | null;
  choosing: boolean;
}

export interface FreeRoamDeps {
  input: InputState;
  overlay: CinematicOverlay;
  sound: CinematicSound | null;
  canvas: HTMLCanvasElement;
  /** A choice in a talk changed the story (e.g. Varro's job accepted). */
  onEffect: (effect: string) => void;
  /** The talk for a story character (built from the story so far), or null for small talk. */
  dialogueFor: (id: string) => Dialogue | null;
  /** E at a spot (the workout stone); false when nothing happens there now. */
  spotActive: (id: string) => boolean;
  /** A line in the corner: gold and strength. */
  status: () => string | null;
}

/** How close the player must be to a spot to use it. */
const SPOT_DISTANCE = 1.8;
const WORKOUT_BAR = 12;

interface WorkoutRun {
  workout: Workout;
  lastHeld: 'left' | 'right' | null;
  onDone: (done: boolean) => void;
}

function smallTalk(npc: Npc, rng: RandomSource): Dialogue {
  const lines = SMALL_TALK[npc.role];
  const text = lines[Math.floor(nextRandom(rng) * lines.length)] ?? '...';
  return { start: 'line', nodes: { line: { lines: [{ speaker: npc.name, text }] } } };
}

export class FreeRoam {
  readonly stage: Stage;
  private readonly deps: FreeRoamDeps;
  private readonly set: DistrictSet;
  private readonly walkable: Walkable;
  private readonly walker: Walker;
  private readonly player: Actor;
  private readonly npcs: Npc[];
  private readonly npcActors: Actor[];
  private readonly rng = createRandom(7);
  private yaw: number;
  private pitch: number = VIEW.startPitch;
  private readonly camPos = new Vector3();
  private readonly camTarget = new Vector3();
  private cameraReady = false;
  private talk: Talk | null = null;
  private workout: WorkoutRun | null = null;
  private punchTimer = 0;
  /** A story effect from the last talk, handed on at the end of the frame. */
  private pendingEffect: string | null = null;
  private wasClicking = false;
  private readonly onCanvasClick = (): void => {
    if (!this.talk?.choosing) this.deps.input.requestLock();
  };

  constructor(stage: Stage, deps: FreeRoamDeps, set: DistrictSet, playerLook: ActorLook) {
    this.stage = stage;
    this.deps = deps;
    this.set = set;
    set.build(stage);
    stage.light(set.light);
    this.walkable = districtWalkable(set.district);
    this.walker = { pos: { x: set.start.x, z: set.start.z }, yaw: set.start.yaw, speed: 0 };
    this.yaw = set.start.yaw;
    this.player = stage.actor(PLAYER_NAME, playerLook);
    this.player.voice = { pitch: 175, rate: 0.12 };
    this.npcs = set.people.map((spec, i) => createNpc(i, spec));
    this.npcActors = set.people.map((spec, i) => {
      const actor = stage.actor(`${spec.name}#${i}`, spec.look);
      actor.voice = spec.voice;
      actor.place(spec.home.x, spec.home.z, spec.yaw ?? 0);
      return actor;
    });
    stage.camera.fov = VIEW.fov;
    deps.overlay.show(false);
    deps.canvas.addEventListener('click', this.onCanvasClick);
  }

  update(dt: number): void {
    const { input } = this.deps;
    const look = input.takeLook();
    this.yaw += look.x * VIEW.sensitivity;
    this.pitch = clamp(this.pitch + look.y * VIEW.sensitivity, VIEW.minPitch, VIEW.maxPitch);
    const pressed = input.takePressed();
    input.takeReleased();
    const pressedE = pressed.includes('KeyE');

    if (this.workout) this.updateWorkout(dt);
    else if (this.talk) this.updateTalk(pressedE);
    else this.updateWalking(dt, pressedE);
    this.deps.overlay.status(this.deps.status());

    for (const npc of this.npcs) stepNpc(npc, dt, this.rng, this.walkable);
    this.syncActors(dt);
    this.updateCamera(dt);
    this.stage.focus.set(this.walker.pos.x, 0, this.walker.pos.z);
    this.stage.update(dt);
    const effect = this.pendingEffect;
    this.pendingEffect = null;
    if (effect) this.deps.onEffect(effect);
  }

  private updateWalking(dt: number, pressedE: boolean): void {
    const { input } = this.deps;
    const forward = (input.isHeld('KeyW') ? 1 : 0) - (input.isHeld('KeyS') ? 1 : 0);
    const right = (input.isHeld('KeyD') ? 1 : 0) - (input.isHeld('KeyA') ? 1 : 0);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const move = { x: sin * forward + cos * right, z: cos * forward - sin * right };
    stepWalker(this.walker, this.set.district, move, input.isHeld('ShiftLeft') || input.isHeld('ShiftRight'), dt);

    const spot = this.nearSpot();
    const partner = spot ? null : talkableNpc(this.npcs, this.walker.pos, this.walker.yaw);
    this.deps.overlay.prompt(spot ? `E  ${spot.label}` : partner ? `E  Talk to ${partner.name}` : null);
    if (pressedE && spot) {
      this.pendingEffect = spot.id;
      return;
    }
    if (pressedE && partner) {
      this.openTalk(partner);
      return;
    }

    const clicking = input.mouseLeft;
    if (clicking && !this.wasClicking && this.punchTimer <= 0) this.punch();
    this.wasClicking = clicking;
    this.punchTimer = Math.max(0, this.punchTimer - dt);
  }

  private nearSpot(): Spot | null {
    const p = this.walker.pos;
    return this.set.spots.find((s) => Math.hypot(s.x - p.x, s.z - p.z) < SPOT_DISTANCE && this.deps.spotActive(s.id)) ?? null;
  }

  /** The stone lift: A and D in turn, fast, before time runs out. */
  startWorkout(onDone: (done: boolean) => void): void {
    this.workout = { workout: startWorkout(), lastHeld: null, onDone };
    this.walker.speed = 0;
    this.deps.overlay.prompt(null);
  }

  private updateWorkout(dt: number): void {
    const run = this.workout;
    if (!run) return;
    const { input, overlay } = this.deps;
    const held = input.isHeld('KeyA') ? 'left' : input.isHeld('KeyD') ? 'right' : null;
    if (held && held !== run.lastHeld) run.workout = workoutPress(run.workout, held);
    run.lastHeld = held;
    run.workout = workoutTick(run.workout, dt);
    const { reps, timeLeft } = run.workout;
    const filled = Math.round((reps / WORKOUT.reps) * WORKOUT_BAR);
    const bar = '▮'.repeat(Math.min(WORKOUT_BAR, filled)) + '▯'.repeat(Math.max(0, WORKOUT_BAR - filled));
    overlay.talk('Lift the stone!', `Press A and D in turn  ${bar}  ${reps}/${WORKOUT.reps}  ${timeLeft.toFixed(1)} s`, '');
    this.player.setPose(reps % 2 === 0 ? 'cheer' : 'offer');
    this.player.setMood(timeLeft < 2 ? 'shout' : 'angry');
    const result = workoutResult(run.workout);
    if (result === 'going') return;
    this.workout = null;
    overlay.talk(null, null);
    this.player.setMood(result === 'done' ? 'happy' : 'sad');
    run.onDone(result === 'done');
  }

  private punch(): void {
    this.punchTimer = PUNCH_TIME;
    const target = facedNpc(this.npcs, this.walker.pos, this.walker.yaw, NPC.punchDistance);
    if (!target || target.dialogue) return;
    punchNpc(this.npcs, target, this.walker.pos);
    this.deps.sound?.speak(this.npcActors[target.id]?.voice ?? this.player.voice, 'surprised', 0.4);
  }

  private openTalk(npc: Npc): void {
    const dialogue = (npc.dialogue ? this.deps.dialogueFor(npc.dialogue) : null) ?? smallTalk(npc, this.rng);
    startTalk(npc, this.walker.pos);
    this.walker.yaw = Math.atan2(npc.pos.x - this.walker.pos.x, npc.pos.z - this.walker.pos.z);
    this.walker.speed = 0;
    this.talk = { npc, dialogue, cursor: openDialogue(dialogue), effect: null, choosing: false };
    this.deps.overlay.prompt(null);
    this.showTalk();
  }

  private updateTalk(pressedE: boolean): void {
    const talk = this.talk;
    if (!talk || talk.choosing || !pressedE) return;
    talk.cursor = advanceDialogue(talk.dialogue, talk.cursor);
    this.showTalk();
  }

  private showTalk(): void {
    const talk = this.talk;
    if (!talk) return;
    const view = viewDialogue(talk.dialogue, talk.cursor);
    const { overlay } = this.deps;
    if (view.kind === 'done') {
      this.closeTalk();
      return;
    }
    if (view.kind === 'line') {
      overlay.talk(view.line.speaker, view.line.text);
      this.speak(view.line);
      return;
    }
    talk.choosing = true;
    overlay.talk(null, null);
    this.deps.input.exitLock();
    overlay.offerChoices(view.options.map((o) => o.text), (index) => {
      const picked = chooseOption(talk.dialogue, talk.cursor, index);
      talk.cursor = picked.cursor;
      talk.effect = picked.effect ?? talk.effect;
      talk.choosing = false;
      this.deps.input.requestLock();
      this.showTalk();
    });
  }

  private speak(line: Line): void {
    const talk = this.talk;
    if (!talk) return;
    const actor = line.speaker === PLAYER_NAME ? this.player : this.npcActors[talk.npc.id];
    if (!actor) return;
    actor.setMood(line.mood ?? 'neutral');
    actor.talking = true;
    this.deps.sound?.speak(actor.voice, line.mood ?? 'neutral', Math.min(3, line.text.length / 14));
  }

  private closeTalk(): void {
    const talk = this.talk;
    if (!talk) return;
    this.talk = null;
    endTalk(talk.npc, this.rng);
    this.deps.overlay.talk(null, null);
    for (const actor of [this.player, ...this.npcActors]) {
      actor.talking = false;
      actor.setMood('neutral');
    }
    this.pendingEffect = talk.effect;
  }

  private syncActors(dt: number): void {
    this.player.drive(this.walker.pos.x, this.walker.pos.z, this.walker.yaw, this.walker.speed);
    if (!this.workout) this.player.setPose(this.punchTimer > 0 ? 'punch' : 'stand');
    this.npcs.forEach((npc, i) => {
      const actor = this.npcActors[i];
      if (!actor) return;
      const moving = npc.mode === 'walk' || npc.mode === 'flee';
      const speed = !moving ? 0 : npc.mode === 'flee' ? NPC.fleeSpeed : npc.role === 'child' ? NPC.childSpeed : NPC.walkSpeed;
      let delta = npc.yaw - actor.yaw;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      const yaw = actor.yaw + delta * Math.min(1, NPC_TURN_RATE * dt);
      actor.drive(npc.pos.x, npc.pos.z, yaw, speed);
      actor.setPose(npc.mode === 'out' ? 'lie' : npc.mode === 'flee' ? 'cower' : 'stand');
      actor.eyesClosed = npc.mode === 'out';
      if (npc.mode === 'flee') actor.setMood('afraid');
      else if (npc.mode !== 'talk' && actor.mood === 'afraid') actor.setMood('neutral');
      const near = Math.hypot(npc.pos.x - this.walker.pos.x, npc.pos.z - this.walker.pos.z) < NOTICE_DISTANCE;
      actor.lookAt(npc.mode === 'talk' || (npc.mode === 'idle' && near) ? this.player.headPosition() : null);
    });
  }

  /** Behind the shoulder while walking; a two-shot from the side while talking. */
  private updateCamera(dt: number): void {
    const camera = this.stage.camera;
    const head = { x: this.walker.pos.x, y: VIEW.height, z: this.walker.pos.z };
    let position: Vector3;
    let target: Vector3;
    const talk = this.talk;
    if (talk) {
      const mid = { x: (head.x + talk.npc.pos.x) / 2, z: (head.z + talk.npc.pos.z) / 2 };
      const across = Math.atan2(talk.npc.pos.x - head.x, talk.npc.pos.z - head.z) + Math.PI / 2;
      target = new Vector3(mid.x, VIEW.talkHeight, mid.z);
      position = this.clearView(target, across, VIEW.talkDistance, 0.12);
    } else {
      target = new Vector3(head.x, head.y, head.z);
      position = this.clearView(target, this.yaw + Math.PI, VIEW.distance, this.pitch);
    }
    const k = this.cameraReady ? 1 - Math.exp(-VIEW.smoothing * dt) : 1;
    this.cameraReady = true;
    this.camPos.addInPlace(position.subtract(this.camPos).scale(k));
    this.camTarget.addInPlace(target.subtract(this.camTarget).scale(k));
    camera.position.copyFrom(this.camPos);
    camera.setTarget(this.camTarget);
  }

  /** A camera spot `distance` from `target` in direction `yaw`, pulled in front of any wall. */
  private clearView(target: Vector3, yaw: number, distance: number, pitch: number): Vector3 {
    const dir = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    let reach = distance;
    for (let i = 1; i <= VIEW.collisionSteps; i++) {
      const d = (distance * i) / VIEW.collisionSteps;
      const p = { x: target.x + dir.x * d, z: target.z + dir.z * d };
      const pushed = resolveDistrict(this.set.district, p, VIEW.wallMargin);
      if (Math.hypot(pushed.x - p.x, pushed.z - p.z) > 1e-3) {
        reach = Math.max(0.8, d - distance / VIEW.collisionSteps);
        break;
      }
    }
    return target.add(dir.scale(reach));
  }

  dispose(): void {
    this.deps.canvas.removeEventListener('click', this.onCanvasClick);
    this.deps.input.exitLock();
    this.deps.overlay.talk(null, null);
    this.deps.overlay.prompt(null);
    this.deps.overlay.clearChoices();
    this.deps.overlay.status(null);
  }
}
