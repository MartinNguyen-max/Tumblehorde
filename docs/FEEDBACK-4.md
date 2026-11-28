# Campaign feedback, round 4 (2026-11-28)

The player's last big round before the game is done. Ticked as it lands.

## Fixes
- [x] The fall of the capital: riders never ride through Roman soldiers; they meet them and fight
- [x] The duel with Hrolf: the ring is Cassian's own legion, real soldiers
- [x] The border fort: looks better (walls, banners, ladders, the broken gate); nobody on horseback; every army storms the gate while the Greeks hold it; the player commands the allies too
- [x] The sewers: brick floor and water, arches and pipes, no grass, not an open maze

## The new ending
- [x] The wizard scene: more detail; the risen are few, terribly strong, and cannot be beaten: a last stand, then flight
- [x] The flight to the shore, the Viking ship, the dead swimming after it and climbing aboard, the wizard on deck
- [x] The fight on the ship: the armies hold the dead back at both ends while the son and one companion fight the wizard, two against one
- [x] The companion dies; the wizard dies; the dead fall
- [x] Home with fewer men and no prisoners; the story of the dead army; the city is strengthened; then walk the new capital

## The whole game
- [ ] Every scene and fight checked: no plain backgrounds, everything aligned, old feedback applied, bots that act sensibly
- [x] Videos of every scene in a folder, for promotion (60 videos recorded on the first PC; not in git)
- [ ] Screenshots of every fight and city walk between the videos (the player said: not yet)

## Where this stands (for continuing on another PC)

- All code is on `main`. The 60 scene videos were recorded on the first PC into `promo/videos/` (594 MB, git-ignored), so they are **not** in the repository. Copy that folder by hand, or record them again.
- Record again: `npm run build -w client`, serve it (`cd client && npx vite preview --port 5300`), then `GAME_URL='http://localhost:5300/?debug' npx tsx tools/record-scenes.ts promo/videos [first-scene-id]`. Needs Chrome with a GPU (ANGLE over Vulkan); record from the build, not the dev server, whose hot reload restarts the page when code changes.
- Screenshots: `npx tsx tools/screenshot-fights.ts promo/candidates` takes a start, a clash and a mid-fight picture per fight (with and without HUD); keep the best one per chapter under the names in `docs/PROMO.md` (`... - fight.png`, `... - walk.png`). Not run yet: the player asked to wait.
- Still to do: watch every video for mistakes and re-record those scenes; the full QA pass of every scene and fight.
