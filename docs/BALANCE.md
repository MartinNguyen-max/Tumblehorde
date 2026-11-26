# Tumblehorde — balance og tal

Startværdier, ikke endelige. De skal justeres, når spillet kan spilles. Alle værdier samles i én konfigurationsfil i koden (`shared/config.ts`), så de kan ændres ét sted.

Enheder: meter, sekunder og HP.

## Kommandør

| Værdi | Tal |
|---|---|
| HP | 100 |
| Løbehastighed | 6 m/s |
| Hophøjde | 1,2 m |
| Genopstandstid | 10 s |
| Sværdskade | 35 |
| Sværdrækkevidde | 2,2 m |
| Angrebs-cooldown | 0,6 s |

Kommandøren er lidt stærkere end en almindelig sværdmand, men kan ikke vinde alene mod en hær.

## Enheder

| Type | HP | Hastighed | Skade | Rækkevidde | Cooldown |
|---|---|---|---|---|---|
| Sværdmand | 100 | 5 m/s | 25 | 2,0 m | 0,8 s |
| Bueskytte | 70 | 5 m/s | 40 | 35 m | 2,0 s |
| Rytter (til hest) | 100 | 11 m/s | 45 | 3,2 m | 1,0 s |
| Hest | 150 | 11 m/s | – | – | – |

- Bueskytten er svag i nærkamp. Hans skade er den samme, men hans rækkevidde falder til 2,0 m.
- Dør hesten, falder rytteren af og kæmper videre til fods med spyd: hastighed 5 m/s, skade 30.

## Skjold

- Blokerer 80 % af skade forfra.
- Blokerer ikke bagfra eller fra siden.
- Man kan ikke angribe, mens skjoldet er oppe.
- Bevægelse med skjold oppe: 60 % hastighed.

## Knockback

| Kilde | Styrke | Stun |
|---|---|---|
| Sværdslag | 3 m/s | 0,4 s |
| Spyd fra hest | 9 m/s | 1,2 s |
| Sammenstød med hest | 12 m/s | 1,5 s |
| Kanten af mappet | 6 m/s indad | 0 s |

Knockback skal føles overdrevet. Det er en del af tonen, ikke en fejl.

## Hærsammensætning

Spilleren vælger 10, 20 eller 30 enheder. Fordelingen er fast:

| Hærstørrelse | Sværdmænd | Bueskytter | Ryttere |
|---|---|---|---|
| 10 | 6 | 3 | 1 |
| 20 | 12 | 6 | 2 |
| 30 | 18 | 9 | 3 |

## Kort og kamp

| Værdi | Tal |
|---|---|
| Kortstørrelse | 150 × 150 m |
| Afstand mellem hære ved start | 60 m |
| Maks kamptid | ingen grænse i v1 |
| Frakoblet spiller, timer | 30 s |

## Bot-AI, medium

- Reagerer på fjender inden for 25 m.
- Hæver skjoldet, når en fjende er inden for 3 m og angriber.
- Bueskytter holder mindst 15 m afstand til nærmeste fjende.
- Bot-kommandøren giver en ny ordre højst hvert 5. sekund.
- Bot-kommandøren sender sin hær mod den nærmeste fjendtlige hær.

Lettere og sværere bots justerer reaktionstid og præcision, ikke HP eller skade.
