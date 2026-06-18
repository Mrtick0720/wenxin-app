import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: hosts allowed to load /_next dev resources (HMR + client chunks).
  // Wildcards cover the common home/office LAN ranges so this survives IP changes.
  allowedDevOrigins: ['192.168.0.153', '192.168.*.*', '10.*.*.*', '172.16.*.*'],
  devIndicators: false,
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
