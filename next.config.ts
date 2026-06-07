import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-capable build (Phase 2). Static export was removed in F0 so that
  // later features can use Route Handlers, middleware, and cookie-based auth.
  // The PWA is unaffected: public/sw.js is a static asset registered client-side.
};

export default nextConfig;
