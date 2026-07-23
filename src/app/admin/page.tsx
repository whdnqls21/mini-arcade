"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/Card";
import { AdminBoard } from "@/components/board/AdminBoard";
import { postJSON } from "@/lib/client-api";
import type { AdminState } from "@/lib/state";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [admin, setAdmin] = useState<AdminState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/state", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        setAdmin(null);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "오류");
      setAuthed(true);
      setAdmin(data as AdminState);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    }
  }, []);

  // 관리자 모드는 진입할 때마다 PIN 을 다시 확인한다.
  // 남아 있는 관리자 세션을 먼저 비우고 항상 PIN 화면부터 시작.
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/logout", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        if (alive) setAuthed(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 페이지를 벗어나면 관리자 세션을 정리한다.
  useEffect(() => {
    return () => {
      navigator.sendBeacon?.("/api/admin/logout");
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between pt-1">
        <h1 className="font-display text-2xl text-ink">관리자</h1>
        <Link href="/" className="text-xs text-ink-dim hover:text-grass">
          ← 앱으로
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {authed === null && (
        <div className="flex justify-center pt-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-pitch-line border-t-grass" />
        </div>
      )}
      {authed === false && <AdminLogin onDone={load} />}
      {authed && admin && <Dashboard admin={admin} reload={load} />}
    </div>
  );
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pin.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/admin/login", { pin });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "실패");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 flex flex-col gap-4">
      <div className="text-center">
        <span className="text-2xl">🔐</span>
        <h2 className="mt-1 font-display text-lg text-ink">관리자 PIN</h2>
        <p className="mt-1 text-xs text-ink-faint">처음이면 입력한 PIN이 관리자 PIN으로 설정됩니다.</p>
      </div>
      <input
        autoFocus
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="••••"
        className="tabular w-full rounded-xl border border-pitch-line bg-black/20 px-4 py-3 text-center text-2xl tracking-[0.5em] text-ink outline-none focus:border-gold"
      />
      <button
        onClick={submit}
        disabled={pin.length !== 4 || busy}
        className="rounded-xl bg-gold py-3 font-display text-lg text-pitch-base disabled:opacity-40"
      >
        {busy ? "확인 중…" : "진입"}
      </button>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </Card>
  );
}

// 공지 작성 — 관리자 세션이 살아 있는 이 화면에서만 쓸 수 있다.
function NoticeForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await postJSON("/api/board", { category: "notice", title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      setMsg("공지를 올렸어요. 게시판 상단에 표시됩니다.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "작성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-gold/30">
      <h2 className="font-display text-lg text-ink">
        공지 작성 <span className="text-sm text-ink-faint">게시판 상단</span>
      </h2>
      <input
        value={title}
        maxLength={40}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="공지 제목"
        className="rounded-xl border border-pitch-line bg-black/20 px-3 py-2.5 text-ink outline-none focus:border-gold"
      />
      <textarea
        value={body}
        maxLength={1000}
        onChange={(e) => setBody(e.target.value)}
        placeholder="공지 내용"
        rows={4}
        className="resize-none rounded-xl border border-pitch-line bg-black/20 px-3 py-2.5 text-sm text-ink outline-none focus:border-gold"
      />
      <button
        onClick={submit}
        disabled={!title.trim() || !body.trim() || busy}
        className="rounded-xl bg-gold py-2.5 font-display text-pitch-base disabled:opacity-40"
      >
        {busy ? "올리는 중…" : "공지 올리기"}
      </button>
      {msg && <p className="text-center text-sm text-grass">{msg}</p>}
      {err && <p className="text-center text-sm text-danger">{err}</p>}
    </Card>
  );
}

type Tab = "board" | "accounts" | "games" | "review";

function Dashboard({ admin, reload }: { admin: AdminState; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 검토할 그림이 있으면 그 탭부터 연다.
  const [tab, setTab] = useState<Tab>(admin.hiddenQuizzes.length > 0 ? "review" : "board");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "board", label: "게시판" },
    { key: "accounts", label: "계정", badge: admin.accounts.length },
    { key: "games", label: "게임" },
    { key: "review", label: "검토", badge: admin.hiddenQuizzes.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex-1 rounded-lg py-2 text-sm transition-colors ${
                tab === t.key ? "bg-grass/15 text-grass" : "border border-pitch-line text-ink-faint hover:text-ink-dim"
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                    t.key === "review" ? "bg-danger/20 text-danger" : "text-ink-faint"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => run(() => postJSON("/api/admin/logout", {}))}
          className="shrink-0 rounded-full border border-pitch-line px-3 py-1 text-xs text-ink-dim hover:text-ink"
        >
          로그아웃
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* 게시판 — 공지 작성과 글 관리(상태·고정·삭제).
          관리자 세션은 이 화면을 벗어나면 끊기므로 게시판엔 관리 버튼을 두지 않는다. */}
      {tab === "board" && (
        <>
          <NoticeForm />
          <AdminBoard />
        </>
      )}

      {tab === "accounts" && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-ink">
            계정 <span className="text-sm text-ink-faint">{admin.accounts.length}명</span>
          </h2>
          {admin.accounts.length === 0 && (
            <p className="text-sm text-ink-dim">아직 가입한 계정이 없어요.</p>
          )}
          {admin.accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-pitch-line bg-black/10 px-3 py-2"
            >
              <span className={`font-display ${a.active ? "text-ink" : "text-ink-faint line-through"}`}>
                {a.name}
              </span>
              <span className="text-[11px] text-ink-faint">{a.playCount}판</span>
              {!a.active && <span className="text-[10px] text-danger">비활성</span>}
              <div className="ml-auto flex gap-1.5">
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      postJSON("/api/admin/action", {
                        action: "accountActive",
                        accountId: a.id,
                        active: !a.active,
                      })
                    )
                  }
                  className="rounded-lg border border-pitch-line px-2.5 py-1 text-xs text-ink-dim disabled:opacity-40"
                >
                  {a.active ? "비활성화" : "활성화"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`'${a.name}' 계정과 모든 기록을 삭제할까요?`)) {
                      run(() =>
                        postJSON("/api/admin/action", { action: "accountDelete", accountId: a.id })
                      );
                    }
                  }}
                  className="rounded-lg border border-danger/40 px-2.5 py-1 text-xs text-danger disabled:opacity-40"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {tab === "games" && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-ink">게임</h2>
          {admin.games.map((g) => (
            <div key={g.slug} className="flex items-center gap-2 text-sm">
              <span className={g.active ? "text-ink" : "text-ink-faint"}>{g.name}</span>
              <span className="text-[11px] text-ink-faint">
                ({g.scoring}) · 기록 {g.scoreCount}개
              </span>
              <div className="ml-auto flex gap-1.5">
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      postJSON("/api/admin/action", {
                        action: "gameActive",
                        slug: g.slug,
                        active: !g.active,
                      })
                    )
                  }
                  className="rounded-lg border border-pitch-line px-2.5 py-1 text-xs text-ink-dim disabled:opacity-40"
                >
                  {g.active ? "숨기기" : "노출"}
                </button>
                <button
                  disabled={busy || g.scoreCount === 0}
                  onClick={() => {
                    // 되돌릴 수 없는 삭제 — 게임 이름을 그대로 입력해야 진행.
                    const typed = prompt(
                      `'${g.name}' 의 기록 ${g.scoreCount}개를 모두 삭제합니다.\n되돌릴 수 없습니다. 진행하려면 게임 이름을 입력하세요.`
                    );
                    if (typed === null) return;
                    if (typed.trim() !== g.name) {
                      alert("게임 이름이 일치하지 않아 취소했습니다.");
                      return;
                    }
                    // 사용자에게 보여줄 사유 — 비우면 '밸런스 조정'.
                    const note = prompt("초기화 사유 (사용자에게 표시됩니다)", "밸런스 조정");
                    if (note === null) return; // 사유 입력을 취소하면 초기화도 취소
                    run(() =>
                      postJSON("/api/admin/action", {
                        action: "gameResetScores",
                        slug: g.slug,
                        note: note.trim(),
                      })
                    );
                  }}
                  className="rounded-lg border border-danger/40 px-2.5 py-1 text-xs text-danger disabled:opacity-40"
                >
                  기록 초기화
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {tab === "review" && <ReviewSection quizzes={admin.hiddenQuizzes} busy={busy} run={run} />}
    </div>
  );
}

// 신고 누적으로 숨겨진 캐치마인드 그림 검토 — 복구 / 영구삭제.
function ReviewSection({
  quizzes,
  busy,
  run,
}: {
  quizzes: AdminState["hiddenQuizzes"];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  if (quizzes.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-ink-dim">검토할 숨겨진 그림이 없어요.</Card>
    );
  }
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg text-ink">
          숨겨진 그림 <span className="text-sm text-ink-faint">{quizzes.length}건</span>
        </h2>
        <p className="mt-0.5 text-xs text-ink-faint">
          신고가 누적돼 자동 숨김된 그림이에요. 확인 후 복구하거나 영구 삭제하세요.
        </p>
      </div>
      {quizzes.map((q) => (
        <div key={q.id} className="flex gap-3 rounded-lg border border-pitch-line bg-black/10 p-3">
          {q.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={q.imageUrl}
              alt="신고된 그림"
              className="h-24 w-24 shrink-0 rounded-lg border border-pitch-line bg-white object-contain"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-pitch-line bg-black/20 text-[11px] text-ink-faint">
              이미지 없음
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="text-sm">
              <span className="text-ink-faint">정답</span> <b className="text-ink">{q.word}</b>
            </div>
            <div className="text-[11px] text-ink-faint">
              {q.authorName} · 신고 {q.reportCount}회
            </div>
            <div className="flex flex-wrap gap-1">
              {reasonChips(q.reasons).map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] text-danger"
                >
                  {r}
                </span>
              ))}
            </div>
            <div className="mt-auto flex gap-1.5 pt-1">
              <button
                disabled={busy}
                onClick={() =>
                  run(() => postJSON("/api/admin/action", { action: "cmRestore", quizId: q.id }))
                }
                className="rounded-lg border border-pitch-line px-2.5 py-1 text-xs text-ink-dim disabled:opacity-40"
              >
                복구
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (confirm(`'${q.word}' 그림을 영구 삭제할까요? 되돌릴 수 없습니다.`)) {
                    run(() => postJSON("/api/admin/action", { action: "cmDelete", quizId: q.id }));
                  }
                }}
                className="rounded-lg border border-danger/40 px-2.5 py-1 text-xs text-danger disabled:opacity-40"
              >
                영구삭제
              </button>
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

// 사유 라벨 배열 → "부적절 2 · 성의없음 1" 식 칩 문자열 배열
function reasonChips(reasons: string[]): string[] {
  const count = new Map<string, number>();
  for (const r of reasons) count.set(r, (count.get(r) ?? 0) + 1);
  return [...count.entries()].map(([label, n]) => (n > 1 ? `${label} ${n}` : label));
}
