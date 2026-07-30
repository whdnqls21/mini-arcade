"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { BrainMark } from "@/components/BrainMark";

// 관리자 진입은 숨김 제스처: 로고를 빠르게 5번 탭.
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
          aria-label="뇌지컬 리그"
          className="leading-none"
        >
          <BrainMark size={28} />
        </button>
        <Link href="/" className="font-display text-xl tracking-tight text-ink">
          뇌지컬 <span className="text-grass">리그</span>
        </Link>
      </div>

      {/* 후원사 — 우측 정렬 */}
      <a
        href="https://naver.me/xk1npYv9"
        target="_blank"
        rel="sponsored noopener noreferrer"
        aria-label="후원사 SCENTOF (새 창)"
        className="group flex shrink-0 items-center gap-1.5"
      >
        <span className="text-[11px] font-light text-ink-faint">with</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/scentof.svg"
          alt="SCENTOF"
          className="h-4 w-auto opacity-80 transition-opacity group-hover:opacity-100"
        />
      </a>
    </header>
  );
}
