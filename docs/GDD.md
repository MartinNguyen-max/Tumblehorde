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
| 2 (keep down) | Formation wheel. Romans: Long line, Two lines, Wedge, Circle around me, Testudo block, Pincer (the wings go round behind the enemy). Vikings: Shield wall, Boar's head, Horns, Shield ring, Swarm |
| F | Advance: holding soldiers step forward a few meters towards where you look |
| 4 | Split the army in two; press again to pick which half hears you (A, B, whole army) |
| 5 | Banquet, or for Vikings the mead feast (once per battle) |
| 6 | Rally speech: courage for 15 s (harder blows, steadier feet), then a 40 s rest |
| R | Throw spears (Vikings: throwing axes) at the enemies where you look (once per battle) |
| Ctrl (held) | Crouch; crouch 4× at another player's commander up close to offer an alliance |
| Q / E | Sword (Vikings: axe) or spear / mount or dismount |
| V | Overview camera |
| T | First person ⇄ third person (also a setting on the start page) |
| M | Sound on/off (also the speaker button in the top right corner) |

See `DECISIONS.md` for how the controls evolved after playtesting.

## 4. Character and commander

- The player is the commander (300 HP), as tall as their soldiers, and starts on a stocky war horse. A charge on horseback breaks a shield wall.
- Has a health bar above their own character.
- Carries sword and spear (`Q`) and a shield. Can give a rousing speech and call a banquet.
- If the commander is knocked out, they get back up after 15 seconds where they fell, as long as some of their soldiers still stand. They patch themselves up.
- Leads Romans or Vikings: the same body and rules, different looks, weapons, shields, formations and words for the special orders (see §5).

## 5. Army

- Selectable size: 10, 20 or 30 units per side.
- All units are AI-controlled and follow orders.
- Each unit has 100 HP.
- There is no health bar for the whole army. You see the enemy's numbers by looking at them.

### Legionaries

For now every army is Roman legionaries (archers and cavalry are parked in the code, see `DECISIONS.md`). They march and hold with the spear behind big square shields that touch in a held line, and draw the sword to attack. Hold formations: long line, two lines, wedge, circle around the commander, testudo block and pincer. The army can be split in two halves.

### Vikings

The second people, same blocky bodies and height as the legion but every warrior looks different: wolf, bear or fox pelts, big beards (some braided), long hair, scars, bare arms with gold arm rings, an iron cap or none, a round painted shield and a bearded axe. They march and hold with spears and draw axes to attack. Axes bite through raised shields and sometimes hook them aside; round shields make a looser wall; Vikings are a little quicker on their feet. Their formations: **shield wall** (two tight ranks), **boar's head** (a deep, narrow wedge to break through), **shield ring** around the jarl, **horns** (the wings go round behind the enemy) and the **swarm** (a loose, screaming mob). The volley is **throwing axes** (shorter range than pila), the banquet a **mead feast** and the rally speech a **war roar**. They roar as they swing. Equal bot armies of Romans and Vikings win about half the time each.

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

### Campaign

One long single-player story (see `STORY.md`), saved at every chapter: cutscenes made in the game, a walkable capital, arena fights, and eight story battles on the battle engine with their own maps (a forest road, a burning village at night, a river bridge, the dark forest, the frozen outpost, a night raid, the northern fortress) and goals (beat them all, hold a bridge or a camp until a clock runs out, or the last night, which cannot be won). Heroes (Varro, Felix, Rufus, Eirik, Marcus) are knocked down but always get back up; from the Dark Forest on, legionaries who fall stay dead. A lost battle can be fought again. Winners celebrate after every won battle.

## 9. Bots

- Local: Medium difficulty to start with. More difficulty levels come later.
- Bots can give orders, use shield and sword, and shoot with the bow.
- Online bots are not in v1.

## 10. Online

- 2–4 players per battle.
- Connect with a code or link.
- If a player leaves the battle, their army continues without orders. After 30 seconds without a connection, the whole army dies.

## 11. Map

- **The Frozen North**: snowy hills and pines, a Viking village of longhouses behind a broken palisade, rune stones, and a big frozen lake (with a small pond): on the ice everyone slides, and running soldiers go down now and then. Snow falls.
- Three battlefields, 220 × 220 m: **Green Meadow** (open field with a farmstead), **Castle Siege** (one army holds the only gate, everyone else attacks) and **The City** (Roman street grid with avenues, alleys and a forum; houses block sight, so soldiers only fight what they see and search the streets when attacking blind).
- Bot armies have no commander; they form up, advance in formation, hold a spear wall and then charge. Players always lead their own army.

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
- **Sound:** Made in the browser, no sound files; music only in the campaign's cutscenes (soft and warm, synthesized), never in battle: cartoon blows, bonks, slide whistles, kazoos, clangs, splashes, thrown spears, glugs and hiccups, and voices that speak only gibberish (cartoon babble): battle cries, the rally speech and cheers, grunts and death yells. Off by default; a speaker button in the top right corner (and `M`) turns it on, and a small hint points at it the first time.

## 15. Out of scope

Login and accounts, mobile, online bots, more bot difficulty levels, and a campaign difficulty setting (the story has one mode on purpose). Sound, more maps and saving (for the campaign, in the browser) were added after v1.
