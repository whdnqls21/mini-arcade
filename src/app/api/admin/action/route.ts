import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/auth";
import { CM_BUCKET } from "@/lib/catchmind/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const sb = createServiceClient();

  // 계정 활성/비활성
  if (action === "accountActive") {
    const accountId = body?.accountId;
    const active = body?.active;
    if (typeof accountId !== "string" || typeof active !== "boolean") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const { error } = await sb.from("ma_accounts").update({ active }).eq("id", accountId);
    if (error) {
      console.error("accountActive 실패", error);
      return NextResponse.json({ error: "변경에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 계정 삭제 (기록도 함께 삭제 — FK cascade)
  if (action === "accountDelete") {
    const accountId = body?.accountId;
    if (typeof accountId !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const { error } = await sb.from("ma_accounts").delete().eq("id", accountId);
    if (error) {
      console.error("accountDelete 실패", error);
      return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 게임 노출 on/off
  if (action === "gameActive") {
    const slug = body?.slug;
    const active = body?.active;
    if (typeof slug !== "string" || typeof active !== "boolean") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const { error } = await sb.from("ma_games").update({ active }).eq("slug", slug);
    if (error) {
      console.error("gameActive 실패", error);
      return NextResponse.json({ error: "변경에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 게임 기록 전체 초기화 (해당 게임의 모든 계정 기록 삭제 — 되돌릴 수 없음)
  if (action === "gameResetScores") {
    const slug = body?.slug;
    if (typeof slug !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    // 존재하지 않는 slug 로 들어오면 아무것도 지우지 않고 알린다.
    const { data: game } = await sb.from("ma_games").select("slug").eq("slug", slug).maybeSingle();
    if (!game) {
      return NextResponse.json({ error: "존재하지 않는 게임입니다." }, { status: 400 });
    }
    const { data, error } = await sb.from("ma_scores").delete().eq("game_slug", slug).select("id");
    if (error) {
      console.error("gameResetScores 실패", error);
      return NextResponse.json({ error: "기록 초기화에 실패했습니다." }, { status: 500 });
    }
    // 사용자 안내용으로 초기화 시각·사유를 게임에 남긴다.
    const rawNote = typeof body?.note === "string" ? body.note.trim() : "";
    const note = rawNote ? rawNote.slice(0, 60) : "밸런스 조정";
    const { error: noteErr } = await sb
      .from("ma_games")
      .update({ reset_at: new Date().toISOString(), reset_note: note })
      .eq("slug", slug);
    if (noteErr) console.error("reset 안내 기록 실패", noteErr); // 안내 실패해도 초기화 자체는 성공
    return NextResponse.json({ ok: true, deleted: data?.length ?? 0 });
  }

  // 캐치마인드 숨겨진 그림 복구 — 다시 노출 + 신고 초기화(재숨김 방지)
  if (action === "cmRestore") {
    const quizId = body?.quizId;
    if (typeof quizId !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    await sb.from("ma_cm_reports").delete().eq("quiz_id", quizId);
    const { error } = await sb
      .from("ma_cm_quizzes")
      .update({ is_hidden: false, report_count: 0 })
      .eq("id", quizId);
    if (error) {
      console.error("cmRestore 실패", error);
      return NextResponse.json({ error: "복구에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 캐치마인드 그림 영구 삭제 — soft delete + Storage 이미지 제거
  if (action === "cmDelete") {
    const quizId = body?.quizId;
    if (typeof quizId !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const { data: quiz } = await sb
      .from("ma_cm_quizzes")
      .select("image_path")
      .eq("id", quizId)
      .maybeSingle();
    if (quiz?.image_path) {
      const { error: rmErr } = await sb.storage.from(CM_BUCKET).remove([quiz.image_path]);
      if (rmErr) console.error("cmDelete 이미지 제거 실패", rmErr); // 파일 제거 실패해도 숨김 처리는 진행
    }
    const { error } = await sb
      .from("ma_cm_quizzes")
      .update({ is_deleted: true, is_hidden: true })
      .eq("id", quizId);
    if (error) {
      console.error("cmDelete 실패", error);
      return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
}
