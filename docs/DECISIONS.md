# Beslutninger

Format: dato, beslutning, begrundelse. Ændres en beslutning, skrives en ny linje i stedet for at slette den gamle.

## 2026-11-26

- **Navn: Tumblehorde.** Repo `tumblehorde`. *Tumble* er den goofy fysik, *horde* er hæren. Navnet undgår "wall", som lå for tæt på Shieldwall. Fravalgt: Tumblewall, Fumblelord (taget), Fumblecharge, Tumblefray.
- **Browser, 3D, tredjepersonskamera.** Det skal være let at komme i gang, og det passer til det ønskede look.
- **Hop og goofy fysik.** Inspireret af Fall Guys og Shieldwall.
- **Bot først, online senere.** Så kan vi teste kernen uden server.
- **Colyseus til online.** Rum-modellen passer til at oprette og joine kampe. Open source, og gratis at selvhoste.
- **Babylon.js + Havok i klienten.** Havok er gratis under MIT og giver goofy fysik.
- **Simpel matematik for hits på serveren.** Så alle ser det samme, og synkronisering holdes simpel.
- **Fælles simuleringskode i `/shared`.** Samme logik i browser og server. Gør bot-først muligt.
- **Åbent kort, ca. 150 × 150 m, usynlige kanter.** Lille og overskueligt. Flere kort kommer senere.
- **Ingen slot og ingen landsbyer i v1.** Holder scope nede.
- **Sejr: alle fjender døde.** Simpel og tydelig.
- **Kommandør genopstår efter ca. 10 sekunder.** Hæren kæmper videre imens.
- **Hær: 10/20/30 enheder pr. hold, valgt af spilleren.**
- **Alle enhedstyper i v1:** Sværdmand, bueskytte og rytter med hest og spyd. Det er et valg, der øger scope. Milepælene i `MVP.md` gør det håndterbart.
- **Lokalt: maks 4 hære i alt.** Dig og 1–3 bot-hære.
- **Online: 2–4 hære.** Bots online er udskudt.
- **Frakobling: 30 sekunder, derefter dør hæren.**
- **Ét hold-format i v1:** Alle mod alle og 2 hold. Mere senere.
- **Healthbar kun over egen karakter.** Holder skærmen ryddelig.
- **Ordrer på taster 1–4.** Forslag, ikke godkendt endnu.
- **Grafik: low-poly som screenshottet.** Lyse holdfarver, og silhuetter der er tydelige.
- **Hosting: egen PC lokalt. Oracle Always Free eller Render Starter til test. Colyseus Cloud senere.** Gratis i starten.
