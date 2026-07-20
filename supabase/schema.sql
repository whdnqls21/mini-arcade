-- ════════════════════════════════════════════════════════════════════════
-- mini-arcade — Supabase 스키마 (테이블 prefix: ma_)
-- ────────────────────────────────────────────────────────────────────────
-- 토너먼트 앱과 같은 Supabase 프로젝트를 재활용한다. 충돌 방지를 위해 모든
-- 테이블에 ma_ prefix 를 붙였다. 이 파일 전체를 SQL Editor 에 붙여넣고 Run.
-- 재실행해도 안전(drop if exists).
--
-- 보안: 모든 테이블 RLS ON, anon 정책 없음 → 클라이언트 직접 접근 불가.
-- 읽기/쓰기는 Next.js 서버 라우트에서 service_role 로만 수행.
-- PIN 은 bcrypt 해시로 저장.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.ma_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop table if exists public.ma_scores cascade;
drop table if exists public.ma_games cascade;
drop table if exists public.ma_accounts cascade;
drop table if exists public.ma_settings cascade;

-- 계정 (자동 승인 가입. 관리자가 active=false 로 비활성화하거나 삭제)
create table public.ma_accounts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,             -- 표시 이름(로그인 아이디)
  pin_hash   text not null,                     -- 4자리 PIN bcrypt 해시
  active     boolean not null default true,     -- false 면 로그인 차단
  created_at timestamptz not null default now()
);

-- 전역 설정 (관리자 PIN)
create table public.ma_settings (
  id             int primary key default 1,
  admin_pin_hash text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ma_settings_singleton check (id = 1)
);
create trigger ma_settings_updated_at before update on public.ma_settings
  for each row execute function public.ma_set_updated_at();

-- 게임 목록 (게임별 점수 정렬 방식)
create table public.ma_games (
  slug        text primary key,                 -- 예: '2048'
  name        text not null,
  description text,
  scoring     text not null default 'high',      -- 'high'(고득점) | 'low'(저점) | 'time'(짧은시간)
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  constraint ma_games_scoring_valid check (scoring in ('high','low','time'))
);

-- 기록 (계정 × 게임, 여러 판. 리더보드는 계정별 베스트로 계산)
create table public.ma_scores (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ma_accounts(id) on delete cascade,
  game_slug  text not null references public.ma_games(slug) on delete cascade,
  score      int not null,                       -- time 게임은 밀리초(ms) 저장
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index ma_scores_game_idx on public.ma_scores (game_slug);
create index ma_scores_account_idx on public.ma_scores (account_id);

-- RLS: 전부 잠금 (서버 service_role 로만 접근)
alter table public.ma_accounts enable row level security;
alter table public.ma_settings enable row level security;
alter table public.ma_games    enable row level security;
alter table public.ma_scores   enable row level security;

-- 시드: 첫 게임 2048 + settings 단일 행
insert into public.ma_settings (id) values (1) on conflict (id) do nothing;
insert into public.ma_games (slug, name, description, scoring, sort) values
  ('2048', '2048', '타일을 합쳐 2048을 만드세요. 고득점 경쟁!', 'high', 0),
  ('suika', '수박게임', '과일을 떨어뜨려 합치세요. 수박까지 갈 수 있을까?', 'high', 1),
  ('apple', '사과게임', '합이 10이 되게 사과를 묶어 지우세요. 90초 승부!', 'high', 2),
  ('mahjong', '사천성', '같은 패를 이어 모두 지우세요. 빠를수록 상위!', 'time', 3),
  ('dino', '크롬 다이노', '장애물을 뛰어넘으며 최대한 멀리! 달릴수록 빨라집니다.', 'high', 4)
on conflict (slug) do nothing;

-- ────────────────────────────────────────────────────────────────────────
-- 이미 운영 중인 DB 에 게임만 추가할 때는 이 파일 전체를 다시 돌리지 말 것.
-- (맨 위 drop table 때문에 기존 기록이 전부 사라진다.) 아래 한 줄만 실행.
--
--   insert into public.ma_games (slug, name, description, scoring, sort) values
--     ('dino', '크롬 다이노', '장애물을 뛰어넘으며 최대한 멀리! 달릴수록 빨라집니다.', 'high', 4)
--   on conflict (slug) do nothing;
-- ────────────────────────────────────────────────────────────────────────
