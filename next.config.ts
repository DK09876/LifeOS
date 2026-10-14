import type { NextConfig } from "next";

// One id per build, baked into both the server and the browser bundles. The
// data API reports the server's; a page running older code sees the mismatch
// and reloads - the Home Screen app otherwise keeps old code for days.
const BUILD_ID = process.env.LIFEOS_BUILD_ID ?? String(Date.now());

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_LIFEOS_BUILD: BUILD_ID },
  // node-sqlite3-wasm loads a .wasm file relative to its own package path.
  // Bundling rewrites that path and the file goes missing at runtime, so the
  // package is required from node_modules instead.
  serverExternalPackages: ['node-sqlite3-wasm', 'web-push'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
