# Decisions

Format: date, decision, rationale. If a decision is changed, a new line is written instead of deleting the old one.

## 2026-11-26

- **Name: Tumblehorde.** Repo `tumblehorde`. *Tumble* is the goofy physics, *horde* is the army. The name avoids "wall", which was too close to Shieldwall. Rejected: Tumblewall, Fumblelord (taken), Fumblecharge, Tumblefray.
- **Browser, 3D, third-person camera.** It should be easy to get started, and it fits the desired look.
- **Jumping and goofy physics.** Inspired by Fall Guys and Shieldwall.
- **Bots first, online later.** So we can test the core without a server.
- **Colyseus for online.** The room model fits creating and joining battles. Open source, and free to self-host.
- **Babylon.js + Havok in the client.** Havok is free under MIT and gives goofy physics.
- **Simple math for hits on the server.** So everyone sees the same thing, and synchronisation is kept simple.
- **Shared simulation code in `/shared`.** Same logic in browser and server. Makes bots-first possible.
- **Open map, about 150 × 150 m, invisible edges.** Small and easy to overview. More maps come later.
- **No castles and no villages in v1.** Keeps scope down.
- **Victory: all enemies dead.** Simple and clear.
- **The commander respawns after about 10 seconds.** The army keeps fighting in the meantime.
- **Army: 10/20/30 units per side, chosen by the player.**
- **All unit types in v1:** Swordsman, archer and rider with horse and spear. This is a choice that increases scope. The milestones in `MVP.md` make it manageable.
- **Local: max 4 armies in total.** You and 1–3 bot armies.
- **Online: 2–4 armies.** Online bots are postponed.
- **Disconnect: 30 seconds, then the army dies.**
- **One team format in v1:** Free-for-all and 2 teams. More later.
- **Health bar only above your own character.** Keeps the screen tidy.
- **Orders on keys 1–4.** Proposal, not approved yet.
- **Graphics: low-poly like the screenshot.** Bright team colors, and clear silhouettes.
- **Hosting: own PC locally. Oracle Always Free or Render Starter for testing. Colyseus Cloud later.** Free to begin with.
