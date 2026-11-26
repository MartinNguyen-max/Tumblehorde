# Tumblehorde

A goofy, fast 3D strategy game in the browser. You run around as the commander and control your own army with orders. The battle is over when all enemies are dead.

## Documents

Read in this order:

1. `docs/MVP.md`: limited scope and milestones. **Start here.**
2. `docs/GDD.md`: game design (what the game is and how it is played)
3. `docs/BALANCE.md`: HP, damage, speeds and army composition
4. `docs/TECH.md`: technical stack, architecture and netcode
5. `docs/DECISIONS.md`: decisions and rationale
6. `CLAUDE.md`: coding rules (read automatically by Claude Code)

## Visual reference

`docs/style-reference/preview.html` is a running Three.js scene that shows the desired style: low-poly with flat shading, colors, proportions, camera angle and terrain. Open it in a browser.

It is a **style reference, not code to be reused directly**. The game is built in Babylon.js, not Three.js. But the color values, the proportions of the figures and the terrain generation are worth looking at.

## Running the game

Requires Node.js 24 or newer.

```bash
npm install
npm run dev          # client on http://localhost:5173 (play against bots)
npm run dev:server   # game server on ws://localhost:2567 (needed for online play)
```

Online: one player clicks **Create room** and shares the code or the `?room=CODE` link;
the others join, the host starts. Over a LAN, open the client via the host's IP address
(Vite prints it); the client connects to port 2567 on the same host. Point the client at
another server with `?server=wss://example.com` or `VITE_SERVER_URL` at build time.

## Checks

```bash
npm test             # Vitest for the shared simulation
npm run typecheck    # TypeScript for shared, client and server
npm run smoke -w server   # online end-to-end check (server must be running)
npm run build        # production build of the client into client/dist
```

## Controls

| Input | Action |
|---|---|
| WASD / Space | Move / jump |
| Left click / right click (hold) | Strike / shield |
| 1 / 2 / 3 | Follow / Hold (form up around you) / Attack |
| 6 / 7 / 8 / 9 | Orders go to: whole army / swordsmen / archers / cavalry |
| Q | Switch weapon: sword, spear, bow |
| E | Mount or dismount a free horse |
| V, mouse wheel | Overview camera, zoom |
| Esc | Pause (local) / release the mouse |

## Layout

```
/shared   pure game logic and network protocol (Vitest)
/client   Babylon.js + Havok client, HUD, landing page
/server   Colyseus room running the shared simulation
/docs     design, balance, tech and decisions
```

## Deploying

The client is static: `npm run build` and host `client/dist` on GitHub Pages or
Cloudflare Pages. Run the server anywhere Node 24 runs (`npm start -w server`, `PORT`
env var), and build the client with `VITE_SERVER_URL=wss://your-server`.
