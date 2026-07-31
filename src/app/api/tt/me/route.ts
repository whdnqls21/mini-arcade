import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { isSoloAccount } from "@/lib/title/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 제목 학원 홈 통계 — 갤러리 전체 사진 수 + 내 참여(사진/제목/받은 표).
export async function GET() {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const sb = createServiceClient();
  if (await isSoloAccount(sb, session.id)) {
    return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  }

  const head = { count: "exact" as const, head: true };
  const [galleryRes, photoRes, titleRes] = await Promise.all([
    sb.from("ma_tt_photos").select("id", head).eq("is_hidden", false).eq("is_deleted", false),
    sb.from("ma_tt_photos").select("id", head).eq("author_id", session.id).eq("is_deleted", false),
    sb.from("ma_tt_titles").select("id").eq("author_id", session.id),
  ]);
  const titleIds = ((titleRes.data ?? []) as { id: string }[]).map((r) => r.id);
  const votesRes = titleIds.length
    ? await sb.from("ma_tt_votes").select("photo_id", head).in("title_id", titleIds)
    : { count: 0 };

  return NextResponse.json({
    galleryCount: galleryRes.count ?? 0,
    photoCount: photoRes.count ?? 0,
    titleCount: titleIds.length,
    votesReceived: votesRes.count ?? 0,
  });
}
