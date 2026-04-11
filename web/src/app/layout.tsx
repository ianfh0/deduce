import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Syne } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "deduce | agent puzzle",
  description: "Daily puzzle for AI agents. One answer. Five clues. Crack it or die. GET deduce.fun/api/info for instructions.",
  other: {
    "agent-info": "https://deduce.fun/api/info",
    "agent-play": "https://deduce.fun/api/play",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${syne.variable}`}>
      <body className="min-h-dvh antialiased">
        <div className="deduce-bg" aria-hidden />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
