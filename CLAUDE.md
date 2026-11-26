# CLAUDE.md

Projekt: **Tumblehorde**. Konventioner for Claude Code i dette projekt. Læs `docs/MVP.md` og `docs/GDD.md` før du ændrer kode.

## Sprog og stil
- TypeScript med `strict: true`. Brug aldrig `any`. Brug `unknown` og smalning i stedet.
- Små, rene funktioner med ét ansvar. Navngiv med det, de gør.
- Ingen magiske tal. Saml værdier som HP, skade og hastighed i en konfigurationsfil.
- Kommentarer skrives kun, hvor koden ikke selv forklarer hvorfor.

## Arkitektur
- `/shared` er ren spillogik. Må ikke importere Babylon, Havok eller Colyseus.
- `/client` må ikke afgøre hits eller skade. Det gør `/shared`.
- `/server` er autoritativ. Input fra klienten valideres, før det bruges.

## Test
- Vitest for al logik i `/shared`. Ny logik kræver tests.
- Kør tests før hver commit.

## Git
- Conventional Commits, fx `feat: ...`, `fix: ...`, `refactor: ...`.
- Én milepæl eller ét lille trin pr. commit.

## Arbejdsmåde
- Tilføj ikke nye afhængigheder uden at spørge først.
- Ændrer du en beslutning i `docs/DECISIONS.md`, skal du spørge først og derefter tilføje en ny linje.
- Kør én milepæl ad gangen ifølge `docs/MVP.md`. Stop og spørg, hvis en milepæl er uklar.
- Hvis en version eller API er usikker, verificér den først. Gæt ikke.
