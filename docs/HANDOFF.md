# Handoff: two Claude sessions on Tumblehorde

Two Claude Code sessions (two accounts, on two different PCs) build milestones M9–M14 at the same
time, each on its own branch of `https://github.com/MartinNguyen-max/Tumblehorde`. This file says who owns what and how the work is merged. Read it, then
`CLAUDE.md`, `docs/MVP.md`, `docs/GDD.md`, `docs/STORY.md`, `docs/DECISIONS.md` and `docs/TECH.md`.

| | Session 1 | Session 2 |
|---|---|---|
| PC | the original PC | the second PC |
| Branch | `main` | `campaign` |
| Builds now | **M9** smarter, better fights, then **M10** Vikings and the north | **M11** campaign foundations, then **M12** the capital |
| Later | battle chapters of M13 | cutscene-heavy chapters of M13 |

## Things every session must know

- **Setup on a new PC:** Node 24 LTS is needed (install it user-locally if missing; on session 1's PC
  it lives at `~/.local/node/bin`, not on PATH). Then `npm ci`. `npm run check` = typecheck + tests;
  run it before every commit. `npm run dev` starts the game.
- **Visual style: chunky boxes only.** Big cube heads, box eyes and brows, boxy bodies, big square
  shields. The player rejected detailed models ("way too detailed and small"). Add flavour with
  colour and a few big shapes; put the expression in animation and posing.
- **Screenshots:** if Chrome is installed, it runs headless with `--use-angle=swiftshader --enable-unsafe-swiftshader`
  for WebGL screenshots via CDP (Node's built-in WebSocket; no puppeteer). In `?debug` mode call
  `tumblehorde.unpause()` or animations freeze at dt = 0. Check close-ups and the real camera view.
- **Work autonomously.** The player wants the work to go on without questions about design details.
  Record judgment calls as new lines in `docs/DECISIONS.md` (never edit old lines), keep the status
  table in `docs/MVP.md` current, and commit after every small step (Conventional Commits, ending with
  the attribution line your harness gives you). Do not add npm dependencies (CLAUDE.md).
- **Everything in English** (code, docs, subtitles).
- The player cares most about the cutscenes: "this is what makes the game". Make them emotional and
  real, with the techniques agreed in `STORY.md` and `DECISIONS.md` (2026-11-27).
- The sound and music cannot be heard by Claude; the player will listen and give feedback later.

## File ownership

Avoid editing the other session's files. If you must, keep the change small and additive (a new
export, a new option, a new map entry) and mention it on the board (below).

**Session 1 owns:** `shared/src/` combat, AI, orders, formations, units, physics, bot, banquet,
arrows, perception, navigation, match, config (existing keys); `client/src/render/` rigs, legionary,
parts, beans, ragdolls, camera, world, effects, battle; `client/src/game/`; `client/src/input/`;
battle HUD; Viking faction everywhere; the north map.

**Session 2 owns (mostly new files):**
- `shared/src/campaign/` — chapter list and order, checkpoints, save data shape, choices, the
  roster of named heroes and legionaries, city NPC behaviour (pure logic with Vitest tests).
- `client/src/cinematic/` — cutscene player: timeline of beats, camera shots, letterbox, actors with
  poses and faces (brows, mouths, blinking, tears), subtitles and narrator, hold-Space-to-skip-one-beat,
  scene lighting and weather, letters on parchment, loading screens.
- `client/src/campaign/` — campaign flow, save/load (localStorage), dialogue with E and choices,
  free-roam city mode, shop, workout, the arena wrapper.
- `client/src/audio/` new files for cutscene music (soft warm pad, plucked lyre, soft choir, the
  recurring monastery melody; Web Audio only) and emotional gibberish voices (sad, crying, warm,
  angry) built on the existing `babble.ts`.
- The capital map, as a new file registered with a one-line entry in `shared/src/maps.ts`.
- The "Campaign" entry on the landing page (`client/src/ui/landing.ts`, `client/src/main.ts`): small edits.

**Shared needs, handled additively by session 2:** an unarmed / unarmoured commander, matches
with only commanders (the arena 1v1v1v1), heroes that are knocked out instead of dying. Add these as
new options in setup/config with tests, without changing default behaviour. Cutscene actors should
reuse the existing part builders in `client/src/render/parts.ts` from new files rather than editing
`rigs.ts`; session 1 is changing rigs for Vikings and fight animation.

## Merging

- **Push after every commit** (`git push`), so the other PC sees your work.
- Session 2: `git pull`, then `git fetch && git merge origin/main` at the start of every step and fix
  conflicts on your side.
- Session 1 merges `campaign` into `main` when M11 and M12 are done (and whenever session 2 asks on
  the board).
- Never rewrite history (`rebase`, `reset --hard`, force push) on either branch.

## The board

`docs/BOARD.md` on your own branch is where you write; the other session reads it from your branch
with `git fetch && git show origin/<your branch>:docs/BOARD.md`. Read the other branch's board at the
start of every step; append a dated line to yours when you finish a milestone, need something from
the other session, or edited one of its files. Keep entries short.
