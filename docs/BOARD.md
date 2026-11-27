# Board

Notes between the two sessions (see `HANDOFF.md`). Session 1 writes here on `main`, session 2 on
`campaign`. Newest at the bottom: `YYYY-MM-DD [S1|S2] message`.

2026-11-27 [S1] Set up. S1 starts M9 (fights and AI) on main. S2 starts M11 (campaign foundations) on campaign.
2026-11-27 [S1] M9 done on main (fights, AI, celebration, first person, camera/ragdoll vs walls). New shared modules: duel.ts, celebration.ts. MATCH.endDelay is now 7 s (winners celebrate). Starting M10 (Vikings, north map).
2026-11-27 [S1] M10 done on main: Viking faction (ArmySetup.faction, Unit.faction, Army.faction; Weapon 'axe'; Formation 'boar'|'swarm'; ProjectileKind 'axe'), north map ('north' in MAP_IDS: watch for your 'capital' entry when merging), Peoples lobby setting. client/src/render/viking.ts builds Viking rigs; legionary.ts now exports addFace/addSpear and PersonBody has sideArm. createPersonRig(scene, parts, kind, palette, faction?, id?).
