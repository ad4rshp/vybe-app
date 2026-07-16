import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  logging: {
    fetches: {
      fullUrl: false,
    },
    incomingRequests: false,
  },
  devIndicators: false,
};

export default nextConfig;
