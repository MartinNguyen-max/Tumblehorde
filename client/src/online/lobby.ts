import { Client, type Room } from '@colyseus/sdk';
import {
  DEFENDER_TEAM,
  canStartBattle,
  type LobbyMessage,
  NET,
  normalizeRoomCode,
  ROOM_NAME,
  type StartMessage,
} from '@tumblehorde/shared';
import { paletteForArmy } from '../palettes.ts';
import { byId, escapeHtml, segmented } from '../ui/dom.ts';

const TOKEN_KEY = 'tumblehorde.reconnect';

export interface LobbyHooks {
  onStart(room: Room, start: StartMessage): void;
  /** The room is gone (left, kicked or the server went away). */
  onClosed(reason: string): void;
}

export function serverEndpoint(): string {
  const fromUrl = new URLSearchParams(location.search).get('server');
  if (fromUrl) return fromUrl;
  const fromEnv: unknown = import.meta.env.VITE_SERVER_URL;
  if (typeof fromEnv === 'string' && fromEnv) return fromEnv;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.hostname || 'localhost'}:${NET.port}`;
}

export function roomCodeFromUrl(): string | null {
  const code = new URLSearchParams(location.search).get('room');
  return code ? normalizeRoomCode(code) : null;
}

function storeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: reloading the page simply will not rejoin.
  }
}

function storedToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/not found|invalid/i.test(message)) return 'No open room with that code (it may be full or mid-battle).';
  if (/locked|full/i.test(message)) return 'That room is full or already fighting.';
  return `Could not reach the game server (${message}).`;
}

/** Creating, joining and showing an online room before (and between) battles. */
export class OnlineLobby {
  private readonly overlay = byId('lobby');
  private readonly codeEl = byId('lobby-code');
  private readonly linkEl = byId('lobby-link', HTMLAnchorElement);
  private readonly playersEl = byId('lobby-players');
  private readonly statusEl = byId('lobby-status');
  private readonly startButton = byId('lobby-start', HTMLButtonElement);
  private readonly teamButton = byId('lobby-team', HTMLButtonElement);
  private readonly sizeSeg = segmented(byId('lobby-size'), () => this.sendSettings());
  private readonly modeSeg = segmented(byId('lobby-mode'), () => this.sendSettings());
  private readonly mapSeg = segmented(byId('lobby-map'), () => this.sendSettings());
  private readonly peoplesSeg = segmented(byId('lobby-peoples'), () => this.sendSettings());
  private room: Room | null = null;
  private lobby: LobbyMessage | null = null;
  private readonly hooks: LobbyHooks;

  constructor(hooks: LobbyHooks) {
    this.hooks = hooks;
    this.startButton.addEventListener('click', () => this.room?.send('start'));
    this.teamButton.addEventListener('click', () => this.room?.send('team'));
    byId('lobby-leave').addEventListener('click', () => void this.leave());
    byId('copy-link').addEventListener('click', () => {
      void navigator.clipboard?.writeText(this.linkEl.href).catch(() => undefined);
    });
  }

  get inRoom(): boolean {
    return this.room !== null;
  }

  get current(): LobbyMessage | null {
    return this.lobby;
  }

  async create(name: string): Promise<void> {
    const room = await new Client(serverEndpoint()).create(ROOM_NAME, { name });
    this.bind(room);
  }

  async join(name: string, rawCode: string): Promise<void> {
    const code = normalizeRoomCode(rawCode);
    if (code.length !== NET.roomCodeLength) throw new Error('Enter the 5-letter room code.');
    try {
      const room = await new Client(serverEndpoint()).joinById(code, { name });
      this.bind(room);
    } catch (error) {
      throw new Error(describeError(error));
    }
  }

  /** After a page reload, try to get back into the battle we were in. */
  async tryReconnect(): Promise<boolean> {
    const token = storedToken();
    if (!token) return false;
    try {
      const room = await new Client(serverEndpoint()).reconnect(token);
      this.bind(room);
      return true;
    } catch {
      storeToken(null);
      return false;
    }
  }

  private bind(room: Room): void {
    this.room = room;
    storeToken(room.reconnectionToken);
    room.onMessage('lobby', (message: LobbyMessage) => {
      this.lobby = message;
      this.render();
    });
    room.onMessage('start', (message: StartMessage) => {
      this.overlay.hidden = true;
      this.hooks.onStart(room, message);
    });
    room.onReconnect(() => storeToken(room.reconnectionToken));
    room.onLeave((code) => {
      if (this.room !== room) return;
      this.room = null;
      this.lobby = null;
      storeToken(null);
      this.overlay.hidden = true;
      this.hooks.onClosed(code === 1000 || code === 4000 ? 'You left the room.' : 'Disconnected from the room.');
    });
    const url = new URL(location.href);
    url.search = `?room=${room.roomId}`;
    history.replaceState(null, '', url);
  }

  show(): void {
    this.overlay.hidden = false;
    this.render();
  }

  hide(): void {
    this.overlay.hidden = true;
  }

  /** Leaves the room; `quietly` skips telling the menu (something else, like the story, has the screen). */
  async leave(quietly = false): Promise<void> {
    const room = this.room;
    this.room = null;
    this.lobby = null;
    storeToken(null);
    this.overlay.hidden = true;
    const url = new URL(location.href);
    url.searchParams.delete('room');
    history.replaceState(null, '', url);
    if (room) await room.leave(true).catch(() => undefined);
    if (!quietly) this.hooks.onClosed('You left the room.');
  }

  private sendSettings(): void {
    this.room?.send('settings', { mode: this.modeSeg.get(), armySize: Number(this.sizeSeg.get()), map: this.mapSeg.get(), peoples: this.peoplesSeg.get() });
  }

  private render(): void {
    const lobby = this.lobby;
    const room = this.room;
    if (!lobby || !room) return;
    const isHost = lobby.hostId === room.sessionId;
    this.codeEl.textContent = lobby.code;
    const link = `${location.origin}${location.pathname}?room=${lobby.code}`;
    this.linkEl.href = link;
    this.linkEl.textContent = link;
    this.sizeSeg.set(String(lobby.armySize));
    this.modeSeg.set(lobby.mode);
    this.mapSeg.set(lobby.map);
    this.peoplesSeg.set(lobby.peoples);
    const siege = lobby.map === 'castle';
    for (const b of this.overlay.querySelectorAll<HTMLButtonElement>('#lobby-settings button')) b.disabled = !isHost;
    const armies = lobby.players.map((p, i) => ({ id: i, team: lobby.mode === 'ffa' ? i : p.team }));
    this.playersEl.innerHTML = lobby.players
      .map((p, i) => {
        const color = paletteForArmy(armies, i, lobby.mode).body;
        const tags = [
          p.sessionId === lobby.hostId ? 'host' : '',
          p.sessionId === room.sessionId ? 'you' : '',
          lobby.mode === 'teams' ? (siege ? (p.team === DEFENDER_TEAM ? 'defends the gate' : 'attacks') : `team ${p.team + 1}`) : '',
          p.connected ? '' : 'reconnecting…',
        ].filter(Boolean);
        return `<li><span class="dot" style="background:${color}"></span>${escapeHtml(p.name)}<span class="tag">${tags.join(' · ')}</span></li>`;
      })
      .join('');
    this.teamButton.hidden = lobby.mode !== 'teams';
    const ready = canStartBattle(lobby);
    this.startButton.hidden = !isHost;
    this.startButton.disabled = !ready || lobby.phase !== 'lobby';
    this.statusEl.textContent =
      lobby.phase === 'battle'
        ? 'A battle is in progress…'
        : lobby.players.length < NET.minPlayers
          ? 'Waiting for at least one more player to join…'
          : !ready
            ? siege && lobby.mode === 'teams'
              ? 'At the castle exactly one player defends the gate (team 1); everyone else attacks.'
              : 'Both teams need at least one player.'
            : isHost
              ? 'Everyone is here? Start the battle!'
              : 'Waiting for the host to start the battle…';
  }
}
