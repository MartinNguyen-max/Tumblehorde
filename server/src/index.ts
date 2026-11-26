import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { NET, ROOM_NAME } from '@tumblehorde/shared';
import { BattleRoom } from './BattleRoom.ts';

export async function startServer(port: number): Promise<Server> {
  const server = new Server({ transport: new WebSocketTransport() });
  server.define(ROOM_NAME, BattleRoom);
  await server.listen(port);
  return server;
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? NET.port);
  await startServer(port);
  console.log(`Tumblehorde server listening on ws://localhost:${port}`);
}
