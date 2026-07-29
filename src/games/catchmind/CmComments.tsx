"use client";

import { useRef, useState } from "react";

import { Card } from "@/components/Card";
import { Heart } from "@/components/board/Heart";
import { timeAgo } from "@/lib/format";
import type { GalleryComment } from "@/games/catchmind/types";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "요청에 실패했습니다.");
  return data as T;
}

// 캐치마인드 문제 댓글 — 갤러리 상세와 결과 화면에서 공용으로 쓴다.
export function CmComments({
  quizId,
  comments,
  onChanged,
}: {
  quizId: string;
  comments: GalleryComment[];
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await onChanged();
    } catch {
      /* 조용히 무시 */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-2 py-3">
      <span className="text-xs text-ink-faint">댓글 {comments.length}</span>
      {comments.map((c) => (
        <div key={c.id} className="rounded-lg bg-black/15 px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-ink-faint">
            <span className="text-ink-dim">{c.authorName}</span>
            <span>{timeAgo(c.createdAt)}</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    api("/api/cm/comment", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "vote", commentId: c.id }),
                    })
                  )
                }
                aria-label="댓글 좋아요"
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors disabled:opacity-60 ${
                  c.liked ? "text-grass" : "text-ink-faint hover:text-ink-dim"
                }`}
              >
                <Heart filled={c.liked} className="h-3 w-3" />
                {c.likes > 0 && <span className="tabular">{c.likes}</span>}
              </button>
              {c.mine && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm("이 댓글을 삭제할까요?")) {
                      run(() =>
                        api("/api/cm/comment", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "delete", commentId: c.id }),
                        })
                      );
                    }
                  }}
                  className="text-danger disabled:opacity-40"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-dim">{c.body}</p>
        </div>
      ))}
      <CommentInput
        busy={busy}
        onSubmit={(text) =>
          run(() =>
            api("/api/cm/comment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "add", quizId, body: text }),
            })
          )
        }
      />
    </Card>
  );
}

function CommentInput({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: string) => Promise<void> | void;
}) {
  const [val, setVal] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const grow = () => {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
  };
  const send = async () => {
    const text = val.trim();
    if (!text || busy) return;
    await onSubmit(text);
    setVal("");
    if (taRef.current) taRef.current.style.height = "auto";
  };
  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={taRef}
        value={val}
        maxLength={500}
        rows={1}
        onChange={(e) => {
          setVal(e.target.value);
          grow();
        }}
        placeholder="댓글 달기…"
        className="min-w-0 flex-1 resize-none rounded-lg border border-pitch-line bg-black/20 px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-grass"
      />
      <button
        onClick={send}
        disabled={!val.trim() || busy}
        className="shrink-0 rounded-lg bg-grass px-3 py-2 text-sm font-medium text-pitch-base disabled:opacity-40"
      >
        등록
      </button>
    </div>
  );
}
