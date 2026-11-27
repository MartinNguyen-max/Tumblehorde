# Tumblehorde — technical design

Version numbers must be verified at setup, since they change quickly.

Verified at setup (2026-11-26): Node 24.22 LTS, TypeScript 7.0, Vite 8.3, Vitest 5.1,
`@babylonjs/core` 9.37, `@babylonjs/havok` 1.3.14, `@colyseus/core` 0.18.30,
`@colyseus/ws-transport` 0.18.5, `@colyseus/sdk` 0.18.10.

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
  *Verified:* the SDK exports `Predict`/`Reconciler`, tied to schema state. We use our own replay-based prediction instead (see `DECISIONS.md`).

## As built

### Simulation (`/shared`)

- `stepMatch(state, inputs, dt)` advances the battle one fixed step: bot commanders, unit AI,
  weapons, movement (gravity, terrain, map edge, obstacles, crowding, trampling), arrows,
  respawns, disconnect timers, elimination and victory.
- All tunables are in `shared/src/config.ts`. The terrain is a heightfield in `terrain.ts`;
  the client builds its mesh from the same grid, so feet always touch the ground.
- Every step produces `SimEvent`s (hits with knockback vectors, deaths, swings, arrows landing,
  orders...). The client turns them into animations, ragdolls, particles and HUD messages.
- `MatchView` (`view.ts`) is the render model: built from the state locally, decoded from
  snapshots online, blended with `interpolateViews`.

### Client (`/client`)

- `render/`: world (terrain, scenery, edge walls, lights, Havok), instanced box-part rigs with
  procedural animation, Havok ragdolls for the dead, arrows and particles, follow camera.
- `game/`: `LocalSession` (simulation in the browser at 60 Hz) and `GameController` (input →
  commands, camera, renderer, HUD). `online/OnlineSession` implements the same `Session` interface.
- `ui/`: landing page (with a live bot battle behind it), HUD, lobby, results.
- `?debug` exposes `window.tumblehorde` for automated smoke tests (start, fast-forward, commands).

### Network (`/server` + `shared/src/net.ts`)

| Message | Direction | Content |
|---|---|---|
| `lobby` | server → all | code, host, phase, mode, army size, players |
| `settings`, `team`, `start` | client → server | host settings, team switch, start (host only) |
| `start` | server → all | match settings and the sessionId → army mapping |
| `input` | client → server | sequence number + validated `CommanderInput`, 20 per second |
| `command` | client → server | order, split or mount (validated) |
| `snap` | server → each | binary snapshot, army status, events, last applied input `ack` |

- The server ticks the simulation at 20 Hz and sends a snapshot every tick. Each tick consumes
  one queued input per player (or repeats the last one); long queues are trimmed.
- Clients rebuild the static roster (unit kinds, armies) from the match settings, so snapshots
  only carry what changes.
- Disconnect: `onDrop` starts the 30 s army timer and `allowReconnection(30)`; `onReconnect`
  cancels it and resends `start` so the client can rebuild its session.

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

## Campaign (M11)

- **Logic (`shared/src/campaign/`):** chapter list and order, save shape with `parseSave` (validates everything read back), legion roster (names, veterans, permadeath from the Dark Forest, fortress recruits), heroes per chapter, the beat timeline with hold-to-skip, dialogue cursor with choices, NPC behaviour (stroll, flee, knocked out, talk) and free-roam walking with building footprints. All covered by Vitest.
- **Cutscenes (`client/src/cinematic/`):** a scene is a `Cutscene` whose `create(stage)` builds its set and cast and returns `Beat`s (shot, line or narration, title, letter, fade, music, sound, `run` at the start, `during` every frame, `choice`). `CutscenePlayer` drives them with the shared timeline; a skipped beat calls `during(stage, 1)` and finishes every walk so the scene stays consistent. `Stage` holds the set, actors, light preset, fires and weather; `CinematicOverlay` is the DOM layer.
- **Campaign flow (`client/src/campaign/`):** `Campaign` walks the chapters (loading card → cutscenes, free roam, later arena and battles), saves at each chapter start, and owns the Esc menu. `FreeRoam` runs a district (`districts.ts`) with its people and dialogues (`dialogues.ts`).
- **Sound:** `client/src/audio/music.ts` (cutscene music) and `cinematicAudio.ts` (music, mood voices, story effects) play through `AudioEngine.directOut()`.
- `?debug` adds `tumblehorde.cutscene(id)`, `tumblehorde.chapter(id)` and `tumblehorde.campaign`.

## Fighting, peoples and story battles (M9, M10, M13)

- **Close fighting (`shared/src/duel.ts`):** target scoring (revenge, turned backs, enemies busy with a friend, a crowding penalty, counted once per step), the duel steering (keep a sword's length, circle, step in, flank to the back), dodges, counters after a block and planned shield bashes. `combat.ts` applies courage (rally), remembers attackers and per-army threat, and resolves bashes and axe hooks.
- **Peoples:** `Faction` (`roman`, `viking`, `bandit`, `zombie`) is set per army (`ArmySetup.faction`) and copied onto every unit; weapons (`axe`, `claw`), shields, speeds and HP follow it (`units.ts`, `config.ts` `VIKING`, `BANDIT`, `ZOMBIE`). `FACTION_FORMATIONS` limits each people to its own formations (`boar` and `swarm` are Viking shapes). Online, `LobbyMessage.peoples` picks them.
- **Story battles:** extra `ArmySetup` options (exact soldier count, spawn point, a bot commander, named heroes who get back up, a later arrival, endless reinforcements, toughness, bot style) and `MatchSettings.prepareTime`. `shared/src/campaign/battles.ts` builds each battle chapter from the save, decides hold clocks and the last stand (`checkStoryGoal`) and reads the result (`battleResult`). Story-only maps are `CAMPAIGN_MAP_IDS` (named spawn points kept clear of trees).
- **Client:** `render/viking.ts` and `render/folk.ts` build the new peoples (Vikings vary per warrior; story heroes and generals get their own looks in `rigs.ts`). `campaign/storyBattle.ts` runs a story battle on the campaign's battle host (`CampaignDeps.startBattle`, which returns the `LocalSession`), with `battleSet.ts` for dusk, night, fire and torches. `render/camera.ts` has the first-person mode and keeps the third-person camera out of walls and tree crowns; `render/weather.ts` is the falling snow; structures get one static Havok body so ragdolls hit walls.
- **Checks:** `tools/browser-check.mjs` drives headless Chrome through a scenario of steps; `tools/campaign-playthrough.json` races through the whole campaign. `server/scripts/smoke.ts` plays Romans against Vikings online.
