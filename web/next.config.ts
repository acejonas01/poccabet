// Poccabet — Next.js site (Theme A and Daylight), built for search engines.
// It runs the same screens as the Vite site (../frontend/src/redesign); only the routing and the
// server rendering live here. react-router calls in those screens go through lib/router-shim.
import os from "node:os";
import path from "node:path";
import type { NextConfig } from "next";

const BACKEND = process.env.BACKEND_URL || "https://poccabet.onrender.com";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "";
// Dev server only: let phones on the same Wi-Fi open it by this Mac's IP (e.g. 192.168.x.x:3000).
// Without this, Next.js blocks its dev scripts for other hosts and the buttons do nothing.
const LAN_IPS = Object.values(os.networkInterfaces()).flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: LAN_IPS,
  experimental: { externalDir: true }, // compile the shared screens from ../frontend/src
  outputFileTracingRoot: path.resolve(__dirname, ".."), // the repo: this site + ../frontend
  // The API is reached through this site (same origin): no CORS setup needed on the backend.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
  webpack(config, { webpack, dev }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-router-dom": path.resolve(__dirname, "lib/router-shim.tsx"),
    };
    // The shared code reads Vite settings; give them this site's values.
    config.plugins.push(
      new webpack.DefinePlugin({
        "import.meta.env.VITE_API_URL": JSON.stringify(""), // same origin, via the rewrite above
        "import.meta.env.VITE_THEMES": JSON.stringify("a,daylight"), // Theme A (default), then Daylight
        "import.meta.env.VITE_PUBLIC_URL": JSON.stringify(SITE),
        "import.meta.env.DEV": JSON.stringify(dev),
      }),
    );
    return config;
  },
};

export default nextConfig;
