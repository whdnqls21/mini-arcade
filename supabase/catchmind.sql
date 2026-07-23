-- ════════════════════════════════════════════════════════════════════════
-- 캐치마인드(그림퀴즈) 전용 스키마 — 단독 실행용 (테이블 prefix: ma_cm_)
-- ────────────────────────────────────────────────────────────────────────
-- 이 파일은 supabase/schema.sql 과 별개로 "그대로 SQL Editor 에 붙여넣고 Run"
-- 해도 안전하다(create table if not exists). 기존 기록은 건드리지 않는다.
--
-- 실행 후 추가로 해야 할 것(코드에서 이미지 업로드/서명에 필요):
--   Supabase → Storage → New bucket → 이름 'cm-drawings', Public 체크 해제(비공개).
--   서버가 service_role 로 업로드/서명 URL 발급하므로 별도 정책은 필요 없다.
-- ════════════════════════════════════════════════════════════════════════

-- 제시어 사전 (출제 시 랜덤 3개 중 택1)
create table if not exists public.ma_cm_words (
  id        serial primary key,
  text      text not null,
  category  text,
  is_active boolean not null default true
);

-- 문제(그림)
create table if not exists public.ma_cm_quizzes (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.ma_accounts(id) on delete cascade,
  word_id      int  not null references public.ma_cm_words(id),
  image_path   text not null,                  -- Storage 오브젝트 경로(서명 URL로 조회)
  report_count int  not null default 0,
  is_hidden    boolean not null default false, -- 신고 3회 누적 시 자동 숨김(soft)
  is_deleted   boolean not null default false, -- 관리자 영구삭제
  created_at   timestamptz not null default now()
);
create index if not exists ma_cm_quizzes_author_idx on public.ma_cm_quizzes (author_id);

-- 사용자별 문제 풀이 상태 (문제당 1행)
create table if not exists public.ma_cm_attempts (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.ma_cm_quizzes(id) on delete cascade,
  user_id      uuid not null references public.ma_accounts(id) on delete cascade,
  tries        int  not null default 0,
  is_correct   boolean not null default false,
  finished     boolean not null default false,
  solver_score int  not null default 0,
  author_score int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (quiz_id, user_id)
);
create index if not exists ma_cm_attempts_quiz_idx on public.ma_cm_attempts (quiz_id);
create index if not exists ma_cm_attempts_user_idx on public.ma_cm_attempts (user_id);

-- 매 추측 로그 (오답 TOP3 집계용)
create table if not exists public.ma_cm_guesses (
  id         uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ma_cm_attempts(id) on delete cascade,
  quiz_id    uuid not null references public.ma_cm_quizzes(id) on delete cascade,
  guess      text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists ma_cm_guesses_quiz_idx on public.ma_cm_guesses (quiz_id);

-- 별점 (품질 지표, 무보상)
create table if not exists public.ma_cm_ratings (
  quiz_id    uuid references public.ma_cm_quizzes(id) on delete cascade,
  user_id    uuid references public.ma_accounts(id) on delete cascade,
  stars      int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);

-- 신고 (1인 1문제 1회)
create table if not exists public.ma_cm_reports (
  quiz_id    uuid references public.ma_cm_quizzes(id) on delete cascade,
  user_id    uuid references public.ma_accounts(id) on delete cascade,
  reason     text,   -- 'lazy' | 'inappropriate' | 'answer_leak'
  created_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);

-- 포인트 원장 (순위 = 이 합계. reason 별로 정답왕/그림왕 분리)
create table if not exists public.ma_cm_point_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.ma_accounts(id) on delete cascade,
  amount      int  not null,
  reason      text not null,   -- 'solve' | 'author_solved'
  ref_quiz_id uuid,
  created_at  timestamptz not null default now()
);
create index if not exists ma_cm_point_logs_user_idx on public.ma_cm_point_logs (user_id);

-- RLS 전면 잠금 (서버 service_role 로만 접근)
alter table public.ma_cm_words      enable row level security;
alter table public.ma_cm_quizzes    enable row level security;
alter table public.ma_cm_attempts   enable row level security;
alter table public.ma_cm_guesses    enable row level security;
alter table public.ma_cm_ratings    enable row level security;
alter table public.ma_cm_reports    enable row level security;
alter table public.ma_cm_point_logs enable row level security;

-- 제시어 초기 시드 (단일 정답이 자연스러운 명사. 필요하면 더 추가)
insert into public.ma_cm_words (text, category) values
  ('사과', '음식'), ('바나나', '음식'), ('피자', '음식'), ('햄버거', '음식'),
  ('아이스크림', '음식'), ('케이크', '음식'), ('수박', '음식'), ('딸기', '음식'),
  ('강아지', '동물'), ('고양이', '동물'), ('기린', '동물'), ('코끼리', '동물'),
  ('사자', '동물'), ('펭귄', '동물'), ('공룡', '동물'), ('상어', '동물'),
  ('토끼', '동물'), ('부엉이', '동물'), ('거북이', '동물'), ('나비', '동물'),
  ('자동차', '사물'), ('비행기', '사물'), ('자전거', '사물'), ('안경', '사물'),
  ('우산', '사물'), ('시계', '사물'), ('가위', '사물'), ('연필', '사물'),
  ('의자', '사물'), ('침대', '사물'), ('로켓', '사물'), ('풍선', '사물'),
  ('컴퓨터', '사물'), ('카메라', '사물'), ('기타', '사물'), ('피아노', '사물'),
  ('축구공', '사물'), ('선물상자', '사물'), ('열쇠', '사물'), ('편지', '사물'),
  ('무지개', '자연'), ('눈사람', '자연'), ('나무', '자연'), ('꽃', '자연'),
  ('태양', '자연'), ('달', '자연'), ('별', '자연'), ('구름', '자연'),
  ('산', '자연'), ('섬', '자연'), ('화산', '자연'), ('번개', '자연'),
  ('로봇', '캐릭터'), ('유령', '캐릭터'), ('마법사', '캐릭터'), ('해적', '캐릭터'),
  ('산타', '캐릭터'), ('외계인', '캐릭터'), ('왕관', '사물'), ('보물지도', '사물')
on conflict do nothing;
