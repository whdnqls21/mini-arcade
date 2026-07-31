import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { isSoloAccount } from "@/lib/title/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 투표 — 사진당 1표. 같은 제목을 다시 누르면 취소, 다른 제목이면 옮긴다.
export async function POST(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const photoId = body?.photoId;
  const titleId = body?.titleId;
  if (typeof photoId !== "string" || typeof titleId !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const sb = createServiceClient();
  const [titleRes, existingRes, solo] = await Promise.all([
    sb.from("ma_tt_titles").select("id,photo_id,author_id").eq("id", titleId).maybeSingle(),
    sb.from("ma_tt_votes").select("title_id").eq("photo_id", photoId).eq("voter_id", session.id).maybeSingle(),
    isSoloAccount(sb, session.id),
  ]);
  if (solo) return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });

  const title = titleRes.data as { id: string; photo_id: string; author_id: string } | null;
  if (!title || title.photo_id !== photoId) {
    return NextResponse.json({ error: "제목을 찾을 수 없어요." }, { status: 404 });
  }
  if (title.author_id === session.id) {
    return NextResponse.json({ error: "내 제목에는 투표할 수 없어요." }, { status: 403 });
  }

  // 같은 제목에 이미 투표했으면 → 취소.
  if (existingRes.data?.title_id === titleId) {
    await sb.from("ma_tt_votes").delete().eq("photo_id", photoId).eq("voter_id", session.id);
    return NextResponse.json({ ok: true, voted: false });
  }

  // 새로 투표하거나 다른 제목으로 옮김(upsert — 사진당 1표 유지).
  const { error } = await sb
    .from("ma_tt_votes")
    .upsert(
      { photo_id: photoId, voter_id: session.id, title_id: titleId },
      { onConflict: "photo_id,voter_id" }
    );
  if (error) {
    console.error("투표 실패", error);
    return NextResponse.json({ error: "투표에 실패했어요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, voted: true });
}
