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
        react: { singleton: true, requiredVersion: '^19.0.0', eager: false },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0', eager: false },
        'lucide-react': { singleton: true, eager: false },
        '@fitness/ui-components': { singleton: true, eager: false },
      },
    }),
  ],
  experiments: {
    outputModule: true,
  },
});
