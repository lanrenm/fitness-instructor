# Build context must be the monorepo root (set via docker-compose
# `build.context: ../`). pnpm-workspace.yaml declares hoisted linking, so
# node_modules lives at /app — every workspace package.json must be present
# before `pnpm install` so `workspace:*` can resolve.
#
# Why this Dockerfile exists: the old one used `apps/api/` as build context,
# which doesn't include pnpm-workspace.yaml / root lockfile / packages/*.
# As a result @fitness/shared-types never got symlinked, and any dep added
# to apps/api/package.json after the first build (e.g. @nestjs/config,
# @nestjs/mapped-types, @anthropic-ai/sdk) was missing from the image.

FROM node:22-alpine

WORKDIR /app

# Mirror + proxy — matches the host dev workflow so pnpm/prisma can reach
# npmmirror and the upstream Anthropic API via the local proxy.
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set proxy http://host.docker.internal:7897 && \
    npm config set https-proxy http://host.docker.internal:7897

RUN npm install -g pnpm

# ---- Layer 1: workspace manifests (cache hit unless deps change) ----
# Copy only manifests first so a source-only change doesn't bust the
# pnpm install cache.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
# pnpm-workspace.yaml globs packages/*, so every workspace member's
# package.json must be present even if api doesn't transitively depend
# on it (here: ui-components, which is consumed by web only).
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/ui-components/package.json ./packages/ui-components/
COPY apps/api/package.json ./apps/api/

# `api...` selects the api package + every workspace dep it transitively
# references (here: @fitness/shared-types). `--frozen-lockfile` guarantees
# the committed lockfile is authoritative; `--ignore-scripts` defers
# postinstall hooks so we can run prisma generate explicitly below.
RUN pnpm install --filter api... --frozen-lockfile --ignore-scripts

# ---- Layer 2: source (changes more often than deps) ----
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/ui-components/ ./packages/ui-components/
COPY apps/api/ ./apps/api/

# shared-types is consumed via `workspace:*` and its package.json
# `exports` map `./ai` → `./dist/ai.js`. dist/ is gitignored, so the
# compiled output must be produced inside the image.
RUN pnpm --filter @fitness/shared-types build

# Regenerate Prisma client against the committed schema. Skipped during
# pnpm install above (`--ignore-scripts`).
# The npm registry proxy (`http://host.docker.internal:7897`) doesn't help
# for binaries.prisma.sh — inside the container that URL's host resolves
# to the container's loopback, which has no proxy listener, causing
# ECONNREFUSED. binaries.prisma.sh is reachable directly, so unset proxy
# env vars for this step only.
RUN cd /app/apps/api && \
    env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
        -u npm_config_proxy -u npm_config_https_proxy \
        npx prisma generate

EXPOSE 3001

# nest CLI lives at /app/node_modules/.bin/nest (hoisted linker), but
# the api package.json sits at /app/apps/api/package.json, so we cd in
# before invoking npm. `start:dev` runs `nest start --watch`.
CMD ["sh", "-c", "cd /app/apps/api && npm run start:dev"]
