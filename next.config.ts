import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Product image uploads travel through server actions.
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [
      {
        // Stable, cacheable tab icons: browsers keep them across deployments
        // instead of dropping the favicon on every release.
        source: "/:icon(favicon.ico|icon.png)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
