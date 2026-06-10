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
        source: "/auth",
        headers: [
          {
            key: "Content-Type",
            value: "text/html",
          },
        ],
      },
    ];
  },
  rewrites: async () => {
    return [
      {
        source: "/auth",
        destination: "http://127.0.0.1:3000/auth",
      },
    ];
  },
};

export default nextConfig;
