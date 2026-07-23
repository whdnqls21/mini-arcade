# 캐치마인드 기획서 v5 (뇌지컬 리그 통합안)

> 상태: **설계 확정, 미구현.** v4 그림퀴즈 기획서를 뇌지컬 리그 구조에 맞춰 재정리한 문서.
> 원본: `~/Downloads/그림퀴즈_기획서_v4.md`. 착수 전 이 문서를 기준으로 삼는다.

친구끼리 그림을 그려 서로 맞히는 게임. 다른 게임과 달리 **비동기·유저 생성 콘텐츠(UGC)·
유저 간 점수 정산** 구조라, 기존 "한 판 → 점수 → 계정별 베스트" 모델과 근본적으로 다르다.

## 0. 이 게임이 다른 게임과 다른 점 (제일 중요)

기존 게임: `Play` 컴포넌트가 한 판 끝날 때 `onGameOver(점수)` → `ma_scores` 저장 →
계정별 베스트로 순위 (`src/lib/state.ts`).

캐치마인드: 점수가 **판이 끝나는 순간에 안 나온다.** 내가 출제하면 그 순간 0점이고,
**며칠 뒤 남이 내 그림을 맞히면 그때 내 점수가 오른다.** 즉 점수는 "한 판의 끝"이 아니라
**계속 쌓이는 누적 원장**(`point_logs` 합계)이다. `onGameOver` 로는 담을 수 없다.

## 1. 확정 사항 (논의로 결정됨)

| 항목 | 결정 |
|---|---|
| **이름** | 캐치마인드 유지 (넷마블 등록 상표임을 인지. 비공개 친구 앱이라 실무상 문제 소지는 낮음) |
| **통합 방식** | **하이브리드(C).** 게임 목록엔 카드로 노출하되, 표준 `Play/onGameOver` 페이지가 아니라 자체 다화면 플로우로 라우팅. 순위는 `point_logs` 누적 합계로 별도 계산. 베스트 모델·시즌 구상을 오염시키지 않는다 |
| **점수 수치** | 정답자 30/20/10(1·2·3차), 출제자 10/5/3. 실패 0. (조정 전제 유지) |
| **별점** | **점수 보상 없음, 품질 지표로만.** 좋은 그림 정렬·신고 판단 참고용 |
| **순위 표시** | **총점 + 정답왕(solve 합계) + 그림왕(author 합계)** 3뷰. 모두 같은 `point_logs` 에서 계산 |
| **출제자 누적 비대칭** | 출제자 점수는 상한 없이 누적(정답자는 문제 수만큼 상한). v1은 수용, 총점 뷰에서만 그림왕이 유리한 정도. 나중에 밸런스로 조정 |
| **힌트** | 1차 없음 / 2차 글자 수(○○○) / **3차 초성 전체**(예: 캐치마인드→ㅋㅊㅁㅇㄷ). 서버가 단계별로 계산해 내려주고 제시어 원문은 클라에 절대 안 보냄 |
| **정답 판정** | **단일 정답 v1.** trim + 공백 제거 + 대소문자 무시, 서버에서만 판정 |
| **이미지 저장** | **Supabase Storage 비공개 버킷 + 서명 URL**(서버 발급). 현재 "RLS 전면 잠금·서버 전용" 모델과 일치 |
| **캔버스** | 펜 색·굵기(3단)·지우개·undo·전체 지우기, 시간제한 없음. undo=획(stroke) 배열 재렌더. 저장 전 축소 + WebP 압축. 모바일 `touch-none` |
| **콜드 스타트** | 초기 시드 없음. **런칭 넛지**("처음엔 다 같이 2~3개씩 그려줘" 공지)로 시작 |
| **맞추기 큐** | 본인 출제 아님 + 내가 finished 아님 + 미삭제 중, **덜 풀린 문제 약한 우선**, 없으면 랜덤 |
| **제시어 뽑기** | 랜덤 3개 중 1개. **다시 뽑기 v1 무제한**(남발되면 그때 제한 추가) |
| **신고** | **임계 3회 도달 시 자동 숨김(soft) + 관리자 검토(복구/영구삭제).** 사유 3종(성의없음/부적절/정답유출), 1인 1문제 1회, 지급 점수 회수 안 함, 출제자 알림 v2 |
| **솔로모드** | 캐치마인드는 P2P 사회적 게임이라 솔로 취지와 충돌 → **솔로 유저에겐 게임 자체를 숨김** |
| **태그** | 두뇌 능력 축에 **'창의력' 신규 태그 추가** |

## 2. 앱 통합 상세 (하이브리드 C 구현 메모)

- **게임 목록 카드**: 발견성을 위해 목록에 노출. 그러려면 registry/게임 목록 경로에
  "런처형" 엔트리가 필요하다 — 기존 `GameEntry` 는 `Play`(점수 보고자)를 전제하므로,
  **`Play` 대신 자체 라우트로 보내는 런처 변형**을 하나 추가한다(예: `href` 또는
  `launcher: true`). `src/games/types.ts` / `src/games/registry.tsx` 소폭 확장.
- **게임 화면**: `src/app/(main)/games/[slug]/page.tsx` 의 표준 점수 페이지를 타지 않고,
  캐치마인드 전용 다화면 플로우로 분기.
- **순위**: `src/lib/state.ts` 의 베스트 계산과 별개로, `point_logs` 를 reason 으로 집계해
  총점/정답왕/그림왕 3뷰를 만든다. 순위 탭에 특별 섹션으로 노출.
- **태그**: `GameTag` 에 `creative`(창의력) 추가 → `src/app/(main)/page.tsx` 의
  `TAG_LABEL`/`TAG_ORDER` 에 반영.

## 3. 화면 (v4 §6 유지)

| 화면 | 내용 |
|---|---|
| 게임 홈 | [문제출제] / [맞추기] + 내 점수(총점·정답왕·그림왕) |
| 제시어 선택 | 제시어 3개 중 선택 (다시 뽑기 무제한) |
| 그리기 | 제시어 + 캔버스 + 도구 + 제출 |
| 맞추기 | 그림 + 정답 입력 + 남은 기회 + 단계별 힌트 영역 + 신고 버튼 |
| 결과 | 정답 공개 + 획득 점수 + 오답 TOP3(있을 때) + 별점 평가 + 신고 + [다음 문제] |
| 안내 | 풀 문제 없음 → 출제 유도 |

## 4. DB 스키마 (ma_cm_ prefix, ma_accounts 참조)

> v4 스키마를 이 프로젝트 규칙에 맞춰 번역: 모든 테이블 `ma_cm_` prefix,
> `users(id)` → `ma_accounts(id)`, RLS 전면 ON(서버 service_role 전용).
> **`supabase/schema.sql` 전체 재실행 금지** — 아래는 신규 추가분으로만 실행.

```sql
-- 제시어 사전
create table public.ma_cm_words (
  id        serial primary key,
  text      text not null,
  category  text,
  is_active boolean not null default true
);

-- 문제(그림)
create table public.ma_cm_quizzes (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.ma_accounts(id) on delete cascade,
  word_id      int  not null references public.ma_cm_words(id),
  image_path   text not null,                 -- Storage 오브젝트 경로(서명 URL로 조회)
  report_count int  not null default 0,
  is_hidden    boolean not null default false, -- 신고 3회 누적 시 자동 숨김(soft)
  is_deleted   boolean not null default false, -- 관리자 영구삭제
  created_at   timestamptz not null default now()
);

-- 사용자별 문제 풀이 상태(문제당 1행)
create table public.ma_cm_attempts (
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

-- 매 추측 로그(오답 TOP3 집계용)
create table public.ma_cm_guesses (
  id         uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ma_cm_attempts(id) on delete cascade,
  guess      text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

-- 별점(품질 지표, 무보상)
create table public.ma_cm_ratings (
  quiz_id    uuid references public.ma_cm_quizzes(id) on delete cascade,
  user_id    uuid references public.ma_accounts(id) on delete cascade,
  stars      int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);

-- 신고(1인 1문제 1회)
create table public.ma_cm_reports (
  quiz_id    uuid references public.ma_cm_quizzes(id) on delete cascade,
  user_id    uuid references public.ma_accounts(id) on delete cascade,
  reason     text,   -- 'lazy' | 'inappropriate' | 'answer_leak'
  created_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);

-- 포인트 원장(순위 = 이 합계. reason별로 정답왕/그림왕 분리)
create table public.ma_cm_point_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.ma_accounts(id) on delete cascade,
  amount      int  not null,
  reason      text not null,   -- 'solve' | 'author_solved'
  ref_quiz_id uuid,
  created_at  timestamptz not null default now()
);
create index ma_cm_point_logs_user_idx on public.ma_cm_point_logs (user_id);

alter table public.ma_cm_words      enable row level security;
alter table public.ma_cm_quizzes    enable row level security;
alter table public.ma_cm_attempts   enable row level security;
alter table public.ma_cm_guesses    enable row level security;
alter table public.ma_cm_ratings    enable row level security;
alter table public.ma_cm_reports    enable row level security;
alter table public.ma_cm_point_logs enable row level security;
```

- 제시어 원문은 클라이언트에 안 내려준다. 힌트(글자 수/초성)는 서버가 시도 단계에 따라 계산.
- 랜덤 출제: `author_id != 나 + finished 아님 + is_hidden/is_deleted=false` 중 덜 풀린 우선.
- 신고 insert 시 `report_count` 증가, 3 도달 시 `is_hidden=true`. 관리자가 검토 후
  복구(`is_hidden=false`) 또는 영구삭제(`is_deleted=true`).

## 5. API 초안 (v4 §8 + 조정)

```
GET  /api/cm/words/pick               제시어 3개 랜덤(무제한 재요청)
POST /api/cm/quizzes                  문제 등록 {word_id, image}  → Storage 업로드
GET  /api/cm/quizzes/next             큐 로직으로 미해결 문제 1개(서명 URL 포함)
POST /api/cm/attempts/:id/guess       답 제출 → {correct, remaining, hint?, score?}
GET  /api/cm/quizzes/:id/result       정답 + 오답 TOP3 + 점수 (finished 사용자만)
POST /api/cm/quizzes/:id/rating       별점 {stars}   (품질 지표)
POST /api/cm/quizzes/:id/report       신고 {reason}
GET  /api/cm/me/stats                 내 총점/정답왕/그림왕/기록
GET  /api/cm/rank                     총점·정답왕·그림왕 순위
```

## 6. 착수 단계 (한 번에 다 하지 말 것)

1. **기반** — 스키마 + Storage 버킷 + 출제 흐름(제시어 뽑기→캔버스→업로드→등록) +
   맞추기 흐름(큐→그림→정답 제출→단계별 힌트→정답 공개) + 서버 판정.
   순위/신고/별점은 최소로.
2. **점수·순위** — `point_logs` 적립 + 총점/정답왕/그림왕 3뷰 + 오답 TOP3.
3. **모더레이션·별점** — 신고 자동 숨김(3회) + 관리자 검토 UI + 별점(품질 지표).

## 7. 남은 준비물 (구현과 별개)

- **제시어 초기 목록 큐레이션** — 단일 정답이 자연스러운 명사 위주(사과·기린·안경…).
  `ma_cm_words` 시드. 콘텐츠 작업이라 미리 모아둘 것.
- **런칭 공지 문구** — 콜드 스타트 넛지("처음엔 다 같이 2~3개씩 그려줘").

## 8. v1에서 의도적으로 뺀 것 (인지된 트레이드오프)

- 동의어/별칭 정답(단일 정답만) → 억울함은 신고/재도전으로.
- 그림에 정답 글자 써넣기·부계정 자문자답 어뷰징 → '정답 유출' 신고로 커버.
- 출제자 점수 상한(무한 누적 수용).
- 출제자 알림, 제시어 다시 뽑기 제한 → 필요 시 후속.
