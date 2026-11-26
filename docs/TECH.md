# Tumblehorde — teknisk design

Versionsnumre skal verificeres ved opsætning, da de ændrer sig hurtigt.

## Stack

| Del | Valg | Hvorfor |
|---|---|---|
| 3D-motor | Babylon.js | Spilorienteret, indbygget fysik og debug-værktøjer |
| Fysik (klient) | Havok (`@babylonjs/havok`) | Gratis under MIT. Bruges til visuel fysik: vælt, skub, fald |
| Sprog | TypeScript (strict) | Samme sprog i klient og server |
| Multiplayer | Colyseus 0.18 | Rum, synkronisering og matchmaking. Open source (MIT) |
| Klient-SDK | `@colyseus/sdk` | Klientsiden af Colyseus |
| Build | Vite | Hurtig og moderne |
| Test | Vitest | Standard for TypeScript |
| Hosting (klient) | GitHub Pages eller Cloudflare Pages | Gratis statisk hosting |

## Mappestruktur

```
/shared      ren spillogik (simulering). Ingen Babylon- eller Colyseus-imports.
/client      Babylon.js, input, HUD og Havok-fysik
/server      Colyseus-rum og autoritativ simulering
/docs        design og beslutninger
```

`/shared` kører både i browseren (lokal bot-kamp) og på serveren (online). Det er derfor, bot-kampe først giver mening.

## Arkitektur

- **Lokal kamp:** Kører helt i browseren. Ingen server.
- **Online kamp:** Serveren kører `/shared`-simuleringen og er autoritativ. Klienten sender input og viser state.
- **Tick:** Serveren kører med fast tick (forslag: 20 Hz).
- **Klientens visning:** Fjernspillere interpoleres mellem tick, så bevægelsen er glat.
- **Egen karakter:** Forudsigelse (prediction), så bevægelsen føles øjeblikkelig. Colyseus 0.18 har indbygget støtte. Det verificeres ved opsætning.

## Fysik

- **Klient:** Havok styrer visuel fysik. Figurer vælter, skubbes og falder.
- **Server:** Simpel matematik afgør hits, skade og knockback-vektor.
- Klienten får knockback-vektoren fra serveren og lader Havok vise den.

## Hosting

| Fase | Løsning | Pris |
|---|---|---|
| Lokal udvikling | Egen PC | 0 kr |
| Test med venner | Oracle Always Free eller Render Starter | 0 kr / $7/md |
| Offentlig | Colyseus Cloud eller egen VPS | fra $15/md |

Klienten hostes statisk gratis.

## Ydelsesmål (forslag)

- 60 FPS i browseren med op til 4 hære × 30 enheder + heste.
- Maks 4 spillere online.
- Serveren skal kunne køre på en lille VPS.
