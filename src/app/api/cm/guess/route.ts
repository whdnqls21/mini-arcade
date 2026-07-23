import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession } from "@/lib/auth";
import {
  MAX_TRIES,
  authorScore,
  hintForTry,
  isSoloAccount,
  normalizeAnswer,
  solverScore,
} from "@/lib/catchmind/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 답 제출 — 판정은 서버에서만. 맞히면 정답자·출제자 점수 적립.
export async function POST(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const quizId = body?.quizId;
  const guessRaw = body?.guess;
  if (typeof quizId !== "string" || typeof guessRaw !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const guess = guessRaw.slice(0, 100);
  if (!guess.trim()) return NextResponse.json({ error: "정답을 입력하세요." }, { status: 400 });

  const sb = createServiceClient();
  if (await isSoloAccount(sb, session.id)) {
    return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  }

  const { data: quiz } = await sb
    .from("ma_cm_quizzes")
    .select("id,author_id,word_id,is_hidden,is_deleted")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz || quiz.is_hidden || quiz.is_deleted) {
    return NextResponse.json({ error: "풀 수 없는 문제입니다." }, { status: 400 });
  }
  if (quiz.author_id === session.id) {
    return NextResponse.json({ error: "본인 문제는 풀 수 없어요." }, { status: 400 });
  }

  const { data: word } = await sb
    .from("ma_cm_words")
    .select("text")
    .eq("id", quiz.word_id)
    .maybeSingle();
  if (!word) return NextResponse.json({ error: "문제 정보를 찾을 수 없습니다." }, { status: 500 });

  // 시도 상태 로드/생성.
  let { data: attempt } = await sb
    .from("ma_cm_attempts")
    .select("id,tries,finished")
    .eq("quiz_id", quizId)
    .eq("user_id", session.id)
    .maybeSingle();

  if (!attempt) {
    const ins = await sb
      .from("ma_cm_attempts")
      .insert({ quiz_id: quizId, user_id: session.id, tries: 0 })
      .select("id,tries,finished")
      .maybeSingle();
    if (ins.error && ins.error.code !== "23505") {
      console.error("시도 생성 실패", ins.error);
      return NextResponse.json({ error: "처리에 실패했습니다." }, { status: 500 });
    }
    attempt =
      ins.data ??
      (
        await sb
          .from("ma_cm_attempts")
          .select("id,tries,finished")
          .eq("quiz_id", quizId)
          .eq("user_id", session.id)
          .maybeSingle()
      ).data;
  }
  if (!attempt) return NextResponse.json({ error: "처리에 실패했습니다." }, { status: 500 });
  if (attempt.finished) {
    return NextResponse.json({ error: "이미 끝난 문제입니다." }, { status: 400 });
  }

  const tryNo = attempt.tries + 1; // 이번이 몇 번째 시도인지 (1~3)
  const correct = normalizeAnswer(guess) === normalizeAnswer(word.text);

  await sb.from("ma_cm_guesses").insert({
    attempt_id: attempt.id,
    quiz_id: quizId,
    guess,
    is_correct: correct,
  });

  if (correct) {
    const sPts = solverScore(tryNo);
    const aPts = authorScore(tryNo);
    await sb
      .from("ma_cm_attempts")
      .update({ tries: tryNo, is_correct: true, finished: true, solver_score: sPts, author_score: aPts })
      .eq("id", attempt.id);
    await sb.from("ma_cm_point_logs").insert([
      { user_id: session.id, amount: sPts, reason: "solve", ref_quiz_id: quizId },
      { user_id: quiz.author_id, amount: aPts, reason: "author_solved", ref_quiz_id: quizId },
    ]);
    return NextResponse.json({
      correct: true,
      finished: true,
      remaining: 0,
      hint: null,
      score: sPts,
      tries: tryNo,
    });
  }

  // 오답.
  const finished = tryNo >= MAX_TRIES;
  await sb.from("ma_cm_attempts").update({ tries: tryNo, finished }).eq("id", attempt.id);
  return NextResponse.json({
    correct: false,
    finished,
    remaining: Math.max(0, MAX_TRIES - tryNo),
    hint: finished ? null : hintForTry(word.text, tryNo),
    score: null,
    tries: tryNo,
  });
}
