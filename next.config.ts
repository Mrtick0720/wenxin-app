import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Resolve the build's commit hash at build time. Vercel sets VERCEL_GIT_COMMIT_SHA;
// fall back to local git for `npm run dev` / non-Vercel builds.
function resolveCommit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.242'],
  devIndicators: false,
  env: {
    // Inlined into the client bundle at build time — used by the temporary
    // BuildMarker to prove which build a device actually loaded.
    NEXT_PUBLIC_BUILD_COMMIT: resolveCommit(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  async headers() {
    return [
      {
        // Prevent iOS PWA from caching the app shell and JS chunks
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
