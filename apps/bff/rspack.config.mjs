import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rspack/cli';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  context: __dirname,
  entry: './src/remote/bootstrap.ts',
  output: {
    path: path.resolve(__dirname, 'public/mf-auth'),
    publicPath: 'auto',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@fitness/ui-components': path.resolve(__dirname, 'node_modules/@fitness/ui-components/dist/index.mjs'),
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
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                namedExport: false,
                exportLocalsConvention: 'as-is',
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'bff_auth',
      filename: 'remoteEntry.js',
      exposes: {
        './AuthPage': './src/remote/bootstrap.ts',
      },
      shared: {
        // eager:true on the REMOTE mirrors the host (apps/web). Without it
        // Rspack generates an async fallback chunk for `react` (see
        // __webpack_require__.e(564) in the bundle), but AuthPage's compiled
        // code does a sync require for the shared module. loadShareSync
        // then fails with "The function should not be called unless you set
        // 'eager:true'". Setting eager on both sides lets the consume use
        // the host's synchronously-registered React without bundling a copy.
        react: { singleton: true, requiredVersion: '^19.0.0', eager: true },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0', eager: true },
        'lucide-react': { singleton: true, eager: true },
        // eager: true because the host (apps/web) doesn't declare
        // @fitness/ui-components in its package.json — the Vite federation
        // plugin therefore can't register a host copy in the share scope.
        // With eager: false the remote's loadRemote() returns
        // `__mf_remote_dependency_pending` pointing at the host's async
        // registration, which never resolves, and the page hangs at
        // "加载中...". eager: true inlines the module into the remote bundle
        // and skips the host-side negotiation.
        '@fitness/ui-components': { singleton: true, eager: true },
      },
      // Disable the dynamic-remote-type-hints runtime plugin. It opens a
      // WebSocket to ws://127.0.0.1:16322/ for dev-only type hints, but the
      // BFF's Rspack runs in `build --watch` mode (not `serve`), so there is
      // no Rspack dev server on 16322. The host browser then tries the host's
      // loopback (also no service), the WebSocket fails, and the federation
      // runtime's `__mf_remote_pending` promise hangs forever — pinning the
      // page at "加载中...". See apps/web/src/pages/Login/index.tsx.
      dev: {
        disableDynamicRemoteTypeHints: true,
      },
    }),
  ],
  experiments: {
    outputModule: true,
  },
});
