-- ════════════════════════════════════════════════════════════════════════
-- 제목 학원(사진 제목 짓기) 전용 스키마 — 단독 실행용 (테이블 prefix: ma_tt_)
-- ────────────────────────────────────────────────────────────────────────
-- 이 파일은 supabase/schema.sql 과 별개로 "그대로 SQL Editor 에 붙여넣고 Run"
-- 해도 안전하다(create table if not exists). 기존 기록은 건드리지 않는다.
--
-- 점수·순위 없는 소셜 게임: 사진을 올리면 누구나(올린 사람 포함) 제목을 달고,
-- 마음에 드는 제목에 투표한다. 사진당 최다 득표 제목이 '왕관'을 쓴다(롤링, 마감 없음).
--
-- 실행 후 추가로 해야 할 것(이미지 업로드/조회에 필요):
--   Supabase → Storage → New bucket → 이름 'title-photos', Public 체크(공개).
--   업로드는 서버 service_role, 조회는 고정 public URL(서명 왕복 없음 → 캐시로 빠름).
--   경로가 계정UUID/랜덤UUID 라 추측 불가. 별도 정책 필요 없다.
-- ════════════════════════════════════════════════════════════════════════

-- 사진(업로드)
create table if not exists public.ma_tt_photos (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.ma_accounts(id) on delete cascade,
  image_path   text not null,                  -- Storage 오브젝트 경로(public URL로 조회)
  report_count int  not null default 0,
  is_hidden    boolean not null default false, -- 신고 3회 누적 시 자동 숨김(soft)
  is_deleted   boolean not null default false, -- 관리자/작성자 삭제
  created_at   timestamptz not null default now()
);
create index if not exists ma_tt_photos_created_idx on public.ma_tt_photos (created_at desc);

-- 제목 (사진당 1인 1개 — 수정은 upsert)
create table if not exists public.ma_tt_titles (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references public.ma_tt_photos(id) on delete cascade,
  author_id   uuid not null references public.ma_accounts(id) on delete cascade,
  author_name text not null,                   -- 표시용 스냅샷(닉 변경돼도 유지)
  body        text not null,
  created_at  timestamptz not null default now(),
  unique (photo_id, author_id)
);
create index if not exists ma_tt_titles_photo_idx on public.ma_tt_titles (photo_id);

-- 투표 (사진당 1인 1표 — 어느 제목에 줬는지. 변경은 upsert, 취소는 delete)
create table if not exists public.ma_tt_votes (
  photo_id   uuid not null references public.ma_tt_photos(id) on delete cascade,
  voter_id   uuid not null references public.ma_accounts(id) on delete cascade,
  title_id   uuid not null references public.ma_tt_titles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, voter_id)
);
create index if not exists ma_tt_votes_title_idx on public.ma_tt_votes (title_id);

-- 신고 (1인 1사진 1회)
create table if not exists public.ma_tt_reports (
  photo_id   uuid references public.ma_tt_photos(id) on delete cascade,
  user_id    uuid references public.ma_accounts(id) on delete cascade,
  reason     text,   -- 'inappropriate' | 'privacy' | 'spam'
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

-- 댓글 + 좋아요 (캐치마인드 갤러리 댓글과 동일 구조)
create table if not exists public.ma_tt_comments (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references public.ma_tt_photos(id) on delete cascade,
  account_id  uuid references public.ma_accounts(id) on delete set null,
  author_name text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists ma_tt_comments_photo_idx on public.ma_tt_comments (photo_id, created_at);

create table if not exists public.ma_tt_comment_votes (
  comment_id uuid not null references public.ma_tt_comments(id) on delete cascade,
  account_id uuid not null references public.ma_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, account_id)
);
create index if not exists ma_tt_comment_votes_comment_idx on public.ma_tt_comment_votes (comment_id);

-- RLS 전면 잠금 (서버 service_role 로만 접근)
alter table public.ma_tt_photos        enable row level security;
alter table public.ma_tt_titles        enable row level security;
alter table public.ma_tt_votes         enable row level security;
alter table public.ma_tt_reports       enable row level security;
alter table public.ma_tt_comments      enable row level security;
alter table public.ma_tt_comment_votes enable row level security;
