import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 게임 한 판 기록 저장.
export async function POST(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const gameSlug = body?.gameSlug;
  const score = body?.score;
  const meta = body?.meta && typeof body.meta === "object" ? body.meta : null;

  if (typeof gameSlug !== "string") {
    return NextResponse.json({ error: "게임을 확인하세요." }, { status: 400 });
  }
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1e12) {
    return NextResponse.json({ error: "점수가 올바르지 않습니다." }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: game } = await sb
    .from("ma_games")
    .select("slug,active")
    .eq("slug", gameSlug)
    .maybeSingle();
  if (!game || !game.active) {
    return NextResponse.json({ error: "진행 중인 게임이 아닙니다." }, { status: 400 });
  }

  // 기록 시점의 솔로모드 여부를 서버가 판단해 meta 에 새긴다(내정보에서 솔로 기록만 골라 보이려고).
  const { data: acct } = await sb
    .from("ma_accounts")
    .select("solo")
    .eq("id", session.id)
    .maybeSingle();
  const finalMeta = { ...(meta ?? {}), solo: !!acct?.solo };

  const { error } = await sb.from("ma_scores").insert({
    account_id: session.id,
    game_slug: gameSlug,
    score: Math.round(score),
    meta: finalMeta,
  });
  if (error) {
    console.error("record 실패", error);
    return NextResponse.json({ error: "기록 저장에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
