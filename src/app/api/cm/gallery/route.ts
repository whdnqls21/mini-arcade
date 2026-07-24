import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { isSoloAccount, drawingUrl } from "@/lib/catchmind/server";
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

  const quizIds = rows.map((r) => r.id);
  const wordIds = [...new Set(rows.map((r) => r.word_id))];
  const [wRes, cRes] = await Promise.all([
    wordIds.length ? sb.from("ma_cm_words").select("id,text").in("id", wordIds) : Promise.resolve({ data: [] }),
    // 문제별 댓글 수 (테이블 없으면 조용히 0)
    quizIds.length ? sb.from("ma_cm_comments").select("quiz_id").in("quiz_id", quizIds) : Promise.resolve({ data: [] }),
  ]);
  const wordById = new Map(((wRes.data ?? []) as { id: number; text: string }[]).map((w) => [w.id, w.text]));
  const commentCount = new Map<string, number>();
  for (const c of (cRes.data ?? []) as { quiz_id: string }[]) {
    commentCount.set(c.quiz_id, (commentCount.get(c.quiz_id) ?? 0) + 1);
  }

  const items = await Promise.all(
    rows.map(async (r) => ({
      quizId: r.id,
      imageUrl: drawingUrl(sb, r.image_path),
      word: wordById.get(r.word_id) ?? "",
      kind: r.kind,
      commentCount: commentCount.get(r.id) ?? 0,
    }))
  );

  return NextResponse.json({ items });
}
