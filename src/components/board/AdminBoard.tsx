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
  const [openId, setOpenId] = useState<string | null>(null); // 펼친 글(아코디언)

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
        const open = openId === p.id;
        return (
          <div
            key={p.id}
            className={`flex flex-col gap-2 rounded-lg border px-3 py-2 ${
              p.isNotice ? "border-gold/30 bg-gold/5" : "border-pitch-line bg-black/10"
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
              aria-expanded={open}
              className="flex flex-col gap-2 text-left"
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

              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 font-display text-sm text-ink">
                  {open ? p.title : <span className="line-clamp-1">{p.title}</span>}
                </span>
                {p.comments.length > 0 && (
                  <span className="shrink-0 text-[11px] text-ink-faint">💬 {p.comments.length}</span>
                )}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </button>

            {open && (
              <>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink-dim">
                  {p.body}
                </p>

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

            {/* 댓글 — 관리자로 답변 달기 + 아무 댓글이나 삭제 */}
            <div className="flex flex-col gap-1.5 border-t border-pitch-line pt-2">
              {p.comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-[11px]">
                  <span className="shrink-0 text-ink-dim">{c.authorName}</span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-ink-dim">
                    {c.body}
                  </span>
                  <span className="shrink-0 text-ink-faint">{timeAgo(c.createdAt)}</span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(p.id, () =>
                        postJSON("/api/board/comment", { action: "delete", commentId: c.id })
                      )
                    }
                    className="shrink-0 text-danger disabled:opacity-40"
                  >
                    삭제
                  </button>
                </div>
              ))}
                  <AdminCommentInput
                    busy={busy}
                    onAdd={(text) =>
                      act(p.id, () =>
                        postJSON("/api/board/comment", { action: "add", postId: p.id, body: text })
                      )
                    }
                  />
                </div>
              </>
            )}
          </div>
        );
      })}
    </Card>
  );
}

// 관리자 댓글 입력 — 관리자 화면에서 달면 '관리자'로 등록된다.
function AdminCommentInput({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (body: string) => Promise<void> | void;
}) {
  const [val, setVal] = useState("");

  const send = async () => {
    const text = val.trim();
    if (!text || busy) return;
    await onAdd(text);
    setVal("");
  };

  return (
    <div className="flex gap-1.5">
      <input
        value={val}
        maxLength={500}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            send();
          }
        }}
        placeholder="관리자로 답변 달기…"
        className="min-w-0 flex-1 rounded-lg border border-pitch-line bg-black/20 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-grass"
      />
      <button
        onClick={send}
        disabled={!val.trim() || busy}
        className="shrink-0 rounded-lg bg-grass px-2.5 py-1.5 text-[11px] font-medium text-pitch-base disabled:opacity-40"
      >
        등록
      </button>
    </div>
  );
}
