# Tumblehorde — MVP and milestones

Build in this order. Each milestone must be playable before we move on.

## Status

Updated as work progresses. ✅ done · 🚧 in progress · ⬜ not started.

| Milestone | Status | Notes |
|---|---|---|
| M1 Run around the map | ✅ | Edge push-back + toast, jump, third-person mouse-look camera |
| M2 Combat and physics | ✅ | Sword/shield, knockback + stun, Havok ragdolls on death, own health bar |
| M3 Army and orders | ✅ | 10/20/30 armies, Follow/Hold/Attack, split by unit type + Tab group select, respawn |
| M4 Bot AI and local battle | ✅ | Medium bots, 1–3 bot armies, free-for-all and 2 teams |
| M5 Archer | ✅ | Ballistic arrows with lead and spread, kiting, shield walls vs archers |
| M6 Rider and horse | ✅ | Mount/dismount (E), trample, thrown off when the horse dies, spear |
| M7 After the battle | ✅ | Results table, duration, kills/deaths, rematch |
| M8 Online | ✅ | Colyseus room with code/link, lobby, 2–4 players FFA or teams, prediction + interpolation, 30 s disconnect rule |
| M9 Smarter, better fights | ✅ | Bots defend when hit, flank and gang up; spacing, dodges, counters; spear kept after volley; rally courage; no wall clipping; celebration; first person |
| M10 Vikings and the north | ✅ | Viking faction (looks, axes, formations, orders), Romans vs Vikings ~50/50, frozen north map |
| M11 Campaign foundations | ✅ | Cutscene engine (actors with faces and tears, shots, letterbox, subtitles, narrator, title cards, letters, fades, weather, firelight), cutscene music and emotional voices, hold Space to skip one beat, one save slot at every chapter start, loading cards, Esc menu, free roam with NPCs, talk (E) and choices; Campaign card on the start page |
| M12 The capital | ✅ | Walkable capital district (forum, forge, bakery, training yard, festival street, skyline and Colosseum beyond) with 21 townsfolk; Varro's job and shop (armor, shield, sword); workout at the stone (+1 strength, 3 times); three arena fights in the Colosseum (3 poor men, 3 trained fighters, optional Draco) with a crowd, purses 25/40/60 and Draco's sword |
| M13 Campaign chapters | ✅ | All 21 chapters playable from the prologue to the end: 22 cutscenes (the prologue in four parts, the arena, the forge, the forest road, the campfire, roll calls of the fallen, the burning village with Eirik's choice, the Emperor, the ruins, Varro's death, Livia's two letters, the rally speech, Hrolf's mirror and choice, peace, the last night with the last-stand choice, the end) and the story battles (session 1) |
| M14 Polish | 🚧 | Full play-through, balance, independent review, docs |
| M14 Polish | 🚧 | Done: independent reviews of both sessions' code with fixes, full campaign play-through in the browser passes (tools/campaign-playthrough.json). Left: the player listens to music and voices and plays it through; balance and camera tweaks from that feedback |

The simulation for all unit types lives in `/shared` and is covered by Vitest
(`npm test`). The online flow is covered by `npm run smoke -w server` against a
running server. Run the game with `npm run dev` (see `README.md`).

After the first playtests (2026-11-26): three battlefields with structures (walled village,
farm, ruins), faceted googly-eyed characters, commander kit (sword/spear/bow, horse, shield on
horseback), Hold forms up around the commander, `6`–`9` select who hears orders, smarter bots
(form up → march → shield wall standoff → engage → regroup), leaderless armies run themselves,
much longer battles. See `DECISIONS.md` and `BALANCE.md` for details.

After the second round of playtests (2026-11-26): Roman legion only (archers, cavalry and the
bow parked), formations from a wheel on `2`, spear on hold and sword on attack, splitting the army
in two, banquet and rally speech, chunky box soldiers with a stocky horse, bot armies without a
commander, castle siege and city maps with grid navigation and fog of war in the city.

Next up after v1: playtesting and balance tuning, sound, more maps, more bot
difficulty levels (see "Out of scope for v1").

## M1: Run around the map
- 150 × 150 m map with invisible edges
- The edge pushes you back and shows the message "The map ends here, go back and fight!"
- Run, jump and third-person camera

**Done when:** You can run around and cannot leave the map.

## M2: Combat and physics
- Swordsman with sword and shield
- 100 HP, damage, knockback
- Death and falling with Havok
- Health bar above your own character

**Done when:** You can strike and block, and characters topple over and die in a funny way.

## M3: Army and orders
- Army with 10/20/30 units
- The orders Follow, Hold, Attack and Split into groups
- The commander respawns after about 10 seconds

**Done when:** The army follows orders, and the commander can respawn.

## M4: Bot AI and local battle
- Medium bot AI that uses orders, shield and sword
- You against 1–3 bot armies
- Free-for-all and 2 teams

**Done when:** You can play a full battle locally against bots.

## M5: Archer
- Bow and arrow
- Bots use the bow

## M6: Rider and horse
- Mount and dismount
- Horse with its own HP; when it dies, the rider falls off
- The rider has a spear

## M7: After the battle
- Status for both armies
- Battle duration, kills and deaths
- Rematch button

## M8: Online
- Colyseus room with a code or link
- 2–4 players, free-for-all or 2 teams
- 30-second timer on disconnect, after which the army dies

**Done when:** Two players can play a full battle over the network.

## M9: Smarter, better fights
- Soldiers hit from behind or the side turn and fight back; soldiers on an order still defend themselves
- Bots pick targets as a team: flank, attack from behind, gang up on the biggest threat instead of a third army
- No soldier waits behind a wall forever: they route round to an enemy they know about
- Melee keeps a fighting distance and looks like fighting: circling, wind-ups, dodges, counters, shoves; wilder on Attack
- Soldiers keep a spear for formations after the volley; Advance stops at the enemy line
- Rally gives courage (a moderate buff for a while)
- Ragdolls and the camera do not go through walls
- Allied armies start next to each other
- Winners celebrate for about 7 s before the results
- First-person view in the settings, showing your own body, shield and sword

## M10: Vikings and the north
- Viking faction with its own looks (pelts, beards, hair, scars), axes that beat shields, own formations and orders
- Romans vs Vikings, Vikings vs Vikings; bot-vs-bot simulations about 50/50
- Frozen north battlefield with snow, ice and a frozen lake

## M11–M13: Campaign
See `docs/STORY.md` for the story, chapters and cutscenes.

## M14: Polish
- Play the whole campaign through, tune balance, independent review, update docs

## Out of scope for v1
Login, persistence, mobile, more maps, online bots and more difficulty levels. (Sound was added after v1.)
