import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession, isAdmin } from "@/lib/auth";
import { COMMENT_MAX, isSoloAccount } from "@/lib/title/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 사진 댓글 — 작성 / 삭제 / 좋아요. (캐치마인드 댓글과 동일 구조)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const sb = createServiceClient();

  // ── 작성 ──────────────────────────────────────────────────────────
  if (action === "add") {
    const session = await getAccountSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const photoId = body?.photoId;
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (typeof photoId !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    if (!text || text.length > COMMENT_MAX) {
      return NextResponse.json({ error: `댓글을 확인하세요 (1~${COMMENT_MAX}자).` }, { status: 400 });
    }
    const [photoRes, solo] = await Promise.all([
      sb.from("ma_tt_photos").select("id").eq("id", photoId).eq("is_deleted", false).maybeSingle(),
      isSoloAccount(sb, session.id),
    ]);
    if (solo) return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
    if (!photoRes.data) return NextResponse.json({ error: "사진을 찾을 수 없어요." }, { status: 404 });

    const { error } = await sb.from("ma_tt_comments").insert({
      photo_id: photoId,
      account_id: session.id,
      author_name: session.name,
      body: text,
    });
    if (error) {
      console.error("사진 댓글 작성 실패", error);
      return NextResponse.json({ error: "댓글 작성에 실패했어요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 좋아요 토글 ───────────────────────────────────────────────────
  if (action === "vote") {
    const session = await getAccountSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const commentId = body?.commentId;
    if (typeof commentId !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const { data: existing } = await sb
      .from("ma_tt_comment_votes")
      .select("comment_id")
      .eq("comment_id", commentId)
      .eq("account_id", session.id)
      .maybeSingle();
    if (existing) {
      await sb.from("ma_tt_comment_votes").delete().eq("comment_id", commentId).eq("account_id", session.id);
      return NextResponse.json({ ok: true, liked: false });
    }
    const { error } = await sb
      .from("ma_tt_comment_votes")
      .insert({ comment_id: commentId, account_id: session.id });
    if (error && error.code !== "23505") {
      console.error("사진 댓글 좋아요 실패", error);
      return NextResponse.json({ error: "좋아요에 실패했어요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, liked: true });
  }

  // ── 삭제 (본인 댓글 또는 관리자) ──────────────────────────────────
  if (action === "delete") {
    const commentId = body?.commentId;
    if (typeof commentId !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const [session, admin] = await Promise.all([getAccountSession(), isAdmin()]);
    const { data: comment } = await sb
      .from("ma_tt_comments")
      .select("account_id")
      .eq("id", commentId)
      .maybeSingle();
    if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없어요." }, { status: 404 });
    const owner = session && comment.account_id === session.id;
    if (!admin && !owner) return NextResponse.json({ error: "삭제 권한이 없어요." }, { status: 403 });
    const { error } = await sb.from("ma_tt_comments").delete().eq("id", commentId);
    if (error) {
      console.error("사진 댓글 삭제 실패", error);
      return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
}
