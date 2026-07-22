"use client";

import { useRef, useState } from "react";

import { Card } from "@/components/Card";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_STYLE } from "@/lib/board-meta";
import { postJSON } from "@/lib/client-api";
import { timeAgo } from "@/lib/format";
import type { PostView } from "@/lib/types";

// 사용자용 카드 — 제목만 보이고 탭하면 내용이 펼쳐진다(아코디언).
// 추천과 본인 글 삭제만 두고, 상태·고정·삭제 관리는 관리자 화면에 있다.
export function PostCard({
  post,
  open,
  onToggle,
  reload,
  sessionId,
}: {
  post: PostView;
  open: boolean;
  onToggle: () => void;
  reload: () => Promise<void> | void;
  sessionId: string | null;
}) {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={`flex flex-col gap-2 ${post.isNotice ? "border-gold/40 bg-gold/5" : ""}`}>
      {/* 헤더 — 라벨과 제목을 한 줄에. 탭하면 펼침/접힘. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-start gap-2 text-left"
      >
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
            post.isNotice ? "bg-gold/20 text-gold" : "bg-pitch-line text-ink-dim"
          }`}
        >
          {CATEGORY_LABEL[post.category]}
        </span>
        {post.status && (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${STATUS_STYLE[post.status]}`}
          >
            {STATUS_LABEL[post.status]}
          </span>
        )}

        <h2 className="min-w-0 flex-1 font-display text-base text-ink">
          {open ? post.title : <span className="line-clamp-1">{post.title}</span>}
        </h2>

        {post.comments.length > 0 && (
          <span className="shrink-0 text-[11px] text-ink-faint">💬 {post.comments.length}</span>
        )}
        <span className="shrink-0 text-[11px] text-ink-faint">{timeAgo(post.createdAt)}</span>
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
      </button>

      {open && (
        <>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-dim">
            {post.body}
          </p>

          <div className="flex items-center gap-2 pt-1 text-[11px] text-ink-faint">
            <span>{post.authorName}</span>
            <div className="ml-auto flex items-center gap-2">
              {/* 공지엔 추천 버튼을 두지 않는다(제안용) */}
              {!post.isNotice && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() => postJSON("/api/board/action", { action: "vote", postId: post.id }))
                  }
                  className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40 ${
                    post.voted
                      ? "border-grass/50 bg-grass/15 text-grass"
                      : "border-pitch-line text-ink-dim hover:text-ink"
                  }`}
                >
                  <span>👍</span>
                  <span className="tabular">{post.votes}</span>
                </button>
              )}
              {post.mine && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm("이 글을 삭제할까요?")) {
                      run(() => postJSON("/api/board/action", { action: "delete", postId: post.id }));
                    }
                  }}
                  className="rounded-lg border border-danger/40 px-2 py-1 text-danger disabled:opacity-40"
                >
                  삭제
                </button>
              )}
            </div>
          </div>

          {/* 댓글 */}
          <div className="mt-1 flex flex-col gap-2 border-t border-pitch-line pt-3">
            {post.comments.length > 0 && (
              <ul className="flex flex-col gap-2">
                {post.comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-black/15 px-3 py-2">
                    <div className="flex items-center gap-2 text-[11px] text-ink-faint">
                      <span className="text-ink-dim">{c.authorName}</span>
                      <span>{timeAgo(c.createdAt)}</span>
                      {c.mine && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (confirm("이 댓글을 삭제할까요?")) {
                              run(() =>
                                postJSON("/api/board/comment", { action: "delete", commentId: c.id })
                              );
                            }
                          }}
                          className="ml-auto text-danger disabled:opacity-40"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-dim">
                      {c.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {sessionId ? (
              <CommentInput
                busy={busy}
                onSubmit={(text) =>
                  run(() => postJSON("/api/board/comment", { action: "add", postId: post.id, body: text }))
                }
              />
            ) : (
              <p className="text-[11px] text-ink-faint">댓글을 쓰려면 로그인하세요.</p>
            )}
          </div>
        </>
      )}
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

  // 내용에 맞춰 높이 자동 조절(최대 120px).
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
    setVal(""); // 성공 후 입력창 비우기(reload 되어도 유지되는 로컬 상태라 직접 비운다)
    if (taRef.current) taRef.current.style.height = "auto";
  };

  return (
    <div className="flex items-end gap-2">
      {/* textarea 라 Enter 로 줄바꿈된다. 제출은 등록 버튼. */}
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
