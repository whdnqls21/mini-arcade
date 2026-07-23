import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { decodeDataUrl, isSoloAccount, uploadDrawing } from "@/lib/catchmind/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 900 * 1024; // 압축 후 넉넉히

// 문제 등록 — 제시어 + 그림(dataURL) → Storage 업로드 후 quizzes insert.
export async function POST(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const wordId = body?.wordId;
  const image = body?.image;
  if (typeof wordId !== "number" || !Number.isInteger(wordId)) {
    return NextResponse.json({ error: "제시어를 확인하세요." }, { status: 400 });
  }
  if (typeof image !== "string") {
    return NextResponse.json({ error: "그림을 확인하세요." }, { status: 400 });
  }

  const decoded = decodeDataUrl(image);
  if (!decoded) {
    return NextResponse.json({ error: "그림 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (decoded.buffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "그림 용량이 너무 큽니다." }, { status: 400 });
  }

  const sb = createServiceClient();
  if (await isSoloAccount(sb, session.id)) {
    return NextResponse.json({ error: "솔로모드에서는 이용할 수 없어요." }, { status: 403 });
  }

  // 제시어 유효성.
  const { data: word } = await sb
    .from("ma_cm_words")
    .select("id")
    .eq("id", wordId)
    .eq("is_active", true)
    .maybeSingle();
  if (!word) return NextResponse.json({ error: "없는 제시어입니다." }, { status: 400 });

  const ext = decoded.contentType.split("/")[1] ?? "webp";
  const path = `${session.id}/${crypto.randomUUID()}.${ext}`;
  const up = await uploadDrawing(sb, path, decoded.buffer, decoded.contentType);
  if (up.error) {
    console.error("그림 업로드 실패", up.error);
    return NextResponse.json(
      { error: "그림 업로드에 실패했습니다. Storage 버킷(cm-drawings) 설정을 확인하세요." },
      { status: 500 }
    );
  }

  const { error } = await sb.from("ma_cm_quizzes").insert({
    author_id: session.id,
    word_id: wordId,
    image_path: path,
  });
  if (error) {
    console.error("문제 등록 실패", error);
    return NextResponse.json({ error: "문제 등록에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
