import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession, isAdmin } from "@/lib/auth";
import { TT_BUCKET, decodeDataUrl, isSoloAccount, photoUrl, uploadPhoto } from "@/lib/title/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { TtComment, TtPhoto, TtTitle } from "@/games/title/types";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 1400 * 1024; // 실사진: 리사이즈(긴 변 ~1280)+webp 압축 후 넉넉히
const GALLERY_LIMIT = 200;

// ── 사진 업로드 ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const image = body?.image;
  if (typeof image !== "string") {
    return NextResponse.json({ error: "사진을 확인하세요." }, { status: 400 });
  }

  const decoded = decodeDataUrl(image);
  if (!decoded) {
    // 서버 방어선 — 클라에서 이미 포맷을 걸러 webp/jpeg 로 보내지만 한 번 더.
    return NextResponse.json(
      { error: "JPEG·PNG·WEBP 사진만 올릴 수 있어요." },
      { status: 400 }
    );
  }
  if (decoded.buffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "사진 용량이 너무 커요. 다른 사진을 시도해 주세요." }, { status: 400 });
  }

  const sb = createServiceClient();
  if (await isSoloAccount(sb, session.id)) {
    return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  }

  const ext = decoded.contentType === "image/jpeg" ? "jpg" : decoded.contentType.split("/")[1] ?? "webp";
  const path = `${session.id}/${crypto.randomUUID()}.${ext}`;
  const up = await uploadPhoto(sb, path, decoded.buffer, decoded.contentType);
  if (up.error) {
    console.error("사진 업로드 실패", up.error);
    return NextResponse.json(
      { error: "사진 업로드에 실패했어요. Storage 버킷(title-photos) 설정을 확인하세요." },
      { status: 500 }
    );
  }

  const { error } = await sb.from("ma_tt_photos").insert({ author_id: session.id, image_path: path });
  if (error) {
    console.error("사진 등록 실패", error);
    return NextResponse.json({ error: "사진 등록에 실패했어요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// ── 사진 삭제 (본인 또는 관리자) ─────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const photoId = new URL(req.url).searchParams.get("photoId");
  if (!photoId) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const sb = createServiceClient();
  const [session, admin] = await Promise.all([getAccountSession(), isAdmin()]);
  if (!session && !admin) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: photo } = await sb
    .from("ma_tt_photos")
    .select("author_id,image_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return NextResponse.json({ error: "사진을 찾을 수 없어요." }, { status: 404 });
  const owner = session && photo.author_id === session.id;
  if (!admin && !owner) return NextResponse.json({ error: "삭제 권한이 없어요." }, { status: 403 });

  if (photo.image_path) {
    const { error: rmErr } = await sb.storage.from(TT_BUCKET).remove([photo.image_path]);
    if (rmErr) console.error("사진 파일 제거 실패", rmErr); // 파일 제거 실패해도 삭제 처리는 진행
  }
  const { error } = await sb
    .from("ma_tt_photos")
    .update({ is_deleted: true, is_hidden: true })
    .eq("id", photoId);
  if (error) {
    console.error("사진 삭제 실패", error);
    return NextResponse.json({ error: "삭제에 실패했어요." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// ── 갤러리 (모든 공개 사진 + 제목·투표·댓글수) ──────────────────────────
export async function GET() {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const sb = createServiceClient();
  if (await isSoloAccount(sb, session.id)) {
    return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  }

  const { data: photoRows } = await sb
    .from("ma_tt_photos")
    .select("id,author_id,image_path,created_at")
    .eq("is_hidden", false)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(GALLERY_LIMIT);
  const photos = (photoRows ?? []) as {
    id: string;
    author_id: string;
    image_path: string;
    created_at: string;
  }[];
  if (photos.length === 0) return NextResponse.json({ items: [] });

  const ids = photos.map((p) => p.id);
  const [tRes, vRes, cRes, rRes, aRes] = await Promise.all([
    sb.from("ma_tt_titles").select("id,photo_id,author_id,author_name,body,created_at").in("photo_id", ids),
    sb.from("ma_tt_votes").select("photo_id,voter_id,title_id").in("photo_id", ids),
    sb
      .from("ma_tt_comments")
      .select("id,photo_id,account_id,author_name,body,created_at")
      .in("photo_id", ids)
      .order("created_at", { ascending: true }),
    sb.from("ma_tt_reports").select("photo_id").in("photo_id", ids).eq("user_id", session.id),
    sb.from("ma_accounts").select("id,name"),
  ]);

  const titleRows = (tRes.data ?? []) as {
    id: string;
    photo_id: string;
    author_id: string;
    author_name: string;
    body: string;
    created_at: string;
  }[];
  const voteRows = (vRes.data ?? []) as { photo_id: string; voter_id: string; title_id: string }[];
  const nameById = new Map(((aRes.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));

  // 제목별 득표 수 + 내가 어느 제목에 투표했는지.
  const votesByTitle = new Map<string, number>();
  const myVoteByPhoto = new Map<string, string>();
  for (const v of voteRows) {
    votesByTitle.set(v.title_id, (votesByTitle.get(v.title_id) ?? 0) + 1);
    if (v.voter_id === session.id) myVoteByPhoto.set(v.photo_id, v.title_id);
  }

  const titlesByPhoto = new Map<string, typeof titleRows>();
  for (const t of titleRows) {
    const arr = titlesByPhoto.get(t.photo_id) ?? [];
    arr.push(t);
    titlesByPhoto.set(t.photo_id, arr);
  }

  const commentRows = (cRes.data ?? []) as {
    id: string;
    photo_id: string;
    account_id: string | null;
    author_name: string;
    body: string;
    created_at: string;
  }[];
  // 댓글 좋아요 집계 + 내가 누른 것.
  const commentIds = commentRows.map((c) => c.id);
  const { data: clv } = commentIds.length
    ? await sb.from("ma_tt_comment_votes").select("comment_id,account_id").in("comment_id", commentIds)
    : { data: [] as { comment_id: string; account_id: string }[] };
  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const l of (clv ?? []) as { comment_id: string; account_id: string }[]) {
    likeCount.set(l.comment_id, (likeCount.get(l.comment_id) ?? 0) + 1);
    if (l.account_id === session.id) likedByMe.add(l.comment_id);
  }
  const commentsByPhoto = new Map<string, TtComment[]>();
  for (const c of commentRows) {
    const arr = commentsByPhoto.get(c.photo_id) ?? [];
    arr.push({
      id: c.id,
      authorName: c.account_id ? nameById.get(c.account_id) ?? c.author_name : c.author_name,
      body: c.body,
      mine: c.account_id === session.id,
      likes: likeCount.get(c.id) ?? 0,
      liked: likedByMe.has(c.id),
      createdAt: c.created_at,
    });
    commentsByPhoto.set(c.photo_id, arr);
  }
  const reportedSet = new Set(((rRes.data ?? []) as { photo_id: string }[]).map((r) => r.photo_id));

  const items: TtPhoto[] = photos.map((p) => {
    const myVoteTitleId = myVoteByPhoto.get(p.id) ?? null;
    const raw = titlesByPhoto.get(p.id) ?? [];
    const titles: TtTitle[] = raw
      .map((t) => ({ t, votes: votesByTitle.get(t.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes || +new Date(a.t.created_at) - +new Date(b.t.created_at))
      .map(({ t, votes }) => ({
        id: t.id,
        body: t.body,
        // 닉 변경 반영: 최신 이름이 있으면 그걸, 없으면(탈퇴) 스냅샷.
        authorName: nameById.get(t.author_id) ?? t.author_name,
        mine: t.author_id === session.id,
        votes,
        voted: myVoteTitleId === t.id,
      }));

    const myTitle = raw.find((t) => t.author_id === session.id);
    const top = titles[0];
    return {
      photoId: p.id,
      imageUrl: photoUrl(sb, p.image_path),
      authorName: nameById.get(p.author_id) ?? "(탈퇴)",
      mine: p.author_id === session.id,
      createdAt: p.created_at,
      titles,
      myTitleBody: myTitle?.body ?? null,
      topTitle: top && top.votes > 0 ? { body: top.body, authorName: top.authorName, votes: top.votes } : null,
      comments: commentsByPhoto.get(p.id) ?? [],
      reported: reportedSet.has(p.id),
      canReport: p.author_id !== session.id,
    };
  });

  return NextResponse.json({ items });
}
