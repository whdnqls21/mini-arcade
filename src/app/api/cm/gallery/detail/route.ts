import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { isSoloAccount, signDrawing } from "@/lib/catchmind/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 갤러리 상세 — 그림/출제자/별점 요약/오답 TOP3/댓글. 내 문제이거나 끝낸 문제만 볼 수 있다.
export async function GET(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const quizId = req.nextUrl.searchParams.get("quizId");
  if (!quizId) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const sb = createServiceClient();
  if (await isSoloAccount(sb, session.id)) {
    return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  }

  const { data: quiz } = await sb
    .from("ma_cm_quizzes")
    .select("author_id,word_id,image_path,is_deleted")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz || quiz.is_deleted) {
    return NextResponse.json({ error: "문제를 찾을 수 없습니다." }, { status: 404 });
  }

  const mine = quiz.author_id === session.id;
  const { data: myAttempt } = await sb
    .from("ma_cm_attempts")
    .select("is_correct,finished")
    .eq("quiz_id", quizId)
    .eq("user_id", session.id)
    .maybeSingle();
  const finished = !!myAttempt?.finished;
  if (!mine && !finished) {
    return NextResponse.json({ error: "아직 볼 수 없는 문제예요." }, { status: 403 });
  }
  const kind = mine ? "mine" : myAttempt?.is_correct ? "solved" : "failed";

  const [wRes, aRes, rRes, myRRes, gRes, cRes] = await Promise.all([
    sb.from("ma_cm_words").select("text").eq("id", quiz.word_id).maybeSingle(),
    sb.from("ma_accounts").select("name").eq("id", quiz.author_id).maybeSingle(),
    sb.from("ma_cm_ratings").select("stars").eq("quiz_id", quizId),
    sb
      .from("ma_cm_ratings")
      .select("stars")
      .eq("quiz_id", quizId)
      .eq("user_id", session.id)
      .maybeSingle(),
    sb.from("ma_cm_guesses").select("guess").eq("quiz_id", quizId).eq("is_correct", false),
    sb.from("ma_cm_comments").select("*").eq("quiz_id", quizId).order("created_at", { ascending: true }),
  ]);

  // 별점 요약
  const dist = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const r of (rRes.data ?? []) as { stars: number }[]) {
    if (r.stars >= 1 && r.stars <= 5) {
      dist[r.stars - 1]++;
      sum += r.stars;
    }
  }
  const count = (rRes.data ?? []).length;
  const avg = count ? sum / count : 0;
  const myStars = (myRRes.data as { stars: number } | null)?.stars ?? null;

  // 오답 TOP3
  const wrongCount = new Map<string, number>();
  for (const g of (gRes.data ?? []) as { guess: string }[]) {
    const key = g.guess.trim();
    if (!key) continue;
    wrongCount.set(key, (wrongCount.get(key) ?? 0) + 1);
  }
  const wrongTop3 = [...wrongCount.entries()]
    .map(([guess, c]) => ({ guess, count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // 댓글 + 좋아요
  const comments = (cRes.data ?? []) as {
    id: string;
    account_id: string | null;
    author_name: string;
    body: string;
    created_at: string;
  }[];
  const commentIds = comments.map((c) => c.id);
  let votes: { comment_id: string; account_id: string }[] = [];
  if (commentIds.length > 0) {
    const { data } = await sb
      .from("ma_cm_comment_votes")
      .select("comment_id,account_id")
      .in("comment_id", commentIds);
    votes = (data ?? []) as { comment_id: string; account_id: string }[];
  }
  const likeCount = new Map<string, number>();
  const myLikes = new Set<string>();
  for (const v of votes) {
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

  return NextResponse.json({
    quizId,
    imageUrl: await signDrawing(sb, quiz.image_path),
    word: (wRes.data as { text: string } | null)?.text ?? "",
    authorName: (aRes.data as { name: string } | null)?.name ?? "(탈퇴)",
    kind,
    rating: { avg, count, dist },
    myStars,
    canRate: finished && !mine && myStars == null,
    wrongTop3,
    comments: commentViews,
  });
}
