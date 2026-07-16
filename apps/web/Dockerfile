FROM node:22

WORKDIR /app

ENV HTTP_PROXY=http://host.docker.internal:7897
ENV HTTPS_PROXY=http://host.docker.internal:7897
ENV http_proxy=http://host.docker.internal:7897
ENV https_proxy=http://host.docker.internal:7897
ENV CI=true

RUN npm config set registry https://registry.npmmirror.com && \
    npm config set proxy http://host.docker.internal:7897 && \
    npm config set https-proxy http://host.docker.internal:7897

RUN npm install -g pnpm

COPY package*.json ./
COPY . .

# 1) Install dev deps for ui-components, then build it so packages/ui-components
#    has a populated dist/. (Mirrors apps/bff/Dockerfile — same monorepo pattern.)
WORKDIR /app/packages/ui-components
RUN pnpm install --ignore-scripts && pnpm build

# 2) Back to the workspace root for the full install.
WORKDIR /app
RUN pnpm install --ignore-scripts

# 3) @fitness/ui-components is referenced from vite.config.ts (federation
#    shared), but not declared in apps/web/package.json, so pnpm 11 hoisted
#    mode materialises it into node_modules *before* the build above runs,
#    and won't refresh the copy afterwards ("Already up to date"). Re-stamp
#    the dist/ tree from the now-built source so the runtime import resolves.
#    Also: packages/ui-components/package.json declares `exports: "./dist/index.js"`
#    but tsup (`format: ['esm']`) produces `index.mjs`. Vite's esbuild pre-bundle
#    is strict about the exports map and ERR_PACKAGE_PATH_NOT_EXPORTEDs on
#    mismatch — rename to keep web working until that source-level fix lands.
#    (BFF tolerates this because rspack's module resolver is loose; this is a
#    latent bug in packages/ui-components, not introduced by the MF migration.)
RUN if [ -d /app/node_modules/@fitness/ui-components ]; then \
      rm -rf /app/node_modules/@fitness/ui-components/dist && \
      cp -a /app/packages/ui-components/dist /app/node_modules/@fitness/ui-components/dist && \
      if [ -f /app/node_modules/@fitness/ui-components/dist/index.mjs ] && \
         [ ! -f /app/node_modules/@fitness/ui-components/dist/index.js ]; then \
        mv /app/node_modules/@fitness/ui-components/dist/index.mjs \
           /app/node_modules/@fitness/ui-components/dist/index.js; \
      fi; \
    fi

# 4) Mirror apps/bff/Dockerfile's node_modules backup pattern. docker-compose
#    mounts the named volume `web-node-modules` on top of /app/node_modules,
#    hiding the image's installed deps and breaking `vite` lookups (npm script
#    can't find `vite: not found` → container restart loop). Back up the
#    image's resolved node_modules and restore it on container start.
RUN mkdir -p /app-original-modules && \
    cp -a ./node_modules /app-original-modules/

EXPOSE 5173

CMD ["sh", "-c", "cp -rn /app-original-modules/node_modules/* /app/node_modules/ 2>/dev/null || true; exec npm run dev -- --host 0.0.0.0"]
