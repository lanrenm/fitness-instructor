import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rspack/cli';

/**
 * Standalone Rspack build for the Step 2a Shadow DOM embed bundle.
 *
 * Differences from rspack.config.mjs (the MF remote build):
 * - NO ModuleFederationPlugin. The MF runtime's share-scope dance
 *   caused the null.useState cascade (see
 *   docs/superpowers/troubleshooting/2026-06-23-mf-auth-stage4.md);
 *   this bundle sidesteps it entirely by inlining every dependency.
 * - React / ReactDOM 19.2.4 are bundled inline (host uses 19.2.6).
 *   Two physical React instances — one for the embed, one for the
 *   host — keep dispatchers correctly scoped.
 * - lucide-react + @fitness/ui-components bundled inline (same reason:
 *   no share-scope negotiation needed).
 * - style-loader attributes every injected <style> tag with
 *   `data-embed-src="auth"` so embed-mount.ts can find and migrate
 *   them into the shadow root at mount time.
 *
 * Output: public/mf-auth/embed.js. clean: false so the existing MF
 * bundle (remoteEntry.js, main.js, etc.) from rspack.config.mjs
 * coexists in the same output dir.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  context: __dirname,
  entry: './src/remote/embed-mount.tsx',
  output: {
    // Separate output dir from rspack.config.mjs's MF bundle. The MF
    // build has `clean: true`, so sharing the output dir would mean
    // every MF watch rebuild wipes embed.js. /mf-auth-embed/* is also
    // whitelisted for CORS in apps/bff/next.config.ts (mirrors the
    // existing /mf-auth/* rule).
    path: path.resolve(__dirname, 'public/mf-auth-embed'),
    publicPath: 'auto',
    clean: true,
    filename: 'embed.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@fitness/ui-components': path.resolve(
        __dirname,
        'node_modules/@fitness/ui-components/dist/index.mjs',
      ),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic' } },
          },
        },
      },
      {
        test: /\.module\.css$/,
        use: [
          {
            // style-loader is leftmost → runs last in the pipeline.
            // injectType lazyStyleTag defers CSS injection until
            // embed-mount.tsx calls .use() on each CSS module. The
            // mount function triggers injection (default target =
            // document.head) then immediately moves the resulting
            // <style> tags into the shadow root — this is the simplest
            // reliable path because style-loader v4 rejects function
            // `insert` options (it calls path.isAbsolute on the value
            // at loader time).
            loader: 'style-loader',
            options: {
              injectType: 'lazyStyleTag',
              attributes: {
                'data-embed-src': 'auth',
              },
            },
          },
          {
            // css-loader runs second: it consumes the @apply-resolved
            // CSS from postcss-loader and applies CSS Modules hashing
            // (namedExport: false keeps `import styles from '...'`).
            loader: 'css-loader',
            options: {
              modules: {
                namedExport: false,
                exportLocalsConvention: 'as-is',
                localIdentName: '[name]__[hash:base64:5]__[local]',
              },
            },
          },
          {
            // postcss-loader is rightmost → runs first on the raw
            // .module.css source. This is where @tailwindcss/postcss
            // expands `@apply flex items-center ...` into real CSS
            // declarations. Without this, the browser receives raw
            // `@apply` directives and silently ignores them — see
            // 2026-06-26 Bug 3: .container lost its flex/centering
            // and the login card was invisible (white-on-white at
            // top-left). postcss.config.js wires @tailwindcss/postcss.
            loader: 'postcss-loader',
          },
        ],
      },
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              injectType: 'lazyStyleTag',
              attributes: { 'data-embed-src': 'auth' },
            },
          },
          'css-loader',
          'postcss-loader',
        ],
      },
    ],
  },
  experiments: {
    // Output as classic script (not ESM). The host loads embed.js via
    // a <script src> tag inside the shadow root, which requires a
    // classic script — ESM <script type="module"> inside shadow roots
    // has cross-browser quirks (Safari especially).
    outputModule: false,
  },
});