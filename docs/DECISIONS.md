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
- **A stolen horse keeps its army id but fights for its rider's side** (`sideArmyId`). The roster sent to clients never changes during a battle, so a horse's army can't change either.
- **A silent client stops acting.** If a connected player sends no input for a few ticks (e.g. a hidden tab), their commander stands still instead of repeating the last input.

## 2026-11-26 (after the first playtest)

- **Commanders start on horseback and carry sword, spear and bow** (`Q` switches). Requested by the player. The shield works with sword or spear on foot. The bow aims where the camera looks.
- **The commander gets back up where they fell after 15 s** (replaces "respawns next to their army after ~10 s"), shoving nearby enemies away, and the camera stays on them meanwhile. Matches the GDD's "they patch themselves up".
- **A leaderless army fights on by itself** (replaces "the army keeps its last orders while the commander is down"). Any army whose commander is down, a player's too, is run by the bot planner until the commander is back.
- **Armies always have three groups: swordsmen, archers, cavalry** (replaces split-by-key-4 and `Tab`).
- **Roman shield wall:** swordsmen on Hold close ranks, lock shields towards the nearest enemy and stab out from behind them; a raised shield next to another blocks 97 % and cannot be pushed.
- **Bot strategy:** form up (15 s) → march as a column → standoff with a shield wall while archers shoot → engage (swords charge, cavalry hunts archers) → regroup at the starting area when badly outnumbered. The bot commander stays behind the line and uses the bow.
- **Holding units face the enemy**, and idle soldiers look at the nearest enemy.
- **A player's Hold forms the army up around the commander** (replaces "Hold means stay where you are" for players), facing where the commander looks: up to 8 swordsmen in a shield-wall front line ahead, the remaining swordsmen as a guard ring, archers in rows behind, cavalry on the flanks. Bots and leaderless armies still hold where they stand, facing the enemy.
- **Shields work on horseback** for the commander (with sword or spear). AI cavalry keeps both hands on the lance.
- **Choosing who hears orders: `6` whole army, `7` swordsmen, `8` archers, `9` cavalry.** The choice sticks; `1`/`2`/`3` (Follow/Hold/Attack) go to the selected group. Selected soldiers show a bobbing marker. Requested by the player after trying hold-key chords.
- **Characters are round "beans" with googly eyes (Fall Guys style)** instead of boxes: glossy capsules and spheres, Roman crested helmets, scuta with emblem and boss, round shields for commanders and riders. Swings vary (chop, swipe, thrust, commander spin); hits squash and wobble, stunned units see stars, flung units flail, the dead get X eyes. Corpses always topple and sink away after ~25 s.
- **A knocked-out commander's body is simulated** (it slides from the blow) and they get up exactly where it lies; the camera stays on the body.
- **Battlefield choice on the landing page** (Random, Meadow, Desert, Rocks) also switches the live background battle.
- **The map is now 220 × 220 m** (replaces "about 150 × 150 m"), armies start on a 85 m circle (170 m apart for two armies) and bots form up for 20 s. Requested by the player: more time to plan before contact.
- **Every battlefield has structures with real collision** (oriented boxes in `shared/src/structures.ts`): the Rocky Highlands are bare rock with a walled village in the middle (gates on the roads, towers, houses with narrow alleys, a well); the Meadow has a farmstead with fences and field walls; the Desert has temple ruins and adobe huts. Arrows hit them. AI soldiers follow walls to get around them (no full pathfinding).
- **Characters are faceted** (flat-shaded, few sides) instead of smooth: between the first boxes and the round beans, as the player asked. Eyes stay smooth and googly.
- **Horses jump** when the rider jumps.
- **Commanders have right of way:** their own soldiers always step aside, and enemies only shove them a little, so they don't get stuck in crowds.
- **The landing page battle mirrors the current setup** (bot armies, teams, army size, battlefield).

## 2026-11-26 (Roman legion)

- **Armies are swordsmen only for now** (replaces "Armies always have three groups" in practice). Archers and cavalry are parked, not deleted: `MatchSettings.mix = 'mixed'` still builds them and their tests still run. Requested by the player to keep controls simple.
- **The bow is parked too.** Commanders carry sword and spear (`Q`); arrows only exist for the parked archers. Requested by the player.
- **Only the commander rides a horse.**
- **Army sizes are 15, 25 and 40** (replaces 10/20/30). Requested by the player.
- **Bot armies have no commander** (`ARMY.botCommanders = false`); they run themselves with the leaderless planner. Without a commander to follow they march by holding a spot ~10 m ahead and moving it on, so they advance in formation. Makes the player's commander the special one. Requested by the player.
- **Swordsmen carry a pilum on Follow and Hold and draw the gladius on Attack.** The spear reaches further (2.7 m) and shoves harder; the sword hits harder. Swapping takes 0.5 s.
- **Hold has formations: long line, two lines (default) and a circle around the commander.** Soldiers stand 0.95 m apart, keep their order along the line so nobody crosses the formation, face their slot's way (a ring faces outwards) and only turn to enemies within ±85° of it. Tap `2` to hold in the last formation; keep `2` down for a see-through wheel and point the mouse at a formation (release or click picks it). Replaces the old "front line + guard ring" Hold and the `6`–`9` group keys.
- **A commander's horse charge breaks shield walls**: shields do not stop it and the soldiers stay down ~2.8 s. Requested by the player: makes the commander matter.
- **Characters are Roman legionaries** (replaces the faceted beans for swordsmen and commanders): lorica segmentata, Gallic helmets with team-colored crests, tall curved scuta that reach the ground, pilum and gladius, a face with scowling brows. The commander wears a bronze muscle cuirass, big pauldrons, greaves, an armored sword arm, a cape and a sideways crest; their horse wears barding. Mounted sword strikes hack downwards. Smooth, shiny shapes for characters; the world stays low-poly. Parked archers and riders keep the old bean look.
- **Banquet (`4`), once per battle.** The army gathers round the commander for 6 s and drinks (an order ends it early); from then on every soldier is drunk for good: they sway, drift around their place in a formation, trip now and then when running, but take 55 % damage and 40 % knockback, hit 30 % harder and faster, shove 1.8× as hard, weigh 2.5× in a crowd, and no shield wall locks against their blows. Drunkenness is decided by the simulation (deterministic sway from time and id, trips from the seeded RNG) so online play agrees. Faces get a red nose, blush, droopy lids, drool and bubbles. Requested by the player.
- **Rally speech (`5`)** is purely for show: the commander raises their weapon and shouts (rings of sound, words in the air), and the soldiers cheer back (pump weapons, bang swords on shields, hop). The simulation only emits a `rally` event with a short cooldown, so it works online too. Requested by the player.
- **Characters are baked for speed:** every part under one body node is merged once per look into a single mesh and instanced (about 90 → 25 instances per soldier); scenery transforms are frozen. 4 × 40 soldiers went from ~20 000 to ~5 500 instances.
