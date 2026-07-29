import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { drawingUrl } from "@/lib/catchmind/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 결과 화면 — 풀이를 끝낸 사람만. 정답 + 오답 TOP3 + 내 점수/별점.
export async function GET(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const quizId = req.nextUrl.searchParams.get("quizId");
  if (!quizId) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const sb = createServiceClient();
  const { data: attempt } = await sb
    .from("ma_cm_attempts")
    .select("is_correct,finished,solver_score")
    .eq("quiz_id", quizId)
    .eq("user_id", session.id)
    .maybeSingle();
  if (!attempt || !attempt.finished) {
    return NextResponse.json({ error: "아직 결과를 볼 수 없어요." }, { status: 403 });
  }

  const { data: quiz } = await sb
    .from("ma_cm_quizzes")
    .select("word_id,image_path,author_id")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz) return NextResponse.json({ error: "문제를 찾을 수 없습니다." }, { status: 404 });

  const [wRes, gRes, rRes, authorRes, cRes] = await Promise.all([
    sb.from("ma_cm_words").select("text").eq("id", quiz.word_id).maybeSingle(),
    sb.from("ma_cm_guesses").select("guess").eq("quiz_id", quizId).eq("is_correct", false),
    sb
      .from("ma_cm_ratings")
      .select("stars")
      .eq("quiz_id", quizId)
      .eq("user_id", session.id)
      .maybeSingle(),
    sb.from("ma_accounts").select("name").eq("id", quiz.author_id).maybeSingle(),
    sb.from("ma_cm_comments").select("*").eq("quiz_id", quizId).order("created_at", { ascending: true }),
  ]);

  // 댓글 + 좋아요 집계(테이블 없으면 조용히 빈 목록).
  const comments = (cRes.data ?? []) as {
    id: string;
    account_id: string;
    author_name: string;
    body: string;
    created_at: string;
  }[];
  const commentIds = comments.map((c) => c.id);
  let cVotes: { comment_id: string; account_id: string }[] = [];
  if (commentIds.length > 0) {
    const { data } = await sb
      .from("ma_cm_comment_votes")
      .select("comment_id,account_id")
      .in("comment_id", commentIds);
    cVotes = (data ?? []) as { comment_id: string; account_id: string }[];
  }
  const likeCount = new Map<string, number>();
  const myLikes = new Set<string>();
  for (const v of cVotes) {
    likeCount.set(v.comment_id, (likeCount.get(v.comment_id) ?? 0) + 1);
    if (v.account_id === session.id) myLikes.add(v.comment_id);
  }
  const commentViews = comments.map((c) => ({
    id: c.id,
    authorName: c.author_name,
    body: c.body,
    mine: c.account_id === session.id,
    likes: likeCount.get(c.id) ?? 0,
    liked: myLikes.has(c.id),
    createdAt: c.created_at,
  }));

  // 오답 집계 TOP3.
  const counts = new Map<string, number>();
  for (const g of (gRes.data ?? []) as { guess: string }[]) {
    const key = g.guess.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const wrongTop3 = [...counts.entries()]
    .map(([guess, count]) => ({ guess, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return NextResponse.json({
    word: (wRes.data as { text: string } | null)?.text ?? "",
    correct: attempt.is_correct,
    myScore: attempt.solver_score,
    authorName: (authorRes.data as { name: string } | null)?.name ?? "(탈퇴)",
    imageUrl: drawingUrl(sb, quiz.image_path),
    wrongTop3,
    myStars: (rRes.data as { stars: number } | null)?.stars ?? null,
    canRate: quiz.author_id !== session.id, // 내 문제엔 별점 불가
    comments: commentViews,
  });
}
