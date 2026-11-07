import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { copy } from "@/lib/copy";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });

const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
};

// The phone keyboard shrinks the layout instead of covering it, so act 2's answer field stays visible.
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${mono.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
