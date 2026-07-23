import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 내 캐치마인드 통계 — 총점/눈썰미/손재주 + 맞힌 수/출제 수.
export async function GET() {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const sb = createServiceClient();
  const [pRes, aRes, qRes] = await Promise.all([
    sb.from("ma_cm_point_logs").select("amount,reason").eq("user_id", session.id),
    sb.from("ma_cm_attempts").select("id").eq("user_id", session.id).eq("is_correct", true),
    sb.from("ma_cm_quizzes").select("id").eq("author_id", session.id).eq("is_deleted", false),
  ]);

  let solvePoints = 0;
  let authorPoints = 0;
  for (const p of (pRes.data ?? []) as { amount: number; reason: string }[]) {
    if (p.reason === "solve") solvePoints += p.amount;
    else if (p.reason === "author_solved") authorPoints += p.amount;
  }

  return NextResponse.json({
    total: solvePoints + authorPoints,
    solvePoints,
    authorPoints,
    solvedCount: (aRes.data ?? []).length,
    quizCount: (qRes.data ?? []).length,
  });
}
