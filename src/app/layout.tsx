import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: `${BRAND.name} — ${BRAND.short}`, template: `%s · ${BRAND.short}` },
  description: `${BRAND.tagline} 24/7 digital radio from ${BRAND.owner}.`,
  icons: { icon: "/favicon.svg" },
  openGraph: { title: BRAND.name, description: BRAND.tagline, images: [BRAND.logo] },
};

export const viewport: Viewport = { themeColor: "#070B1E", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--color-gold)] focus:px-3 focus:py-2 focus:text-[var(--color-midnight)]">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
