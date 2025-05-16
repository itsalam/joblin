import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    minimumCacheTTL: 2678400, // 31 days
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.logo.dev",
        pathname: "/**", // allow all subpaths
      },
    ],
  },
};

export default nextConfig;
