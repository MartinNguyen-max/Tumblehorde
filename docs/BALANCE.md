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
