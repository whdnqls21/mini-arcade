import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { TITLE_MAX, isSoloAccount } from "@/lib/title/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 제목 제출/수정 — 사진당 1인 1개(upsert). 빈 제목이면 삭제(달았다가 지우기).
export async function POST(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const photoId = body?.photoId;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (typeof photoId !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (text.length > TITLE_MAX) {
    return NextResponse.json({ error: `제목은 ${TITLE_MAX}자까지예요.` }, { status: 400 });
  }

  const sb = createServiceClient();
  const [photoRes, solo] = await Promise.all([
    sb.from("ma_tt_photos").select("id").eq("id", photoId).eq("is_hidden", false).eq("is_deleted", false).maybeSingle(),
    isSoloAccount(sb, session.id),
  ]);
  if (solo) return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  if (!photoRes.data) return NextResponse.json({ error: "사진을 찾을 수 없어요." }, { status: 404 });

  // 빈 제목 = 내 제목 삭제(투표는 title FK cascade 로 함께 정리됨).
  if (!text) {
    const { error } = await sb
      .from("ma_tt_titles")
      .delete()
      .eq("photo_id", photoId)
      .eq("author_id", session.id);
    if (error) {
      console.error("제목 삭제 실패", error);
      return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, removed: true });
  }

  const { error } = await sb.from("ma_tt_titles").upsert(
    { photo_id: photoId, author_id: session.id, author_name: session.name, body: text },
    { onConflict: "photo_id,author_id" }
  );
  if (error) {
    console.error("제목 제출 실패", error);
    return NextResponse.json({ error: "제목 등록에 실패했어요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
