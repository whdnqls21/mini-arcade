# 뇌지컬 리그 (mini-arcade)

친구들끼리 미니게임 기록을 겨루는 모바일 우선 PWA. 이름 + 4자리 PIN 으로 가입/로그인하고,
게임별 리더보드에서 순위를 겨룬다.

## 스택 / 실행

Next.js 15 (App Router) · React 19 · Tailwind · Supabase(Postgres)

```bash
npm run dev     # 환경변수는 .env.local — .env.example 참고
npm run build
```

## 구조

| 위치 | 역할 |
|---|---|
| `src/games/registry.tsx` | slug → `{ Play, Icon, info }`. **새 게임은 여기 한 곳에만 등록하면** 목록·리더보드·설명 모달·아이콘이 전부 자동으로 붙는다 |
| `src/games/<slug>/` | 게임별 코드. 규칙 엔진(`logic.ts`)과 화면(`*.tsx`)을 분리해 둔다 |
| `src/lib/state.ts` | 앱 상태 조립. 리더보드 계산(계정별 베스트 → 순위)이 여기 있다 |
| `src/app/api/` | 서버 라우트. Supabase 는 service_role 로 **서버에서만** 접근한다(RLS 전면 차단) |
| `src/lib/auth.ts` | 서명된 httpOnly 쿠키 세션. 관리자 세션은 짧게(10분) 유지 |

## 게임 4종

| slug | 이름 | 점수 방식 | 비고 |
|---|---|---|---|
| `2048` | 2048 | `high` | |
| `suika` | 수박게임 | `high` | matter.js 물리 |
| `apple` | 사과게임 | `high` | 90초 제한, 지운 사과 수 |
| `mahjong` | 사천성 | `time` | 완주 시간(ms), **짧을수록 상위** |

점수 정렬은 `high` / `low` / `time` 세 가지를 지원한다(`src/lib/state.ts`). `time` 은 밀리초로
저장하고 오름차순 정렬하며, 완주하지 못하면 기록을 남기지 않는다.

## 조심할 것

- **`supabase/schema.sql` 전체를 다시 실행하지 말 것.** 맨 위 `drop table` 때문에 기록이 전부
  사라진다. 게임을 추가할 때는 파일 하단 주석의 `insert` 한 줄만 SQL Editor 에서 실행한다.
- 게임 slug 는 `ma_scores.game_slug` 에 기록이 쌓여 있으므로 바꾸지 않는다. 표시 이름만 바꾼다.
- 이 저장소는 **브랜치/PR 없이 `main` 에 바로 커밋·푸시**한다.

## 작업 방식

- 규칙 엔진을 화면과 분리해 두고, 노드로 직접 돌려 검증한 뒤 UI 를 붙인다.
  (예: 사천성 판 생성은 100판을 만들어 역순으로 전부 완주되는지까지 확인했다)
- 브라우저 확인이 필요하면 `src/app/dev-*` 임시 페이지를 만들어 보고 **반드시 지운다.**
- 되돌리기 어려운 관리자 기능(기록 초기화)은 게임 이름을 직접 입력해야 진행되게 해 뒀다.

## 아직 안 한 것 / 확인 필요

- **배포 안 됨.** Vercel 등 설정이 없어 로컬에서만 돈다. 폰으로 플레이하려면 배포가 필요하다.
- 관리자 화면의 기록 초기화 확인창이 아직 브라우저 기본 `prompt`/`alert`.
  `src/components/Modal.tsx` 가 있으니 이걸로 교체하면 PWA 에서 더 자연스럽다.
- **실제 기기 조작감 미확인** — 수박게임의 낙하 속도/드롭 쿨다운, 사천성 타일 크기(8×6이라 한 칸이
  40px 남짓). 조정 지점은 각 게임 `logic.ts` 상단 상수.
