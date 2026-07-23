import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 내 캐치마인드 통계 — 총점/눈썰미/손재주 + 맞힌 수/출제 수.
export async function GET() {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const sb = createServiceClient();
  const [pRes, atRes, qMineRes, candRes] = await Promise.all([
    sb.from("ma_cm_point_logs").select("amount,reason").eq("user_id", session.id),
    sb.from("ma_cm_attempts").select("quiz_id,is_correct,finished").eq("user_id", session.id),
    sb.from("ma_cm_quizzes").select("id").eq("author_id", session.id).eq("is_deleted", false),
    // 맞출 수 있는 문제(본인 출제 아님 + 미숨김/미삭제)
    sb
      .from("ma_cm_quizzes")
      .select("id")
      .neq("author_id", session.id)
      .eq("is_hidden", false)
      .eq("is_deleted", false),
  ]);

  let solvePoints = 0;
  let authorPoints = 0;
  for (const p of (pRes.data ?? []) as { amount: number; reason: string }[]) {
    if (p.reason === "solve") solvePoints += p.amount;
    else if (p.reason === "author_solved") authorPoints += p.amount;
  }

  const attempts = (atRes.data ?? []) as { quiz_id: string; is_correct: boolean; finished: boolean }[];
  const solvedCount = attempts.filter((a) => a.is_correct).length;
  const finishedIds = new Set(attempts.filter((a) => a.finished).map((a) => a.quiz_id));
  const candidates = (candRes.data ?? []) as { id: string }[];
  const unsolvedCount = candidates.filter((c) => !finishedIds.has(c.id)).length;

  return NextResponse.json({
    total: solvePoints + authorPoints,
    solvePoints,
    authorPoints,
    solvedCount,
    quizCount: (qMineRes.data ?? []).length,
    unsolvedCount,
  });
}
