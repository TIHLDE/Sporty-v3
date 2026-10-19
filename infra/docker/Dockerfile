FROM oven/bun:1.3.14 AS builder
WORKDIR /app

COPY . .
RUN --mount=type=secret,id=web_env,target=/app/.env --mount=type=cache,target=/root/.bun/install/cache bun install

# prisma/generated is gitignored; the build imports it. generate never connects, but prisma.config.ts requires DATABASE_URL to be set.
RUN DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder bun run --cwd packages/db db:generate

ENV NODE_ENV=production
RUN --mount=type=secret,id=web_env,target=/app/.env cd apps/web && bun run build
ENV DATABASE_URL=

FROM node:24-slim AS runner
# Prisma's schema engine needs openssl to detect the platform; slim ships without it.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

# Build metadata from the build pipeline; a local `docker build` gets "unknown".
ARG APP_VERSION=unknown
ARG GIT_SHA=unknown
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA

ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

USER node

# SSR chunks require workspace dependencies at runtime
WORKDIR /app/apps/web
# The deploy pipeline only ships a new image and never migrates, so migrate on
# boot. `&&` aborts the start if a migration fails instead of serving a stale schema.
CMD ["sh", "-c", "cd ../../packages/db && node node_modules/prisma/build/index.js migrate deploy && cd ../../apps/web && exec node .output/server/index.mjs"]
