import { NextResponse, type NextRequest } from "next/server";

import { isAdmin } from "@/lib/auth";
import { CM_BUCKET } from "@/lib/catchmind/server";
import { computeSeasonSnapshot, fetchScheduledOrActiveSeason } from "@/lib/season";
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

  // 시즌 시작 — 로테이션 종목 + 기간 지정. 활성 시즌은 하나만(이미 있으면 거부).
  if (action === "seasonCreate") {
    const rawGames = Array.isArray(body?.games) ? body.games : null;
    if (!rawGames || rawGames.length === 0) {
      return NextResponse.json({ error: "종목을 하나 이상 선택하세요." }, { status: 400 });
    }
    const wanted: string[] = [
      ...new Set((rawGames as unknown[]).filter((s): s is string => typeof s === "string")),
    ];
    // 유효한(존재하는) 게임 slug 만 허용. 이름은 공지 문구에 쓴다.
    const { data: gs } = await sb.from("ma_games").select("slug,name");
    const gameRows = (gs ?? []) as { slug: string; name: string }[];
    const valid = new Set(gameRows.map((g) => g.slug));
    const nameBySlug = new Map(gameRows.map((g) => [g.slug, g.name]));
    const games = wanted.filter((s) => valid.has(s));
    if (games.length === 0) {
      return NextResponse.json({ error: "유효한 종목이 없습니다." }, { status: 400 });
    }
    if (games.length > 8) {
      return NextResponse.json({ error: "종목은 최대 8개까지 선택할 수 있어요." }, { status: 400 });
    }

    // 이미 활성 시즌이 있으면 거부(먼저 종료해야 함).
    const { data: activeRow } = await sb
      .from("ma_seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle();
    if (activeRow) {
      return NextResponse.json(
        { error: "이미 진행 중인 시즌이 있어요. 먼저 종료한 뒤 새 시즌을 시작하세요." },
        { status: 400 }
      );
    }

    // 다음 시즌 번호 = 최대 num + 1.
    const { data: last } = await sb
      .from("ma_seasons")
      .select("num")
      .order("num", { ascending: false })
      .limit(1)
      .maybeSingle();
    const num = ((last as { num: number } | null)?.num ?? 0) + 1;

    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    const name = rawName ? rawName.slice(0, 30) : null;

    // 관리자가 지정한 시작·종료 일시(ISO). 시작이 미래면 그 시즌은 '예정'으로 대기하다
    // 시작 시각이 지나면 자동으로 진행 중이 된다(fetchActiveSeason 의 시작일 필터).
    const startsAt = typeof body?.startsAt === "string" ? new Date(body.startsAt) : new Date();
    const endsAt = typeof body?.endsAt === "string" ? new Date(body.endsAt) : null;
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "시작 일시를 확인하세요." }, { status: 400 });
    }
    if (!endsAt || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "종료 일시를 확인하세요." }, { status: 400 });
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json({ error: "종료 일시는 시작 일시보다 뒤여야 해요." }, { status: 400 });
    }

    const { error } = await sb.from("ma_seasons").insert({
      num,
      name,
      games,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "active",
    });
    if (error) {
      console.error("seasonCreate 실패", error);
      return NextResponse.json({ error: "시즌 시작에 실패했습니다." }, { status: 500 });
    }

    // 시즌 공지 자동 작성(관리자가 끄지 않았으면). 실패해도 시즌 생성 자체는 성공 처리.
    if (body?.announce !== false) {
      const scheduled = startsAt.getTime() > Date.now();
      const gameNames = games.map((s) => nameBySlug.get(s) ?? s);
      const kst = (d: Date) =>
        d.toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      const title = `🏆 시즌 ${num} ${scheduled ? "예고" : "시작"}!`;
      const noticeBody = [
        `시즌 ${num}${name ? ` · “${name}”` : ""}이 ${scheduled ? "곧 시작돼요" : "시작됐어요"}! 🎉`,
        ``,
        `■ 기간`,
        scheduled ? `${kst(startsAt)} 시작 · ${kst(endsAt)} 종료 예정` : `${kst(startsAt)} ~ ${kst(endsAt)}`,
        ``,
        `■ 이번 시즌 종목`,
        gameNames.join(" · "),
        `(지정 종목 외 게임은 자유 종목으로 계속 즐길 수 있어요.)`,
        ``,
        `■ 겨루는 법 · 보상`,
        `종목별 순위로 F1 포인트를 모아 종합 1위 = 시즌 MVP 🏆`,
        `· 시즌 MVP — 금테 아이콘 + 칭호`,
        `· 종목별 1등 — 시즌 한정 금테 아이콘`,
        `· 명예의 전당에 이름 영구 등재`,
        ``,
        `순위 탭에서 실시간 MVP 레이스를 확인하세요!`,
      ]
        .join("\n")
        .slice(0, 1000);
      const { error: pErr } = await sb.from("ma_posts").insert({
        account_id: null,
        author_name: "관리자",
        category: "notice",
        title,
        body: noticeBody,
        is_notice: true,
      });
      if (pErr) console.error("시즌 공지 자동 작성 실패(무시)", pErr);
    }

    return NextResponse.json({ ok: true, num });
  }

  // 시즌 종료 — 활성 시즌을 지금 종료(status=closed). 예정 종료일 전이어도 됨.
  // 종료 직전에 스냅샷(종목별 1등 + F1 MVP)을 이름 문자열로 박아 명예의 전당에 남기고,
  // MVP 에게 시즌 보상 아이콘(season_mvp, 금테)을 지급한다.
  if (action === "seasonEnd") {
    // 진행 중이거나 '예정'인 시즌 모두 종료 대상(예정 시즌 종료 = 취소).
    const active = await fetchScheduledOrActiveSeason(sb);
    if (!active) {
      return NextResponse.json({ error: "진행 중이거나 예정된 시즌이 없습니다." }, { status: 400 });
    }

    // 1) 스냅샷 계산 → 저장. 결과 테이블이 없으면(2단계 마이그레이션 전) 닫지 않고 안내.
    const { rows, mvpAccountId } = await computeSeasonSnapshot(sb, active);
    if (rows.length > 0) {
      const { error: insErr } = await sb.from("ma_season_results").insert(rows);
      if (insErr) {
        console.error("seasonEnd 스냅샷 저장 실패", insErr);
        return NextResponse.json(
          { error: "시즌 결과 저장에 실패했어요. 2단계 마이그레이션(ma_season_results)을 먼저 실행하세요." },
          { status: 500 }
        );
      }
    }

    // 2) 시즌 보상 아이콘 영구 지급 — MVP(season_mvp) + 종목별 1등(schamp:<slug>).
    //    (중복·테이블없음은 무시. 한 사람이 여러 종목 1등이면 종목 수만큼 받는다.)
    const grants: { account_id: string; icon_key: string }[] = [];
    if (mvpAccountId) grants.push({ account_id: mvpAccountId, icon_key: "season_mvp" });
    for (const r of rows) {
      if (r.category === "champion" && r.account_id && r.game_slug) {
        grants.push({ account_id: r.account_id, icon_key: `schamp:${r.game_slug}` });
      }
    }
    if (grants.length > 0) {
      const { error: gErr } = await sb.from("ma_account_icons").upsert(grants, {
        onConflict: "account_id,icon_key",
        ignoreDuplicates: true,
      });
      if (gErr) console.error("시즌 보상 아이콘 지급 실패(무시)", gErr);
    }

    // 3) 시즌 닫기.
    const { error } = await sb
      .from("ma_seasons")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", active.id);
    if (error) {
      console.error("seasonEnd 실패", error);
      return NextResponse.json({ error: "시즌 종료에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mvp: mvpAccountId, champions: rows.filter((r) => r.category === "champion").length });
  }

  return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
}
