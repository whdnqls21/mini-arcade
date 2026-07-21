"use client";

import { useState } from "react";

import { Card } from "@/components/Card";
import { CATEGORY_LABEL, STATUS_LABEL, STATUS_ORDER, STATUS_STYLE } from "@/lib/board-meta";
import { postJSON } from "@/lib/client-api";
import { timeAgo } from "@/lib/format";
import type { PostStatus, PostView } from "@/lib/types";

export function PostCard({
  post,
  isAdmin,
  reload,
}: {
  post: PostView;
  isAdmin: boolean;
  reload: () => Promise<void> | void;
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

        <div className="ml-auto flex items-center gap-1.5">
          {isAdmin && !post.isNotice && (
            <StatusPicker
              value={post.status}
              disabled={busy}
              onPick={(status) =>
                run(() => postJSON("/api/board/action", { action: "setStatus", postId: post.id, status }))
              }
            />
          )}
          {isAdmin && (
            <button
              disabled={busy}
              onClick={() =>
                run(() =>
                  postJSON("/api/board/action", { action: "pin", postId: post.id, pinned: !post.pinned })
                )
              }
              className={`rounded-lg border px-2 py-1 text-[11px] disabled:opacity-40 ${
                post.pinned ? "border-gold/50 text-gold" : "border-pitch-line text-ink-faint"
              }`}
            >
              {post.pinned ? "고정 해제" : "고정"}
            </button>
          )}
          {(post.mine || isAdmin) && (
            <button
              disabled={busy}
              onClick={() => {
                if (confirm("이 글을 삭제할까요?")) {
                  run(() => postJSON("/api/board/action", { action: "delete", postId: post.id }));
                }
              }}
              className="rounded-lg border border-danger/40 px-2 py-1 text-[11px] text-danger disabled:opacity-40"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function StatusPicker({
  value,
  onPick,
  disabled,
}: {
  value: PostStatus | null;
  onPick: (status: PostStatus | null) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onPick((e.target.value || null) as PostStatus | null)}
      className="rounded-lg border border-pitch-line bg-black/20 px-2 py-1 text-[11px] text-ink-dim disabled:opacity-40"
    >
      <option value="">상태 없음</option>
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
