# Tumblehorde — technical design

Version numbers must be verified at setup, since they change quickly.

## Stack

| Part | Choice | Why |
|---|---|---|
| 3D engine | Babylon.js | Game-oriented, built-in physics and debug tools |
| Physics (client) | Havok (`@babylonjs/havok`) | Free under MIT. Used for visual physics: toppling, shoving, falling |
| Language | TypeScript (strict) | Same language in client and server |
| Multiplayer | Colyseus 0.18 | Rooms, synchronisation and matchmaking. Open source (MIT) |
| Client SDK | `@colyseus/sdk` | The client side of Colyseus |
| Build | Vite | Fast and modern |
| Test | Vitest | Standard for TypeScript |
| Hosting (client) | GitHub Pages or Cloudflare Pages | Free static hosting |

## Folder structure

```
/shared      pure game logic (simulation). No Babylon or Colyseus imports.
/client      Babylon.js, input, HUD and Havok physics
/server      Colyseus rooms and authoritative simulation
/docs        design and decisions
```

`/shared` runs both in the browser (local bot battle) and on the server (online). That is why bot battles make sense first.

## Architecture

- **Local battle:** Runs entirely in the browser. No server.
- **Online battle:** The server runs the `/shared` simulation and is authoritative. The client sends input and displays state.
- **Tick:** The server runs at a fixed tick (proposal: 20 Hz).
- **Client display:** Remote players are interpolated between ticks so movement is smooth.
- **Own character:** Prediction, so movement feels instant. Colyseus 0.18 has built-in support. This is verified at setup.

## Physics

- **Client:** Havok drives visual physics. Characters topple, get shoved and fall.
- **Server:** Simple math decides hits, damage and the knockback vector.
- The client receives the knockback vector from the server and lets Havok display it.

## Hosting

| Phase | Solution | Price |
|---|---|---|
| Local development | Own PC | 0 kr |
| Testing with friends | Oracle Always Free or Render Starter | 0 kr / $7/mo |
| Public | Colyseus Cloud or own VPS | from $15/mo |

The client is hosted statically for free.

## Performance targets (proposal)

- 60 FPS in the browser with up to 4 armies × 30 units + horses.
- Max 4 players online.
- The server must be able to run on a small VPS.
