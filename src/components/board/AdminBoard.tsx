"use client";

import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/Card";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_ORDER } from "@/lib/board-meta";
import { postJSON } from "@/lib/client-api";
import { timeAgo } from "@/lib/format";
import type { PostStatus, PostView } from "@/lib/types";

// 관리자 대시보드용 게시판 관리 — 상태 라벨 · 고정 · 삭제.
// 관리자 세션이 살아 있는 이 화면에서만 동작한다(게시판에는 관리 버튼을 두지 않음).
export function AdminBoard() {
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/board", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "불러오지 못했습니다.");
      setPosts(json.posts as PostView[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-lg text-ink">
        게시판 <span className="text-sm text-ink-faint">{posts ? `${posts.length}개` : ""}</span>
      </h2>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!posts && !error && <p className="text-sm text-ink-dim">불러오는 중…</p>}
      {posts && posts.length === 0 && <p className="text-sm text-ink-dim">글이 없어요.</p>}

      {posts?.map((p) => {
        const busy = busyId === p.id;
        return (
          <div
            key={p.id}
            className={`flex flex-col gap-2 rounded-lg border px-3 py-2 ${
              p.isNotice ? "border-gold/30 bg-gold/5" : "border-pitch-line bg-black/10"
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] text-ink-faint">
              <span className="rounded-full bg-pitch-line px-2 py-0.5 text-ink-dim">
                {CATEGORY_LABEL[p.category]}
              </span>
              {!p.isNotice && <span>👍 {p.votes}</span>}
              {p.pinned && <span className="text-gold">고정됨</span>}
              <span className="ml-auto">
                {p.authorName} · {timeAgo(p.createdAt)}
              </span>
            </div>

            <p className="text-sm text-ink">{p.title}</p>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* 상태 라벨은 제안 글에만 */}
              {!p.isNotice && (
                <select
                  value={p.status ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    act(p.id, () =>
                      postJSON("/api/board/action", {
                        action: "setStatus",
                        postId: p.id,
                        status: (e.target.value || null) as PostStatus | null,
                      })
                    )
                  }
                  className="rounded-lg border border-pitch-line bg-black/20 px-2 py-1 text-[11px] text-ink-dim disabled:opacity-40"
                >
                  <option value="">상태 없음</option>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              )}

              <button
                disabled={busy}
                onClick={() =>
                  act(p.id, () =>
                    postJSON("/api/board/action", { action: "pin", postId: p.id, pinned: !p.pinned })
                  )
                }
                className={`rounded-lg border px-2 py-1 text-[11px] disabled:opacity-40 ${
                  p.pinned ? "border-gold/50 text-gold" : "border-pitch-line text-ink-faint"
                }`}
              >
                {p.pinned ? "고정 해제" : "고정"}
              </button>

              <button
                disabled={busy}
                onClick={() => {
                  if (confirm(`'${p.title}' 글을 삭제할까요?`)) {
                    act(p.id, () => postJSON("/api/board/action", { action: "delete", postId: p.id }));
                  }
                }}
                className="ml-auto rounded-lg border border-danger/40 px-2 py-1 text-[11px] text-danger disabled:opacity-40"
              >
                삭제
              </button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
