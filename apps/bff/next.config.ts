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
  turbopack: {}
};

export default nextConfig;
