# Sporty v3

Sporty for TIHLDE sine idrettslag. Alt i appen krever innlogging med TIHLDE-kontoen.

Samme stack som [Sporty v2](https://github.com/TIHLDE/sporty): Turborepo, TanStack Start, tRPC, Prisma med PostgreSQL, Better Auth, Tailwind v4 med shadcn/ui, Oxlint og Oxfmt, og Bun.

## Kom i gang

1. Kopier `.env.example` til `.env` og fyll inn verdiene (se under).
2. Installer avhengighetene:
   ```bash
   bun install
   ```
3. Start appen. Dette starter også databasen i Docker, genererer Prisma-klienten og oppdaterer skjemaet:
   ```bash
   bun run dev
   ```
4. Åpne [http://localhost:3001](http://localhost:3001).

## Innlogging med TIHLDE

Innloggingen går gjennom Photon (`https://photon.tihlde.org/api/auth`), TIHLDE sin OAuth2/OIDC-leverandør. Oppsettet ligger i `packages/auth/src/index.ts`.

- `PHOTON_CLIENT_ID` og `PHOTON_CLIENT_SECRET` er påkrevd. Uten dem starter ikke appen, siden ingen kan logge inn.
- Klienten registreres i Photon (krever tilgangen `oauth-clients:*`) med redirect URI `<BETTER_AUTH_URL>/api/auth/callback/photon`, f.eks. `http://localhost:3001/api/auth/callback/photon` lokalt.

### Alt krever innlogging

- **Sider:** `/login` er den eneste åpne siden. Alle andre sider legges under `apps/web/src/routes/_auth/`, der layouten sender deg til `/login` uten gyldig sesjon.
- **API:** Alle tRPC-prosedyrer bruker `protectedProcedure` fra `packages/api/src/index.ts`. Det finnes med vilje ingen `publicProcedure`.

## API for mobilappen

Sporty v3 er felles backend for nettsiden og mobilappen (Sporty Native). Nettsiden bruker tRPC (`/api/trpc`), mens appen bruker et REST-API under `/api` med de samme stiene som appens egen server hadde, så appen bare trenger ny adresse (`EXPO_PUBLIC_API_URL`).

- Koden ligger i `packages/api/src/rest/`: `routes/` (én fil per rute), `server/` (innlogging, synk med tihlde.org, bøter, push …) og `routes.gen.ts` (stiene). `apps/web/src/routes/api/$.ts` sender `/api/*` dit.
- Innlogging: appen sender sitt Photon-token som `Authorization: Bearer …` (sjekkes lokalt mot tihlde.org sine nøkler, og må være laget for `PHOTON_APP_CLIENT_ID`). Nettsidens Better Auth-cookie godtas også.
- Brukere: `Person` er et medlem (med Photon-id), og kobles til Better Auth sin `user` når personen logger inn på nettsiden. Appen og nettsiden gir samme `Person` for samme TIHLDE-konto.
- Opplastede filer lagres i `apps/web/storage` (Docker-volumet `sporty_v3_uploads` i produksjon).

## Struktur

```
apps/web          TanStack Start-appen (sider, API-ruter for auth og tRPC)
packages/api      tRPC-rutere og kontekst
packages/auth     Better Auth med «Logg inn med TIHLDE»
packages/db       Prisma-skjema, migreringer og klient
packages/ui       Delte shadcn/ui-komponenter
packages/config   Felles TypeScript-oppsett
infra/docker      Postgres for utvikling, og Dockerfile/compose for produksjon
```

## Skript

| Kommando | Hva den gjør |
|---|---|
| `bun run dev` | Starter database og app |
| `bun run build` | Bygger alt |
| `bun run check-types` | Typesjekk |
| `bun run lint` / `bun run lint:fix` | Oxlint |
| `bun run format` / `bun run format:fix` | Oxfmt |
| `bun run db:migrate` | Ny migrering etter endringer i skjemaet |
| `bun run db:studio` | Prisma Studio |
| `bun run docker:dev` / `docker:dev:down` / `docker:fresh` | Database i Docker |
