import type { Metadata, Viewport } from "next";
import { Do_Hyeon, Noto_Sans_KR, Oswald } from "next/font/google";

import "./globals.css";
import AppHeader from "@/components/AppHeader";
import { AppShell } from "@/components/AppShell";
import InstallPrompt from "@/components/InstallPrompt";

const display = Do_Hyeon({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Noto_Sans_KR({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--font-body", display: "swap" });
const numeric = Oswald({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-numeric", display: "swap" });

import { ICON_VERSION } from "@/lib/brain-mark";

export const metadata: Metadata = {
  title: "뇌지컬 리그",
  description: "친구들과 퍼즐 게임으로 기록 경쟁하는 뇌지컬 리그",
  applicationName: "뇌지컬 리그",
  // 아이콘을 바꾸면 ICON_VERSION 을 올린다. 브라우저와 OS 가 아이콘을 오래 캐시해서
  // 경로가 같으면 예전 그림을 계속 쓴다.
  icons: {
    icon: `/icon.svg?v=${ICON_VERSION}`,
    shortcut: `/icon.svg?v=${ICON_VERSION}`,
    apple: `/apple-icon?v=${ICON_VERSION}`,
  },
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
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
