import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyTimeout: 120_000,
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/api/:path((?!auth).*)",
          destination: "http://localhost:4000/api/:path*",
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
