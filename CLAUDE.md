# CLAUDE.md

Project: **Tumblehorde**. Conventions for Claude Code in this project. Read `docs/MVP.md` and `docs/GDD.md` before changing code.

## Language and style
- TypeScript with `strict: true`. Never use `any`. Use `unknown` and narrowing instead.
- Small, pure functions with a single responsibility. Name them after what they do.
- No magic numbers. Collect values such as HP, damage and speed in a config file.
- Only write comments where the code cannot explain *why* by itself.

## Architecture
- `/shared` is pure game logic. It must not import Babylon, Havok or Colyseus.
- `/client` must not decide hits or damage. `/shared` does that.
- `/server` is authoritative. Input from the client is validated before it is used.

## Tests
- Vitest for all logic in `/shared`. New logic requires tests.
- Run tests before every commit.

## Git
- Conventional Commits, e.g. `feat: ...`, `fix: ...`, `refactor: ...`.
- One milestone or one small step per commit.

## Way of working
- Do not add new dependencies without asking first.
- If you change a decision in `docs/DECISIONS.md`, ask first and then add a new line.
- Work on one milestone at a time according to `docs/MVP.md`. Stop and ask if a milestone is unclear.
- If a version or API is uncertain, verify it first. Do not guess.
