"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "게임", icon: GameIcon },
  { href: "/rank", label: "순위", icon: RankIcon },
  { href: "/me", label: "내정보", icon: MeIcon },
] as const;

export default function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto max-w-md px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-stretch justify-around rounded-2xl border border-pitch-line bg-pitch-base/90 shadow-card backdrop-blur-md">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  active ? "text-grass" : "text-ink-faint hover:text-ink-dim"
                }`}
              >
                <Icon active={active} />
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
function MeIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
