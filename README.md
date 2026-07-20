# 미니 아케이드 (mini-arcade)

친구들과 **퍼즐 게임으로 기록 경쟁**하는 모바일 우선 웹앱(PWA).
토너먼트 예측 앱의 인프라(Next.js + Supabase + PIN 세션 + PWA)를 재활용해 만들었다.

- **계정**: 이름 + 4자리 PIN 으로 **자동 승인 가입**. 관리자가 **비활성화/삭제** 가능.
- **게임**: 앱에 내장된 퍼즐을 직접 플레이. 게임별로 점수 정렬 방식(고득점/저점/시간)을 가진다.
- **리더보드**: 게임별 **계정 베스트** 기록으로 순위. 첫 게임은 **2048**(고득점).
- **관리자**: 🕹️ 로고를 빠르게 5번 탭 → `/admin` (PIN). 계정/게임 관리.

## 스택
- Next.js 15 (App Router) · React 19 · Tailwind 3 · TypeScript
- Supabase (Postgres, service_role 서버 라우트) — **토너먼트 앱과 같은 프로젝트 재활용, 테이블 prefix `ma_`**
- PWA (manifest + service worker + 설치 배너)

## 데이터 모델 (`supabase/schema.sql`, prefix `ma_`)
- `ma_accounts` — 계정(name, pin_hash, active)
- `ma_settings` — 관리자 PIN
- `ma_games` — 게임(slug, name, scoring, active, sort)
- `ma_scores` — 기록(account × game, score, meta)

## 시작하기
1. `cp .env.example .env.local` 후 Supabase 값 채우기 (토너먼트와 같은 프로젝트 키 재사용 가능)
2. Supabase SQL Editor 에 `supabase/schema.sql` 실행 (ma_ 테이블 생성 + 2048 시드)
3. `npm install && npm run dev`

## 게임 추가하는 법
1. `src/games/<slug>/` 에 플레이 컴포넌트 작성 (`GamePlayProps`: `onGameOver(score, meta)` 호출)
2. `src/games/registry.ts` 에 `slug → { Play }` 등록
3. `ma_games` 에 행 추가(`scoring` 지정)

## 폴더
```
src/
  app/            # 페이지 + API 라우트
  components/      # StateProvider, Card, AppHeader, BottomTabs, LoginScreen, InstallPrompt
  games/           # 게임 레지스트리 + 각 게임(2048)
  lib/             # auth, supabase, state, types, format, pin
supabase/schema.sql
```
