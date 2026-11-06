import type { Metadata } from "next";
import { Kalam, Permanent_Marker, Pinyon_Script, Schibsted_Grotesk } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { copy } from "@/lib/copy";
import "./globals.css";

const sans = Schibsted_Grotesk({
  variable: "--font-sans-family",
  subsets: ["latin"],
});

const marker = Permanent_Marker({
  variable: "--font-marker-family",
  subsets: ["latin"],
  weight: "400",
});

const hand = Kalam({
  variable: "--font-hand-family",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Only the participation certificate uses it.
const script = Pinyon_Script({
  variable: "--font-script-family",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.home.subhead,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${marker.variable} ${hand.variable} ${script.variable} antialiased`}
    >
      <body className="p-1.5 sm:p-4 lg:p-6">
        <div className="board-frame">
          <span
            className="corner-cap left-0 top-0 rounded-tl-[12px] rounded-br-[6px]"
            aria-hidden="true"
          />
          <span
            className="corner-cap right-0 top-0 rounded-tr-[12px] rounded-bl-[6px]"
            aria-hidden="true"
          />
          <span
            className="corner-cap bottom-0 left-0 rounded-bl-[12px] rounded-tr-[6px]"
            aria-hidden="true"
          />
          <span
            className="corner-cap bottom-0 right-0 rounded-br-[12px] rounded-tl-[6px]"
            aria-hidden="true"
          />
          <div className="board min-h-[calc(100dvh-3rem)] overflow-clip">{children}</div>
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
