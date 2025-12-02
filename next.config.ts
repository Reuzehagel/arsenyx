import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
