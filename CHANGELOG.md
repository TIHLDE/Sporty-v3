# Changelog

Alle merkbare endringer i Sporty dokumenteres her. Nyeste øverst.

## Kategorier

- **✨ Feature**: ny funksjonalitet
- **🐛 Fix**: feilretting
- **♻️ Endret**: endring i eksisterende funksjonalitet (oppførsel, UI, refaktorering)
- **🗑️ Fjernet**: funksjonalitet som er tatt bort
- **🔒 Sikkerhet**: sikkerhetsrelaterte endringer

## Mal

Kopier denne blokken til toppen av listen under, og ta bare med kategoriene som er i bruk:

```md
## YYYY-MM-DD

### ✨ Feature

- Kort beskrivelse av hva som er nytt

### 🐛 Fix

- Kort beskrivelse av hva som ble fikset
```

---

## 2026-10-14

### ✨ Feature

- **Varselloggen beholdes for alltid**:
  - `GET /api/notifications` tar `?cursor=` og blar bakover i hele historikken, 100 om gangen. Nettsiden har «Last inn eldre varsler».
  - Når et arrangement slettes, beholdes varslene om det, men de mister lenken.
  - Når en undergruppe slettes, flyttes varslene til hovedgruppen, også uten lenke.
  - Varsler slettes bare når noen fjernes fra gruppen («fjernet fra gruppen = fjernet fra alt»).
- **Nettsiden, første runde** (shadcn, enkel toppmeny med én kolonne i stedet for dashboard): **Hjem** med kommende arrangementer og dine ubetalte bøter, **Grupper** med gruppeside (arrangementer, medlemmer med rolle/posisjon/inaktiv, undergrupper), **Nytt arrangement** (sub-/admin, med stedssøk), **Arrangement** med svar og hvem som kommer, og **Bøter** per lag (sum, «Last inn flere», detaljer med bilde, gi bot, godkjenning for botsjef/leder)
- **Nettsiden, andre runde**: gruppesiden har fått fanene **Kunngjøringer** (med bilder, video og vedlegg, egen side med kommentarer), **Avstemninger** (stem direkte i listen, resultat når det er synlig, egen side med kommentarer) og **Betalinger** (marker selv at du har betalt; sub-/admin ser hvem som mangler), med «Ny …» for sub-/admin. Ny side **Innstillinger** for gruppen: navn, beskrivelse og farge, roller (admin), posisjon og inaktiv med begrunnelse (sub-/admin), posisjonslisten (legg til, nytt navn, flytt, slett), og undergrupper (lag ny med medlemmer, endre medlemmer, slett)
- **Nettsiden, sub-/admin som i appen**: rediger og slett arrangementer (`/arrangementer/:id/rediger`), registrer/endre/fjern resultat på kamper, og gi fellesbot til dem som ikke har svart. «Nytt arrangement» lar deg velge hele gruppen eller en undergruppe, og vises også for den som bare er sub-/admin i en undergruppe. Skjemaene har samme standardverdier og sjekker som appen: start i morgen kl. 18, sluttid/påmeldingsfrist som valgfrie felt (sluttid etter start, frist før start), frist om 3 dager for avstemninger og om 14 dager for betalinger, ingen like alternativer, og kunngjøringer trenger bare tittel
- **Nettsiden, resten av appen**:
  - **Meldinger**: gruppechatter og direktemeldinger, «Ny melding» til alle du deler en gruppe med, og eldre meldinger lastes inn ved behov. Nye meldinger hentes hvert 5. sekund.
  - **Varsler**: med «Merk alle som lest». Varslene lenker til riktig side på nettsiden, og gruppesiden har en egen Varsler-fane.
  - **Antall uleste** meldinger og varsler vises i menyen.
  - **Profil** (fra brukermenyen):
    - inaktiv-status med begrunnelse, ubetalte bøter og gruppene med rolle
    - pushvarsler, som lagres på brukeren og gjelder appen
    - kalender som .ics-fil med arrangementene du har sagt ja til eller ikke svart på
    - utseende (automatisk, lys eller mørk)
    - logg ut
  - **Gruppesiden**: fanen **Filer** og forsidebildet.
  - **Innstillinger**: **forsidebilde** (admin) og **eksport** av oppmøte og resultater som CSV.
  - **Mobil**: ingen sider ruller sideveis på telefonbredde lenger.
- **tRPC for nettsiden** (`packages/api/src/routers`): prosedyrene kaller samme logikk som REST-API-et for appen i samme prosess, så logikken bare finnes ett sted
- **Felles backend for appen**: API-et fra Sporty Native (grupper, arrangementer, oppmøte, kunngjøringer, avstemninger, bøter fra tihlde.org, betalinger, meldinger, varsler, push, opplasting) er flyttet hit under `/api`, med de samme stiene, så appen og nettsiden deler én database. Appens modeller ligger i `packages/db/prisma/schema/sporty.prisma`, der appens `User` heter `Person` og kobles til Better Auth sin `user`
- **Innlogging for appen**: `/api` godtar appens Photon-token (`Authorization: Bearer`, sjekket lokalt med `jose`) i tillegg til nettsidens cookie. Samme TIHLDE-konto gir samme `Person` i appen og på nettsiden

- **Prosjektoppsett**: samme stack som Sporty v2 (Turborepo, TanStack Start, tRPC, Prisma/PostgreSQL, Better Auth, Tailwind v4 med shadcn/ui i `packages/ui`, Oxlint/Oxfmt, Bun), med egen database i Docker på port 5434
- **Logg inn med TIHLDE**: innlogging via Photon (OAuth2/OIDC med PKCE). Det finnes ingen annen måte å logge inn på
- **Innlogging kreves for alt**: bare `/login` er åpen. Alle andre sider ligger under `_auth`-layouten og sender deg til `/login` uten innlogging, og alle tRPC-kall krever innlogging (`protectedProcedure`, det finnes ingen `publicProcedure`)
- **Brukermeny** øverst til høyre med navn, e-post og «Logg ut»

### 🐛 Fix

- `/api/me`, grupperlisten, lovverket, «Gi bot», fellesbot og «mine bøter» feilet for nettside-brukere når Photon-tokenet ikke kunne hentes, også for grupper som ikke trenger tihlde.org. Tokenet hentes nå bare når det faktisk trengs, og en synk som feiler stopper ikke forespørselen
- **Undergrupper var ikke synlige på nettsiden**: fanen «Undergrupper» vises nå alltid på hovedgrupper (med «Ny undergruppe» for admin), og «Arrangementer» på en hovedgruppe viser også undergruppenes arrangementer, merket med undergruppen
- **Data laget i appen før byttet** (undergruppen 11'er under Pythons Fotball Herrer med posisjon og medlem, og arrangementet «Test») er flyttet fra appens gamle database til denne