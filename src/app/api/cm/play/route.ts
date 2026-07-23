import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { answerLength, hintForTry, isSoloAccount, signDrawing } from "@/lib/catchmind/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 맞출 문제 1개 — 본인 출제 아님 + 미완료 + 미숨김/미삭제 중 덜 풀린 문제 우선.
export async function GET() {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const sb = createServiceClient();
  if (await isSoloAccount(sb, session.id)) {
    return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  }

  const [qRes, myRes, allRes] = await Promise.all([
    sb
      .from("ma_cm_quizzes")
      .select("id,word_id,image_path")
      .eq("is_hidden", false)
      .eq("is_deleted", false)
      .neq("author_id", session.id),
    sb.from("ma_cm_attempts").select("quiz_id,tries,finished").eq("user_id", session.id),
    sb.from("ma_cm_attempts").select("quiz_id"),
  ]);

  const quizzes = qRes.data ?? [];
  const mine = (myRes.data ?? []) as { quiz_id: string; tries: number; finished: boolean }[];
  const finished = new Set(mine.filter((a) => a.finished).map((a) => a.quiz_id));
  const triesByQuiz = new Map(mine.map((a) => [a.quiz_id, a.tries]));

  const attemptCount = new Map<string, number>();
  for (const a of (allRes.data ?? []) as { quiz_id: string }[]) {
    attemptCount.set(a.quiz_id, (attemptCount.get(a.quiz_id) ?? 0) + 1);
  }

  const candidates = quizzes.filter((q) => !finished.has(q.id));
  if (candidates.length === 0) {
    return NextResponse.json({ quiz: null });
  }

  // 덜 풀린 문제 우선 + 랜덤 타이브레이크.
  candidates.sort((a, b) => {
    const ca = attemptCount.get(a.id) ?? 0;
    const cb = attemptCount.get(b.id) ?? 0;
    if (ca !== cb) return ca - cb;
    return Math.random() - 0.5;
  });
  const chosen = candidates[0];

  const { data: word } = await sb
    .from("ma_cm_words")
    .select("text")
    .eq("id", chosen.word_id)
    .maybeSingle();
  if (!word) return NextResponse.json({ quiz: null });

  const imageUrl = await signDrawing(sb, chosen.image_path);
  if (!imageUrl) return NextResponse.json({ error: "그림을 불러오지 못했습니다." }, { status: 500 });

  const tries = triesByQuiz.get(chosen.id) ?? 0;
  return NextResponse.json({
    quiz: {
      quizId: chosen.id,
      imageUrl,
      length: answerLength(word.text),
      tries,
      hint: hintForTry(word.text, tries),
    },
  });
}
