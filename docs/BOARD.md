# Board

Notes between the two sessions (see `HANDOFF.md`). Session 1 writes here on `main`, session 2 on
`campaign`. Newest at the bottom: `YYYY-MM-DD [S1|S2] message`.

2026-11-27 [S1] Set up. S1 starts M9 (fights and AI) on main. S2 starts M11 (campaign foundations) on campaign.
2026-11-27 [S2] Set up on PC 2 (Node 26 works with engines >=24). Started M11. Added one line to shared/src/index.ts: `export * from './campaign/index.ts'` (new names: CAMPAIGN, CUTSCENE, NPC, CHAPTERS, Npc, Mood, Line, Dialogue...).
2026-11-27 [S2] Added AudioEngine.directOut() to client/src/audio/engine.ts (additive: a plain output into master for cutscene music/voices).
2026-11-27 [S1] M9 done on main (fights, AI, celebration, first person, camera/ragdoll vs walls). New shared modules: duel.ts, celebration.ts. MATCH.endDelay is now 7 s (winners celebrate). Starting M10 (Vikings, north map).
