import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession, isAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { PostStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: PostStatus[] = ["reviewing", "planned", "done", "declined"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const postId = body?.postId;
  if (typeof postId !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const sb = createServiceClient();

  // ── 추천 토글 (로그인 사용자) ─────────────────────────────────────
  if (action === "vote") {
    const session = await getAccountSession();
    if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const { data: existing } = await sb
      .from("ma_post_votes")
      .select("post_id")
      .eq("post_id", postId)
      .eq("account_id", session.id)
      .maybeSingle();

    if (existing) {
      await sb.from("ma_post_votes").delete().eq("post_id", postId).eq("account_id", session.id);
      return NextResponse.json({ ok: true, voted: false });
    }
    const { error } = await sb
      .from("ma_post_votes")
      .insert({ post_id: postId, account_id: session.id });
    // 동시 클릭 등으로 이미 있으면(unique 위반) 추천된 상태로 본다.
    if (error && error.code !== "23505") {
      console.error("추천 실패", error);
      return NextResponse.json({ error: "추천에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, voted: true });
  }

  // ── 삭제 (본인 글 또는 관리자) ────────────────────────────────────
  if (action === "delete") {
    const [session, admin] = await Promise.all([getAccountSession(), isAdmin()]);
    const { data: post } = await sb
      .from("ma_posts")
      .select("account_id")
      .eq("id", postId)
      .maybeSingle();
    if (!post) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

    const mine = session && post.account_id === session.id;
    if (!admin && !mine) {
      return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
    }
    const { error } = await sb.from("ma_posts").delete().eq("id", postId);
    if (error) {
      console.error("게시글 삭제 실패", error);
      return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 상태 라벨 (관리자) ────────────────────────────────────────────
  if (action === "setStatus") {
    if (!(await isAdmin())) return NextResponse.json({ error: "관리자만 가능합니다." }, { status: 403 });
    const status = body?.status;
    if (status !== null && !STATUSES.includes(status)) {
      return NextResponse.json({ error: "상태 값이 올바르지 않습니다." }, { status: 400 });
    }
    const { error } = await sb.from("ma_posts").update({ status }).eq("id", postId);
    if (error) {
      console.error("상태 변경 실패", error);
      return NextResponse.json({ error: "변경에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 고정 토글 (관리자) ────────────────────────────────────────────
  if (action === "pin") {
    if (!(await isAdmin())) return NextResponse.json({ error: "관리자만 가능합니다." }, { status: 403 });
    const pinned = body?.pinned;
    if (typeof pinned !== "boolean") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const { error } = await sb.from("ma_posts").update({ pinned }).eq("id", postId);
    if (error) {
      console.error("고정 변경 실패", error);
      return NextResponse.json({ error: "변경에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
}
