import { NextResponse, type NextRequest } from "next/server";

import { ACCOUNT_COOKIE, COOKIE_OPTIONS, signSession } from "@/lib/auth";
import { isValidPin, verifyPin } from "@/lib/pin";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const pin = body?.pin;
  if (!name || !isValidPin(pin)) {
    return NextResponse.json({ error: "이름과 4자리 PIN을 확인하세요." }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: acc } = await sb
    .from("ma_accounts")
    .select("id,name,pin_hash,active")
    .eq("name", name)
    .maybeSingle();
  if (!acc) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!acc.active) {
    return NextResponse.json({ error: "비활성화된 계정입니다. 관리자에게 문의하세요." }, { status: 403 });
  }
  const ok = await verifyPin(pin, acc.pin_hash);
  if (!ok) {
    return NextResponse.json({ error: "PIN이 일치하지 않습니다." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, name: acc.name });
  res.cookies.set(
    ACCOUNT_COOKIE,
    signSession({ role: "account", id: acc.id, name: acc.name }),
    COOKIE_OPTIONS
  );
  return res;
}
