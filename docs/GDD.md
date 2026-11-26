# Tumblehorde — Game Design Document

## 1. Pitch

Et goofy og hurtigt 3D-strategispil i browseren. Du er kommandøren og løber rundt med din egen karakter. Din hær kæmper selv, og du styrer den med få ordrer. Fysikken er overdreven og sjov: man vælter, skubbes, falder og tumler.

Inspiration: Shieldwall (kamp og skjold), Bannerlord (hær og kommandør), Fall Guys (goofy fysik og tone).

## 2. Kernesløjfe

1. Løb rundt på kortet.
2. Giv ordrer til hæren.
3. Hæren kæmper selv. Du slår selv med sværdet.
4. Vind ved at udslette alle fjender.

## 3. Kontroller (forslag, skal testes)

| Input | Handling |
|---|---|
| WASD | Bevæg dig |
| Mellemrum | Hop |
| Venstreklik | Slå |
| Højreklik (holdt) | Skjold op |
| Taster 1–4 | Ordrer (Følg, Stå, Angrib, Del i grupper) |

Ordrer er `Følg`, `Stå`, `Angrib` og `Del i grupper` (1–3 grupper). Tastevalgene er et forslag og er ikke godkendt endnu.

## 4. Karakter og kommandør

- Spilleren er kommandøren og har 100 HP.
- Har en healthbar over sin egen karakter.
- Har sværd i v1.
- Dør kommandøren, genopstår han efter ca. 10 sekunder. Han lapper sig selv sammen.

## 5. Hær

- Størrelse valgbar: 10, 20 eller 30 enheder pr. hold.
- Alle enheder styres af AI og følger ordrer.
- Enhederne har 100 HP hver.
- Der er ingen healthbar for hele hæren. Man ser fjendens antal ved at kigge på dem.

### Enhedstyper i v1

| Type | Udstyr | Beskrivelse |
|---|---|---|
| Sværdmand | Sværd + skjold | Blokerer med skjold, slår med sværd |
| Bueskytte | Bue og pil | Skyder fra afstand |
| Rytter | Hest + spyd | Kan stige op og af hesten. Hesten har egen HP og kan dø. Dør hesten, falder rytteren af |

Alle enhedstyper er med i v1.

## 6. Fysik og tone

- Knockback er overdreven. Man vælter, skubbes og falder på sjove måder.
- Når en karakter dør eller falder, skal det være sjovt og goofy.
- Fysik vises med Havok i klienten. Serveren afgør kun hits og knockback med simpel matematik.

## 7. Kamp og sejr

- **Kamp:** Alle mod alle, eller to hold. Sejr når alle fjender er døde.
- **Hold ude:** En hær er ude, når alle dens enheder er døde.
- **Kanten:** Mappet har usynlige vægge. Man skubbes tilbage, og der vises en besked: "Mappet stopper, gå tilbage og fight!"

## 8. Modes

| Mode | Lokalt | Online (senere) |
|---|---|---|
| Alle mod alle | Dig mod 1–3 bot-hære | 2–4 hære (spillere) |
| 2 hold | Dig og bots mod bots | 2–4 hære i to hold |

Lokalt er der maks 4 hære i alt. Bots følger de samme regler som spilleren.

## 9. Bots

- Lokalt: Medium sværhedsgrad i starten. Flere sværhedsgrader kommer senere.
- Bots kan give ordrer, bruge skjold og sværd, og skyde med bue.
- Online-bots er ikke med i v1.

## 10. Online

- 2–4 spillere pr. kamp.
- Forbindelse via kode eller link.
- Forlader en spiller kampen, fortsætter hans hær uden ordrer. Efter 30 sekunder uden forbindelse dør hele hæren.

## 11. Kort

- Ét kort i v1, ca. 150 × 150 meter.
- Åbent terræn, ingen slot og ingen landsbyer.
- Flere kort kommer senere.

## 12. HUD

- **Nederst:** Egen loadout (våben og udstyr). Kommandoer vises, og er de ikke tilgængelige, er de gråtonede.
- **Over egen karakter:** Healthbar.
- **Over fjender:** Antal enheder vises, når man kigger på dem.
- **Ingen** healthbar for hele hæren.

## 13. Efter kamp

- Status for egen hær og fjendens hær.
- Kampens varighed.
- Antal dræbte og døde.
- Rematch-knap.

## 14. Grafik og lyd

- **Stil:** Low-poly med flad skygning. Lys blå himmel og grønt terræn. Lyse, tydelige holdfarver, så silhuetter er klare. Samme verdensstil som mmaxlab-screenshottet.
- **Visuel reference:** `docs/style-reference/preview.html`. Åbn den i en browser. Den viser farver, proportioner, kameravinkel, terrænstil og HUD-placering. Den er bygget i Three.js som reference, men spillet bygges i Babylon.js.
- **Farver (fra referencen):** Himmel `#8EC9EE`, blåt hold `#3C7BD0`, rødt hold `#D1483F`, accent `#F08A24`, terræn grøn `hsl(0.26, 45%, 40-49%)`, sti sand `hsl(0.11, 42%, 70-76%)`.
- **Animationer:** Gang, løb, slag, skjold, skud, hop og død. Færdige animationer i v1, fx fra Mixamo.
- **Lyd:** Kommer senere.

## 15. Uden for v1

- Lyd
- Login og persistens
- Mobil
- Flere kort
- Online-bots
- Flere sværhedsgrader
