import { type ArmySetup, type ArmySize, DEFENDER_TEAM, type GameMode, isMapId, MAP, type MapId, MAPS, mapFromRandom, type MatchSettings } from '@tumblehorde/shared';
import { paletteForArmy } from '../palettes.ts';
import { byId, escapeHtml, segmented } from './dom.ts';

export interface LandingHooks {
  onStartLocal(settings: MatchSettings): void;
  onCreateRoom(name: string): void;
  onJoinRoom(name: string, code: string): void;
  /** Any setting changed: show that battle (bots only) behind the menu. */
  onPreview(settings: MatchSettings): void;
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
  private readonly size = segmented(byId('opt-size'), () => this.preview());
  private readonly map = segmented(byId('opt-map'), () => {
    this.renderTeams();
    this.preview();
  });
  private readonly role = segmented(byId('opt-role'), () => this.preview());
  private readonly siegeField = byId('siege-field');
  private readonly mode = segmented(byId('opt-mode'), () => {
    this.renderTeams();
    this.preview();
  });
  private readonly bots = segmented(byId('opt-bots'), () => {
    this.teams = defaultTeams(Number(this.bots.get()) + 1);
    this.renderTeams();
    this.preview();
  });
  private readonly teamField = byId('team-field');
  private readonly teamList = byId('team-list');
  private readonly startButton = byId('start-local', HTMLButtonElement);
  private readonly nameInput = byId('player-name', HTMLInputElement);
  private readonly codeInput = byId('room-code', HTMLInputElement);
  readonly onlineHint = byId('online-hint');
  private teams = defaultTeams(2);
  private readonly hooks: LandingHooks;

  constructor(hooks: LandingHooks) {
    this.hooks = hooks;
    this.nameInput.value = readStoredName();
    this.teamList.addEventListener('click', (e) => {
      const chip = e.target instanceof HTMLElement ? e.target.closest<HTMLButtonElement>('.team-chip') : null;
      const index = Number(chip?.dataset.index);
      if (!chip || chip.disabled || !Number.isInteger(index)) return;
      this.teams[index] = this.teams[index] === 0 ? 1 : 0;
      this.renderTeams();
      this.preview();
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
    const siege = this.map.get() === 'castle';
    this.siegeField.hidden = siege === false && this.map.get() !== 'random';
    const isTeams = this.mode.get() === 'teams' && !siege;
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
    const map = this.pickMap();
    const armySize = Number(this.size.get()) as ArmySize;
    const seed = (Date.now() ^ MAP.seed) | 0;
    const mode = this.mode.get() === 'teams' ? 'teams' : 'ffa';
    if (MAPS[map].layout === 'siege') return { mode, armySize, armies: this.siegeSetups(mode), seed, map };
    return { mode, armySize, armies: this.armySetups(mode), seed, map };
  }

  /**
   * At the castle one army holds the gate: you, or the first bot. In free-for-all every attacker
   * fights for itself (the defender too); in 2 teams the attackers are allies.
   */
  private siegeSetups(mode: GameMode): ArmySetup[] {
    const defending = this.role.get() === 'defend';
    return this.armySetups(mode).map((army, i) => {
      const defends = defending ? i === 0 : i === 1;
      if (mode === 'ffa') return { ...army, defends };
      return { ...army, defends, team: defends ? DEFENDER_TEAM : DEFENDER_TEAM + 1 };
    });
  }

  private preview(): void {
    this.hooks.onPreview(this.previewSettings());
  }

  /** The battle as set up, with a bot in your place, for the live preview. */
  previewSettings(): MatchSettings {
    const settings = this.settings();
    return { ...settings, armies: settings.armies.map((a, i) => ({ ...a, isBot: true, name: i === 0 ? 'Your army' : a.name })) };
  }

  /** The chosen battlefield, or null for random. */
  chosenMap(): MapId | null {
    const chosen = this.map.get();
    return isMapId(chosen) ? chosen : null;
  }

  /** "Random" picks a new battlefield every battle. */
  pickMap(): MapId {
    const chosen = this.map.get();
    return isMapId(chosen) ? chosen : mapFromRandom(Math.random());
  }
}
