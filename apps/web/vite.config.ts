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
            type: 'module',
            name: 'bff_auth',
            entry: mfRemoteUrl,
            entryGlobalName: 'bff_auth',
            shareScope: 'default',
          },
        },
        shared: {
          react: { singleton: true, requiredVersion: '^19.0.0' },
          'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
          'lucide-react': { singleton: true },
          '@fitness/ui-components': { singleton: true },
        },
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
      },
    },
  };
});
