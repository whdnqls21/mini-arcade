"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { AdminBoard } from "@/components/board/AdminBoard";
import { GAME_REGISTRY } from "@/games/registry";
import { postJSON } from "@/lib/client-api";
import { ddayLabel } from "@/lib/format";
import type { AdminState } from "@/lib/state";
import type { PostCategory } from "@/lib/types";

// 아직 공개 전(ma_games 미등록)인 베타 게임 — 관리자만 여기서 테스트한다.
// 공개(ma_games insert)하면 여기서 빼서 목록 중복을 막는다.
const BETA_GAMES: { slug: string; name: string }[] = [
  { slug: "simon", name: "사이먼" },
  { slug: "numbermemory", name: "숫자 기억" },
  { slug: "fifteen", name: "슬라이드 퍼즐" },
];

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

// 관리자 글 작성(공지 / 업데이트) — 관리자 세션이 살아 있는 이 화면에서만 쓸 수 있다.
const ADMIN_POST_KINDS: { value: PostCategory; label: string; placeholder: string }[] = [
  { value: "notice", label: "공지", placeholder: "공지 내용" },
  { value: "update", label: "업데이트", placeholder: "새 게임 출시 · 패치 내용" },
];

function NoticeForm() {
  const [category, setCategory] = useState<PostCategory>("notice");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const kind = ADMIN_POST_KINDS.find((k) => k.value === category) ?? ADMIN_POST_KINDS[0];

  async function submit() {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await postJSON("/api/board", { category, title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      setMsg(`${kind.label} 글을 올렸어요. 게시판 상단에 표시됩니다.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "작성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-gold/30">
      <h2 className="font-display text-lg text-ink">
        관리자 글 작성 <span className="text-sm text-ink-faint">게시판 상단</span>
      </h2>
      {/* 분류: 공지 / 업데이트 */}
      <div className="flex gap-1.5">
        {ADMIN_POST_KINDS.map((k) => (
          <button
            key={k.value}
            onClick={() => setCategory(k.value)}
            className={`flex-1 rounded-lg py-2 text-sm transition-colors ${
              category === k.value
                ? k.value === "update"
                  ? "bg-grass/15 text-grass"
                  : "bg-gold/15 text-gold"
                : "border border-pitch-line text-ink-faint hover:text-ink-dim"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <input
        value={title}
        maxLength={40}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`${kind.label} 제목`}
        className="rounded-xl border border-pitch-line bg-black/20 px-3 py-2.5 text-ink outline-none focus:border-gold"
      />
      <textarea
        value={body}
        maxLength={1000}
        onChange={(e) => setBody(e.target.value)}
        placeholder={kind.placeholder}
        rows={4}
        className="resize-none rounded-xl border border-pitch-line bg-black/20 px-3 py-2.5 text-sm text-ink outline-none focus:border-gold"
      />
      <button
        onClick={submit}
        disabled={!title.trim() || !body.trim() || busy}
        className={`rounded-xl py-2.5 font-display text-pitch-base disabled:opacity-40 ${
          category === "update" ? "bg-grass" : "bg-gold"
        }`}
      >
        {busy ? "올리는 중…" : `${kind.label} 올리기`}
      </button>
      {msg && <p className="text-center text-sm text-grass">{msg}</p>}
      {err && <p className="text-center text-sm text-danger">{err}</p>}
    </Card>
  );
}

type Tab = "board" | "accounts" | "games" | "seasons" | "beta" | "review";

function Dashboard({ admin, reload }: { admin: AdminState; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 검토할 그림·사진이 있으면 그 탭부터 연다.
  const reviewCount = admin.hiddenQuizzes.length + admin.hiddenPhotos.length;
  const [tab, setTab] = useState<Tab>(reviewCount > 0 ? "review" : "board");

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

  const TABS: { key: Tab; label: string; badge?: number; icon: (p: { active?: boolean }) => ReactNode }[] = [
    { key: "board", label: "게시판", icon: NavBoardIcon },
    { key: "accounts", label: "계정", badge: admin.accounts.length, icon: NavAccountsIcon },
    { key: "games", label: "게임", icon: NavGamesIcon },
    { key: "seasons", label: "시즌", icon: NavSeasonsIcon },
    { key: "beta", label: "베타", icon: NavBetaIcon },
    { key: "review", label: "검토", badge: reviewCount, icon: NavReviewIcon },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">아래 메뉴로 이동</span>
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

      {tab === "games" && <GamesSection admin={admin} busy={busy} run={run} />}

      {tab === "seasons" && <SeasonSection admin={admin} busy={busy} run={run} />}

      {tab === "beta" && <BetaSection />}

      {tab === "review" && (
        <ReviewSection quizzes={admin.hiddenQuizzes} photos={admin.hiddenPhotos} busy={busy} run={run} />
      )}

      <AdminNav tab={tab} setTab={setTab} tabs={TABS} />
    </div>
  );
}

// 관리자 하단 네비게이션 — 앱 공용 탭 대신 관리자 섹션 이동에 쓴다.
function AdminNav({
  tab,
  setTab,
  tabs,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  tabs: { key: Tab; label: string; badge?: number; icon: (p: { active?: boolean }) => ReactNode }[];
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto max-w-md px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-stretch justify-around rounded-2xl border border-pitch-line bg-pitch-base/90 shadow-card backdrop-blur-md">
          {tabs.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  active ? "text-grass" : "text-ink-faint hover:text-ink-dim"
                }`}
              >
                <span className="relative">
                  <Icon active={active} />
                </span>
                <span className={active ? "font-medium" : ""}>{t.label}</span>
                {t.badge != null && t.badge > 0 && (
                  <span
                    className={`absolute right-1.5 top-1 rounded-full px-1 text-[9px] ${
                      t.key === "review" ? "bg-danger/30 text-danger" : "bg-pitch-line text-ink-faint"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// 하단 네비 아이콘 — 앱 공용 BottomTabs 와 같은 22px SVG 로 높이를 맞춘다.
type NavIconProps = { active?: boolean };
function navSvg(children: ReactNode, active?: boolean) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
function NavBoardIcon({ active }: NavIconProps) {
  return navSvg(
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </>,
    active
  );
}
function NavAccountsIcon({ active }: NavIconProps) {
  return navSvg(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M18 20c0-2.6-1-4.3-3-5" />
    </>,
    active
  );
}
function NavGamesIcon({ active }: NavIconProps) {
  return navSvg(
    <>
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <path d="M7 12h3M8.5 10.5v3M15 11h.01M18 13h.01" />
    </>,
    active
  );
}
function NavSeasonsIcon({ active }: NavIconProps) {
  return navSvg(
    <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 21l-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />,
    active
  );
}
function NavBetaIcon({ active }: NavIconProps) {
  return navSvg(
    <>
      <path d="M9 3h6M10 3v5l-4.5 8.5A2 2 0 0 0 7.3 20h9.4a2 2 0 0 0 1.8-3.5L14 8V3" />
      <path d="M8 14h8" />
    </>,
    active
  );
}
function NavReviewIcon({ active }: NavIconProps) {
  return navSvg(
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4-4" />
    </>,
    active
  );
}

// 게임 관리 — 시즌 종목/자유 종목으로 나눠 ▲▼ 로 순서 조정(로컬) 후 '순서 저장' 으로 한 번에 반영.
// 노출·기록 초기화는 즉시 반영(순서 미저장 상태에선 잠근다 — 저장 안 한 순서가 초기화되는 걸 막음).
type AdminGame = AdminState["games"][number];
function GamesSection({
  admin,
  busy,
  run,
}: {
  admin: AdminState;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const activeSeason = admin.seasons.find((s) => s.status === "active") ?? null;

  const [seasonOrder, setSeasonOrder] = useState<AdminGame[]>([]);
  const [freeOrder, setFreeOrder] = useState<AdminGame[]>([]);
  const [dirty, setDirty] = useState(false);

  // admin.games 가 바뀌면(로드/저장 후) 로컬 순서를 서버 순서로 재설정.
  useEffect(() => {
    const s = admin.seasons.find((x) => x.status === "active");
    const set = new Set(s?.games ?? []);
    setSeasonOrder(admin.games.filter((g) => set.has(g.slug)));
    setFreeOrder(admin.games.filter((g) => !set.has(g.slug)));
    setDirty(false);
  }, [admin]);

  const move = (list: AdminGame[], setList: (v: AdminGame[]) => void, i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    setDirty(true);
  };

  const saveOrder = () =>
    run(() =>
      postJSON("/api/admin/action", {
        action: "gameSetOrder",
        slugs: [...seasonOrder, ...freeOrder].map((g) => g.slug),
      })
    );

  const gameRow = (g: AdminGame, list: AdminGame[], setList: (v: AdminGame[]) => void, i: number) => (
    <div key={g.slug} className="flex items-center gap-2 rounded-lg border border-pitch-line bg-black/10 px-2 py-1.5 text-sm">
      {/* 순서 조정 ▲▼ (로컬만 — 저장 전까지 서버 반영 안 함) */}
      <div className="flex flex-col gap-0.5">
        <button
          disabled={busy || i === 0}
          onClick={() => move(list, setList, i, -1)}
          aria-label="위로"
          className="rounded border border-pitch-line px-1.5 leading-none text-ink-dim disabled:opacity-25"
        >
          ▲
        </button>
        <button
          disabled={busy || i === list.length - 1}
          onClick={() => move(list, setList, i, 1)}
          aria-label="아래로"
          className="rounded border border-pitch-line px-1.5 leading-none text-ink-dim disabled:opacity-25"
        >
          ▼
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <span className={g.active ? "text-ink" : "text-ink-faint"}>{g.name}</span>
        <span className="ml-1 text-[11px] text-ink-faint">
          ({g.scoring}) · 기록 {g.scoreCount}
        </span>
      </div>

      <div className="flex shrink-0 gap-1.5">
        <button
          disabled={busy || dirty}
          onClick={() =>
            run(() =>
              postJSON("/api/admin/action", { action: "gameActive", slug: g.slug, active: !g.active })
            )
          }
          className="rounded-lg border border-pitch-line px-2 py-1 text-xs text-ink-dim disabled:opacity-40"
        >
          {g.active ? "숨기기" : "노출"}
        </button>
        <button
          disabled={busy || dirty || g.scoreCount === 0}
          onClick={() => {
            const typed = prompt(
              `'${g.name}' 의 기록 ${g.scoreCount}개를 모두 삭제합니다.\n되돌릴 수 없습니다. 진행하려면 게임 이름을 입력하세요.`
            );
            if (typed === null) return;
            if (typed.trim() !== g.name) {
              alert("게임 이름이 일치하지 않아 취소했습니다.");
              return;
            }
            const note = prompt("초기화 사유 (사용자에게 표시됩니다)", "밸런스 조정");
            if (note === null) return;
            run(() =>
              postJSON("/api/admin/action", { action: "gameResetScores", slug: g.slug, note: note.trim() })
            );
          }}
          className="rounded-lg border border-danger/40 px-2 py-1 text-xs text-danger disabled:opacity-40"
        >
          초기화
        </button>
      </div>
    </div>
  );

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-ink">게임</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            ▲▼ 로 순서를 바꾸고 <b className="text-ink-dim">순서 저장</b>을 눌러 반영해요. 시즌·자유 종목 안에서 정렬.
          </p>
        </div>
        <button
          disabled={busy || !dirty}
          onClick={saveOrder}
          className="shrink-0 rounded-lg bg-grass px-3 py-1.5 font-display text-sm text-pitch-base disabled:opacity-30"
        >
          순서 저장
        </button>
      </div>

      {activeSeason && seasonOrder.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-gold">🏆 시즌 종목</p>
          {seasonOrder.map((g, i) => gameRow(g, seasonOrder, setSeasonOrder, i))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-ink-dim">{activeSeason ? "자유 종목" : "전체 게임"}</p>
        {freeOrder.map((g, i) => gameRow(g, freeOrder, setFreeOrder, i))}
      </div>

      {dirty && (
        <p className="text-[11px] text-gold">
          순서가 바뀌었어요. ‘순서 저장’을 눌러 반영하세요. (저장 전엔 노출·초기화가 잠깁니다)
        </p>
      )}
    </Card>
  );
}

// 시즌 관리 — 활성 시즌이 있으면 현황+지금 종료, 없으면 새 시즌 시작 폼. 역대 시즌은 아래에.
function SeasonSection({
  admin,
  busy,
  run,
}: {
  admin: AdminState;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const nameBySlug = new Map(admin.games.map((g) => [g.slug, g.name]));
  const active = admin.seasons.find((s) => s.status === "active") ?? null;
  const past = admin.seasons.filter((s) => s.status === "closed");

  // 새 시즌 폼 상태 — 종목 선택, 이름, 시작·종료 일시(datetime-local).
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date()));
  const [endAt, setEndAt] = useState(() => toLocalInput(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)));

  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  const validRange = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
  // 활성 시즌이 아직 시작 전(예정)인지 — 표시·버튼 문구를 바꾼다.
  const scheduled = active ? new Date(active.starts_at).getTime() > Date.now() : false;

  const togglePick = (slug: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {active ? (
        <Card className="flex flex-col gap-3 border-gold/30">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg text-ink">
              시즌 {active.num}
              {active.name ? <span className="ml-1.5 text-gold">{active.name}</span> : null}
            </h2>
            {scheduled ? (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] text-gold">예정</span>
            ) : (
              <span className="rounded-full bg-grass/15 px-2 py-0.5 text-[11px] text-grass">진행 중</span>
            )}
            <span className="ml-auto text-xs text-ink-faint">
              {scheduled ? `시작 ${ddayText(active.starts_at)}` : ddayText(active.ends_at)}
            </span>
          </div>
          <div className="text-xs text-ink-dim">
            {fmtDateTime(active.starts_at)} ~ {fmtDateTime(active.ends_at)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {active.games.map((slug) => (
              <span key={slug} className="rounded-full bg-black/25 px-2.5 py-1 text-xs text-ink">
                {nameBySlug.get(slug) ?? slug}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-ink-faint">
            {scheduled
              ? "아직 시작 전(예정)이에요. 시작 일시가 지나면 자동으로 진행 중이 됩니다. 지금 종료하면 이 예정 시즌이 취소돼요."
              : "지금 종료하면 예정 종료일 전이어도 마감되고, MVP·종목별 1등이 명예의 전당에 기록돼요."}
          </p>
          <button
            disabled={busy}
            onClick={() => {
              const msg = scheduled
                ? `예정된 시즌 ${active.num}을(를) 취소할까요?`
                : `시즌 ${active.num}을(를) 지금 종료할까요? MVP·종목별 1등이 확정됩니다.`;
              if (confirm(msg)) {
                run(() => postJSON("/api/admin/action", { action: "seasonEnd" }));
              }
            }}
            className="rounded-xl border border-danger/40 py-2.5 text-sm text-danger disabled:opacity-40"
          >
            {scheduled ? "예정 시즌 취소" : "시즌 지금 종료"}
          </button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg text-ink">새 시즌 시작</h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              이번 시즌 종목을 고르세요. 4~5개 권장(최대 8). 고른 종목만 순위·MVP에 들어가고,
              나머지 게임은 자유 종목으로 계속 플레이할 수 있어요.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {admin.games.map((g) => {
              const on = picked.has(g.slug);
              return (
                <button
                  key={g.slug}
                  onClick={() => togglePick(g.slug)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    on
                      ? "border-grass/50 bg-grass/15 text-grass"
                      : "border-pitch-line text-ink-dim hover:text-ink"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {g.name}
                </button>
              );
            })}
          </div>
          <input
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            placeholder="시즌 이름(선택) 예: 반응속도 시즌"
            className="rounded-xl border border-pitch-line bg-black/20 px-3 py-2.5 text-sm text-ink outline-none focus:border-gold"
          />
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs text-ink-dim">
              <span className="w-9 shrink-0 text-ink-faint">시작</span>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="flex-1 rounded-xl border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-dim">
              <span className="w-9 shrink-0 text-ink-faint">종료</span>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="flex-1 rounded-xl border border-pitch-line bg-black/20 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              />
            </label>
          </div>
          <p className="text-[11px] text-ink-faint">
            {picked.size}개 선택 ·{" "}
            {startMs > Date.now() ? `${fmtDateTime(new Date(startMs).toISOString())} 시작 예정` : "즉시 시작"}
            {validRange ? ` · ${fmtDateTime(new Date(endMs).toISOString())} 종료` : ""}
          </p>
          {!validRange && <p className="text-[11px] text-danger">종료 일시는 시작 일시보다 뒤여야 해요.</p>}
          <button
            disabled={busy || picked.size === 0 || !validRange}
            onClick={() =>
              run(() =>
                postJSON("/api/admin/action", {
                  action: "seasonCreate",
                  games: [...picked],
                  name: name.trim(),
                  startsAt: new Date(startMs).toISOString(),
                  endsAt: new Date(endMs).toISOString(),
                })
              )
            }
            className="rounded-xl bg-gold py-2.5 font-display text-pitch-base disabled:opacity-40"
          >
            {startMs > Date.now() ? "시즌 예약" : "시즌 시작"}
          </button>
        </Card>
      )}

      {past.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h3 className="font-display text-sm text-ink-dim">역대 시즌</h3>
          {past.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="font-display text-ink">시즌 {s.num}</span>
              {s.name && <span className="text-gold">{s.name}</span>}
              <span className="text-ink-faint">{s.games.length}종목</span>
              <span className="ml-auto text-ink-faint">
                {fmtDate(s.starts_at)} ~ {fmtDate(s.closed_at ?? s.ends_at)}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// 날짜 표기 유틸(관리자 화면 전용).
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}. ${d.getDate()}.`;
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}. ${d.getDate()}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Date → datetime-local 입력값(YYYY-MM-DDTHH:mm, 로컬 시간)
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function ddayText(endIso: string): string {
  return ddayLabel(endIso, { past: (n) => `${n}일 지남` });
}

// 베타 게임 테스트 — 아직 공개 전인 게임을 관리자만 여기서 플레이해 확인한다(기록 저장 안 함).
function BetaSection() {
  const [active, setActive] = useState<string | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);

  const g = BETA_GAMES.find((x) => x.slug === active) ?? null;
  const entry = active ? GAME_REGISTRY[active] : null;
  const Play = entry?.Play;

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg text-ink">
          베타 게임 <span className="text-sm text-ink-faint">테스트 전용</span>
        </h2>
        <p className="mt-0.5 text-xs text-ink-faint">
          아직 공개 전인 게임이에요. 여기서 직접 해보고 확인하세요. 기록은 저장되지 않아요.
        </p>
      </div>

      {BETA_GAMES.length === 0 ? (
        <p className="rounded-lg bg-black/15 px-3 py-4 text-center text-xs text-ink-faint">
          지금은 테스트할 베타 게임이 없어요. 새 게임을 만들면 여기서 공개 전 확인합니다.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {BETA_GAMES.map((x) => {
            const Icon = GAME_REGISTRY[x.slug]?.Icon;
            return (
              <button
                key={x.slug}
                onClick={() => {
                  setActive(x.slug);
                  setLast(null);
                  setBest(null);
                }}
                className="flex items-center gap-2 rounded-lg border border-pitch-line bg-black/10 px-3 py-2 text-left text-sm text-ink transition-colors hover:border-grass/40"
              >
                {Icon && <Icon size={28} />}
                <span className="flex-1">{x.name}</span>
                <span className="text-xs text-grass">테스트 →</span>
              </button>
            );
          })}
        </div>
      )}

      {g && entry && Play && (
        <Modal open onClose={() => setActive(null)} title={g.name}>
          <div className="flex flex-col gap-3">
            {last != null && (
              <p className="text-center text-sm text-ink-dim">
                이번 판 <span className="tabular text-gold">{last}</span>
                {best != null && best !== last ? ` · 최고 ${best}` : ""}
              </p>
            )}
            <Play
              onGameOver={(s) => {
                setLast(s);
                setBest((b) => (b == null ? s : Math.max(b, s)));
              }}
              bestScore={best}
              submitting={false}
              accountId={null}
            />
          </div>
        </Modal>
      )}
    </Card>
  );
}

// 신고 누적으로 숨겨진 캐치마인드 그림·제목 학원 사진 검토 — 복구 / 영구삭제.
function ReviewSection({
  quizzes,
  photos,
  busy,
  run,
}: {
  quizzes: AdminState["hiddenQuizzes"];
  photos: AdminState["hiddenPhotos"];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  if (quizzes.length === 0 && photos.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-ink-dim">검토할 숨겨진 그림·사진이 없어요.</Card>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {photos.length > 0 && <PhotoReview photos={photos} busy={busy} run={run} />}
      {quizzes.length > 0 && (
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
      )}
    </div>
  );
}

// 제목 학원 숨겨진 사진 검토 — 복구 / 영구삭제.
function PhotoReview({
  photos,
  busy,
  run,
}: {
  photos: AdminState["hiddenPhotos"];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg text-ink">
          숨겨진 사진 <span className="text-sm text-ink-faint">{photos.length}건</span>
        </h2>
        <p className="mt-0.5 text-xs text-ink-faint">
          신고가 누적돼 자동 숨김된 사진이에요. 확인 후 복구하거나 영구 삭제하세요.
        </p>
      </div>
      {photos.map((p) => (
        <div key={p.id} className="flex gap-3 rounded-lg border border-pitch-line bg-black/10 p-3">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imageUrl}
              alt="신고된 사진"
              className="h-24 w-24 shrink-0 rounded-lg border border-pitch-line bg-black/20 object-contain"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-pitch-line bg-black/20 text-[11px] text-ink-faint">
              이미지 없음
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="text-[11px] text-ink-faint">
              {p.authorName} · 신고 {p.reportCount}회
            </div>
            <div className="flex flex-wrap gap-1">
              {reasonChips(p.reasons).map((r) => (
                <span key={r} className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] text-danger">
                  {r}
                </span>
              ))}
            </div>
            <div className="mt-auto flex gap-1.5 pt-1">
              <button
                disabled={busy}
                onClick={() => run(() => postJSON("/api/admin/action", { action: "ttRestore", photoId: p.id }))}
                className="rounded-lg border border-pitch-line px-2.5 py-1 text-xs text-ink-dim disabled:opacity-40"
              >
                복구
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (confirm("이 사진을 영구 삭제할까요? 되돌릴 수 없습니다.")) {
                    run(() => postJSON("/api/admin/action", { action: "ttDelete", photoId: p.id }));
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
