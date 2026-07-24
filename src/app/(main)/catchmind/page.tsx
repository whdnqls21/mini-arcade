"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Card } from "@/components/Card";
import { useAppState } from "@/components/StateProvider";
import { DrawCanvas, type DrawCanvasHandle } from "@/games/catchmind/DrawCanvas";
import { REPORT_REASONS, type ReportReason } from "@/games/catchmind/types";

// 갤러리는 진입 시에만 필요하니 지연 로드해 첫 진입 번들을 가볍게.
const Gallery = dynamic(() => import("@/games/catchmind/Gallery").then((m) => m.Gallery), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-pitch-line border-t-grass" />
    </div>
  ),
});
import type {
  CmRank,
  CmStats,
  GuessResult,
  PlayQuiz,
  QuizResult,
  WordPick,
} from "@/games/catchmind/types";

type View = "home" | "pick" | "draw" | "guess" | "result" | "rank" | "gallery";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "요청에 실패했습니다.");
  return data as T;
}

export default function CatchmindPage() {
  const { state } = useAppState();
  const [view, setView] = useState<View>("home");
  const [resultQuizId, setResultQuizId] = useState<string | null>(null);

  if (!state) return null;
  if (state.session?.solo) {
    return (
      <Wrap onHome={() => setView("home")} showBack={false}>
        <Card className="py-10 text-center text-sm text-ink-dim">
          캐치마인드는 함께 그리고 맞히는 게임이라 솔로모드에서는 이용할 수 없어요.
          <br />내정보에서 솔로모드를 끄면 참여할 수 있습니다.
        </Card>
      </Wrap>
    );
  }

  const goResult = (quizId: string) => {
    setResultQuizId(quizId);
    setView("result");
  };

  return (
    <Wrap onHome={() => setView("home")} showBack={view !== "home"}>
      {view === "home" && (
        <Home
          onPick={() => setView("pick")}
          onGuess={() => setView("guess")}
          onRank={() => setView("rank")}
          onGallery={() => setView("gallery")}
        />
      )}
      {view === "pick" && <Pick onDraw={() => setView("draw")} pickRef={pickHolder} />}
      {view === "draw" && <Draw word={pickHolder.current} onDone={() => setView("home")} />}
      {view === "guess" && <Guess onFinished={goResult} onEmpty={() => setView("pick")} />}
      {view === "result" && resultQuizId && <Result quizId={resultQuizId} onNext={() => setView("guess")} />}
      {view === "rank" && <Rank />}
      {view === "gallery" && <Gallery />}
    </Wrap>
  );
}

// 선택한 제시어를 draw 로 넘기기 위한 간이 홀더(리렌더 불필요).
const pickHolder: { current: WordPick | null } = { current: null };

function Wrap({
  children,
  onHome,
  showBack,
}: {
  children: React.ReactNode;
  onHome: () => void;
  showBack: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-grass">캐치마인드</p>
          <h1 className="font-display text-2xl text-ink">그리고, 맞히기</h1>
        </div>
        {showBack ? (
          <button onClick={onHome} className="rounded-lg border border-pitch-line px-3 py-2 text-sm text-ink-dim hover:text-ink">
            홈으로
          </button>
        ) : (
          <Link href="/" className="rounded-lg border border-pitch-line px-3 py-2 text-sm text-ink-dim hover:text-ink">
            게임 목록
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

// ── 홈 ────────────────────────────────────────────────────────────────
function Home({
  onPick,
  onGuess,
  onRank,
  onGallery,
}: {
  onPick: () => void;
  onGuess: () => void;
  onRank: () => void;
  onGallery: () => void;
}) {
  const [stats, setStats] = useState<CmStats | null>(null);
  useEffect(() => {
    api<CmStats>("/api/cm/me").then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-around gap-2 py-4">
        <Stat label="총점" value={stats?.total ?? 0} accent />
        <Divider />
        <Stat label="눈썰미" value={stats?.solvePoints ?? 0} />
        <Divider />
        <Stat label="손재주" value={stats?.authorPoints ?? 0} />
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <BigButton
          onClick={onGuess}
          title="맞추기"
          desc={stats ? `안 푼 문제 ${stats.unsolvedCount}개` : "남의 그림을 맞혀요"}
        />
        <BigButton onClick={onPick} title="문제출제" desc="제시어를 그려요" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onGallery} className="rounded-xl border border-pitch-line py-3 text-sm text-ink-dim hover:text-ink">
          🖼️ 갤러리
        </button>
        <button onClick={onRank} className="rounded-xl border border-pitch-line py-3 text-sm text-ink-dim hover:text-ink">
          🏆 순위
        </button>
      </div>

      {stats && (
        <p className="text-center text-xs text-ink-faint">
          맞힌 문제 {stats.solvedCount}개 · 낸 문제 {stats.quizCount}개 · 안 푼 문제 {stats.unsolvedCount}개
        </p>
      )}
    </div>
  );
}

function BigButton({ onClick, title, desc }: { onClick: () => void; title: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl border border-pitch-line bg-pitch-card py-7 transition-colors hover:border-grass/40"
    >
      <span className="font-display text-xl text-ink">{title}</span>
      <span className="text-xs text-ink-faint">{desc}</span>
    </button>
  );
}

// ── 제시어 선택 ────────────────────────────────────────────────────────
function Pick({ onDraw, pickRef }: { onDraw: () => void; pickRef: { current: WordPick | null } }) {
  const [words, setWords] = useState<WordPick[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setWords(null);
    setErr(null);
    api<{ words: WordPick[] }>("/api/cm/words")
      .then((d) => setWords(d.words))
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  if (err) return <Card className="py-10 text-center text-sm text-danger">{err}</Card>;
  if (!words) return <Spinner />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-dim">그릴 제시어를 골라요.</p>
      {words.map((w) => (
        <button
          key={w.id}
          onClick={() => {
            pickRef.current = w;
            onDraw();
          }}
          className="rounded-xl border border-pitch-line bg-pitch-card py-5 font-display text-xl text-ink transition-colors hover:border-grass/40"
        >
          {w.text}
        </button>
      ))}
      <button onClick={load} className="mt-1 rounded-lg border border-pitch-line py-2.5 text-sm text-ink-dim hover:text-ink">
        🔄 다시 뽑기
      </button>
    </div>
  );
}

// ── 그리기 ────────────────────────────────────────────────────────────
function Draw({ word, onDone }: { word: WordPick | null; onDone: () => void }) {
  const canvasRef = useRef<DrawCanvasHandle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!word) return <Card className="py-10 text-center text-sm text-ink-dim">제시어를 먼저 골라주세요.</Card>;

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-display text-lg text-ink">출제 완료! 🎉</p>
        <p className="text-sm text-ink-dim">누군가 맞히면 점수를 받아요.</p>
        <button onClick={onDone} className="rounded-xl bg-grass px-6 py-2.5 font-display text-pitch-base">
          홈으로
        </button>
      </Card>
    );
  }

  const submit = async () => {
    if (!canvasRef.current || canvasRef.current.isEmpty()) {
      setErr("그림을 그려주세요.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const image = canvasRef.current.toDataURL();
      await api("/api/cm/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: word.id, image }),
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Card className="py-3 text-center">
        <span className="text-xs text-ink-faint">제시어</span>
        <p className="font-display text-2xl text-ink">{word.text}</p>
      </Card>
      <DrawCanvas ref={canvasRef} />
      {err && <p className="text-center text-sm text-danger">{err}</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="rounded-xl bg-grass py-3 font-display text-pitch-base disabled:opacity-50"
      >
        {submitting ? "제출 중…" : "제출하기"}
      </button>
    </div>
  );
}

// ── 맞추기 ────────────────────────────────────────────────────────────
function Guess({ onFinished, onEmpty }: { onFinished: (quizId: string) => void; onEmpty: () => void }) {
  const [quiz, setQuiz] = useState<PlayQuiz | null | "none">(null);
  const [err, setErr] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [remaining, setRemaining] = useState(3);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  const load = useCallback(() => {
    setQuiz(null);
    setErr(null);
    setGuess("");
    setWrong(false);
    api<{ quiz: PlayQuiz | null }>("/api/cm/play")
      .then((d) => {
        if (!d.quiz) {
          setQuiz("none");
          return;
        }
        setQuiz(d.quiz);
        setRemaining(3 - d.quiz.tries);
        setHint(d.quiz.hint);
      })
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);

  if (err) return <Card className="py-10 text-center text-sm text-danger">{err}</Card>;
  if (quiz === null) return <Spinner />;
  if (quiz === "none") {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-display text-lg text-ink">풀 문제가 없어요</p>
        <p className="text-sm text-ink-dim">직접 문제를 출제해 보시겠어요?</p>
        <button onClick={onEmpty} className="rounded-xl bg-grass px-6 py-2.5 font-display text-pitch-base">
          문제 출제하러 가기
        </button>
      </Card>
    );
  }

  const submit = async () => {
    if (!guess.trim() || busy) return;
    setBusy(true);
    setWrong(false);
    try {
      const r = await api<GuessResult>("/api/cm/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.quizId, guess }),
      });
      if (r.finished) {
        onFinished(quiz.quizId);
        return;
      }
      setRemaining(r.remaining);
      setHint(r.hint);
      setGuess("");
      setWrong(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "제출에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={quiz.imageUrl}
        alt="맞혀야 할 그림"
        className="mx-auto w-full max-w-[20rem] rounded-xl border border-pitch-line bg-white"
        style={{ aspectRatio: "1 / 1" }}
      />
      <div className="text-sm">
        <span className="text-ink-dim">
          남은 기회 <b className="text-ink">{remaining}</b>
        </span>
      </div>
      {hint && (
        <Card className="py-2.5 text-center">
          <span className="text-xs text-ink-faint">힌트</span>{" "}
          <span className="font-display tracking-[0.15em] text-gold">{hint}</span>
        </Card>
      )}
      {wrong && <p className="text-center text-sm text-danger">아쉬워요, 다시!</p>}
      <div className="flex gap-2">
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="정답 입력"
          className="min-w-0 flex-1 rounded-xl border border-pitch-line bg-black/20 px-4 py-3 text-ink outline-none focus:border-grass/50"
        />
        <button
          onClick={submit}
          disabled={busy || !guess.trim()}
          className="shrink-0 rounded-xl bg-grass px-5 font-display text-pitch-base disabled:opacity-50"
        >
          제출
        </button>
      </div>
    </div>
  );
}

// ── 결과 ──────────────────────────────────────────────────────────────
function Result({ quizId, onNext }: { quizId: string; onNext: () => void }) {
  const [r, setR] = useState<QuizResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    api<QuizResult>(`/api/cm/result?quizId=${quizId}`)
      .then((d) => {
        setR(d);
        setStars(d.myStars);
      })
      .catch((e) => setErr(e.message));
  }, [quizId]);

  if (err) return <Card className="py-10 text-center text-sm text-danger">{err}</Card>;
  if (!r) return <Spinner />;

  const rate = async (s: number) => {
    setStars(s);
    try {
      await api("/api/cm/quiz-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rating", quizId, stars: s }),
      });
    } catch {
      /* 별점 실패는 조용히 무시 */
    }
  };

  const report = async (reason: ReportReason) => {
    try {
      await api("/api/cm/quiz-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report", quizId, reason }),
      });
      setReported(true);
      setReporting(false);
    } catch {
      setReporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col items-center gap-2 py-6 text-center">
        <p className={`font-display text-2xl ${r.correct ? "text-grass" : "text-danger"}`}>
          {r.correct ? "정답! 🎉" : "아쉬워요 😢"}
        </p>
        <p className="text-sm text-ink-dim">
          정답은 <b className="text-ink">{r.word}</b>
        </p>
        <p className="text-xs text-ink-faint">
          그린 사람 <span className="text-ink-dim">{r.authorName}</span>
        </p>
        {r.correct && (
          <p className="text-sm text-gold">
            +{r.myScore}점 획득
          </p>
        )}
      </Card>

      {r.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={r.imageUrl}
          alt="방금 푼 그림"
          className="mx-auto w-full max-w-[16rem] rounded-xl border border-pitch-line bg-white"
          style={{ aspectRatio: "1 / 1" }}
        />
      )}

      {r.wrongTop3.length > 0 && (
        <Card className="flex flex-col gap-1.5 py-3">
          <span className="text-xs text-ink-faint">많이 나온 오답</span>
          {r.wrongTop3.map((w, i) => (
            <div key={w.guess} className="flex justify-between text-sm">
              <span className="text-ink-dim">
                {i + 1}. {w.guess}
              </span>
              <span className="text-ink-faint">{w.count}회</span>
            </div>
          ))}
        </Card>
      )}

      {/* 별점(품질 지표) */}
      <Card className="flex flex-col items-center gap-2 py-3">
        <span className="text-xs text-ink-faint">이 그림 어땠나요?</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => rate(s)} aria-label={`${s}점`} className="text-2xl">
              <span className={stars != null && s <= stars ? "text-gold" : "text-ink-faint"}>★</span>
            </button>
          ))}
        </div>
      </Card>

      {/* 신고 */}
      {reported ? (
        <p className="text-center text-xs text-ink-faint">신고가 접수됐어요.</p>
      ) : reporting ? (
        <Card className="flex flex-col gap-2 py-3">
          <span className="text-xs text-ink-faint">신고 사유</span>
          {REPORT_REASONS.map((r2) => (
            <button
              key={r2.value}
              onClick={() => report(r2.value)}
              className="rounded-lg border border-pitch-line py-2 text-sm text-ink-dim hover:text-ink"
            >
              {r2.label}
            </button>
          ))}
          <button onClick={() => setReporting(false)} className="text-xs text-ink-faint">
            취소
          </button>
        </Card>
      ) : (
        <button onClick={() => setReporting(true)} className="text-center text-xs text-ink-faint hover:text-ink-dim">
          🚩 이 문제 신고하기
        </button>
      )}

      <button onClick={onNext} className="rounded-xl bg-grass py-3 font-display text-pitch-base">
        다음 문제 →
      </button>
    </div>
  );
}

// ── 순위 ──────────────────────────────────────────────────────────────
function Rank() {
  const [rank, setRank] = useState<CmRank | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<keyof CmRank>("total");

  useEffect(() => {
    api<CmRank>("/api/cm/rank").then(setRank).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Card className="py-10 text-center text-sm text-danger">{err}</Card>;
  if (!rank) return <Spinner />;

  const TABS: { key: keyof CmRank; label: string }[] = [
    { key: "total", label: "총점" },
    { key: "solver", label: "눈썰미" },
    { key: "author", label: "손재주" },
  ];
  const rows = rank[tab];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2 text-sm transition-colors ${
              tab === t.key ? "bg-grass/15 text-grass" : "border border-pitch-line text-ink-faint"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Card className="py-10 text-center text-sm text-ink-dim">아직 기록이 없어요.</Card>
      ) : (
        <Card className="flex flex-col gap-1 py-2">
          {rows.map((r) => (
            <div key={`${r.rank}-${r.name}`} className="flex items-center justify-between py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <span className={`w-6 text-center font-display ${r.rank <= 3 ? "text-gold" : "text-ink-faint"}`}>
                  {r.rank}
                </span>
                <span className="text-ink">{r.name}</span>
              </span>
              <span className="tabular text-grass">{r.points}점</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── 공통 소품 ──────────────────────────────────────────────────────────
function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[11px] text-ink-faint">{label}</span>
      <span className={`font-display text-xl ${accent ? "text-gold" : "text-ink"}`}>{value}</span>
    </div>
  );
}
function Divider() {
  return <span className="h-8 w-px bg-pitch-line" />;
}
function Spinner() {
  return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-pitch-line border-t-grass" />
    </div>
  );
}
