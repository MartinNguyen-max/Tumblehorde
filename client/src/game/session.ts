import {
  applyCommand,
  type Command,
  type CommanderInput,
  createMatch,
  interpolateViews,
  type MatchSettings,
  type MatchState,
  type MapId,
  type MatchView,
  matchView,
  neutralInput,
  SIM,
  type SimEvent,
  stepMatch,
} from '@tumblehorde/shared';

/** A battle the client can display and control, whether it runs locally or on a server. */
export interface Session {
  readonly online: boolean;
  /** The army this client commands, or null when only watching. */
  readonly myArmyId: number | null;
  readonly map: MapId;
  update(dt: number): void;
  view(): MatchView | null;
  takeEvents(): SimEvent[];
  setInput(input: CommanderInput): void;
  command(command: Command): void;
  dispose(): void;
}

const MAX_STEPS_PER_FRAME = 8;

/** Runs the shared simulation in the browser at a fixed rate and interpolates for rendering. */
export class LocalSession implements Session {
  readonly online = false;
  readonly myArmyId: number | null;
  readonly settings: MatchSettings;
  readonly map: MapId;
  private readonly state: MatchState;
  private readonly inputs = new Map<number, CommanderInput>();
  private readonly step = 1 / SIM.localTickRate;
  private accumulator = 0;
  private previous: MatchView;
  private current: MatchView;
  private events: SimEvent[] = [];

  constructor(settings: MatchSettings, myArmyId: number | null) {
    this.settings = settings;
    this.map = settings.map;
    this.myArmyId = myArmyId;
    this.state = createMatch(settings);
    this.current = matchView(this.state);
    this.previous = this.current;
    if (myArmyId !== null) this.inputs.set(myArmyId, neutralInput());
  }

  update(dt: number): void {
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= this.step && steps < MAX_STEPS_PER_FRAME) {
      stepMatch(this.state, this.inputs, this.step);
      this.events.push(...this.state.events);
      this.accumulator -= this.step;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    if (steps > 0) {
      this.previous = steps > 1 ? matchView(this.state) : this.current;
      this.current = matchView(this.state);
    }
  }

  view(): MatchView {
    return interpolateViews(this.previous, this.current, this.accumulator / this.step);
  }

  takeEvents(): SimEvent[] {
    return this.events.splice(0, this.events.length);
  }

  setInput(input: CommanderInput): void {
    if (this.myArmyId !== null) this.inputs.set(this.myArmyId, input);
  }

  command(command: Command): void {
    if (this.myArmyId === null) return;
    const alreadySeen = this.state.events.length;
    applyCommand(this.state, this.myArmyId, command);
    this.events.push(...this.state.events.slice(alreadySeen));
  }

  dispose(): void {
    this.events = [];
  }
}
