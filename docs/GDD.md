# Tumblehorde — Game Design Document

## 1. Pitch

A goofy, fast 3D strategy game in the browser. You are the commander and run around with your own character. Your army fights on its own, and you control it with a few orders. The physics are exaggerated and fun: you topple, get shoved, fall and tumble.

Inspiration: Shieldwall (combat and shields), Bannerlord (army and commander), Fall Guys (goofy physics and tone).

## 2. Core loop

1. Run around the map.
2. Give orders to the army.
3. The army fights on its own. You strike with your own sword.
4. Win by wiping out all enemies.

## 3. Controls (proposal, to be tested)

| Input | Action |
|---|---|
| WASD | Move |
| Space | Jump |
| Left click | Strike |
| Right click (held) | Shield up |
| Keys 1–3 | Orders (Follow, Hold, Attack) |
| Keys 6–9 | Who hears orders: whole army, swordsmen, archers, cavalry |
| Q / E | Switch weapon (sword, spear, bow) / mount or dismount |

The orders are `Follow`, `Hold` (form up around the commander) and `Attack`. Armies are always split into swordsmen, archers and cavalry. See `DECISIONS.md` for how the controls evolved after playtesting.

## 4. Character and commander

- The player is the commander and has 100 HP.
- Has a health bar above their own character.
- Has a sword in v1.
- If the commander dies, they respawn after about 10 seconds. They patch themselves up.

## 5. Army

- Selectable size: 10, 20 or 30 units per side.
- All units are AI-controlled and follow orders.
- Each unit has 100 HP.
- There is no health bar for the whole army. You see the enemy's numbers by looking at them.

### Unit types in v1

| Type | Equipment | Description |
|---|---|---|
| Swordsman | Sword + shield | Blocks with the shield, strikes with the sword |
| Archer | Bow and arrow | Shoots from a distance |
| Rider | Horse + spear | Can mount and dismount the horse. The horse has its own HP and can die. If the horse dies, the rider falls off |

All unit types are in v1.

## 6. Physics and tone

- Knockback is exaggerated. You topple, get shoved and fall in funny ways.
- When a character dies or falls, it should be funny and goofy.
- Physics is shown with Havok in the client. The server only decides hits and knockback with simple math.

## 7. Battle and victory

- **Battle:** Free-for-all, or two teams. Victory when all enemies are dead.
- **Eliminated:** An army is out when all its units are dead.
- **The edge:** The map has invisible walls. You are pushed back, and a message is shown: "The map ends here, go back and fight!"

## 8. Modes

| Mode | Local | Online (later) |
|---|---|---|
| Free-for-all | You against 1–3 bot armies | 2–4 armies (players) |
| 2 teams | You and bots against bots | 2–4 armies in two teams |

Locally there are at most 4 armies in total. Bots follow the same rules as the player.

## 9. Bots

- Local: Medium difficulty to start with. More difficulty levels come later.
- Bots can give orders, use shield and sword, and shoot with the bow.
- Online bots are not in v1.

## 10. Online

- 2–4 players per battle.
- Connect with a code or link.
- If a player leaves the battle, their army continues without orders. After 30 seconds without a connection, the whole army dies.

## 11. Map

- Three battlefields in v1 (Meadow, Desert, Rocky Highlands with a walled village), 220 × 220 meters, picked or random. (Originally one map of about 150 × 150 m; see `DECISIONS.md`.)
- Open terrain, no castles and no villages.
- More maps come later.

## 12. HUD

- **Bottom:** Your own loadout (weapons and equipment). Orders are shown, and if they are not available, they are greyed out.
- **Above your own character:** Health bar.
- **Above enemies:** The number of units is shown when you look at them.
- **No** health bar for the whole army.

## 13. After the battle

- Status of your own army and the enemy's army.
- Battle duration.
- Number of kills and deaths.
- Rematch button.

## 14. Graphics and sound

- **Style:** Low-poly with flat shading. Light blue sky and green terrain. Bright, clear team colors so silhouettes are clear. Same world style as the mmaxlab screenshot.
- **Visual reference:** `docs/style-reference/preview.html`. Open it in a browser. It shows colors, proportions, camera angle, terrain style and HUD placement. It is built in Three.js as a reference, but the game is built in Babylon.js.
- **Colors (from the reference):** Sky `#8EC9EE`, blue team `#3C7BD0`, red team `#D1483F`, accent `#F08A24`, terrain green `hsl(0.26, 45%, 40-49%)`, path sand `hsl(0.11, 42%, 70-76%)`.
- **Animations:** Walk, run, strike, shield, shoot, jump and death. Ready-made animations in v1, e.g. from Mixamo.
- **Sound:** Comes later.

## 15. Out of scope for v1

- Sound
- Login and persistence
- Mobile
- More maps
- Online bots
- More difficulty levels
