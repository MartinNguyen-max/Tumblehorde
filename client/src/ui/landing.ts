import { type ArmySetup, type ArmySize, type GameMode, MAP, type MatchSettings } from '@tumblehorde/shared';
import { paletteForArmy } from '../palettes.ts';
import { byId, escapeHtml, segmented } from './dom.ts';

export interface LandingHooks {
  onStartLocal(settings: MatchSettings): void;
  onCreateRoom(name: string): void;
  onJoinRoom(name: string, code: string): void;
}

const NAME_STORAGE_KEY = 'tumblehorde.name';

function defaultTeams(armyCount: number): number[] {
  return Array.from({ length: armyCount }, (_, i) => i % 2);
}

export function readStoredName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeName(name: string): void {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // Private mode: the name is simply not remembered.
  }
}

/** The landing page: local battle setup and the online entry points. */
export class Landing {
  private readonly root = byId('landing');
  private readonly size = segmented(byId('opt-size'));
  private readonly mode = segmented(byId('opt-mode'), () => this.renderTeams());
  private readonly bots = segmented(byId('opt-bots'), () => {
    this.teams = defaultTeams(Number(this.bots.get()) + 1);
    this.renderTeams();
  });
  private readonly teamField = byId('team-field');
  private readonly teamList = byId('team-list');
  private readonly startButton = byId('start-local', HTMLButtonElement);
  private readonly nameInput = byId('player-name', HTMLInputElement);
  private readonly codeInput = byId('room-code', HTMLInputElement);
  readonly onlineHint = byId('online-hint');
  private teams = defaultTeams(2);

  constructor(hooks: LandingHooks) {
    this.nameInput.value = readStoredName();
    this.teamList.addEventListener('click', (e) => {
      const chip = e.target instanceof HTMLElement ? e.target.closest<HTMLButtonElement>('.team-chip') : null;
      const index = Number(chip?.dataset.index);
      if (!chip || chip.disabled || !Number.isInteger(index)) return;
      this.teams[index] = this.teams[index] === 0 ? 1 : 0;
      this.renderTeams();
    });
    this.startButton.addEventListener('click', () => hooks.onStartLocal(this.settings()));
    byId('create-room').addEventListener('click', () => hooks.onCreateRoom(this.playerName()));
    byId('join-room').addEventListener('click', () => hooks.onJoinRoom(this.playerName(), this.codeInput.value));
    this.codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') hooks.onJoinRoom(this.playerName(), this.codeInput.value);
    });
    this.renderTeams();
  }

  playerName(): string {
    const name = this.nameInput.value.trim() || 'Commander';
    storeName(name);
    return name;
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  private armySetups(mode: GameMode): ArmySetup[] {
    const count = Number(this.bots.get()) + 1;
    const teams = this.teams.slice(0, count);
    const placeholder = teams.map((team, id) => ({ id, team }));
    return teams.map((team, i) => ({
      name: i === 0 ? 'You' : `${paletteForArmy(placeholder, i, mode).name} Bot`,
      team: mode === 'ffa' ? i : team,
      isBot: i !== 0,
    }));
  }

  private renderTeams(): void {
    const isTeams = this.mode.get() === 'teams';
    this.teamField.hidden = !isTeams;
    const setups = this.armySetups('teams');
    this.teamList.innerHTML = setups
      .map((a, i) => {
        const color = paletteForArmy(setups.map((s, id) => ({ id, team: s.team })), i, 'teams').body;
        const label = `${escapeHtml(a.name)} · ${a.team === 0 ? 'Team 1' : 'Team 2'}`;
        return `<button class="team-chip" data-index="${i}" style="background:${color}" ${i === 0 ? 'disabled' : ''}>${label}</button>`;
      })
      .join('');
    const sides = new Set(setups.map((s) => s.team));
    this.startButton.disabled = isTeams && sides.size < 2;
  }

  settings(): MatchSettings {
    const mode = this.mode.get() === 'teams' ? 'teams' : 'ffa';
    return {
      mode,
      armySize: Number(this.size.get()) as ArmySize,
      armies: this.armySetups(mode),
      seed: (Date.now() ^ MAP.seed) | 0,
    };
  }
}
