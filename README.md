# Tumblehorde

A goofy, fast 3D strategy game in the browser. You run around as the commander and control your own army with orders. The battle is over when all enemies are dead.

## Documents

Read in this order:

1. `docs/MVP.md`: limited scope and milestones. **Start here.**
2. `docs/GDD.md`: game design (what the game is and how it is played)
3. `docs/BALANCE.md`: HP, damage, speeds and army composition
4. `docs/TECH.md`: technical stack, architecture and netcode
5. `docs/DECISIONS.md`: decisions and rationale
6. `CLAUDE.md`: coding rules (read automatically by Claude Code)

## Visual reference

`docs/style-reference/preview.html` is a running Three.js scene that shows the desired style: low-poly with flat shading, colors, proportions, camera angle and terrain. Open it in a browser.

It is a **style reference, not code to be reused directly**. The game is built in Babylon.js, not Three.js. But the color values, the proportions of the figures and the terrain generation are worth looking at.

## Setup

The project is not scaffolded yet. First step:

```bash
# Client
npm create vite@latest client -- --template vanilla-ts
cd client && npm install @babylonjs/core @babylonjs/havok && cd ..

# Server (only once M8 is reached)
npm create colyseus-app@latest server
```

Verify versions at setup. They change quickly.

Then `/shared` is created as a separate TypeScript module that is imported by both client and server. See `docs/TECH.md`.
