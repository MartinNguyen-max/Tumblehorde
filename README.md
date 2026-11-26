# Tumblehorde

Et goofy, hurtigt 3D-strategispil i browseren. Du løber rundt som kommandør og styrer din egen hær med ordrer. Kampen er færdig, når alle fjender er døde.

## Dokumenter

Læs i denne rækkefølge:

1. `docs/MVP.md`: afgrænset scope og milepæle. **Start her.**
2. `docs/GDD.md`: spildesign (hvad spillet er og hvordan det spilles)
3. `docs/BALANCE.md`: HP, skade, hastigheder og hærsammensætning
4. `docs/TECH.md`: teknisk stack, arkitektur og netcode
5. `docs/DECISIONS.md`: beslutninger og begrundelser
6. `CLAUDE.md`: regler for kodningen (læses automatisk af Claude Code)

## Visuel reference

`docs/style-reference/preview.html` er en kørende Three.js-scene, der viser den ønskede stil: low-poly med flad skygning, farver, proportioner, kameravinkel og terræn. Åbn den i en browser.

Den er en **stilreference, ikke kode der skal genbruges direkte**. Spillet bygges i Babylon.js, ikke Three.js. Men farveværdier, proportioner på figurerne og terrængenereringen er værd at kigge på.

## Opsætning

Projektet er ikke scaffoldet endnu. Første skridt:

```bash
# Klient
npm create vite@latest client -- --template vanilla-ts
cd client && npm install @babylonjs/core @babylonjs/havok && cd ..

# Server (først når M8 nås)
npm create colyseus-app@latest server
```

Verificér versioner ved opsætning. De ændrer sig hurtigt.

Derefter oprettes `/shared` som et separat TypeScript-modul, der importeres af både klient og server. Se `docs/TECH.md`.
