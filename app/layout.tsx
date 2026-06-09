import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cóndor",
  description: "Seguimiento de gastos local-first para LATAM",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cóndor",
  },
  // Favicon + apple-icon are provided by the app/ file conventions
  // (app/favicon.ico, app/icon.png, app/apple-icon.png) — Next auto-links them.
};

export const viewport: Viewport = {
  themeColor: "#0E131F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      {/* pt: keep content clear of the iOS status bar / notch — viewport-fit=cover
          extends the page under it (black-translucent standalone mode).
          SINGLE SOURCE OF TRUTH for the top safe-area inset: only <body> owns
          env(safe-area-inset-top). Page headers must use plain design padding
          (pt-4/pt-5) and must NOT add a second env(safe-area-inset-top) — doing
          so double-pads under the notch. The only exceptions are full-screen
          overlays rendered outside this <body> flow (LockScreen), which carry
          their own inset. Bottom inset is owned additively: each page clears the
          BottomNav rail (pb-calc(...+5.5rem); /anadir +2rem, no nav) and
          BottomNav itself clears the home indicator (pb-env(safe-area-inset-bottom)). */}
      <body className="min-h-dvh bg-bg text-text pt-[env(safe-area-inset-top)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
