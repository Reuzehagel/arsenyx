import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark pg as external to avoid Turbopack bundling issues
  serverExternalPackages: ["pg"],
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.warframestat.us",
        pathname: "/img/**",
      },
      {
        protocol: "https",
        hostname: "wiki.warframe.com",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
