import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { REPORT_THRESHOLD } from "@/lib/catchmind/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const REASONS = ["lazy", "inappropriate", "answer_leak"];

// 별점(품질 지표) / 신고. 풀이를 끝낸 사람만.
export async function POST(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const quizId = body?.quizId;
  if (typeof quizId !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const sb = createServiceClient();

  // 풀이를 끝낸 사람만 별점/신고 가능.
  const { data: attempt } = await sb
    .from("ma_cm_attempts")
    .select("finished")
    .eq("quiz_id", quizId)
    .eq("user_id", session.id)
    .maybeSingle();
  if (!attempt?.finished) {
    return NextResponse.json({ error: "문제를 풀어야 평가할 수 있어요." }, { status: 403 });
  }

  // ── 별점 (품질 지표, 무보상) ──────────────────────────────────────
  if (action === "rating") {
    const stars = body?.stars;
    if (typeof stars !== "number" || stars < 1 || stars > 5) {
      return NextResponse.json({ error: "별점은 1~5 사이여야 합니다." }, { status: 400 });
    }
    const { error } = await sb
      .from("ma_cm_ratings")
      .upsert(
        { quiz_id: quizId, user_id: session.id, stars: Math.round(stars) },
        { onConflict: "quiz_id,user_id" }
      );
    if (error) {
      console.error("별점 실패", error);
      return NextResponse.json({ error: "평가에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 신고 (1인 1문제 1회, 누적 임계 시 자동 숨김) ───────────────────
  if (action === "report") {
    const reason = body?.reason;
    if (!REASONS.includes(reason)) {
      return NextResponse.json({ error: "신고 사유를 선택하세요." }, { status: 400 });
    }
    const ins = await sb
      .from("ma_cm_reports")
      .insert({ quiz_id: quizId, user_id: session.id, reason });
    if (ins.error) {
      // 이미 신고함(unique) → 조용히 성공 처리(중복 증가 방지).
      if (ins.error.code === "23505") return NextResponse.json({ ok: true, already: true });
      console.error("신고 실패", ins.error);
      return NextResponse.json({ error: "신고에 실패했습니다." }, { status: 500 });
    }

    const { data: quiz } = await sb
      .from("ma_cm_quizzes")
      .select("report_count")
      .eq("id", quizId)
      .maybeSingle();
    const next = (quiz?.report_count ?? 0) + 1;
    await sb
      .from("ma_cm_quizzes")
      .update({ report_count: next, is_hidden: next >= REPORT_THRESHOLD })
      .eq("id", quizId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
}
