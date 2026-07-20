"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

// 관리자 진입은 숨김 제스처: 🕹️ 로고를 빠르게 5번 탭.
export default function AppHeader() {
  const router = useRouter();
  const taps = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function secretTap() {
    taps.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      taps.current = 0;
    }, 1500);
    if (taps.current >= 5) {
      taps.current = 0;
      if (timer.current) clearTimeout(timer.current);
      router.push("/admin");
    }
  }

  return (
    <header className="sticky top-0 z-20 -mb-px flex items-center justify-between bg-gradient-to-b from-pitch-base via-pitch-base/95 to-transparent px-4 pb-3 pt-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={secretTap}
          aria-label="뇌지컬 대전"
          className="text-2xl leading-none"
        >
          🕹️
        </button>
        <Link href="/" className="font-display text-xl tracking-tight text-ink">
          뇌지컬 <span className="text-grass">대전</span>
        </Link>
      </div>
    </header>
  );
}
