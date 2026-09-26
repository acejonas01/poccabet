// Poccabet — Next.js site (Theme A only), built for search engines.
// It runs the same screens as the Vite site (../frontend/src/redesign); only the routing and the
// server rendering live here. react-router calls in those screens go through lib/router-shim.
import path from "node:path";
import type { NextConfig } from "next";

const BACKEND = process.env.BACKEND_URL || "https://poccabet.onrender.com";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "";

const nextConfig: NextConfig = {
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
        "import.meta.env.VITE_THEMES": JSON.stringify("a,bento,poster,daylight"), // Theme A + the three light themes
        "import.meta.env.VITE_PUBLIC_URL": JSON.stringify(SITE),
        "import.meta.env.DEV": JSON.stringify(dev),
      }),
    );
    return config;
  },
};

export default nextConfig;
