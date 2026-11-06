import type { Metadata } from "next";
import { Archivo, Courier_Prime, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { copy } from "@/lib/copy";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });

const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

// Only the verdict paper uses it.
const courier = Courier_Prime({
  variable: "--font-courier",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${mono.variable} ${courier.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
