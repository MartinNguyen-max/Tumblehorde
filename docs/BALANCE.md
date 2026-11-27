# Tumblehorde — balance and numbers

Starting values, not final. They must be tuned once the game is playable. All values are collected in one config file in the code (`shared/config.ts`), so they can be changed in one place.

Units: meters, seconds and HP.

## Commander

| Value | Number |
|---|---|
| HP | 100 |
| Run speed | 6 m/s |
| Jump height | 1.2 m |
| Respawn time | 10 s |
| Sword damage | 35 |
| Sword range | 2.2 m |
| Attack cooldown | 0.6 s |

The commander is a bit stronger than a regular swordsman, but cannot win alone against an army.

## Units

| Type | HP | Speed | Damage | Range | Cooldown |
|---|---|---|---|---|---|
| Swordsman | 100 | 5 m/s | 25 | 2.0 m | 0.8 s |
| Archer | 70 | 5 m/s | 40 | 35 m | 2.0 s |
| Rider (mounted) | 100 | 11 m/s | 45 | 3.2 m | 1.0 s |
| Horse | 150 | 11 m/s | – | – | – |

- The archer is weak in melee. Their damage is the same, but their range drops to 2.0 m.
- If the horse dies, the rider falls off and keeps fighting on foot with the spear: speed 5 m/s, damage 30.

## Shield

- Blocks 80 % of damage from the front.
- Does not block from behind or from the side.
- You cannot attack while the shield is up.
- Movement with the shield up: 60 % speed.

## Knockback

| Source | Strength | Stun |
|---|---|---|
| Sword strike | 3 m/s | 0.4 s |
| Spear from horse | 9 m/s | 1.2 s |
| Collision with horse | 12 m/s | 1.5 s |
| Edge of the map | 6 m/s inward | 0 s |

Knockback should feel exaggerated. It is part of the tone, not a bug.

## Army composition

The player picks 10, 20 or 30 units. The distribution is fixed:

| Army size | Swordsmen | Archers | Riders |
|---|---|---|---|
| 10 | 6 | 3 | 1 |
| 20 | 12 | 6 | 2 |
| 30 | 18 | 9 | 3 |

## Map and battle

| Value | Number |
|---|---|
| Map size | 150 × 150 m |
| Distance between armies at start | 60 m |
| Max battle time | no limit in v1 |
| Disconnected player, timer | 30 s |

## Bot AI, medium

- Reacts to enemies within 25 m.
- Raises the shield when an enemy within 3 m attacks.
- Archers keep at least 15 m distance to the nearest enemy.
- The bot commander gives a new order at most every 5 seconds.
- The bot commander sends its army towards the nearest enemy army.

Easier and harder bots adjust reaction time and precision, not HP or damage.

## Added during implementation

Values the design did not specify. All live in `shared/src/config.ts`.

| Value | Number |
|---|---|
| Strike windup (commander / swordsman / spear on foot) | 0.2 / 0.3 / 0.3 s |
| Mounted spear windup | 0.15 s |
| Bow draw time | 0.55 s |
| Spear on foot range / cooldown | 2.4 m / 1.0 s |
| Archer melee cooldown | 2.0 s |
| Commander on horseback | 35 damage, 3.0 m, knockback 7 m/s, stun 0.9 s |
| Commander max targets per swing | 2 (units hit 1) |
| Arrow knockback | 2 m/s, stun 0.2 s |
| Arrow speed / gravity | 32 m/s / 14 m/s² |
| Bot aim spread (medium) | ±0.03 rad yaw, ±0.025 rad pitch |
| Horse trample | 10 damage when moving faster than 6 m/s |
| Hit on a mounted rider lands on the horse | 50 % |
| Knockback on a blocked hit | 50 % |
| Upward pop on knockback | 35 % of horizontal strength |
| Movement while striking or drawing | 50 % speed |
| Respawn invulnerability | 2 s |
| Gravity | 25 m/s² |

## Tuning round 1 (2026-11-26, after the first playtest)

Feedback: the commander died too fast, fights were too quick, shields too weak, armies met too soon.
These values replace the ones above where they differ.

| Value | Before | Now |
|---|---|---|
| Commander HP | 100 | 300, heals 6 HP/s after 5 s without damage |
| Commander respawn | 10 s next to the army | 15 s where they fell, shoves enemies within 5 m away |
| Swordsman HP / cooldown | 100 / 0.8 s | 180 / 1.1 s |
| Archer HP / arrow damage / cooldown | 70 / 40 / 2.0 s | 120 / 30 / 2.5 s |
| Rider HP / lance damage / cooldown | 100 / 45 / 1.0 s | 180 / 40 / 1.3 s |
| Horse HP | 150 | 280 |
| Shield block / cone / blocked knockback | 80 % / ±60° / 50 % | 92 % / ±75° / 30 %, never stuns |
| Shield wall (raised shield next to another) | – | 97 %, no knockback |
| Army spacing / shield wall spacing | 1.9 m | 1.5 m / 1.15 m |
| Distance between armies at start | 60 m | spawn circle radius 55 m (110 m for two armies) |
| Form-up time before bots march | 1.5 s | 15 s |
| Commander weapons | sword | sword, spear (30 dmg, 2.8 m; 45 dmg lance on horseback), bow (35 dmg, 45 m, 1.0 s) |

Bot-vs-bot battles now last about 1–3 minutes (median 2:12 over 24 seeded battles), up from 30–60 s.

## Tuning round 2

| Value | Before | Now |
|---|---|---|
| Map size | 150 × 150 m | 220 × 220 m |
| Spawn circle radius | 55 m | 85 m (170 m between two armies) |
| Form-up time | 15 s | 20 s |
| Commander body slide when knocked out | – | 50 % of the killing blow's push |
| Horse jump height | – | 1.4 m |
| Commander shove share vs. enemies (own soldiers: 0) | 50 % | 30 % |

## Roman legion update (2026-11-26)

The tables above are the original v1 proposal. `shared/src/config.ts` is the source of truth;
these are the values after the legion update.

| Value | Number |
|---|---|
| Army sizes | 15 / 25 / 40 swordsmen (archers and riders parked) |
| Swordsman | 180 HP, 5 m/s |
| Sword (Attack) | 25 damage, 2.0 m, 1.1 s, 0.38 s wind-up, shove 3 m/s |
| Spear (Follow, Hold) | 14 damage, 2.7 m, 1.1 s, shove 9 m/s that lands through shields |
| Commander | 300 HP, 6 m/s, back up after 15 s |
| Horse | 280 HP, 7.5 m/s; tramples above 5 m/s; the commander's charge breaks shield walls (15 damage, 2.8 s down) |
| Shield | blocks 92 %, in a wall 97 %; braced shield weighs 3× in a crowd |
| Hold spacing | 0.86 m apart, ranks 1.0 m, shields 0.88 m wide |
| Thrown spears (once) | 30 m range, 50 damage (60 % through shields), shove 7 m/s |
| Banquet (once) | 6 s feast; drunk: 55 % damage taken, 40 % shove taken, 130 % damage dealt, 1.8× shove |
| Water | 1.1 m deep, 55 % speed; soldiers fall for 1.8 s |
| Crouch | 45 % speed; 4 crouches in 3.5 s at a commander within 16 m offer an alliance |
| Bot styles | steady, charge, phalanx (3 m steps, swords after 15 s at the line), patient (9 m or 50 s), flank (pincer for 14 s, then charge) |
| Rally speech | 15 s courage: 115 % damage dealt, 60 % stun and 75 % shove taken; 40 s rest |
| Close fighting | revenge on whoever hurt you within 4 s and 7 m; at most 3 on one enemy before others look elsewhere |
| Dodges | 30 % (45 % on Attack) of blows seen coming: 0.3 s hop at 1.8× speed |
| Counter | a blocked blow makes the next strike ready within 0.15 s |
| Shield bash | 40 % of blows at a raised shield: 6 damage, 1.6 m, knocks the guard aside (0.8 s) |
| Celebration | 7 s after the win before the results |
| Viking warrior | 180 HP, 5.3 m/s |
| Axe (Attack) | 27 damage, 1.9 m, 1.1 s, 0.42 s wind-up; 35 % through a raised shield, hooks it aside 35 % of the time (0.55 s) |
| Viking spear (Hold) | 14 damage, 2.6 m, shove 8 m/s through shields |
| Round shield | blocks 90 %, in a wall 93 % |
| Throwing axes (once) | 22 m range, 42 damage (45 % through shields), shove 8 m/s |
| Romans vs Vikings | bots, 15 a side: Vikings won 46 % of 80 on the meadow, 50 % of 40 at 25 a side, 50 % at the castle, 42 % in the city |
| Ice | 22 % grip, 12 % friction; running soldiers slip 15 % per second (1.2 s down) |
| Fog of war (city) | 60 m sight, sightings remembered 25 s |
