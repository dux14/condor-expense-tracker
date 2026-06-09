import type { NextConfig } from "next";

// Supabase project origin — read from env so preview/prod differ without code change.
const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Keep the avatar host in sync with images.remotePatterns below.
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} wss://*.supabase.co`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Exported as a stable seam for the header-presence regression test. Next loads
// only the default export, so a named export alongside it is inert at runtime.
export const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "publickey-credentials-get=(self), camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // Server-capable build (Phase 2). Static export was removed in F0 so that
  // later features can use Route Handlers, middleware, and cookie-based auth.
  // The PWA is unaffected: public/sw.js is a static asset registered client-side.
  images: {
    // Explicit: assets are static/small; skip the metered Image Optimizer on Hobby (F11).
    unoptimized: true,
    remotePatterns: [
      // Mirrored in the CSP img-src directive above — update both together.
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
