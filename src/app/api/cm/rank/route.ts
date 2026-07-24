import { NextResponse } from "next/server";

import { getAccountSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Agg {
  total: number;
  solve: number;
  author: number;
}

// point_logs 를 reason 으로 집계해 총점/눈썰미/손재주 3뷰. 솔로·비활성 계정 제외.
export async function GET() {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const sb = createServiceClient();
  // 순위 집계는 DB 뷰(ma_cm_rank)에서 사용자당 1행으로 받아 온다(point_logs 전량 조회 방지).
  const [rankRes, accRes] = await Promise.all([
    sb.from("ma_cm_rank").select("user_id,total,solve,author"),
    sb.from("ma_accounts").select("id,name,active,solo").eq("active", true),
  ]);

  const accounts = (accRes.data ?? []) as { id: string; name: string; solo: boolean }[];
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const eligible = new Set(accounts.filter((a) => !a.solo).map((a) => a.id));

  const agg = new Map<string, Agg>();
  if (!rankRes.error && rankRes.data) {
    for (const r of rankRes.data as { user_id: string; total: number; solve: number; author: number }[]) {
      if (!eligible.has(r.user_id)) continue;
      agg.set(r.user_id, { total: r.total, solve: r.solve, author: r.author });
    }
  } else {
    // 폴백: 뷰 미생성(마이그레이션 전)이면 원장 합산.
    console.warn("ma_cm_rank 뷰 없음 — point_logs 폴백", rankRes.error?.message);
    const { data: logs } = await sb.from("ma_cm_point_logs").select("user_id,amount,reason");
    for (const p of (logs ?? []) as { user_id: string; amount: number; reason: string }[]) {
      if (!eligible.has(p.user_id)) continue;
      const cur = agg.get(p.user_id) ?? { total: 0, solve: 0, author: 0 };
      cur.total += p.amount;
      if (p.reason === "solve") cur.solve += p.amount;
      else if (p.reason === "author_solved") cur.author += p.amount;
      agg.set(p.user_id, cur);
    }
  }

  const build = (pick: (a: Agg) => number) => {
    const rows = [...agg.entries()]
      .map(([id, a]) => ({ name: nameById.get(id) ?? "", points: pick(a), rank: 0 }))
      .filter((r) => r.points > 0)
      .sort((x, y) => y.points - x.points);
    rows.forEach((r, i) => {
      r.rank = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1;
    });
    return rows;
  };

  return NextResponse.json({
    total: build((a) => a.total),
    solver: build((a) => a.solve),
    author: build((a) => a.author),
  });
}
