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

  // 어뷰징 방지: 사람이 낼 수 없는 기록은 거부한다(제출 시 검사라 '새 게임' 재시작으로도 못 지나친다).
  // 그린라이트(5라운드 반응 합산, time): 반응 하한 100ms×5=500ms 가 이론상 최소지만,
  // 5판 연속 그렇게 반응하는 건 불가능 → 700ms(라운드당 0.14초) 미만은 예측/연타로 보고 거부.
  const MIN_TOTAL: Record<string, number> = { greenlight: 700 };
  const floor = MIN_TOTAL[gameSlug];
  if (floor != null && score < floor) {
    return NextResponse.json(
      { error: "기록이 사람이 낼 수 없을 만큼 빨라 인정되지 않았어요." },
      { status: 400 }
    );
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
