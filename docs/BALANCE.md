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
