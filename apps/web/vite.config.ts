import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const mfRemoteUrl =
    env.VITE_MF_REMOTE_URL ?? 'http://localhost:3000/mf-auth/remoteEntry.js';

  return {
    plugins: [
      react(),
      tailwindcss(),
      federation({
        name: 'web',
        filename: 'remoteEntry.js',
        remotes: {
          bff_auth: {
            // BFF's Rspack outputs a global-script remoteEntry.js
            // (`var bff_auth; ... bff_auth = ...;`), NOT an ESM with
            // `export` statements. With `type: 'module'` the host's
            // `import()` returns an empty module object, the runtime's
            // loadRemote() then wraps it incorrectly and `mod.default`
            // resolves to undefined. Default (no `type`) makes the
            // federation plugin inject a `<script>` tag — the global
            // `window.bff_auth` becomes the remote and loadRemote()
            // unwraps `default` correctly.
            name: 'bff_auth',
            entry: mfRemoteUrl,
            entryGlobalName: 'bff_auth',
            shareScope: 'default',
          },
        },
        shared: {
          // Eager:true on the HOST means React/react-dom register in the
          // share scope synchronously when the host bundle evaluates, so
          // they're available before the remote's first consume resolves.
          // Without eager:true, the host's React registration is async
          // (chunk-loaded), and the remote's consume runs first — falling
          // back to the 19.2.6 vendor chunk from ui-components' peer dep
          // and loading a second React instance, breaking useState's
          // dispatcher. Required because the remote's bootstrap eagerly
          // (sync) consumes React; the host's async share init loses the
          // race.
          //
          // import:false on react/react-dom tells the Vite plugin to
          // generate a seed module (in dev only) that imports the HOST's
          // own local React/ReactDOM and writes it into
          // __mfModuleCache.share["react"] BEFORE the initHost() loop
          // calls runtime.loadShare(). Without it, the loop's first
          // loadShare("react") finds an empty share scope and falls
          // through to the remote's initializeSharingData fallback —
          // writing the REMOTE's Rspack-bundled React@19.2.4 (or 19.2.6
          // after version alignment) into the share scope. Then
          // AuthPage's consume proxy pulls the remote's React, while the
          // host's reconciler sets the dispatcher on a different
          // ReactSharedInternals → `Cannot read properties of null
          // (reading 'useState')`. With import:false, the host's
          // `import 'react'` is also proxied through the share scope, so
          // the host, the seed, and AuthPage all share one React
          // instance.
          //
          // NOTE: `import` here is a STRING ('react' / 'react-dom'),
          // NOT boolean false. Setting it to literal `false` would make
          // the seed code do `import("/@fs/<abs>/node_modules/react/index.js")`
          // which loads the raw CJS file (`'use strict'; ... module.exports = ...`)
          // in the browser ESM context → `ReferenceError: module is not defined`.
          // A string value short-circuits the Vite plugin's
          // getConcreteSharedImportSource (line 986: `if (typeof
          // configuredImport === "string") return configuredImport;`) so
          // the seed does `import("react")` which Vite's prebundle serves
          // as ESM (`node_modules/.vite/deps/react.js?v=...`).
          //
          // SUBPATH OVERRIDES — react/jsx-dev-runtime,
          // react/jsx-runtime, react-dom/client. The Vite plugin's
          // COMMON_SHARED_SUBPATHS map (line 3188) auto-walks these
          // subpaths and shares them with the PARENT's shareItem via
          // getLoadShareModulePath + writeLoadShareModule + writePreBuildLibPath
          // (line 5041). With `import: 'react'` on the parent, the plugin's
          // writePreBuildLibPath line 1005 uses the parent's
          // getConcreteSharedImportSource → returns the string `'react'`
          // even when pkg='react/jsx-dev-runtime'. The generated prebuild
          // module then does `import __mfPrebuildDefault from 'react'`,
          // which doesn't expose `jsxDEV` (that's only on the
          // `react/jsx-dev-runtime` subpath). The destructured export
          // `const jsxDEV = __mfPrebuildExports.jsxDEV` is `undefined`,
          // and the host's JSX transform call site throws `_jsxDEV is
          // not a function`. Same trap for `react/jsx-runtime` (jsx/jsxs)
          // and `react-dom/client` (createRoot).
          //
          // Declaring each subpath explicitly here gives it its own
          // shareItem with `import: '<subpath>'` (string), so:
          //   - The seed does `import('react/jsx-dev-runtime')` →
          //     Vite prebundle serves it as ESM (line 5035-5048 pushes
          //     it into optimizeDeps.include).
          //   - writePreBuildLibPath's special case for `react/jsx-dev-runtime`
          //     (line 1020-1029) imports from the subpath, and the
          //     destructured jsxDEV is the real one.
          //   - getSharedNamedExports returns ['Fragment','jsxDEV'] from
          //     the subpath's actual ESM file, not from `'react'` main.
          // The plugin's loop at line 5012 iterates ALL shared keys, so
          // these explicit subpath entries overwrite the auto-generated
          // ones the parent loop (line 5041) wrote first. Order doesn't
          // matter; the later writeLoadShareModule / writePreBuildLibPath
          // call (per-key) replaces the earlier one (per-subpath).
          //
          // lucide-react / @fitness/ui-components don't need import:false
          // because the host code never imports them directly — only
          // AuthPage does, and the remote's fallback populates the
          // share scope for them. (Apps/web source: `grep -r
          // "from ['\"]lucide-react\|from ['\"]@fitness" apps/web/src`
          // returns no matches.)
          react: { singleton: true, requiredVersion: '^19.0.0', eager: true, import: 'react' },
          'react/jsx-dev-runtime': { singleton: true, requiredVersion: '^19.0.0', eager: true, import: 'react/jsx-dev-runtime' },
          'react/jsx-runtime': { singleton: true, requiredVersion: '^19.0.0', eager: true, import: 'react/jsx-runtime' },
          'react-dom': { singleton: true, requiredVersion: '^19.0.0', eager: true, import: 'react-dom' },
          'react-dom/client': { singleton: true, requiredVersion: '^19.0.0', eager: true, import: 'react-dom/client' },
          'lucide-react': { singleton: true },
          '@fitness/ui-components': { singleton: true },
        },
        // The dynamic-remote-type-hints runtime plugin (enabled by default
        // in dev) opens a WebSocket to ws://127.0.0.1:16322/ expecting an
        // Rspack dev server there. BFF runs `rspack build --watch` (not
        // `serve`), so no dev server is reachable from the host browser, the
        // WebSocket fails, and the federation runtime's `__mf_remote_pending`
        // promise hangs forever. Disable it on both sides. The same option
        // is also set in apps/bff/rspack.config.mjs for the remote side.
        dev: {
          disableDynamicRemoteTypeHints: true,
        },
        // The dts (declaration type sharing) feature tries to download
        // `@mf-types.zip` from the remote at runtime. With BFF in
        // `build --watch` mode (no dev server for type streaming) this
        // always fails. It's a dev-time IDE hint only — disable here.
        // Same as the dts.disable option in @module-federation/sdk.
        dts: false,
      }),
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://host.docker.internal:3000',
          changeOrigin: true,
        },
        '/bff': {
          target: 'http://host.docker.internal:3000',
          changeOrigin: true,
        },
        '/users': {
          target: 'http://host.docker.internal:3001',
          changeOrigin: true,
        },
        // Step 2a: proxy the standalone embed bundle (BFF Next.js's
        // public/ dir) through Vite. /api/embed/auth returns
        // bundleUrl: '/mf-auth-embed/embed.js' and the host <script>
        // loads it from the same origin as the page (5173), so Vite
        // has to forward to BFF (3000). Without this the browser
        // gets a 404 HTML page, parses it as JS, and dies with
        // "Unexpected token '<'".
        '/mf-auth-embed': {
          target: 'http://host.docker.internal:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
