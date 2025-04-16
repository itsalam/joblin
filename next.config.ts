import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.logo.dev',
        pathname: '/**', // allow all subpaths
      }],
  },
};

export default nextConfig;
