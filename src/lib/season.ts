import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// 시즌 한 개. games 는 이번 시즌 로테이션 종목 slug 목록.
export interface Season {
  id: string;
  num: number;
  name: string | null;
  games: string[];
  starts_at: string;
  ends_at: string;
  status: "active" | "closed";
  closed_at: string | null;
}

// 현재 활성 시즌(status='active'). 하나만 존재하도록 DB 부분 유니크 인덱스로 강제한다.
// 테이블이 아직 없으면(마이그레이션 전) null → 시즌제 미적용(전 게임 올타임)으로 조용히 폴백.
//
// NOTE(2단계): 종료일(ends_at) 이 지난 활성 시즌의 자동 종료·스냅샷은 여기서 처리할 예정.
// 1단계에서는 예정 종료일이 지나도 관리자가 '지금 종료'를 누를 때까지 활성으로 둔다.
export async function fetchActiveSeason(sb: SupabaseClient): Promise<Season | null> {
  const { data, error } = await sb
    .from("ma_seasons")
    .select("id,num,name,games,starts_at,ends_at,status,closed_at")
    .eq("status", "active")
    .order("num", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const s = data as Season;
  return { ...s, games: s.games ?? [] };
}
