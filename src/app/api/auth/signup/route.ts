import { NextResponse, type NextRequest } from "next/server";

import { ACCOUNT_COOKIE, COOKIE_OPTIONS, signSession } from "@/lib/auth";
import { validateName } from "@/lib/name";
import { hashPin, isValidPin } from "@/lib/pin";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 자동 승인 가입: 이름 + 4자리 PIN → 계정 생성 후 바로 로그인.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pin = body?.pin;

  const nameCheck = validateName(body?.name);
  if (!nameCheck.ok) {
    return NextResponse.json({ error: nameCheck.error }, { status: 400 });
  }
  const name = nameCheck.name;
  if (!isValidPin(pin)) {
    return NextResponse.json({ error: "4자리 PIN을 입력하세요." }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: existing } = await sb
    .from("ma_accounts")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "이미 사용 중인 이름입니다." }, { status: 409 });
  }

  const hash = await hashPin(pin);
  const { data: created, error } = await sb
    .from("ma_accounts")
    .insert({ name, pin_hash: hash })
    .select("id,name")
    .maybeSingle();
  if (error || !created) {
    console.error("signup 실패", error);
    return NextResponse.json({ error: "가입에 실패했습니다." }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, name: created.name });
  res.cookies.set(
    ACCOUNT_COOKIE,
    signSession({ role: "account", id: created.id, name: created.name }),
    COOKIE_OPTIONS
  );
  return res;
}
