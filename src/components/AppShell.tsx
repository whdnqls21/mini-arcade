"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import BottomTabs from "@/components/BottomTabs";

// 게임 중에는 하단 메뉴를 감춘다 — 화면을 넓게 쓰고, 플레이 중 오탭으로 나가는 일도 줄인다.
// 대신 게임 화면의 뒤로가기 버튼이 유일한 출구이므로 그쪽을 크게 만들어 뒀다.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inGame = pathname.startsWith("/games/");

  return (
    <>
      <main className={`flex-1 px-4 pt-2 ${inGame ? "pb-8" : "pb-28"}`}>{children}</main>
      {!inGame && <BottomTabs />}
    </>
  );
}
