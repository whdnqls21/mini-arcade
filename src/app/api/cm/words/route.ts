import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { isSoloAccount } from "@/lib/catchmind/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 제시어 3개 랜덤 (출제자 본인이 그릴 것이라 원문을 준다).
export async function GET() {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const sb = createServiceClient();
  if (await isSoloAccount(sb, session.id)) {
    return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  }

  const { data } = await sb.from("ma_cm_words").select("id,text").eq("is_active", true);
  const words = data ?? [];
  // 작은 사전이라 전부 받아 JS 에서 섞어 3개.
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return NextResponse.json({ words: words.slice(0, 3) });
}
