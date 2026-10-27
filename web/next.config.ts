import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Yerel test: ANCALOG_MOCK=1 ile çalışınca gerçek veritabanı yerine dev/mock-supabase.ts kullanılır
    resolveAlias: process.env.ANCALOG_MOCK ? { "@supabase/supabase-js": "./dev/mock-supabase.ts" } : {},
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
