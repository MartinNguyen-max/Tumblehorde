# Tumblehorde — Game Design Document

## 1. Pitch

A goofy, fast 3D strategy game in the browser. You are the commander and run around with your own character. Your army fights on its own, and you control it with a few orders. The physics are exaggerated and fun: you topple, get shoved, fall and tumble.

Inspiration: Shieldwall (combat and shields), Bannerlord (army and commander), Fall Guys (goofy physics and tone).

## 2. Core loop

1. Run around the map.
2. Give orders to the army.
3. The army fights on its own. You strike with your own sword.
4. Win by wiping out all enemies.

## 3. Controls

| Input | Action |
|---|---|
| WASD | Move |
| Space | Jump (the horse jumps too) |
| Left click | Strike |
| Right click (held) | Shield up |
| 1 / 3 | Follow / Attack |
| 2 (tap) | Hold in the current formation |
| 2 (keep down) | Formation wheel: Long line, Two lines, Wedge, Circle around me, Testudo block, Column |
| F | Advance: holding soldiers step forward a few meters towards where you look |
| 4 | Split the army in two; press again to pick which half hears you (A, B, whole army) |
| 5 | Banquet (once per battle) |
| 6 | Rally speech |
| R | Throw spears at the enemies where you look (once per battle) |
| C (held) | Crouch; crouch 4× at another commander up close to offer an alliance |
| Q / E | Sword or spear / mount or dismount |
| V | Overview camera |

See `DECISIONS.md` for how the controls evolved after playtesting.

## 4. Character and commander

- The player is the commander (300 HP), as tall as their soldiers, and starts on a stocky war horse. A charge on horseback breaks a shield wall.
- Has a health bar above their own character.
- Carries sword and spear (`Q`) and a shield. Can give a rousing speech and call a banquet.
- If the commander dies, they respawn after about 10 seconds. They patch themselves up.

## 5. Army

- Selectable size: 10, 20 or 30 units per side.
- All units are AI-controlled and follow orders.
- Each unit has 100 HP.
- There is no health bar for the whole army. You see the enemy's numbers by looking at them.

### Legionaries

For now every army is Roman legionaries (archers and cavalry are parked in the code, see `DECISIONS.md`). They march and hold with the spear behind big square shields that touch in a held line, and draw the sword to attack. Hold formations: long line, two lines, wedge, circle around the commander, testudo block and column. The army can be split in two halves.

After a **banquet** the whole army is drunk for the rest of the battle: they sway, stumble and cannot stand in a straight line, but they are very tough, hit hard and barge through enemy formations.

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

- Three battlefields, 220 × 220 m: **Green Meadow** (open field with a farmstead), **Castle Siege** (one army holds the only gate, everyone else attacks) and **The City** (Roman street grid with avenues, alleys and a forum; houses block sight, so soldiers only fight what they see and search the streets when attacking blind).
- Bot armies have no commander; they form up, advance in formation, hold a spear wall and then charge.

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
