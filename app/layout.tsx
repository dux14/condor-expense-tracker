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
      <body className="min-h-dvh bg-bg text-text">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
