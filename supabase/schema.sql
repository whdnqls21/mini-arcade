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

drop table if exists public.ma_post_votes cascade;
drop table if exists public.ma_posts cascade;
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
  solo       boolean not null default false,    -- 솔로모드: 리더보드에서 제외(경쟁 부담 없이 개인 기록만)
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
  reset_at    timestamptz,                       -- 마지막 기록 초기화 시각(안내용). null 이면 초기화 이력 없음
  reset_note  text,                              -- 초기화 사유(예: '밸런스 조정'). 사용자에게 보여준다
  created_at  timestamptz not null default now(),
  constraint ma_games_scoring_valid check (scoring in ('high','low','time','htime'))
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

-- 게시판 (사용자 제안 · 관리자 공지)
create table public.ma_posts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid references public.ma_accounts(id) on delete set null, -- null = 운영자(관리자) 글
  author_name text not null,                     -- 작성 시점 이름 스냅샷(이름 변경/삭제에 안 흔들림)
  category    text not null default 'etc',        -- 'notice'(공지) | 'game'(게임 추천) | 'balance'(밸런스) | 'bug'(오류제보) | 'etc'(기타)
  title       text not null,
  body        text not null,
  is_notice   boolean not null default false,     -- 관리자 공지 → 상단
  pinned      boolean not null default false,     -- 관리자 고정
  status      text,                               -- 제안 처리 상태: null | 'reviewing' | 'planned' | 'done' | 'declined'
  created_at  timestamptz not null default now(),
  constraint ma_posts_category_valid check (category in ('notice','game','balance','bug','etc')),
  constraint ma_posts_status_valid check (status is null or status in ('reviewing','planned','done','declined'))
);
create index ma_posts_created_idx on public.ma_posts (created_at desc);

-- 추천(👍) — 계정당 글마다 한 번
create table public.ma_post_votes (
  post_id    uuid not null references public.ma_posts(id) on delete cascade,
  account_id uuid not null references public.ma_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, account_id)
);

-- 댓글 (글마다 여러 개. 작성자 이름은 스냅샷으로 저장해 이름 변경/삭제에 안 흔들림)
create table public.ma_post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.ma_posts(id) on delete cascade,
  account_id  uuid references public.ma_accounts(id) on delete set null, -- null = 운영자
  author_name text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index ma_post_comments_post_idx on public.ma_post_comments (post_id, created_at);

-- RLS: 전부 잠금 (서버 service_role 로만 접근)
alter table public.ma_accounts      enable row level security;
alter table public.ma_settings      enable row level security;
alter table public.ma_games         enable row level security;
alter table public.ma_scores        enable row level security;
alter table public.ma_posts         enable row level security;
alter table public.ma_post_votes    enable row level security;
alter table public.ma_post_comments enable row level security;

-- 시드: 첫 게임 2048 + settings 단일 행
insert into public.ma_settings (id) values (1) on conflict (id) do nothing;
insert into public.ma_games (slug, name, description, scoring, sort) values
  ('2048', '2048', '타일을 합쳐 2048을 만드세요. 고득점 경쟁!', 'high', 0),
  ('suika', '수박게임', '과일을 떨어뜨려 합치세요. 수박까지 갈 수 있을까?', 'high', 1),
  ('apple', '사과게임', '합이 10이 되게 사과를 묶어 지우세요. 80초 승부!', 'high', 2),
  ('mahjong', '사천성', '같은 패를 이어 모두 지우세요. 빠를수록 상위!', 'time', 3),
  ('dino', '크롬 다이노', '장애물을 뛰어넘으며 최대한 멀리! 달릴수록 빨라집니다.', 'high', 4),
  ('memory', '카드 짝맞추기', '같은 과일 카드를 기억해 짝을 맞추세요. 빠를수록 상위!', 'time', 5),
  ('whack', '두더지 잡기', '구멍에서 튀어나오는 두더지를 재빨리 잡으세요. 나쁜 두더지는 조심!', 'high', 6),
  ('schulte', '1 to 50', '1부터 50까지 순서대로 가장 빠르게! 집중력 게임.', 'time', 7),
  ('poop', '똥 피하기', '떨어지는 똥을 피해 오래 버티세요! 졸라맨을 좌우로 움직여요.', 'htime', 8)
on conflict (slug) do nothing;

-- ────────────────────────────────────────────────────────────────────────
-- 이미 운영 중인 DB 에 게임만 추가할 때는 이 파일 전체를 다시 돌리지 말 것.
-- (맨 위 drop table 때문에 기존 기록이 전부 사라진다.) 아래 한 줄만 실행.
--
--   insert into public.ma_games (slug, name, description, scoring, sort) values
--     ('memory', '카드 짝맞추기', '같은 과일 카드를 기억해 짝을 맞추세요. 빠를수록 상위!', 'time', 5),
--     ('whack', '두더지 잡기', '구멍에서 튀어나오는 두더지를 재빨리 잡으세요. 나쁜 두더지는 조심!', 'high', 6),
--     ('schulte', '1 to 50', '1부터 50까지 순서대로 가장 빠르게! 집중력 게임.', 'time', 7),
--     ('poop', '똥 피하기', '떨어지는 똥을 피해 오래 버티세요! 졸라맨을 좌우로 움직여요.', 'htime', 8)
--   on conflict (slug) do nothing;
--
-- 똥 피하기 기록을 초.소수2자리로 바꿀 때(scoring 을 htime 로, 저장은 ms 로):
--   alter table public.ma_games drop constraint if exists ma_games_scoring_valid;
--   alter table public.ma_games add constraint ma_games_scoring_valid
--     check (scoring in ('high','low','time','htime'));
--   update public.ma_games  set scoring = 'htime'   where slug = 'poop';
--   update public.ma_scores set score = score * 1000 where game_slug = 'poop'; -- 기존 '초' 기록을 ms 로
--
-- 운영 DB 에 기록 초기화 안내 컬럼을 추가할 때(이 파일 전체 재실행 금지):
--   alter table public.ma_games
--     add column if not exists reset_at   timestamptz,
--     add column if not exists reset_note text;
--
-- 운영 DB 에 솔로모드 컬럼을 추가할 때(이 파일 전체 재실행 금지):
--   alter table public.ma_accounts
--     add column if not exists solo boolean not null default false;
--
-- 게시판 분류에 오류제보(bug)를 추가할 때(이 파일 전체 재실행 금지):
--   alter table public.ma_posts drop constraint if exists ma_posts_category_valid;
--   alter table public.ma_posts add constraint ma_posts_category_valid
--     check (category in ('notice','game','balance','bug','etc'));
--
-- 게시판에 댓글을 추가할 때(이 파일 전체 재실행 금지) — 아래 한 벌만 실행:
--   create table if not exists public.ma_post_comments (
--     id          uuid primary key default gen_random_uuid(),
--     post_id     uuid not null references public.ma_posts(id) on delete cascade,
--     account_id  uuid references public.ma_accounts(id) on delete set null,
--     author_name text not null,
--     body        text not null,
--     created_at  timestamptz not null default now()
--   );
--   create index if not exists ma_post_comments_post_idx on public.ma_post_comments (post_id, created_at);
--   alter table public.ma_post_comments enable row level security;
--
-- 운영 DB 에 게시판을 추가할 때(이 파일 전체 재실행 금지) — 위 create table 두 개를
-- create table if not exists 로 바꿔 그대로 실행하고, 아래 RLS 도 함께 실행:
--   alter table public.ma_posts      enable row level security;
--   alter table public.ma_post_votes enable row level security;
-- ────────────────────────────────────────────────────────────────────────
