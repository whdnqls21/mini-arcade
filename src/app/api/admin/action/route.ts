import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const sb = createServiceClient();

  // 계정 활성/비활성
  if (action === "accountActive") {
    const accountId = body?.accountId;
    const active = body?.active;
    if (typeof accountId !== "string" || typeof active !== "boolean") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const { error } = await sb.from("ma_accounts").update({ active }).eq("id", accountId);
    if (error) {
      console.error("accountActive 실패", error);
      return NextResponse.json({ error: "변경에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 계정 삭제 (기록도 함께 삭제 — FK cascade)
  if (action === "accountDelete") {
    const accountId = body?.accountId;
    if (typeof accountId !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const { error } = await sb.from("ma_accounts").delete().eq("id", accountId);
    if (error) {
      console.error("accountDelete 실패", error);
      return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 게임 노출 on/off
  if (action === "gameActive") {
    const slug = body?.slug;
    const active = body?.active;
    if (typeof slug !== "string" || typeof active !== "boolean") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const { error } = await sb.from("ma_games").update({ active }).eq("slug", slug);
    if (error) {
      console.error("gameActive 실패", error);
      return NextResponse.json({ error: "변경에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
}
