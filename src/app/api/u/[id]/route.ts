import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { buildPublicProfile } from "@/lib/state";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 공개 프로필 조회 — 로그인한 사용자만.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAccountSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const sb = createServiceClient();
  const profile = await buildPublicProfile(sb, id, session.id);
  if (!profile) {
    return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(profile);
}
