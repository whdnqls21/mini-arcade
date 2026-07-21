import { NextResponse, type NextRequest } from "next/server";

import { ACCOUNT_COOKIE, COOKIE_OPTIONS, getAccountSession, signSession } from "@/lib/auth";
import { validateName } from "@/lib/name";
import { hashPin, isValidPin, verifyPin } from "@/lib/pin";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 본인 계정의 이름/PIN 변경.
export async function POST(req: NextRequest) {
  const session = await getAccountSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const sb = createServiceClient();
  // 세션 쿠키는 30일이라 그 사이 관리자가 계정을 지우거나 막았을 수 있다.
  const { data: me } = await sb
    .from("ma_accounts")
    .select("id,name,pin_hash,active")
    .eq("id", session.id)
    .maybeSingle();
  if (!me) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!me.active) {
    return NextResponse.json({ error: "비활성화된 계정입니다. 관리자에게 문의하세요." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  // ── 이름 변경 ────────────────────────────────────────────────────
  if (action === "rename") {
    const nameCheck = validateName(body?.name);
    if (!nameCheck.ok) {
      return NextResponse.json({ error: nameCheck.error }, { status: 400 });
    }
    const name = nameCheck.name;
    if (name === me.name) {
      return NextResponse.json({ error: "지금 쓰는 이름과 같습니다." }, { status: 400 });
    }

    const { data: taken } = await sb
      .from("ma_accounts")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (taken) {
      return NextResponse.json({ error: "이미 사용 중인 이름입니다." }, { status: 409 });
    }

    const { error } = await sb.from("ma_accounts").update({ name }).eq("id", me.id);
    if (error) {
      // 조회와 update 사이에 다른 사람이 같은 이름을 선점하면 unique 제약에 걸린다.
      if (error.code === "23505") {
        return NextResponse.json({ error: "이미 사용 중인 이름입니다." }, { status: 409 });
      }
      console.error("rename 실패", error);
      return NextResponse.json({ error: "이름 변경에 실패했습니다." }, { status: 500 });
    }

    // 세션 쿠키가 이름을 담고 있으므로 새 이름으로 다시 발급한다.
    const res = NextResponse.json({ ok: true, name });
    res.cookies.set(
      ACCOUNT_COOKIE,
      signSession({ role: "account", id: me.id, name }),
      COOKIE_OPTIONS
    );
    return res;
  }

  // ── PIN 변경 ─────────────────────────────────────────────────────
  if (action === "changePin") {
    const currentPin = body?.currentPin;
    const newPin = body?.newPin;
    if (!isValidPin(currentPin) || !isValidPin(newPin)) {
      return NextResponse.json({ error: "4자리 PIN을 입력하세요." }, { status: 400 });
    }
    const ok = await verifyPin(currentPin, me.pin_hash);
    if (!ok) {
      return NextResponse.json({ error: "현재 PIN이 일치하지 않습니다." }, { status: 401 });
    }
    if (currentPin === newPin) {
      return NextResponse.json({ error: "지금 쓰는 PIN과 같습니다." }, { status: 400 });
    }

    const hash = await hashPin(newPin);
    const { error } = await sb.from("ma_accounts").update({ pin_hash: hash }).eq("id", me.id);
    if (error) {
      console.error("changePin 실패", error);
      return NextResponse.json({ error: "PIN 변경에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── 솔로모드 전환 ─────────────────────────────────────────────────
  if (action === "setSolo") {
    const solo = body?.solo;
    if (typeof solo !== "boolean") {
      return NextResponse.json({ error: "솔로모드 값이 올바르지 않습니다." }, { status: 400 });
    }
    const { error } = await sb.from("ma_accounts").update({ solo }).eq("id", me.id);
    if (error) {
      console.error("setSolo 실패", error);
      return NextResponse.json({ error: "솔로모드 변경에 실패했습니다." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, solo });
  }

  return NextResponse.json({ error: "알 수 없는 동작입니다." }, { status: 400 });
}
