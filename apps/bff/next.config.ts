import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@fitness/ui-components"],
  webpack: (config) => {
    config.resolve.alias["@fitness/ui-components"] = path.resolve(
      __dirname,
      "../../packages/ui-components/dist/index.js"
    );
    return config;
  },
};

export default nextConfig;
