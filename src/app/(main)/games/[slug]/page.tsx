"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

import { Card } from "@/components/Card";
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
      <div className="flex items-center justify-between pt-1">
        <div>
          <Link href="/" className="text-xs text-ink-faint hover:text-grass">
            ← 게임
          </Link>
          <h1 className="font-display text-2xl text-ink">{game.name}</h1>
        </div>
        <span className="text-[11px] text-ink-faint">{scoringLabel[game.scoring]}</span>
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

      <Leaderboard slug={slug} />
    </div>
  );
}

function Leaderboard({ slug }: { slug: string }) {
  const { state } = useAppState();
  const game = state?.games.find((g) => g.slug === slug);
  if (!game) return null;
  const meId = state?.session?.id;

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
