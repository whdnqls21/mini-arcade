"use client";

import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { PostCard } from "@/components/board/PostCard";
import { postJSON } from "@/lib/client-api";
import { CATEGORY_LABEL, SUGGESTION_CATEGORIES } from "@/lib/board-meta";
import type { PostCategory, PostView } from "@/lib/types";

interface BoardData {
  session: { id: string; name: string } | null;
  isAdmin: boolean;
  posts: PostView[];
}

type Sort = "recent" | "top";
type CatFilter = PostCategory | "all";

// 상단 분류 필터 칩(순서 고정).
const CAT_FILTERS: { key: CatFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "notice", label: CATEGORY_LABEL.notice },
  { key: "game", label: CATEGORY_LABEL.game },
  { key: "balance", label: CATEGORY_LABEL.balance },
  { key: "bug", label: CATEGORY_LABEL.bug },
  { key: "etc", label: CATEGORY_LABEL.etc },
];

export default function BoardPage() {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [cat, setCat] = useState<CatFilter>("all");
  const [writing, setWriting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/board", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "불러오지 못했습니다.");
      setData(json as BoardData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Header onWrite={() => setWriting(true)} canWrite={false} />
        {error ? (
          <p className="text-center text-sm text-danger">{error}</p>
        ) : (
          <div className="flex justify-center pt-12">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-pitch-line border-t-grass" />
          </div>
        )}
      </div>
    );
  }

  // 분류 필터 먼저 적용. 그다음 공지·고정 글이 위, 나머지는 정렬(최신순/추천순).
  const visible = cat === "all" ? data.posts : data.posts.filter((p) => p.category === cat);
  const notices = visible.filter((p) => p.isNotice || p.pinned);
  const rest = visible.filter((p) => !p.isNotice && !p.pinned);
  rest.sort((a, b) =>
    sort === "top"
      ? b.votes - a.votes || +new Date(b.createdAt) - +new Date(a.createdAt)
      : +new Date(b.createdAt) - +new Date(a.createdAt)
  );
  const ordered = [...notices, ...rest];

  return (
    <div className="flex flex-col gap-4">
      <Header onWrite={() => setWriting(true)} canWrite={!!data.session || data.isAdmin} />

      {error && <p className="text-center text-sm text-danger">{error}</p>}

      {/* 분류 필터 */}
      <div className="flex flex-wrap gap-1.5">
        {CAT_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setCat(f.key)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              cat === f.key
                ? "bg-grass/15 text-grass"
                : "border border-pitch-line text-ink-faint hover:text-ink-dim"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5">
        {(["recent", "top"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              sort === s ? "bg-grass/15 text-grass" : "text-ink-faint hover:text-ink-dim"
            }`}
          >
            {s === "recent" ? "최신순" : "추천순"}
          </button>
        ))}
      </div>

      {ordered.length === 0 ? (
        <Card className="py-10 text-center text-sm text-ink-dim">
          {cat === "all" ? "아직 글이 없어요. 첫 제안을 남겨보세요!" : "이 분류에 아직 글이 없어요."}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              open={openId === p.id}
              onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
              reload={load}
              sessionId={data.session?.id ?? null}
            />
          ))}
        </div>
      )}

      {writing && (
        <WriteModal
          onClose={() => setWriting(false)}
          onDone={async () => {
            setWriting(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Header({ onWrite, canWrite }: { onWrite: () => void; canWrite: boolean }) {
  return (
    <div className="flex items-end justify-between pt-1">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-grass">게시판</p>
        <h1 className="font-display text-2xl text-ink">제안 · 공지</h1>
      </div>
      {canWrite && (
        <button
          onClick={onWrite}
          className="rounded-lg bg-grass px-3 py-2 text-sm font-medium text-pitch-base"
        >
          글쓰기
        </button>
      )}
    </div>
  );
}

function WriteModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  // 공지는 관리자 화면에서 쓴다(관리자 세션이 게시판에선 유지되지 않음). 여기선 제안 분류만.
  const categories = SUGGESTION_CATEGORIES;
  const [category, setCategory] = useState<PostCategory>(categories[0]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || !text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/board", { category, title: title.trim(), body: text.trim() });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "작성 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="글쓰기">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                category === c
                  ? c === "notice"
                    ? "bg-gold/20 text-gold"
                    : "bg-grass/15 text-grass"
                  : "border border-pitch-line text-ink-faint"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        <input
          value={title}
          maxLength={40}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="rounded-xl border border-pitch-line bg-black/20 px-3 py-2.5 text-ink outline-none focus:border-grass"
        />
        <textarea
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            category === "notice" ? "공지 내용을 적어주세요." : "어떤 제안인지 적어주세요."
          }
          rows={5}
          className="resize-none rounded-xl border border-pitch-line bg-black/20 px-3 py-2.5 text-sm text-ink outline-none focus:border-grass"
        />

        <button
          onClick={submit}
          disabled={!title.trim() || !text.trim() || busy}
          className="rounded-xl bg-grass py-3 font-display text-pitch-base disabled:opacity-40"
        >
          {busy ? "올리는 중…" : "올리기"}
        </button>
        {error && <p className="text-center text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
