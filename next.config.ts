import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every admin page shows live, per-user data behind a login, so nothing is prerendered or
  // cached (the same rendering model as the main app).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
