// End-to-end check of the online flow against a running server:
// two players create/join a room, start a battle, send input and receive snapshots.
// Usage: node server/scripts/smoke.ts [ws://localhost:2567]
import assert from 'node:assert/strict';
import { Client, type Room } from '@colyseus/sdk';
import {
  decodeSnapshot,
  FORMATION,
  MAP,
  type LobbyMessage,
  NET,
  neutralInput,
  ROOM_NAME,
  rosterFor,
  type SnapshotMessage,
  type StartMessage,
} from '@tumblehorde/shared';

const endpoint = process.argv[2] ?? `ws://localhost:${NET.port}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function track(room: Room) {
  const seen = { lobby: null as LobbyMessage | null, start: null as StartMessage | null, snaps: [] as SnapshotMessage[] };
  room.onMessage('lobby', (m: LobbyMessage) => (seen.lobby = m));
  room.onMessage('start', (m: StartMessage) => (seen.start = m));
  room.onMessage('snap', (m: SnapshotMessage) => seen.snaps.push(m));
  return seen;
}

const host = await new Client(endpoint).create(ROOM_NAME, { name: 'Host' });
const hostSeen = track(host);
assert.match(host.roomId, /^[A-Z]{5}$/, 'room id is a 5-letter code');
const guest = await new Client(endpoint).joinById(host.roomId, { name: 'Guest<script>' });
const guestSeen = track(guest);
await sleep(300);
assert.equal(hostSeen.lobby?.players.length, 2, 'both players in the lobby');
assert.equal(hostSeen.lobby?.players[1]?.name, 'Guestscript', 'names are sanitized');

guest.send('start');
await sleep(200);
assert.equal(hostSeen.start, null, 'only the host can start');

host.send('settings', { mode: 'teams', armySize: 10 });
await sleep(200);
assert.equal(hostSeen.lobby?.mode, 'teams');
host.send('start');
await sleep(500);
// Read through a function: TypeScript otherwise keeps the `null` narrowing from above.
const startOf = (seen: { start: StartMessage | null }): StartMessage | null => seen.start;
const start = startOf(hostSeen);
assert.ok(start && startOf(guestSeen), 'both got the start message');
const myArmy = start.armies[host.sessionId];
assert.equal(myArmy, 0);

for (let seq = 0; seq < 20; seq++) {
  host.send('input', { seq, input: { ...neutralInput(), moveX: 1 } });
  guest.send('input', { seq, input: 'garbage' });
  await sleep(50);
}
host.send('command', { type: 'order', order: 'attack', group: null });
host.send('command', { type: 'order', order: 'nonsense', group: null });
await sleep(400);

const last = hostSeen.snaps.at(-1);
assert.ok(last, 'snapshots arrive');
assert.ok(hostSeen.snaps.length > 15, `snapshot rate ok (${hostSeen.snaps.length})`);
assert.ok(last.ack >= 15, `inputs acknowledged (ack ${last.ack})`);
const view = decodeSnapshot(new Uint8Array(last.bytes), {
  roster: rosterFor(start.settings),
  mode: start.settings.mode,
  armySize: start.settings.armySize,
  armies: last.armies,
  previous: null,
});
const commander = view.units[view.armies[0]!.commanderId]!;
const startX = -(MAP.armySpawnRadius - FORMATION.commanderSpawnAhead);
assert.ok(commander.x > startX + 5, `host commander moved (x=${commander.x.toFixed(1)}, start ${startX})`);
assert.deepEqual(view.armies[0]!.orders, ['attack', 'attack', 'attack'], 'order applied');
assert.equal(view.armies[1]!.disconnectTimer, null);
console.log(`snapshot bytes: ${last.bytes.byteLength}, events so far: ${hostSeen.snaps.reduce((n, s) => n + s.events.length, 0)}`);

await guest.leave(true);
await sleep(400);
const afterLeave = hostSeen.snaps.at(-1)!;
assert.ok(afterLeave.armies[1]!.disconnectTimer !== null && afterLeave.armies[1]!.disconnectTimer <= 30, 'leaver gets the 30 s timer');
const joinLate = await new Client(endpoint).joinById(host.roomId, { name: 'Late' }).then(() => 'joined', () => 'rejected');
assert.equal(joinLate, 'rejected', 'cannot join a battle in progress');

await host.leave(true);
console.log('online smoke test passed');
process.exit(0);
