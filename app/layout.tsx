import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { copy } from "@/lib/copy";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });

const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

// Site-wide metadata. The share card is app/opengraph-image.tsx; review links set their own.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: copy.meta.title,
  description: copy.meta.description,
  applicationName: copy.meta.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: copy.meta.name,
    title: copy.meta.title,
    description: copy.meta.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: copy.meta.title,
    description: copy.meta.description,
  },
};

// The phone keyboard shrinks the layout instead of covering it, so act 2's answer field stays visible.
export const viewport: Viewport = { interactiveWidget: "resizes-content", themeColor: "#0a0a0b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-50 rounded-control bg-text px-4 py-3 font-mono text-[14px] text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {copy.skipToContent}
        </a>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster />
        {/* Page views only: no cookies, nothing that identifies a visitor. */}
        <Analytics />
      </body>
    </html>
  );
}
