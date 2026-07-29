import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 하단 탭의 '안 읽은 글' 점 표시용 — 가장 최근 게시글 시각만 가볍게 돌려준다.
// 읽음 판정(마지막으로 본 시각)은 클라이언트 localStorage 에서 하므로 여기선 최신 시각과 보는 사람 id 만.
export async function GET() {
  const session = await getAccountSession();
  const sb = createServiceClient();
  const { data } = await sb
    .from("ma_posts")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({
    latestAt: (data as { created_at: string } | null)?.created_at ?? null,
    viewerId: session?.id ?? null,
  });
}
