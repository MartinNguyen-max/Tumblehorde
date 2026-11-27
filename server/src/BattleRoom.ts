import { type Client, Room } from '@colyseus/core';
import {
  ARMY,
  applyCommand,
  type ArmySize,
  battleSettings,
  canStartBattle,
  type CommanderInput,
  createMatch,
  encodeSnapshot,
  type GameMode,
  generateRoomCode,
  type InputMessage,
  type LobbyMessage,
  type MapChoice,
  MATCH,
  type MatchState,
  matchView,
  NET,
  neutralInput,
  type RoomPhase,
  sanitizeCommandMessage,
  sanitizeInputMessage,
  type Peoples,
  sanitizeLobbySettings,
  sanitizeName,
  setArmyConnected,
  SIM,
  type SimEvent,
  type SnapshotMessage,
  type StartMessage,
  stepMatch,
} from '@tumblehorde/shared';

interface Player {
  sessionId: string;
  name: string;
  team: number;
  connected: boolean;
  client: Client | null;
  armyId: number | null;
  queue: InputMessage[];
  lastInput: CommanderInput;
  ack: number;
  /** Ticks in a row without fresh input; a silent client stops acting after a few. */
  staleTicks: number;
  left: boolean;
}

const activeCodes = new Set<string>();
const MAX_CODE_ATTEMPTS = 50;
const INPUTS_KEPT_WHEN_BEHIND = 2;

function uniqueCode(): string {
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const code = generateRoomCode();
    if (!activeCodes.has(code)) return code;
  }
  throw new Error('Could not find a free room code');
}

/**
 * One online battle. The room is a lobby until the host starts; then it runs the shared
 * simulation authoritatively and streams snapshots. Clients only send validated input.
 */
export class BattleRoom extends Room {
  override maxClients: number = NET.maxPlayers;
  private players: Player[] = [];
  private hostId = '';
  private mode: GameMode = 'ffa';
  private armySize: ArmySize = ARMY.sizes[1];
  private peoples: Peoples = 'romans';
  private map: MapChoice = 'random';
  private phase: RoomPhase = 'lobby';
  private match: MatchState | null = null;
  private pendingEvents: SimEvent[] = [];

  override onCreate(): void {
    const code = uniqueCode();
    activeCodes.add(code);
    this.roomId = code;
    this.setPatchRate(null);

    this.onMessage('input', (client, raw: unknown) => this.receiveInput(client, raw));
    this.onMessage('command', (client, raw: unknown) => this.receiveCommand(client, raw));
    this.onMessage('settings', (client, raw: unknown) => this.receiveSettings(client, raw));
    this.onMessage('team', (client) => this.switchTeam(client));
    this.onMessage('start', (client) => this.startBattle(client));
    this.setSimulationInterval(() => this.tick(), 1000 / SIM.serverTickRate);
  }

  override onJoin(client: Client, options: unknown): void {
    const raw = typeof options === 'object' && options !== null && 'name' in options ? options.name : undefined;
    const teamCounts = [0, 1].map((t) => this.players.filter((p) => p.team === t).length);
    this.players.push({
      sessionId: client.sessionId,
      name: sanitizeName(raw),
      team: (teamCounts[0] ?? 0) <= (teamCounts[1] ?? 0) ? 0 : 1,
      connected: true,
      client,
      armyId: null,
      queue: [],
      lastInput: neutralInput(),
      ack: -1,
      staleTicks: 0,
      left: false,
    });
    if (!this.hostId) this.hostId = client.sessionId;
    this.broadcastLobby();
  }

  override onDrop(client: Client): void {
    const player = this.player(client);
    if (!player) return;
    player.connected = false;
    player.client = null;
    if (this.match && player.armyId !== null) setArmyConnected(this.match, player.armyId, false);
    if (this.phase === 'lobby' && this.hostId === client.sessionId) {
      this.hostId = this.players.find((p) => p.connected)?.sessionId ?? this.hostId;
    }
    this.allowReconnection(client, MATCH.disconnectTimeout);
    this.broadcastLobby();
  }

  override onReconnect(client: Client): void {
    const player = this.player(client);
    if (!player) return;
    player.connected = true;
    player.client = client;
    // The rejoined client starts a fresh session whose input sequence restarts at 1.
    player.queue = [];
    player.ack = -1;
    player.staleTicks = 0;
    player.lastInput = neutralInput();
    if (!this.hostId) this.hostId = client.sessionId;
    if (this.match && player.armyId !== null) {
      setArmyConnected(this.match, player.armyId, true);
      client.send('start', this.startMessage());
    }
    this.broadcastLobby();
  }

  override onLeave(client: Client): void {
    const player = this.player(client);
    if (!player) return;
    player.connected = false;
    player.client = null;
    if (this.phase === 'battle' && this.match && player.armyId !== null) {
      // The army fights on without orders until the disconnect timer runs out.
      player.left = true;
      if (this.match.armies[player.armyId]?.disconnectTimer === null) setArmyConnected(this.match, player.armyId, false);
    } else {
      this.players = this.players.filter((p) => p !== player);
    }
    if (this.hostId === client.sessionId) this.hostId = this.players.find((p) => p.connected)?.sessionId ?? '';
    this.broadcastLobby();
  }

  override onDispose(): void {
    activeCodes.delete(this.roomId);
  }

  private player(client: Client): Player | undefined {
    return this.players.find((p) => p.sessionId === client.sessionId);
  }

  private lobbyMessage(): LobbyMessage {
    return {
      code: this.roomId,
      hostId: this.hostId,
      phase: this.phase,
      mode: this.mode,
      armySize: this.armySize,
      map: this.map,
      peoples: this.peoples,
      players: this.players
        .filter((p) => !p.left)
        .map((p) => ({ sessionId: p.sessionId, name: p.name, team: p.team, connected: p.connected })),
    };
  }

  private broadcastLobby(): void {
    this.broadcast('lobby', this.lobbyMessage());
  }

  private receiveInput(client: Client, raw: unknown): void {
    const player = this.player(client);
    const message = sanitizeInputMessage(raw);
    if (!player || !message || this.phase !== 'battle') return;
    if (message.seq <= player.ack) return;
    player.queue.push(message);
  }

  private receiveCommand(client: Client, raw: unknown): void {
    const player = this.player(client);
    const command = sanitizeCommandMessage(raw);
    if (!player || !command || !this.match || player.armyId === null) return;
    const before = this.match.events.length;
    applyCommand(this.match, player.armyId, command);
    this.pendingEvents.push(...this.match.events.slice(before));
  }

  private receiveSettings(client: Client, raw: unknown): void {
    const settings = sanitizeLobbySettings(raw);
    if (!settings || client.sessionId !== this.hostId || this.phase !== 'lobby') return;
    this.mode = settings.mode;
    this.armySize = settings.armySize;
    this.map = settings.map;
    this.peoples = settings.peoples;
    this.broadcastLobby();
  }

  private switchTeam(client: Client): void {
    const player = this.player(client);
    if (!player || this.phase !== 'lobby') return;
    player.team = player.team === 0 ? 1 : 0;
    this.broadcastLobby();
  }

  private startMessage(): StartMessage {
    const armies: Record<string, number> = {};
    for (const p of this.players) if (p.armyId !== null) armies[p.sessionId] = p.armyId;
    if (!this.match) throw new Error('No battle running');
    return { settings: this.match.settings, armies };
  }

  private startBattle(client: Client): void {
    if (client.sessionId !== this.hostId || this.phase !== 'lobby') return;
    const lobby = this.lobbyMessage();
    if (!canStartBattle(lobby)) return;
    const settings = battleSettings(lobby, (Date.now() & 0x7fffffff) | 0);
    this.players.forEach((p, i) => {
      p.armyId = i;
      p.queue = [];
      p.ack = -1;
      p.lastInput = neutralInput();
      p.staleTicks = 0;
    });
    this.match = createMatch(settings);
    // Players still reconnecting get an army too; it falls if they do not make it back in time.
    for (const p of this.players) if (!p.connected && p.armyId !== null) setArmyConnected(this.match, p.armyId, false);
    this.pendingEvents = [];
    this.phase = 'battle';
    void this.lock();
    this.broadcast('start', this.startMessage());
    this.broadcastLobby();
  }

  /** Takes this tick's input for a player: one queued input, or the last one again if none arrived. */
  private nextInput(player: Player): CommanderInput {
    if (player.queue.length > NET.maxQueuedInputs) player.queue.splice(0, player.queue.length - INPUTS_KEPT_WHEN_BEHIND);
    const next = player.queue.shift();
    if (next) {
      player.lastInput = next.input;
      player.ack = next.seq;
      player.staleTicks = 0;
    } else if (++player.staleTicks > NET.maxQueuedInputs) {
      // A hidden tab stops sending input: stand still instead of running on forever.
      player.lastInput = neutralInput(player.lastInput.faceYaw);
    }
    return player.lastInput;
  }

  private tick(): void {
    const match = this.match;
    if (this.phase !== 'battle' || !match) return;
    const inputs = new Map<number, CommanderInput>();
    for (const p of this.players) {
      if (p.armyId !== null && p.connected) inputs.set(p.armyId, this.nextInput(p));
    }
    stepMatch(match, inputs, 1 / SIM.serverTickRate);
    this.pendingEvents.push(...match.events);

    const view = matchView(match);
    const bytes = encodeSnapshot(view);
    for (const p of this.players) {
      if (!p.client || !p.connected) continue;
      const snapshot: SnapshotMessage = { bytes, armies: view.armies, events: this.pendingEvents, ack: p.ack };
      p.client.send('snap', snapshot);
    }
    this.pendingEvents = [];

    if (match.phase === 'over') this.returnToLobby();
  }

  private returnToLobby(): void {
    this.phase = 'lobby';
    this.match = null;
    this.players = this.players.filter((p) => !p.left);
    for (const p of this.players) p.armyId = null;
    if (!this.players.some((p) => p.sessionId === this.hostId)) this.hostId = this.players[0]?.sessionId ?? '';
    void this.unlock();
    this.broadcastLobby();
  }
}
