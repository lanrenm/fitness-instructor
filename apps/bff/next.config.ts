import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@fitness/ui-components"],
  webpack: (config) => {
    config.resolve.alias["@fitness/ui-components"] = path.resolve(
      __dirname,
      "./node_modules/@fitness/ui-components/dist/index.mjs"
    );
    return config;
  },
  turbopack: {},
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
