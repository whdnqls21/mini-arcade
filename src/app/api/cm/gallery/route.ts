import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { isSoloAccount, signDrawing } from "@/lib/catchmind/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 갤러리 목록 — 내가 끝낸 문제(맞힘/실패) + 내가 출제한 문제.
export async function GET() {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const sb = createServiceClient();
  if (await isSoloAccount(sb, session.id)) {
    return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  }

  const [atRes, mineRes] = await Promise.all([
    sb.from("ma_cm_attempts").select("quiz_id,is_correct").eq("user_id", session.id).eq("finished", true),
    sb
      .from("ma_cm_quizzes")
      .select("id,word_id,image_path,created_at")
      .eq("author_id", session.id)
      .eq("is_deleted", false),
  ]);

  const attempts = (atRes.data ?? []) as { quiz_id: string; is_correct: boolean }[];
  const correctById = new Map(attempts.map((a) => [a.quiz_id, a.is_correct]));
  const attemptIds = attempts.map((a) => a.quiz_id);

  type Row = { id: string; word_id: number; image_path: string; created_at: string };
  const byId = new Map<string, Row & { kind: "mine" | "solved" | "failed" }>();

  for (const q of (mineRes.data ?? []) as Row[]) byId.set(q.id, { ...q, kind: "mine" });

  if (attemptIds.length > 0) {
    const { data } = await sb
      .from("ma_cm_quizzes")
      .select("id,word_id,image_path,created_at")
      .in("id", attemptIds)
      .eq("is_deleted", false);
    for (const q of (data ?? []) as Row[]) {
      if (byId.has(q.id)) continue; // 내 문제는 이미 mine 으로
      byId.set(q.id, { ...q, kind: correctById.get(q.id) ? "solved" : "failed" });
    }
  }

  const rows = [...byId.values()].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
  );

  const wordIds = [...new Set(rows.map((r) => r.word_id))];
  const wRes = wordIds.length
    ? await sb.from("ma_cm_words").select("id,text").in("id", wordIds)
    : { data: [] };
  const wordById = new Map(((wRes.data ?? []) as { id: number; text: string }[]).map((w) => [w.id, w.text]));

  const items = await Promise.all(
    rows.map(async (r) => ({
      quizId: r.id,
      imageUrl: await signDrawing(sb, r.image_path),
      word: wordById.get(r.word_id) ?? "",
      kind: r.kind,
    }))
  );

  return NextResponse.json({ items });
}
