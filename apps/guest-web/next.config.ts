import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@addasplit/split-engine"],
  typedRoutes: true,
};

export default nextConfig;
