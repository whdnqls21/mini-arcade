"use client";

import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/Card";
import { CmComments } from "@/games/catchmind/CmComments";
import type { GalleryDetail, GalleryItem, GalleryKind } from "@/games/catchmind/types";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "요청에 실패했습니다.");
  return data as T;
}

const KIND_BADGE: Record<GalleryKind, { label: string; cls: string }> = {
  mine: { label: "내 출제", cls: "bg-gold/20 text-gold" },
  solved: { label: "맞힘", cls: "bg-grass/20 text-grass" },
  failed: { label: "못 맞힘", cls: "bg-black/40 text-ink-faint" },
};

// 갤러리 — 그리드(액자) ↔ 상세를 내부에서 전환.
export function Gallery() {
  const [sel, setSel] = useState<string | null>(null);
  return sel ? (
    <Detail quizId={sel} onBack={() => setSel(null)} />
  ) : (
    <Grid onSelect={setSel} />
  );
}

// ── 그리드(액자) ────────────────────────────────────────────────────────
function Grid({ onSelect }: { onSelect: (quizId: string) => void }) {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: GalleryItem[] }>("/api/cm/gallery")
      .then((d) => setItems(d.items))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <Card className="py-10 text-center text-sm text-danger">{err}</Card>;
  if (!items) return <Spinner />;
  if (items.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-ink-dim">
        아직 갤러리가 비었어요.
        <br />
        문제를 풀거나 출제하면 여기에 모여요.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => {
        const badge = KIND_BADGE[it.kind];
        return (
          <button
            key={it.quizId}
            onClick={() => onSelect(it.quizId)}
            className="flex flex-col gap-1.5 rounded-xl border border-pitch-line bg-pitch-card p-2 transition-colors hover:border-grass/40"
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.imageUrl ?? ""}
                alt={it.word}
                className="w-full rounded-lg border border-pitch-line bg-white object-contain"
                style={{ aspectRatio: "1 / 1" }}
              />
              <span className={`absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] ${badge.cls}`}>
                {badge.label}
              </span>
              {it.commentCount > 0 && (
                <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-ink-dim">
                  💬 {it.commentCount}
                </span>
              )}
            </div>
            <span className="truncate text-center text-xs text-ink-dim">{it.word}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── 상세 ────────────────────────────────────────────────────────────────
function Detail({ quizId, onBack }: { quizId: string; onBack: () => void }) {
  const [d, setD] = useState<GalleryDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<GalleryDetail>(`/api/cm/gallery/detail?quizId=${quizId}`)
      .then(setD)
      .catch((e) => setErr(e.message));
  }, [quizId]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      load();
    } finally {
      setBusy(false);
    }
  };

  if (err) return <Card className="py-10 text-center text-sm text-danger">{err}</Card>;
  if (!d) return <Spinner />;

  const badge = KIND_BADGE[d.kind];
  const maxDist = Math.max(1, ...d.rating.dist);

  return (
    <div className="flex flex-col gap-3">
      <button onClick={onBack} className="self-start text-sm text-ink-dim hover:text-ink">
        ← 갤러리
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={d.imageUrl ?? ""}
        alt={d.word}
        className="mx-auto w-full max-w-[18rem] rounded-xl border border-pitch-line bg-white"
        style={{ aspectRatio: "1 / 1" }}
      />

      <Card className="flex flex-col gap-1 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="font-display text-xl text-ink">{d.word}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${badge.cls}`}>{badge.label}</span>
        </div>
        <span className="text-xs text-ink-faint">그린 사람 {d.authorName}</span>
      </Card>

      {/* 별점 요약 */}
      <Card className="flex flex-col gap-2 py-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg text-gold">
            ★ {d.rating.count ? d.rating.avg.toFixed(1) : "-"}
          </span>
          <span className="text-xs text-ink-faint">평가 {d.rating.count}명</span>
        </div>
        <div className="flex flex-col gap-1">
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="flex items-center gap-2 text-[11px] text-ink-faint">
              <span className="w-4 shrink-0 text-right">{s}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full bg-gold/70"
                  style={{ width: `${(d.rating.dist[s - 1] / maxDist) * 100}%` }}
                />
              </div>
              <span className="w-5 shrink-0 tabular">{d.rating.dist[s - 1]}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 내 평가 / 평가하기 */}
      {d.canRate ? (
        <Card className="flex flex-col items-center gap-2 py-3">
          <span className="text-xs text-ink-faint">이 그림을 평가해 주세요</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() =>
                  run(() =>
                    api("/api/cm/quiz-action", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "rating", quizId, stars: s }),
                    })
                  )
                }
                aria-label={`${s}점`}
                className="text-2xl text-ink-faint hover:text-gold disabled:opacity-50"
              >
                ★
              </button>
            ))}
          </div>
        </Card>
      ) : d.myStars != null ? (
        <p className="text-center text-xs text-ink-faint">
          내 평가{" "}
          <span className="text-gold">{"★".repeat(d.myStars)}</span>
          <span className="text-ink-faint/40">{"★".repeat(5 - d.myStars)}</span>
        </p>
      ) : null}

      {/* 오답 TOP3 */}
      {d.wrongTop3.length > 0 && (
        <Card className="flex flex-col gap-1.5 py-3">
          <span className="text-xs text-ink-faint">많이 나온 오답</span>
          {d.wrongTop3.map((w, i) => (
            <div key={w.guess} className="flex justify-between text-sm">
              <span className="text-ink-dim">
                {i + 1}. {w.guess}
              </span>
              <span className="text-ink-faint">{w.count}회</span>
            </div>
          ))}
        </Card>
      )}

      {/* 댓글 */}
      <CmComments quizId={quizId} comments={d.comments} onChanged={load} />
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-pitch-line border-t-grass" />
    </div>
  );
}
