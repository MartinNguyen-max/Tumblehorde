import type { World } from '../render/world.ts';
import type { InputState } from '../input/input.ts';
import { CinematicOverlay } from '../cinematic/overlay.ts';
import { CutscenePlayer } from '../cinematic/player.ts';
import type { CinematicSound, Cutscene } from '../cinematic/script.ts';
import { CUTSCENES } from '../cinematic/scenes/index.ts';

export interface CampaignDeps {
  world: World;
  input: InputState;
  sound: CinematicSound | null;
  /** Back to the main menu. */
  onExit: () => void;
}

/** The single-player story: cutscenes, free roam in the city, arena fights and battles. */
export class Campaign {
  private readonly deps: CampaignDeps;
  readonly overlay = new CinematicOverlay();
  readonly player: CutscenePlayer;

  constructor(deps: CampaignDeps) {
    this.deps = deps;
    this.player = new CutscenePlayer(deps.world, this.overlay, deps.sound);
  }

  get active(): boolean {
    return this.player.active;
  }

  playCutscene(scene: Cutscene, onDone: () => void): void {
    this.player.play(scene, onDone);
  }

  /** Plays a cutscene by id and returns to the menu after (for testing scenes). */
  playById(id: string): boolean {
    const scene = CUTSCENES[id];
    if (!scene) return false;
    this.playCutscene(scene, () => this.deps.onExit());
    return true;
  }

  frame(dt: number): void {
    this.player.update(dt, this.deps.input.isHeld('Space'));
  }

  stop(): void {
    this.player.stop();
  }
}
