import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession, isAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { PostCategory, PostView } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORIES: PostCategory[] = ["notice", "game", "balance", "bug", "etc"];

interface PostRow {
  id: string;
  account_id: string | null;
  author_name: string;
  category: PostCategory;
  title: string;
  body: string;
  is_notice: boolean;
  pinned: boolean;
  status: PostView["status"];
  created_at: string;
}

// 목록 — 로그인 없이도 볼 수 있게 한다(작성/추천만 로그인 필요).
export async function GET() {
  const sb = createServiceClient();
  const [session, admin, pRes, vRes] = await Promise.all([
    getAccountSession(),
    isAdmin(),
    sb.from("ma_posts").select("*").order("created_at", { ascending: false }),
    sb.from("ma_post_votes").select("post_id,account_id"),
  ]);

  // 테이블이 없으면(마이그레이션 전) 조용히 빈 목록으로 보이지 않게 원인을 알린다.
  if (pRes.error) {
    console.error("게시판 조회 실패", pRes.error);
    return NextResponse.json(
      { error: "게시판을 불러오지 못했습니다. (테이블이 생성됐는지 확인하세요)" },
      { status: 500 }
    );
  }

  const posts = (pRes.data ?? []) as PostRow[];
  const votes = (vRes.data ?? []) as { post_id: string; account_id: string }[];

  const voteCount = new Map<string, number>();
  const myVotes = new Set<string>();
  for (const v of votes) {
    voteCount.set(v.post_id, (voteCount.get(v.post_id) ?? 0) + 1);
    if (session && v.account_id === session.id) myVotes.add(v.post_id);
  }

  const views: PostView[] = posts.map((p) => ({
    id: p.id,
    category: p.category,
    title: p.title,
    body: p.body,
    authorName: p.author_name,
    isNotice: p.is_notice,
    pinned: p.pinned,
    status: p.status,
    votes: voteCount.get(p.id) ?? 0,
    voted: myVotes.has(p.id),
    mine: !!session && p.account_id === session.id,
    createdAt: p.created_at,
  }));

  return NextResponse.json({
    session: session ? { id: session.id, name: session.name } : null,
    isAdmin: admin,
    posts: views,
  });
}

// 작성 — 공지는 관리자만, 나머지는 로그인 사용자.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category = body?.category as PostCategory;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "분류를 확인하세요." }, { status: 400 });
  }
  if (!title || title.length > 40) {
    return NextResponse.json({ error: "제목을 확인하세요 (1~40자)." }, { status: 400 });
  }
  if (!text || text.length > 1000) {
    return NextResponse.json({ error: "내용을 확인하세요 (1~1000자)." }, { status: 400 });
  }

  const sb = createServiceClient();
  const admin = await isAdmin();

  if (category === "notice") {
    // 공지는 관리자만. 작성자는 '운영자', 계정 참조 없음.
    if (!admin) {
      return NextResponse.json({ error: "공지는 관리자만 쓸 수 있습니다." }, { status: 403 });
    }
    const { error } = await sb.from("ma_posts").insert({
      account_id: null,
      author_name: "운영자",
      category,
      title,
      body: text,
      is_notice: true,
    });
    if (error) {
      console.error("공지 작성 실패", error);
      return NextResponse.json({ error: "작성에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 일반 글은 로그인 필요. 이름은 스냅샷으로 저장.
  const session = await getAccountSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { error } = await sb.from("ma_posts").insert({
    account_id: session.id,
    author_name: session.name,
    category,
    title,
    body: text,
  });
  if (error) {
    console.error("게시글 작성 실패", error);
    return NextResponse.json({ error: "작성에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
