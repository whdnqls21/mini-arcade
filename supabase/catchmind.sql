-- ════════════════════════════════════════════════════════════════════════
-- 캐치마인드(그림퀴즈) 전용 스키마 — 단독 실행용 (테이블 prefix: ma_cm_)
-- ────────────────────────────────────────────────────────────────────────
-- 이 파일은 supabase/schema.sql 과 별개로 "그대로 SQL Editor 에 붙여넣고 Run"
-- 해도 안전하다(create table if not exists). 기존 기록은 건드리지 않는다.
--
-- 실행 후 추가로 해야 할 것(코드에서 이미지 업로드/조회에 필요):
--   Supabase → Storage → New bucket → 이름 'cm-drawings', Public 체크(공개).
--   업로드는 서버 service_role, 조회는 고정 public URL 사용(서명 왕복 없음 → 캐시로 빠름).
--   그림 경로가 계정UUID/랜덤UUID 라 추측 불가. 별도 정책 필요 없다.
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

-- 제시어 중복 방지(text 유니크) — 재실행/추가 시드를 안전하게. 이미 있으면 건너뜀.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ma_cm_words_text_unique') then
    alter table public.ma_cm_words add constraint ma_cm_words_text_unique unique (text);
  end if;
end $$;

-- 추가 제시어(재실행 안전 — on conflict (text) do nothing)
insert into public.ma_cm_words (text, category) values
  ('도넛', '음식'), ('라면', '음식'), ('김밥', '음식'), ('계란', '음식'),
  ('사탕', '음식'), ('초콜릿', '음식'), ('포도', '음식'), ('당근', '음식'),
  ('옥수수', '음식'), ('식빵', '음식'), ('붕어빵', '음식'), ('솜사탕', '음식'),
  ('핫도그', '음식'), ('쿠키', '음식'), ('오렌지', '음식'), ('파인애플', '음식'),
  ('체리', '음식'), ('감자', '음식'), ('김치', '음식'), ('만두', '음식'),
  ('국수', '음식'), ('샌드위치', '음식'), ('팝콘', '음식'),
  ('곰', '동물'), ('여우', '동물'), ('늑대', '동물'), ('원숭이', '동물'),
  ('다람쥐', '동물'), ('판다', '동물'), ('얼룩말', '동물'), ('하마', '동물'),
  ('악어', '동물'), ('뱀', '동물'), ('개구리', '동물'), ('문어', '동물'),
  ('게', '동물'), ('달팽이', '동물'), ('꿀벌', '동물'), ('무당벌레', '동물'),
  ('돼지', '동물'), ('소', '동물'), ('닭', '동물'), ('오리', '동물'),
  ('병아리', '동물'), ('햄스터', '동물'), ('고슴도치', '동물'), ('낙타', '동물'),
  ('캥거루', '동물'), ('코알라', '동물'), ('사슴', '동물'), ('고래', '동물'),
  ('돌고래', '동물'),
  ('버스', '사물'), ('기차', '사물'), ('트럭', '사물'), ('헬리콥터', '사물'),
  ('신발', '사물'), ('모자', '사물'), ('장갑', '사물'), ('양말', '사물'),
  ('티셔츠', '사물'), ('바지', '사물'), ('목걸이', '사물'), ('반지', '사물'),
  ('가방', '사물'), ('지갑', '사물'), ('휴대폰', '사물'), ('텔레비전', '사물'),
  ('냉장고', '사물'), ('세탁기', '사물'), ('선풍기', '사물'), ('전구', '사물'),
  ('촛불', '사물'), ('망치', '사물'), ('삽', '사물'), ('빗자루', '사물'),
  ('칫솔', '사물'), ('컵', '사물'), ('접시', '사물'), ('숟가락', '사물'),
  ('젓가락', '사물'), ('포크', '사물'), ('주전자', '사물'), ('냄비', '사물'),
  ('책', '사물'), ('공책', '사물'), ('붓', '사물'), ('물감', '사물'),
  ('바다', '자연'), ('강', '자연'), ('호수', '자연'), ('폭포', '자연'),
  ('사막', '자연'), ('파도', '자연'), ('지구', '자연'), ('토성', '자연'),
  ('우주', '자연'), ('나뭇잎', '자연'), ('새싹', '자연'), ('선인장', '자연'),
  ('야자수', '자연'), ('튤립', '자연'), ('해바라기', '자연'), ('장미', '자연'),
  ('벚꽃', '자연'), ('단풍잎', '자연'), ('모닥불', '자연'),
  ('천사', '캐릭터'), ('요정', '캐릭터'), ('공주', '캐릭터'), ('왕자', '캐릭터'),
  ('닌자', '캐릭터'), ('광대', '캐릭터'), ('좀비', '캐릭터'), ('용', '캐릭터'),
  ('인어공주', '캐릭터'), ('미라', '캐릭터'), ('뱀파이어', '캐릭터'), ('마녀', '캐릭터'),
  ('거인', '캐릭터'),
  ('잠수함', '탈것'), ('열기구', '탈것'), ('스케이트보드', '탈것'), ('요트', '탈것'),
  ('소방차', '탈것'), ('경찰차', '탈것'), ('구급차', '탈것'), ('탱크', '탈것'),
  ('등대', '탈것'), ('궁전', '탈것'), ('텐트', '탈것'), ('그네', '탈것'),
  ('미끄럼틀', '탈것'), ('대관람차', '탈것'),
  ('농구공', '놀이'), ('야구방망이', '놀이'), ('골대', '놀이'), ('낚싯대', '놀이'),
  ('다트', '놀이'), ('볼링공', '놀이'), ('트로피', '놀이'), ('메달', '놀이'),
  ('주사위', '놀이'),
  ('드럼', '악기'), ('바이올린', '악기'), ('트럼펫', '악기'), ('하모니카', '악기'),
  ('마이크', '악기'), ('실로폰', '악기')
on conflict (text) do nothing;

-- 추상 명사 · 유명인물 (게시판 제안 반영 — 창의력/사실묘사 재미). 정확일치라 대표 명칭 위주.
insert into public.ma_cm_words (text, category) values
  ('자유', '추상'), ('행복', '추상'), ('분노', '추상'), ('희망', '추상'),
  ('좌절', '추상'), ('피곤', '추상'), ('사랑', '추상'), ('슬픔', '추상'),
  ('평화', '추상'), ('꿈', '추상'),
  ('메시', '인물'), ('페이커', '인물'), ('손흥민', '인물'), ('아인슈타인', '인물'),
  ('세종대왕', '인물'), ('이순신', '인물'), ('나폴레옹', '인물'), ('링컨', '인물'),
  ('마이클잭슨', '인물'), ('스티브잡스', '인물')
on conflict (text) do nothing;

-- ────────────────────────────────────────────────────────────────────────
-- 갤러리 댓글 (문제별 댓글 + 좋아요). 게시판 댓글과 동일 구조.
-- 운영 DB 에 추가할 때 아래 한 벌만 실행(재실행 안전).
create table if not exists public.ma_cm_comments (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.ma_cm_quizzes(id) on delete cascade,
  account_id  uuid references public.ma_accounts(id) on delete set null,
  author_name text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists ma_cm_comments_quiz_idx on public.ma_cm_comments (quiz_id, created_at);

create table if not exists public.ma_cm_comment_votes (
  comment_id uuid not null references public.ma_cm_comments(id) on delete cascade,
  account_id uuid not null references public.ma_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, account_id)
);
create index if not exists ma_cm_comment_votes_comment_idx on public.ma_cm_comment_votes (comment_id);

alter table public.ma_cm_comments       enable row level security;
alter table public.ma_cm_comment_votes  enable row level security;

-- ════════════════════════════════════════════════════════════════════════
-- 성능 개선 (전체 테이블 스캔 → DB 집계/정렬). 운영 DB 에 아래 한 벌만 실행(재실행 안전).
-- ────────────────────────────────────────────────────────────────────────
-- 1) 순위 집계 뷰 — point_logs 전량 조회+JS합산 대신 사용자당 1행으로 집계.
create or replace view public.ma_cm_rank as
select user_id,
       coalesce(sum(amount), 0)                                          as total,
       coalesce(sum(amount) filter (where reason = 'solve'), 0)          as solve,
       coalesce(sum(amount) filter (where reason = 'author_solved'), 0)  as author
from public.ma_cm_point_logs
group by user_id;

-- 2) 맞추기 "덜 풀린 우선" 정렬용 카운트 — attempts 전량 스캔 대신 컬럼 + 트리거.
alter table public.ma_cm_quizzes add column if not exists attempt_count int not null default 0;
update public.ma_cm_quizzes q
  set attempt_count = (select count(*) from public.ma_cm_attempts a where a.quiz_id = q.id);
create or replace function public.ma_cm_bump_attempt_count()
returns trigger language plpgsql as $$
begin
  update public.ma_cm_quizzes set attempt_count = attempt_count + 1 where id = new.quiz_id;
  return new;
end; $$;
drop trigger if exists ma_cm_attempts_bump on public.ma_cm_attempts;
create trigger ma_cm_attempts_bump after insert on public.ma_cm_attempts
  for each row execute function public.ma_cm_bump_attempt_count();
