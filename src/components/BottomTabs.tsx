"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/", label: "게임", icon: GameIcon },
  { href: "/rank", label: "순위", icon: RankIcon },
  { href: "/board", label: "게시판", icon: BoardIcon },
  { href: "/me", label: "내정보", icon: MeIcon },
] as const;

// 게시판 '안 읽은 글' 점 — 최신 글 시각을 가볍게 받아, 마지막으로 본 시각(localStorage)보다
// 뒤면 게시판 탭에 점을 띄운다. 게시판에 들어가면 본 시각을 갱신해 점이 사라진다.
function useBoardUnread(pathname: string): boolean {
  const [latestAt, setLatestAt] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [unread, setUnread] = useState(false);

  // 이동할 때마다 최신 글 시각을 다시 확인(글 작성·읽음 반영).
  useEffect(() => {
    let alive = true;
    fetch("/api/board/latest", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setLatestAt(d?.latestAt ?? null);
        setViewerId(d?.viewerId ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!latestAt) {
      setUnread(false);
      return;
    }
    const key = `ma_board_seen:${viewerId ?? "guest"}`;
    const onBoard = pathname.startsWith("/board");
    if (onBoard) {
      try {
        window.localStorage.setItem(key, latestAt);
      } catch {
        // 저장 실패해도 표시엔 영향 없음
      }
      setUnread(false);
      return;
    }
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(key);
    } catch {
      seen = null;
    }
    setUnread(!seen || latestAt > seen);
  }, [latestAt, viewerId, pathname]);

  return unread;
}

export default function BottomTabs() {
  const pathname = usePathname();
  const boardUnread = useBoardUnread(pathname);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto max-w-md px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-stretch justify-around rounded-2xl border border-pitch-line bg-pitch-base/90 shadow-card backdrop-blur-md">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const dot = href === "/board" && boardUnread;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  active ? "text-grass" : "text-ink-faint hover:text-ink-dim"
                }`}
              >
                <span className="relative">
                  <Icon active={active} />
                  {dot && (
                    <span
                      aria-label="안 읽은 글"
                      className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full border border-pitch-base bg-danger"
                    />
                  )}
                </span>
                <span className={active ? "font-medium" : ""}>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

type IconProps = { active?: boolean };
function GameIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <path d="M7 12h3M8.5 10.5v3M15 11h.01M18 13h.01" />
    </svg>
  );
}
function RankIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 21V11M12 21V4M18 21v-7" />
    </svg>
  );
}
function BoardIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}
function MeIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
