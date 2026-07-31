import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { REPORT_THRESHOLD } from "@/lib/title/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const REASONS = ["inappropriate", "privacy", "spam"];

// 사진 신고 — 1인 1사진 1회, 누적 임계 시 자동 숨김(soft).
export async function POST(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const photoId = body?.photoId;
  const reason = body?.reason;
  if (typeof photoId !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!REASONS.includes(reason)) {
    return NextResponse.json({ error: "신고 사유를 선택하세요." }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: photo } = await sb
    .from("ma_tt_photos")
    .select("author_id,report_count")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return NextResponse.json({ error: "사진을 찾을 수 없어요." }, { status: 404 });
  if (photo.author_id === session.id) {
    return NextResponse.json({ error: "내 사진은 신고할 수 없어요." }, { status: 403 });
  }

  const ins = await sb.from("ma_tt_reports").insert({ photo_id: photoId, user_id: session.id, reason });
  if (ins.error) {
    if (ins.error.code === "23505") return NextResponse.json({ ok: true, already: true });
    console.error("사진 신고 실패", ins.error);
    return NextResponse.json({ error: "신고에 실패했어요." }, { status: 500 });
  }

  const next = (photo.report_count ?? 0) + 1;
  await sb
    .from("ma_tt_photos")
    .update({ report_count: next, is_hidden: next >= REPORT_THRESHOLD })
    .eq("id", photoId);
  return NextResponse.json({ ok: true });
}
