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
  jumpWalker,
  type Vec2,
} from '@tumblehorde/shared';
import { type TransformNode, Vector3 } from '../render/babylon.ts';
import { CAMERA } from '../visualConfig.ts';
import type { InputState } from '../input/input.ts';
import type { Actor, ActorLook } from '../cinematic/actor.ts';
import type { CinematicOverlay } from '../cinematic/overlay.ts';
import type { CinematicSound } from '../cinematic/script.ts';
import { Stage } from '../cinematic/stage.ts';
import { CAST } from '../cinematic/cast.ts';
import { SMALL_TALK } from './dialogues.ts';
import { CityMap } from './cityMap.ts';
import type { DistrictSet, Spot } from './districts.ts';

/**
 * Walking around the city as Cassian: WASD and the mouse, E to talk, left click to punch.
 * Punched townsfolk lie dazed for a moment and their neighbours run; only a few people have
 * more to say than a line of small talk.
 */

/** The camera works as it does in battle. */
const VIEW = {
  sensitivity: CAMERA.mouseSensitivity,
  distance: CAMERA.distance,
  height: CAMERA.height,
  minPitch: CAMERA.minPitch,
  maxPitch: CAMERA.maxPitch,
  startPitch: CAMERA.startPitch,
  smoothing: CAMERA.smoothing,
  /** Samples along the line from the player to the camera, to keep walls out of the view. */
  collisionSteps: 12,
  wallMargin: 0.3,
  talkDistance: 4.2,
  talkHeight: 1.35,
  fov: CAMERA.fov,
} as const;
/** The yellow arrow over whoever to go to next. */
const GUIDE = { color: '#FFD23A', height: 2.9, bob: 0.22, bobSpeed: 4, spin: 1.8 } as const;
const PUNCH_TIME = 0.32;
/** How long a line of talk is voiced: by its length, up to a few seconds. */
const TALK_VOICE = { maxSeconds: 3, charsPerSecond: 14 } as const;
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
  /** Names shown instead of the real ones (the smith is "Blacksmith" until he says his name). */
  renames?: Readonly<Record<string, string>>;
  /** Who to go to next (a name as shown, or a spot id), for the arrow and the map; null for nobody. */
  guide?: () => string | null;
}

/** How close the player must be to a spot to use it. */
const SPOT_DISTANCE = 1.8;

interface WorkoutRun {
  workout: Workout;
  /** Key presses since the last frame: taps can be shorter than a frame. */
  presses: ('left' | 'right')[];
  stop: () => void;
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
  private player: Actor;
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
  private readonly map: CityMap;
  private readonly arrow: TransformNode;
  private time = 0;
  private readonly onCanvasClick = (): void => {
    if (!this.talk?.choosing) this.deps.input.requestLock();
  };

  /** Cassian changes clothes (puts on the armor he just bought): a new body in the same spot. */
  setPlayerLook(look: ActorLook): void {
    const voice = this.player.voice;
    this.player.dispose();
    this.player = this.stage.actor(PLAYER_NAME, look);
    this.player.voice = voice;
    this.player.drive(this.walker.pos.x, this.walker.pos.z, this.walker.yaw, 0);
  }

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
    this.player.voice = CAST.cassianPrisoner.voice;
    this.npcs = set.people.map((spec, i) => createNpc(i, { ...spec, name: deps.renames?.[spec.name] ?? spec.name }));
    this.npcActors = set.people.map((spec, i) => {
      const actor = stage.actor(`${spec.name}#${i}`, spec.look);
      actor.voice = spec.voice;
      actor.place(spec.home.x, spec.home.z, spec.yaw ?? 0);
      return actor;
    });
    stage.camera.fov = VIEW.fov;
    this.map = new CityMap(set.district);
    this.arrow = stage.group('guide-arrow');
    const tip = stage.world.parts.part('cone', GUIDE.color, this.arrow, [0.32, 0.55, 0.32], [0, 0, 0], { glow: true, castShadow: false });
    tip.rotation.x = Math.PI;
    stage.world.parts.part('box', GUIDE.color, this.arrow, [0.2, 0.5, 0.2], [0, 0.5, 0], { glow: true, castShadow: false });
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
    else this.updateWalking(dt, pressedE, pressed.includes('Space'));
    this.deps.overlay.status(this.deps.status());
    this.time += dt;
    const goal = this.talk || this.workout ? null : this.guideTarget();
    this.placeArrow(dt, goal);
    this.map.update(dt, this.walker.pos, this.yaw, this.npcs, goal ? goal.pos : null);

    for (const npc of this.npcs) stepNpc(npc, dt, this.rng, this.walkable);
    this.syncActors(dt);
    this.updateCamera(dt);
    this.stage.focus.set(this.walker.pos.x, 0, this.walker.pos.z);
    this.stage.update(dt);
    const effect = this.pendingEffect;
    this.pendingEffect = null;
    if (effect) this.deps.onEffect(effect);
  }

  /** Where the arrow points: the person (or spot) the story wants next. */
  private guideTarget(): { pos: Vec2; height: number } | null {
    const name = this.deps.guide?.() ?? null;
    if (name === null) return null;
    const spot = this.set.spots.find((s) => s.id === name);
    if (spot) return { pos: spot, height: 1.2 };
    const npc = this.npcs.find((n) => n.name === name);
    return npc ? { pos: npc.pos, height: GUIDE.height } : null;
  }

  private placeArrow(dt: number, goal: { pos: Vec2; height: number } | null): void {
    this.arrow.setEnabled(goal !== null);
    if (!goal) return;
    this.arrow.position.set(goal.pos.x, goal.height + Math.sin(this.time * GUIDE.bobSpeed) * GUIDE.bob, goal.pos.z);
    this.arrow.rotation.y += GUIDE.spin * dt;
  }

  private updateWalking(dt: number, pressedE: boolean, pressedJump: boolean): void {
    const { input } = this.deps;
    if (pressedJump) jumpWalker(this.walker);
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
    const presses: ('left' | 'right')[] = [];
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.code === 'KeyA') presses.push('left');
      if (e.code === 'KeyD') presses.push('right');
    };
    window.addEventListener('keydown', onKey);
    this.workout = { workout: startWorkout(), presses, onDone, stop: () => window.removeEventListener('keydown', onKey) };
    this.walker.speed = 0;
    this.deps.overlay.prompt(null);
  }

  private updateWorkout(dt: number): void {
    const run = this.workout;
    if (!run) return;
    const { overlay } = this.deps;
    for (const side of run.presses.splice(0)) run.workout = workoutPress(run.workout, side);
    run.workout = workoutTick(run.workout, dt);
    const { reps, timeLeft } = run.workout;
    overlay.talk('Lift the stone!', `Press A and D in turn: ${reps}/${WORKOUT.reps} · ${timeLeft.toFixed(1)} s`, '', reps / WORKOUT.reps);
    this.player.setPose(reps % 2 === 0 ? 'cheer' : 'offer');
    this.player.setMood(timeLeft < 2 ? 'shout' : 'angry');
    const result = workoutResult(run.workout);
    if (result === 'going') return;
    this.endWorkout();
    this.player.setMood(result === 'done' ? 'happy' : 'sad');
    run.onDone(result === 'done');
  }

  private endWorkout(): void {
    this.workout?.stop();
    this.workout = null;
    this.deps.overlay.talk(null, null);
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
    this.deps.sound?.speak(actor.voice, line.mood ?? 'neutral', Math.min(TALK_VOICE.maxSeconds, line.text.length / TALK_VOICE.charsPerSecond));
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
    this.player.root.position.y = this.walker.air?.height ?? 0;
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
    this.map.dispose();
    this.deps.canvas.removeEventListener('click', this.onCanvasClick);
    this.deps.input.exitLock();
    this.deps.overlay.talk(null, null);
    this.deps.overlay.prompt(null);
    this.deps.overlay.clearChoices();
    this.deps.overlay.status(null);
    this.endWorkout();
  }
}
