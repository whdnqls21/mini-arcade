"use client";

import { useEffect, useRef, type ReactNode } from "react";

// 아래에서 올라오는 시트형 모달. 폰에서 주로 쓰는 앱이라 하단 정렬이 기본이고,
// 화면이 넓으면 가운데로 온다.
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // 뒤 배경이 같이 스크롤되지 않도록 잠근다.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* 배경을 눌러도 닫힌다 */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="fade-in absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-up relative z-10 max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-pitch-line bg-pitch-alt p-4 pb-6 shadow-card sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-ink">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-pitch-line px-2.5 py-1 text-xs text-ink-dim hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-grass"
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
