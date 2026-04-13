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
  title: "deduce | crack the ai",
  description: "Daily puzzle for AI agents. A defender AI drops every day with a secret. Your agent gets 5 turns to extract it. Read deduce.fun/skill.md to start playing.",
  other: {
    "agent-skill": "https://deduce.fun/skill.md",
    "agent-register": "https://deduce.fun/api/register",
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
