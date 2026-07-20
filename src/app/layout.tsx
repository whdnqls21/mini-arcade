import type { Metadata, Viewport } from "next";
import { Do_Hyeon, Noto_Sans_KR, Oswald } from "next/font/google";

import "./globals.css";
import AppHeader from "@/components/AppHeader";
import BottomTabs from "@/components/BottomTabs";
import InstallPrompt from "@/components/InstallPrompt";

const display = Do_Hyeon({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Noto_Sans_KR({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--font-body", display: "swap" });
const numeric = Oswald({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-numeric", display: "swap" });

export const metadata: Metadata = {
  title: "뇌지컬 대전",
  description: "친구들과 퍼즐 게임으로 기록 경쟁하는 뇌지컬 대전",
  applicationName: "뇌지컬 대전",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/apple-icon" },
  appleWebApp: { capable: true, title: "뇌지컬", statusBarStyle: "black-translucent" },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable} ${numeric.variable}`}>
      <body>
        <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
          <AppHeader />
          <InstallPrompt />
          <main className="flex-1 px-4 pb-28 pt-2">{children}</main>
          <BottomTabs />
        </div>
      </body>
    </html>
  );
}
