"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

import { Card } from "@/components/Card";
import { GameInfoButton } from "@/components/GameInfo";
import { ResetNotice } from "@/components/ResetNotice";
import { useAppState } from "@/components/StateProvider";
import { GAME_REGISTRY } from "@/games/registry";
import { postJSON } from "@/lib/client-api";
import { formatScore, scoringLabel } from "@/lib/format";

export default function PlayPage() {
  const params = useParams();
  const slug = String(params.slug);
  const { state, refresh } = useAppState();
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const game = state?.games.find((g) => g.slug === slug);
  const entry = GAME_REGISTRY[slug];

  const onGameOver = useCallback(
    async (score: number, meta?: Record<string, unknown>) => {
      setSubmitting(true);
      setError(null);
      setNote(null);
      try {
        await postJSON("/api/games/record", { gameSlug: slug, score, meta });
        await refresh();
        setNote(`기록 저장됨: ${score}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "기록 저장 실패");
      } finally {
        setSubmitting(false);
      }
    },
    [slug, refresh]
  );

  if (!state) return null;
  if (!game || !entry) {
    return (
      <Card className="mt-8 py-10 text-center text-sm text-ink-dim">
        게임을 찾을 수 없어요.{" "}
        <Link href="/" className="text-grass">
          목록으로
        </Link>
      </Card>
    );
  }

  const Play = entry.Play;

  return (
    <div className="flex flex-col gap-4">
      {/* 게임 중에는 하단 메뉴가 숨겨지므로 이 버튼이 유일한 출구다. 크게 둔다. */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          href="/"
          aria-label="게임 목록으로 돌아가기"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pitch-line bg-black/25 text-ink-dim transition-colors hover:border-grass/50 hover:text-grass focus:outline-none focus-visible:ring-2 focus-visible:ring-grass"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl leading-tight text-ink">{game.name}</h1>
          <p className="text-[11px] leading-none text-ink-faint">{scoringLabel[game.scoring]}</p>
        </div>

        {entry.info && <GameInfoButton info={entry.info} />}
      </div>

      <Card>
        <Play
          onGameOver={onGameOver}
          bestScore={game.myBest}
          submitting={submitting}
          accountId={state.session?.id ?? null}
        />
      </Card>

      {note && <p className="text-center text-sm text-grass">{note}</p>}
      {error && <p className="text-center text-sm text-danger">{error}</p>}

      <ResetNotice
        gameName={game.name}
        resetAt={game.reset_at}
        resetNote={game.reset_note}
        accountId={state.session?.id ?? null}
        slug={slug}
      />

      <Leaderboard slug={slug} />
    </div>
  );
}

function Leaderboard({ slug }: { slug: string }) {
  const { state } = useAppState();
  const game = state?.games.find((g) => g.slug === slug);
  if (!game) return null;
  const meId = state?.session?.id;
  const solo = state?.session?.solo ?? false;

  // 솔로모드 — 남의 기록은 숨기고 내 기록만 보여준다.
  if (solo) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">내 기록</h2>
          <span className="text-[11px] text-ink-faint">솔로모드</span>
        </div>
        {game.myBest == null ? (
          <p className="text-sm text-ink-dim">아직 기록이 없어요. 편하게 도전해보세요!</p>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-grass/40 bg-grass/10 px-3 py-2 text-sm">
            <span className="flex-1 font-display text-ink">내 최고 기록</span>
            <span className="tabular text-gold">{formatScore(game.scoring, game.myBest)}</span>
          </div>
        )}
        <p className="text-[12px] text-ink-faint">솔로모드에서는 다른 사람 기록이 보이지 않아요.</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-lg text-ink">리더보드 🏆</h2>
      {game.leaderboard.length === 0 ? (
        <p className="text-sm text-ink-dim">아직 기록이 없어요. 첫 기록의 주인공이 되세요!</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {game.leaderboard.map((r) => {
            const isMe = r.accountId === meId;
            const isFirst = r.rank === 1;
            return (
              <li
                key={r.accountId}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                  isMe ? "border border-grass/40 bg-grass/10" : "bg-black/15"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display ${
                    isFirst ? "bg-gold/20 text-gold" : "bg-pitch-line text-ink-dim"
                  }`}
                >
                  {r.rank}
                </span>
                <span className="flex-1 font-display text-ink">
                  {r.name}
                  {isMe && <span className="ml-1 text-[10px] text-grass">나</span>}
                  {isFirst && " 👑"}
                </span>
                <span className="tabular text-gold">{formatScore(game.scoring, r.best)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
