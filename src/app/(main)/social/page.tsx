"use client";

import Link from "next/link";

import { Card } from "@/components/Card";
import { useAppState } from "@/components/StateProvider";
import { CatchmindIcon } from "@/games/catchmind/CatchmindIcon";
import { TitleIcon } from "@/games/title/TitleIcon";

// 소셜 게임 허브 — 점수/순위 없이 함께 즐기는 게임들(캐치마인드·제목 학원).
export default function SocialPage() {
  const { state } = useAppState();
  if (!state) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <p className="text-xs uppercase tracking-[0.2em] text-grass">소셜</p>
        <h1 className="font-display text-2xl text-ink">함께 노는 게임</h1>
        <p className="mt-0.5 text-xs text-ink-faint">순위도 점수도 없이, 다 같이 즐겨요.</p>
      </div>

      {state.session?.solo ? (
        <Card className="py-10 text-center text-sm text-ink-dim">
          소셜 게임은 함께 즐기는 게임이라 솔로모드에서는 이용할 수 없어요.
          <br />내정보에서 솔로모드를 끄면 참여할 수 있습니다.
        </Card>
      ) : (
        <>
          <SocialCard
            href="/catchmind"
            name="캐치마인드"
            desc="그림을 그려 내고, 남의 그림을 맞혀요."
            footer="그리고 · 맞히고 · 함께 즐겨요"
            Icon={CatchmindIcon}
          />
          <SocialCard
            href="/title"
            name="제목 학원"
            desc="사진을 올리고, 재치있는 제목을 달고 투표해요."
            footer="올리고 · 제목 달고 · 투표해요"
            Icon={TitleIcon}
          />
        </>
      )}
    </div>
  );
}

function SocialCard({
  href,
  name,
  desc,
  footer,
  Icon,
}: {
  href: string;
  name: string;
  desc: string;
  footer: string;
  Icon: ({ size }: { size?: number }) => React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card className="flex flex-col gap-3 transition-colors hover:border-grass/40">
        <div className="flex items-start gap-3">
          <span className="shrink-0">
            <Icon size={44} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h2 className="font-display text-xl text-ink">{name}</h2>
              <span className="text-[11px] font-medium text-grass/70">#창의력</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-faint">{desc}</p>
          </div>
          <span className="flex shrink-0 items-center justify-center self-stretch rounded-lg bg-grass/15 px-4 text-sm font-medium text-grass">
            플레이 →
          </span>
        </div>
        <div className="flex items-center justify-end border-t border-pitch-line pt-3 text-xs">
          <span className="text-ink-dim">{footer}</span>
        </div>
      </Card>
    </Link>
  );
}
