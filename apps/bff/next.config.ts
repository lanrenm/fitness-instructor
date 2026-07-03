import type { NextConfig } from "next";
import path from "path";

const uiComponentsDist = path.resolve(
  __dirname,
  "./node_modules/@fitness/ui-components/dist/index.mjs"
);
const uiComponentsDistRelative =
  "./node_modules/@fitness/ui-components/dist/index.mjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@fitness/ui-components"],
  webpack: (config) => {
    config.resolve.alias["@fitness/ui-components"] = uiComponentsDist;
    return config;
  },
  turbopack: {
    resolveAlias: {
      "@fitness/ui-components": uiComponentsDistRelative,
    },
  },
  headers: () => {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, Accept'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
        ]
      },
      {
        source: '/mf-auth/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
          },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
        ],
      },
      {
        source: '/mf-auth-embed/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
          },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
        ],
      },
    ];
  },
};

export default nextConfig;
