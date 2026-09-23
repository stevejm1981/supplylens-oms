import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Product image uploads travel through server actions.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
