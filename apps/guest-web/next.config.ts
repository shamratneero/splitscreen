import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep production builds from replacing files served by a running preview.
  distDir: process.env.ADDASPLIT_BROWSER_TEST === "1" ? ".next-test" : process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  transpilePackages: ["@splitpay/split-engine"],
  typedRoutes: true,
};

export default nextConfig;
