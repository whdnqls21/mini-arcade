import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 결과 화면 — 풀이를 끝낸 사람만. 정답 + 오답 TOP3 + 내 점수/별점.
export async function GET(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const quizId = req.nextUrl.searchParams.get("quizId");
  if (!quizId) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const sb = createServiceClient();
  const { data: attempt } = await sb
    .from("ma_cm_attempts")
    .select("is_correct,finished,solver_score")
    .eq("quiz_id", quizId)
    .eq("user_id", session.id)
    .maybeSingle();
  if (!attempt || !attempt.finished) {
    return NextResponse.json({ error: "아직 결과를 볼 수 없어요." }, { status: 403 });
  }

  const { data: quiz } = await sb
    .from("ma_cm_quizzes")
    .select("word_id")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz) return NextResponse.json({ error: "문제를 찾을 수 없습니다." }, { status: 404 });

  const [wRes, gRes, rRes] = await Promise.all([
    sb.from("ma_cm_words").select("text").eq("id", quiz.word_id).maybeSingle(),
    sb.from("ma_cm_guesses").select("guess").eq("quiz_id", quizId).eq("is_correct", false),
    sb
      .from("ma_cm_ratings")
      .select("stars")
      .eq("quiz_id", quizId)
      .eq("user_id", session.id)
      .maybeSingle(),
  ]);

  // 오답 집계 TOP3.
  const counts = new Map<string, number>();
  for (const g of (gRes.data ?? []) as { guess: string }[]) {
    const key = g.guess.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const wrongTop3 = [...counts.entries()]
    .map(([guess, count]) => ({ guess, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return NextResponse.json({
    word: (wRes.data as { text: string } | null)?.text ?? "",
    correct: attempt.is_correct,
    myScore: attempt.solver_score,
    wrongTop3,
    myStars: (rRes.data as { stars: number } | null)?.stars ?? null,
  });
}
