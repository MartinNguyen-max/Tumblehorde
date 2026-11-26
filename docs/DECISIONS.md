# Decisions

Format: date, decision, rationale. If a decision is changed, a new line is written instead of deleting the old one.

## 2026-11-26

- **Name: Tumblehorde.** Repo `tumblehorde`. *Tumble* is the goofy physics, *horde* is the army. The name avoids "wall", which was too close to Shieldwall. Rejected: Tumblewall, Fumblelord (taken), Fumblecharge, Tumblefray.
- **Browser, 3D, third-person camera.** It should be easy to get started, and it fits the desired look.
- **Jumping and goofy physics.** Inspired by Fall Guys and Shieldwall.
- **Bots first, online later.** So we can test the core without a server.
- **Colyseus for online.** The room model fits creating and joining battles. Open source, and free to self-host.
- **Babylon.js + Havok in the client.** Havok is free under MIT and gives goofy physics.
- **Simple math for hits on the server.** So everyone sees the same thing, and synchronisation is kept simple.
- **Shared simulation code in `/shared`.** Same logic in browser and server. Makes bots-first possible.
- **Open map, about 150 × 150 m, invisible edges.** Small and easy to overview. More maps come later.
- **No castles and no villages in v1.** Keeps scope down.
- **Victory: all enemies dead.** Simple and clear.
- **The commander respawns after about 10 seconds.** The army keeps fighting in the meantime.
- **Army: 10/20/30 units per side, chosen by the player.**
- **All unit types in v1:** Swordsman, archer and rider with horse and spear. This is a choice that increases scope. The milestones in `MVP.md` make it manageable.
- **Local: max 4 armies in total.** You and 1–3 bot armies.
- **Online: 2–4 armies.** Online bots are postponed.
- **Disconnect: 30 seconds, then the army dies.**
- **One team format in v1:** Free-for-all and 2 teams. More later.
- **Health bar only above your own character.** Keeps the screen tidy.
- **Orders on keys 1–4.** Proposal, not approved yet.
- **Graphics: low-poly like the screenshot.** Bright team colors, and clear silhouettes.
- **Hosting: own PC locally. Oracle Always Free or Render Starter for testing. Colyseus Cloud later.** Free to begin with.

## 2026-11-26 (implementation)

Decisions made while building v1. None of them replace an earlier line.

- **Toolchain: Node 24 LTS, TypeScript 7, Vite 8, Vitest 5, Babylon.js 9 + Havok 1.3, Colyseus 0.18.** Verified on npm at setup. npm workspaces for `shared`, `client` and `server`.
- **Server runs TypeScript directly with Node's built-in type stripping.** No extra build step or runner dependency. Hence `erasableSyntaxOnly` and `.ts` import extensions everywhere.
- **Fixed simulation rates: 60 Hz locally, 30 Hz on the server, 20 Hz snapshots.** Movement integrates gravity exactly, so jumps are the same at any rate.
- **Animations are procedural, not Mixamo.** The characters are box rigs like the style reference; procedural walk/strike/shield/draw/stun poses fit that look, need no external assets or accounts, and can be changed in code. Death and falls use Havok ragdolls.
- **Split into groups is by unit type.** 2 groups = melee | archers, 3 groups = swordsmen | archers | riders. `Tab` picks which group the next order goes to (or all). Key `4` cycles 1 → 2 → 3 → 1 groups.
- **Hold means "stay where you are".** A group on Hold keeps its current center and faces the commander's direction; melee units only engage within 6 m, archers shoot within range.
- **The commander respawns next to their army** (at the center of the living soldiers) with 2 s of invulnerability. With no soldiers left there is no respawn: an army is out when all soldiers and the commander are down.
- **Orders need a living commander.** While the commander is down, the army keeps its last orders (the order buttons are greyed out).
- **No friendly fire** for swords, spears, arrows or trampling.
- **Mounted targets:** a hit on a rider lands on the horse half of the time; riders are never knocked out of the saddle, only thrown when the horse dies. Any free horse can be mounted (`E`), also by the commander.
- **Medium bots march, then engage.** Beyond 45 m the bot army follows its commander as one block; closer than that it splits: melee attacks, archers hold and shoot.
- **Team colors:** free-for-all uses blue/red/gold/purple; in 2 teams allies share a color family (blue/teal vs red/orange).
- **Enemy count label:** shown above an enemy army when the camera looks within ~12° of its center.
- **Landing page shows a live bot battle** behind the menu, so the game sells itself before you click.
- **Online sync uses our own binary snapshots, not Colyseus schema state.** The server already runs the full shared simulation; sending a compact snapshot of what moves (~25 bytes per living unit, 20 per second) plus the tick's events is simpler than mirroring every unit into schema classes, and keeps one view model for local and online play. Colyseus provides rooms, matchmaking, messaging and reconnection.
- **Own-commander prediction is our own, not Colyseus `Predict`.** Colyseus 0.18 does ship prediction helpers, but they are built around schema state and `defineInput`. We replay unacknowledged inputs through the same shared movement code instead (`predictCommanderStep`), which a test checks against the server step. On horseback the commander is not predicted.
- **Room code = room id.** Five letters without I and O, shareable as `?room=CODE`.
- **Lobby rules:** the first player is host and picks army size and mode; only the host can start; 2 teams needs players on both sides. Rooms are locked during a battle and return to the lobby afterwards ("Back to lobby" on the results screen).
- **Leaving mid-battle counts as disconnecting.** The army fights on with its last orders and falls after 30 s unless the player reconnects (the SDK retries automatically; a page reload rejoins via a stored reconnection token).
- **Server tick changed from 30 Hz to 20 Hz** (replaces the 30 Hz in "Fixed simulation rates" above). It matches the 20 Hz proposal in `TECH.md`, a snapshot goes out every tick, and clients send input at the same rate so each tick consumes exactly one input.
