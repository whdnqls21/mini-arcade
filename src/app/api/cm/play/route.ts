import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { answerLength, hintForTry, isSoloAccount, drawingUrl } from "@/lib/catchmind/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 맞출 문제 1개 — 본인 출제 아님 + 미완료 + 미숨김/미삭제 중 덜 풀린 문제 우선.
export async function GET() {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const sb = createServiceClient();

  // 내 시도 + 솔로체크를 병렬로.
  const [myRes, solo] = await Promise.all([
    sb.from("ma_cm_attempts").select("quiz_id,tries,finished").eq("user_id", session.id),
    isSoloAccount(sb, session.id),
  ]);
  if (solo) {
    return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  }

  const mine = (myRes.data ?? []) as { quiz_id: string; tries: number; finished: boolean }[];
  const finishedIds = mine.filter((a) => a.finished).map((a) => a.quiz_id);
  const triesByQuiz = new Map(mine.map((a) => [a.quiz_id, a.tries]));

  // 덜 풀린 문제 우선(attempt_count 오름차순) 중 내가 안 끝낸 것 몇 개만 DB에서 뽑는다.
  // (attempts 전량 스캔 제거.) 그중 랜덤 1개로 변별력 확보.
  const candQuery = (withOrder: boolean) => {
    let q = sb
      .from("ma_cm_quizzes")
      .select("id,word_id,image_path")
      .eq("is_hidden", false)
      .eq("is_deleted", false)
      .neq("author_id", session.id);
    if (finishedIds.length > 0) q = q.not("id", "in", `(${finishedIds.join(",")})`);
    if (withOrder) q = q.order("attempt_count", { ascending: true });
    return q.limit(8);
  };

  let cand = await candQuery(true);
  if (cand.error) {
    // attempt_count 컬럼 없음(마이그레이션 전) → 정렬 없이 폴백.
    console.warn("attempt_count 정렬 실패 — 폴백", cand.error.message);
    cand = await candQuery(false);
  }
  const cands = (cand.data ?? []) as { id: string; word_id: number; image_path: string }[];
  if (cands.length === 0) {
    return NextResponse.json({ quiz: null });
  }
  const chosen = cands[Math.floor(Math.random() * cands.length)];

  const { data: word } = await sb
    .from("ma_cm_words")
    .select("text")
    .eq("id", chosen.word_id)
    .maybeSingle();
  if (!word) return NextResponse.json({ quiz: null });

  const imageUrl = drawingUrl(sb, chosen.image_path);
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
