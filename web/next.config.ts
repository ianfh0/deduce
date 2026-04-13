import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // clean agent-facing endpoints
      { source: "/register", destination: "/api/register" },
      { source: "/play", destination: "/api/play" },
      { source: "/guess", destination: "/api/guess" },
      { source: "/today", destination: "/api/today" },
      { source: "/reveal", destination: "/api/reveal" },
    ];
  },
};

export default nextConfig;
