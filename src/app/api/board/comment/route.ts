import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession, isAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BODY_MAX = 500;

// 게시글 댓글 — 작성/삭제.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const sb = createServiceClient();

  // ── 작성 (로그인 사용자) ──────────────────────────────────────────
  if (action === "add") {
    const session = await getAccountSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const postId = body?.postId;
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (typeof postId !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    if (!text || text.length > BODY_MAX) {
      return NextResponse.json({ error: `댓글을 확인하세요 (1~${BODY_MAX}자).` }, { status: 400 });
    }

    // 글이 있는지 확인(삭제된 글에 다는 것 방지).
    const { data: post } = await sb.from("ma_posts").select("id").eq("id", postId).maybeSingle();
    if (!post) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

    const { error } = await sb.from("ma_post_comments").insert({
      post_id: postId,
      account_id: session.id,
      author_name: session.name, // 이름 스냅샷
      body: text,
    });
    if (error) {
      console.error("댓글 작성 실패", error);
      return NextResponse.json({ error: "댓글 작성에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 삭제 (본인 댓글 또는 관리자) ──────────────────────────────────
  if (action === "delete") {
    const commentId = body?.commentId;
    if (typeof commentId !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const [session, admin] = await Promise.all([getAccountSession(), isAdmin()]);
    const { data: comment } = await sb
      .from("ma_post_comments")
      .select("account_id")
      .eq("id", commentId)
      .maybeSingle();
    if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });

    const mine = session && comment.account_id === session.id;
    if (!admin && !mine) {
      return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
    }
    const { error } = await sb.from("ma_post_comments").delete().eq("id", commentId);
    if (error) {
      console.error("댓글 삭제 실패", error);
      return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
}
