"use client";

import { useState } from "react";

import { Card } from "@/components/Card";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_STYLE } from "@/lib/board-meta";
import { postJSON } from "@/lib/client-api";
import { timeAgo } from "@/lib/format";
import type { PostView } from "@/lib/types";

// 사용자용 카드 — 추천과 본인 글 삭제만. 상태·고정·삭제 관리는 관리자 화면에 있다.
export function PostCard({ post, reload }: { post: PostView; reload: () => Promise<void> | void }) {
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
      <div className="flex items-center gap-2 text-[11px]">
        <span
          className={`rounded-full px-2 py-0.5 ${
            post.isNotice ? "bg-gold/20 text-gold" : "bg-pitch-line text-ink-dim"
          }`}
        >
          {CATEGORY_LABEL[post.category]}
        </span>
        {post.status && (
          <span className={`rounded-full border px-2 py-0.5 ${STATUS_STYLE[post.status]}`}>
            {STATUS_LABEL[post.status]}
          </span>
        )}
        <span className="ml-auto text-ink-faint">
          {post.authorName} · {timeAgo(post.createdAt)}
        </span>
      </div>

      <h2 className="font-display text-base text-ink">{post.title}</h2>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-dim">
        {post.body}
      </p>

      <div className="flex items-center gap-2 pt-1">
        {/* 공지엔 추천 버튼을 두지 않는다(제안용) */}
        {!post.isNotice && (
          <button
            disabled={busy}
            onClick={() => run(() => postJSON("/api/board/action", { action: "vote", postId: post.id }))}
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
            className="ml-auto rounded-lg border border-danger/40 px-2 py-1 text-[11px] text-danger disabled:opacity-40"
          >
            삭제
          </button>
        )}
      </div>
    </Card>
  );
}
