# Tumblehorde

A goofy, fast 3D strategy game in the browser. You run around as the commander and control your own army with orders. The battle is over when all enemies are dead.

Play **battles** (Romans or Vikings against bots, or online against friends) or the **campaign**:
a long story from a monk's burned monastery, through prison, the arena and the legion, to the
last battle against Hrolf the Red and one last night. See `docs/STORY.md`.

## Documents

Read in this order:

1. `docs/MVP.md`: limited scope and milestones. **Start here.**
2. `docs/GDD.md`: game design (what the game is and how it is played)
3. `docs/BALANCE.md`: HP, damage, speeds and army composition
4. `docs/TECH.md`: technical stack, architecture and netcode
5. `docs/DECISIONS.md`: decisions and rationale
6. `docs/STORY.md`: the campaign's story, characters, chapters and choices
7. `CLAUDE.md`: coding rules (read automatically by Claude Code)

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

### The whole campaign in the browser

With the dev server running (`npm run dev`) and Google Chrome installed:

```
node tools/browser-check.mjs tools/campaign-playthrough.json /tmp/tumblehorde-shots
```

It starts a new story and races through every chapter (cutscene beats skipped, battles won at
once, choices clicked) and prints each chapter it passed, any errors, and the final save.

## Controls

| Input | Action |
|---|---|
| WASD / Space | Move / jump |
| Left click / right click (hold) | Strike / shield |
| 1 / 3 | Follow / Attack |
| 2 (tap) | Hold in the current formation |
| 2 (keep down) | Formation wheel. Romans: long line, two lines, wedge, circle around you, testudo block, pincer. Vikings: shield wall, boar's head, horns, shield ring, swarm |
| 4 | Split the army in two; again: pick half A, half B or the whole army |
| 5 / 6 | Banquet or mead feast (once: a very drunk, very tough army) / rally speech or war roar (15 s of courage, then a 40 s rest) |
| F | Advance: holding soldiers step forward towards where you look |
| R | Throw spears (Vikings: axes) at the enemies where you look (once per battle) |
| Ctrl (hold) | Crouch; crouch 4× at another player's commander up close to offer an alliance |
| Q / E | Sword (Vikings: axe) or spear / mount or dismount the horse |
| M | Sound on/off (also the speaker button, top right) |
| V, mouse wheel | Overview camera, zoom |
| T | First person ⇄ third person (also on the start page) |
| Esc | Pause (local) / release the mouse |

In the campaign: **E** talks to someone close, **1–9** (or a click) picks an answer, and
**holding Space** skips one beat of a cutscene at a time.

Battlefields: Green Meadow, Castle Siege (one army holds the gate behind a moat), The City
(narrow streets; soldiers only see what is in plain sight) and The Frozen North (a Viking
village and a frozen lake you slide on).

Peoples: lead Romans or Vikings against Romans, Vikings or both (online: all Romans, all Vikings,
or Romans vs Vikings by team).

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
