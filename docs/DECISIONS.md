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
- **Battlefields are Meadow, Castle and City** (replaces Meadow/Desert/Rocky Highlands). Requested by the player: desert and rocks "made no sense". **Castle:** one army (team 0; in free-for-all the first army) starts in the courtyard and holds the single west gate, everyone else attacks from the field; online in team mode exactly one player may defend, and "random" never lands on the castle when the teams do not fit. Bot defenders hold the gate. Locally you pick "Defend the gate" or "Attack" (then the first bot defends and the other bots are your allies). **City:** a Roman street grid with wide avenues, narrow side streets, alleys inside the blocks, a forum with a temple, and city walls; armies start in squares at the avenue ends.
- **Grid navigation for AI** (`shared/src/navigation.ts`, replaces "no full pathfinding"): 1.5 m cells, line-of-sight first, else a shared flow field towards the goal (a few built per step, LRU-cached). Formation places that fall inside buildings move to the nearest free spot. Commander-less bots advance along the streets.
- **Online lobby picks the battlefield** (Random/Meadow/Castle/City) instead of always random.
- **Fairer melee:** strikes that finish in the same step land together (before, the unit earlier in the list stunned the other out of its swing and always won the exchange); soldiers behind a shield strike back when the enemy is between blows, and only raise the shield against 60 % of incoming blows.
- **Spears are thrust over a raised shield** on foot, so a held spear wall keeps its shields up. A held line or gate is now very strong against swords; the commander's charge and the banquet are how you break it.
- **Characters are chunky boxes again** (replaces the detailed smooth legionaries above). Requested by the player after seeing them: "too detailed and small", liked the first box soldiers best. Big cube head with box eyes and scowling brows, boxy steel chest with two lorica bands, team-colored tunic and box crest, a big square scutum; the commander gets gold, a cape and a sideways crest. Drawn 10 % larger than the collision body. Horses are boxy too, with barding.
- **The commander is as tall as the soldiers and the horse is a stocky pony** (`BODY.saddleHeight` 1.35 → 0.72): riding lifts you only a little. The follow camera sits closer and lower (6.5 m, eye level). Requested by the player.
- **A held line always has its shields up** once in place, and soldiers stand 0.86 m apart with 0.88 m wide shields, so the shields touch edge to edge. Requested by the player.
- **Fog of war in the city** (`shared/src/perception.ts`): houses block sight, so soldiers only target enemies they can see; every sighting is shared by the whole army (last known position, forgotten after 25 s or when found empty). Attacking with nobody in sight sends the army from street corner to street corner looking. Bots in the city plan from what they have seen too. Open maps are unchanged. Requested by the player.
- **Split the army in two (`4`)**: left and right half as seen from the commander; `4` again picks half A, half B or the whole army, and an order to the whole army joins the halves. Each half can hold its own formation where the commander stood. Banquet moved to `5`, rally to `6`. Requested by the player.
- **Simulation speed:** structures are bucketed by area for collisions, each soldier looks around once per think and keeps an eye on the enemy it saw (instead of searching every step), and routes are cached per soldier. 4 × 40 soldiers in the city cost ~4 ms per step (was ~11 ms).
- **Soldiers never walk straight into a wall while waiting for a route** (replaces the fallback "head straight for the goal"). Only a few flow fields are built per step; in big city fights ~40 % of route requests used to hit that limit and fall back to a straight line into the houses. Now far goals snap to a coarse lattice so soldiers share fields, the field builder is faster (bucket queue, typed tables), and without a route a soldier keeps its last visible waypoint or takes an open step towards the goal. Wall-hugging in the city halved. Requested by the player.
- **The horse runs 7.5 m/s** (was 11; soldiers walk 5, the commander 6), and tramples above 5 m/s. Requested by the player: the horse was far too quick for the army.
- **Six formations**: long line, two lines, wedge (tip in front, ranks growing by two), circle around the commander, testudo block (square) and column (three wide, for streets and gates), all on the `2` wheel. Deep formations stand ahead of the commander with the last rank just in front of them. Requested by the player.
- **Advance (`F`)**: every holding group (or the selected half) moves 4 m towards where the commander looks and turns that way. Requested by the player.
- **The castle is an island fortress** (replaces the walled square in the field): smaller in area (44 × 44 m) but much taller (8 m walls, 14–15 m towers, a 20 m keep), with barracks, stables, a smithy, market stalls, barrels and a well inside, a gate arch, and a shallow moat all round crossed by a wooden bridge to the gate. Requested by the player.
- **Water is shallow** (1.1 m): it slows everyone to 55 %, soldiers who end up in it fall flat for 1.8 s, commanders and horses just wade. It does no damage. AI soldiers route over the bridge (water counts as blocked for navigation). Requested by the player.
- **The city is denser and taller**: streets every 18 m (5 m wide, avenues 10 m), each block split into narrow 9–15 m houses with 2.2 m alleys (too narrow for AI routes, fine for sneaking), windows on every floor, the forum still open in the middle. Requested by the player.
- **Free-for-all at the castle stays free-for-all** (fixes: picking the castle forced 2 teams, so every bot attacked the player together). `ArmySetup.defends` marks the castle holder; in free-for-all every attacker fights for itself, in 2 teams the attackers are allies. Reported by the player.
- **Bot armies have a commander again** (replaces "Bot armies have no commander"), on horseback like the player's. Requested by the player (needed for alliances). A bot commander now stops leading the march 22 m from the enemy (was 45 m, which left two bot armies waiting forever just outside their 32 m form-up range).
- **Held spears shove harder** (strength 6.5, stun 0.6): a holding line is very defensive. Requested by the player.
- **Crouch (`C`) and alliances, Minecraft style.** Tap crouch 4 times within 3.5 s while looking at another commander within 16 m to offer an alliance. If they crouch back while the two of you stand close and look at each other, your armies can no longer hurt each other (shared by targeting, arrows, bots' planning and victory); each player still commands only their own soldiers. Bot commanders agree 25 % of the time: then they turn to you and crouch back. Works online between players too. A battle ends once nobody left standing is hostile to anyone else; everyone left standing wins. Crouching walks at 45 % speed. Requested by the player.
- **Spear volley (`R`), once per battle:** every soldier (of the selected half, or all) still carrying a spear throws it at an enemy within 9 m of where the commander looks, if within 30 m; they throw one after another within 0.6 s, the pila fly as projectiles (50 damage, big shove), and the soldiers fight on with swords (holding too). Requested by the player.
- **Sound and music are synthesized with Web Audio** (no files, no new dependency): a looping D-dorian marching tune, effects built from noise, oscillators and filters, and gibberish voices (a buzzy source through two vowel filters babbling random syllables, cartoon-style). Effects are placed in stereo and fade with distance from the camera, and are thinned out in big melees (at most 28 at once, same-kind sounds spaced out). Sound is off by default; the speaker button in the top right corner or `M` toggles it, the choice is remembered, and a hint bubble points at the button on the first visit. Requested by the player. Replaces "Sound comes later".
- **The play camera now really starts close** (6.5 m, low pitch): `main.ts` still forced the old 9 m distance at battle start.
- **No music; funnier sounds** (replaces the marching tune). Requested by the player: "sounds too much like robots". Voices now use a soft glottal source with breath noise, three vowel filters, pitch glides, vibrato, random squeaks and a pitch and pace of their own per soldier; there are long "waaah" death yells, "yaaay" cheers, giggles and hiccups from drunks, and a burp after the banquet. Effects went cartoon: bonks for blows, tinny "tonks" on shields, a slide whistle for anyone launched, helmet pops, a bloop after a splash, a twang for stuck spears, and a kazoo for orders, alliances, the fanfare and a sad trombone.
- **Bots have no commander again** (replaces "Bot armies have a commander again"): players lead their armies in person, online too; bots run themselves. Alliances are therefore between players only, and the bots' "crouch back" answer is gone. Requested by the player.
- **Crouch is `Ctrl`** (was `C`), like sneaking in Minecraft. Requested by the player. Ctrl+key browser shortcuts are blocked while playing, but browsers never let a page block Ctrl+W, so leaving the page during a battle asks for confirmation.
- **The bottom bar has two rows**: every number key on the first (Follow, Hold with the formation, Attack, Split, Banquet, Rally), everything else on the second (Advance, Throw spears, Sword/Spear, Shield, Horse, Crouch); one-time actions carry a "once" tag. Requested by the player.
- **Pincer replaces Column** on the formation wheel (column and testudo were too alike). Requested by the player. A third of the army goes on each wing, the rest holds a shield line in the middle. With enemies within 45 m (in the city: the last sighting), each wing swings wide past the enemy's flank, then closes in 6 m behind its line facing it and stabs at its back; with no enemy near, the wings wait ahead of the line's ends like horns.
- **Thrown spears punch through shields and stick.** Before, every pilum that met a raised shield was blocked like a sword (3–8 % got through), so a volley at a shield wall did almost nothing; now 60 % of its damage lands anyway, and the spear stays stuck in whoever (or whatever shield) it hit, riding along and falling with them. Reported by the player.
- **Held spears shove rather than kill:** 14 damage (was 20) but a 9 m/s shove (was 6.5) that lands even on a raised shield or a locked wall. Soldiers braced behind a raised shield weigh 3× in the crowd, so attackers cannot push into a held line and end up nose to nose. Requested by the player.
- **Bot armies have a fighting style**, picked at random per battle and again after they regroup: *steady* (form up, stand off, charge with swords), *charge* (skip the standoff), *phalanx* (push forward in formation 3 m at a time with spears and hold at the enemy line; after 15 s there without a breakthrough, draw swords and go in) and *patient* (wait behind a shield wall until the enemy is within 9 m, or for 50 s). Requested by the player: "sometimes charge, sometimes in formation, sometimes waiting, sometimes in formation and spear". In bot-vs-bot tests every pairing ends within ~100 s.
- **No bot battle stalls any more:** a bot army that has fallen back to regroup for 25 s makes a last stand and attacks again, and castle defenders who outnumber all attackers together two to one sally out. Before, castle battles between bots could last forever. Found in a 4 × 40 bot health run on every map.
- **Refused orders are explained**: throwing spears with nobody in range, a second volley or banquet, or Advance without a holding formation now shows a short banner saying why, instead of silently doing nothing.
- **Minimap** in the top left corner: buildings and the moat, every army as colored dots (commanders bigger), and a white arrow for you pointing where you look. In the city only enemies that you or one of your soldiers can see are shown, checked a few times a second with the same sight lines as the simulation. Added to make formations, splits and pincers easier to direct.
- **Fixes from an independent review of the simulation** (all with regression tests in `shared/test/review-fixes.test.ts`):
  - Soldiers in the moat, a narrow alley or a pocket no route leaves now find their way out (a short search through anything not solid to the nearest cell the route starts from, wading if need be), and wall-sliding never looks past a planned route's next waypoint (it used to bounce soldiers to and fro across alleys). Sight lines are checked against the real walls, so alleys and water no longer hide anyone. Bot battles in the city could run forever because of this.
  - Pincer wings are chosen once, when the pincer forms; before, soldiers swapped between the wings and the middle every step once the wings were round the enemy.
  - Splitting a holding army keeps each half holding where it stands (both halves used to crowd onto the same spots).
  - The spear volley is only thrown at an enemy; it could be wasted on empty ground.
  - A bot army picks a new style once when it starts falling back, not every step.
  - A formation order for a half that does not exist no longer changes the formation.
  - A bot army that knows where the enemy is but has not been hurt for 40 s charges, so no stand-off lasts forever. With this, every 2–4 army bot battle tried on every map ends.

## 2026-11-27 (Vikings and campaign plan)

Agreed with the player before building. None of these replace an earlier line unless stated.

- **The next update is milestones M9–M14** (see `MVP.md`): smarter and better-looking fights, Vikings and a frozen north map, then a long campaign. Built by one agent, step by step, a commit per step.
- **Vikings are a second faction**, same blocky shape and height as the Romans but with pelts, beards, longer hair, scars and broad arms, and each one looks a bit different (Romans all look alike). Axes beat shields more easily; Romans keep the tighter wall and longer reach. Tuned until bot-vs-bot battles are about 50/50. Vikings roar and scream more and have their own formations and special orders.
- **Campaign** as written in `STORY.md`, including the extra chapters (the Champion, the Ruins, the Bridge, the Outpost, the Night Raid), Eirik, Hrolf as Cassian's mirror, named legionaries with a roll call of the fallen, Livia's letters and visible ageing. One difficulty only.
- **Cutscenes are made in the game** with the same characters: camera shots, letterbox, brows, mouths and tears, emotional gibberish voices with English subtitles and a narrator (old Cassian). No recorded voices.
- **Soft, warm synthesized music plays only in cutscenes** (pad, plucked lyre, soft choir, one recurring monastery melody). Battles stay without music. Narrows "No music; funnier sounds".
- **Holding Space skips one beat** of a cutscene (a shot or a line), never the whole scene.
- **Campaign progress is saved in the browser** (localStorage) at every checkpoint. Replaces "Login, persistence" being out of scope, for the campaign only.
- **No gore.** Wounds are shown as red stains on clothes and armor.
- **The zombies come from a grave, unexplained**, and can be any kind of dead. The last battle of the campaign cannot be won.
- **Commanders still get knocked down and get back up** in army battles; in the arena, going down loses the fight.

## 2026-11-27 (M9: smarter, better fights)

- **Soldiers defend themselves whatever the order.** Whoever hurt a soldier within 4 s and 7 m becomes its target; a soldier in a held line turns round to an enemy at its back (or closer than 2.6 m) and fights back. Reported by the player: bots attacked from behind "didn't even think about it", and after Advance the line stood with its back to the enemy.
- **Target choice scores enemies** instead of taking the nearest: distance, minus a bonus for whoever hurt you, a turned back or someone fighting a friend, plus a penalty for every attacker beyond three already on that enemy. Fights spread out and soldiers go round to the enemy's back.
- **Close fighting has a rhythm** (`shared/src/duel.ts`): soldiers keep about a sword's length, circle between blows (two duellists circle the same way), step in to strike, hop out of the way of blows they see coming (30 %, 45 % on Attack), counter right after a block, sometimes leap in on Attack, and bash shield-hiders with their own shield (it knocks the guard aside). The sword wind-up is 0.38 s (was 0.3) so a blow can be seen and dodged. Requested by the player: "they are just standing on top of each other and hitting".
- **Bot armies turn on whoever hurts them most** (harm remembered per army, fading over 20 s), and a fifth bot style, *flank*, holds a pincer for 14 s to get its wings behind the enemy before charging. Reported by the player: two bots fought each other while the player attacked one from behind.
- **Soldiers keep a spear after the volley** ("we are pretending they have 2"): the volley is still once per battle, but holding soldiers use a spear again. Replaces "the soldiers fight on with swords (holding too)".
- **Advance stops at the enemy line**: a holding formation steps forward at most until its front is 1.8 m from an enemy in its way; with no room it refuses ("The enemy line is right there"). Reported by the player: Advance walked the formation through the enemy.
- **The rally speech gives courage** for 15 s (115 % damage dealt, 60 % stun and 75 % shove taken) and then needs a 40 s rest. Replaces "The commander's rousing speech: only for show". Requested by the player: "more courage, shouldn't overrule enemy but buff a bit".
- **Victory celebration**: for 7 s after the win (was 2.5 s) the winners jump, spin, dance and cheer before the results.
- **Team mates start side by side** (the meadow: around their team's side of the circle; the city: neighbouring avenue ends).
- **Castle walls count as solid for escape routes** (`NAV.solidInset` 0.1, was 0.6): a 2.4 m wall could fall between grid cells, so soldiers in the dead-end strip between moat and gate towers tried to walk out through the wall and stood there. Reported by the player.
- **Ragdolls bounce off buildings** (one static Havok body with a box per structure), and **the third-person camera stops in front of walls** instead of looking through them. Reported by the player.
- **First-person view**, a setting on the start page and `T` in battle: the commander's head is hidden, the body, shield and sword stay; looking down the eye moves forward over the chest so you see your belt, shield and sword. Requested by the player.
- **The sword got a pommel, a wider guard, a bright blade with a dark groove and a tapered point** — still a handful of boxes. Requested by the player: "make sword look sliiightly better".
