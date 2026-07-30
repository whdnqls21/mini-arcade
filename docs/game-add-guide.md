# 게임 추가 가이드라인

새 미니게임을 추가할 때 밟는 순서와 **빠지기 쉬운 지점**을 정리한다.
(실제로 Kuku Kube·스트룹·암산 스프린트 3종을 추가하며 겪은 것 기준)

핵심 원칙: **규칙 엔진을 화면과 분리하고, 노드로 검증한 뒤 UI를 붙인다.**

---

## 0. 먼저 정할 것

| 항목 | 규칙 |
|---|---|
| **slug** | 영소문자, 예: `stroop`. **한 번 정하면 절대 안 바꾼다** — 기록이 `ma_scores.game_slug` 에 쌓인다. 표시 이름만 바꾼다. |
| **표시 이름** | `ma_games.name`. 언제든 변경 가능(예: Kuku Kube). |
| **점수 방식(scoring)** | `high`(고득점) · `low`(저점) · `time`(짧을수록 상위, ms) · `htime`(오래 버틸수록, ms) |
| **태그(tags)** | `reflex(순발력)·memory(기억력)·focus(집중력)·observe(눈썰미)·calc(계산)·strategy(전략)·creative(창의력)` 중 **2~3개**. 라벨/순서는 `src/app/(main)/page.tsx` 의 `TAG_LABEL·TAG_ORDER`, 타입은 `src/games/types.ts` 의 `GameTag`. 새 축이 필요하면 세 곳에 함께 추가 |

`scoring` 은 `src/lib/state.ts` 의 정렬(`sortDir`)과 `src/lib/format.ts` 표시를 자동으로 탄다.
`time·htime` 은 **밀리초(ms)로 저장**하고 표시는 `formatScore` 가 '초'로 바꾼다.

---

## 1. 규칙 엔진(logic) 먼저 — 화면과 분리

- 순수 로직은 `src/games/<slug>/logic.ts` 로 빼고, **노드로 대량 검증**한다.
  (예: 사천성은 100판을 만들어 전부 완주되는지, 암산은 30만 문제의 정답이 실제 계산값과 일치하는지 확인했다.)
- 랜덤·타이머·오디오는 브라우저 전용 → 로직은 순수 함수로 두고 UI 에서 호출.

## 2. 게임 컴포넌트 — `src/games/<slug>/<Name>Game.tsx`

- `"use client"` + `GamePlayProps` 를 받는다:
  ```ts
  { onGameOver(score, meta?), bestScore, submitting, accountId }
  ```
- **판이 끝나면** `onGameOver(score, { game: slug })` 를 딱 한 번 호출(중복 방지: `reported` ref).
  페이지가 `POST /api/games/record` 로 저장한다.
- 공용 컴포넌트 재사용: `StartGate`(시작 게이트), `RetryButton`(다시 하기 — `submitting` 중 잠금). `@/games/shared`.
- 효과음: `@/games/sound` (`tone·sequence·tick·thud`, 에셋 0). 제한시간 게임은 **마지막 5초 `tick()`, 1초 `tick(true)`**.
- **모바일**: 인터랙티브 요소(판·버튼)에 `touch-none select-none` — 드래그로 화면이 안 밀리게.
- rAF/interval 은 언마운트·정지 시 **cleanup**.

## 3. 아이콘 — `src/games/<slug>/<Name>Icon.tsx`

- `{ size }` 를 받는 SVG. 목록·베타에서 44px 로 노출된다. "게임에서 실제 보게 될 것"을 축소해 보여준다.

## 4. 레지스트리 등록 — `src/games/registry.tsx`

- `dynamic(() => import(...), { ssr: false })` 로 불러온다.
  **SSR 은 끈다** — `Math.random()`·`performance.now()`·`AudioContext`·마운트 시 랜덤 배치는 서버/클라 결과가 달라진다.
- `GAME_REGISTRY[slug] = { Play, Icon, tags, info }`.
- `info.rows` 는 플레이어가 궁금한 순서로: **목표 → 조작 → 규칙/점수 → 종료**, 그리고 `tip`.
  > ⚠️ **문구가 실제 구현과 일치하는지 반드시 대조**(제한시간·감점 초·선택지 수·격자 크기 등).
  > `StartGate` 의 `title`·`lines` 도 마찬가지(시간·조작 문구).

## 5. (권장) 베타 테스트 — 공개 전 관리자만

- `ma_games` 에 넣기 전이라 일반 사용자에겐 안 보인다. `src/app/admin/page.tsx` 의 `BETA_GAMES` 에 `{ slug, name }` 추가 →
  관리자 **베타 탭**에서 관리자 PIN 뒤로 플레이해 확인(기록 저장 안 함).
- 공개(6번) 후에는 **`BETA_GAMES` 에서 제거**(안 그러면 목록·베타에 중복).

## 6. 공개 — `ma_games` 에 한 줄 insert (SQL Editor)

`supabase/schema.sql` **전체 재실행 금지**(맨 위 drop 으로 기록이 날아간다). 아래 한 줄만:

```sql
insert into public.ma_games (slug, name, description, scoring, sort) values
  ('<slug>', '<이름>', '<목록 카드 한 줄 설명>', 'high', <정렬번호>)
on conflict (slug) do nothing;
```

- 실행 즉시 일반 사용자에게 공개되고 목록·리더보드에 뜬다. `sort` 로 목록 순서 조정.
- `active=false` 로 넣으면 숨긴 채 두었다가 관리자 화면에서 노출 토글도 가능.

## 7. 획득/시즌 아이콘 — **잊기 쉬움** (`src/lib/icons.ts`)

새 게임에 "1위" 보상을 주려면 **직접 추가**해야 한다. 안 하면 그 게임엔 1위 칭호가 없다.

- **올타임 1위 칭호**: `EARNED` 에 `["champ:<slug>", 이모지, 이름, 힌트, { kind:"champion", slug:"<slug>" }]`.
  판정은 `state.ts eligibleIcons` 가 자동(단, **5명 이상 겨룬 게임에서만** 인정 — `MIN_RANKED_FOR_ICON`).
- **시즌 종목 1등 금테**: `SEASON_CHAMP` 에 `["schamp:<slug>", 이모지, "시즌 <이름>"]`.
  > ⚠️ **이걸 안 넣고 시즌 종목으로 쓰면**, 시즌 종료 때 `seasonEnd` 가 `schamp:<slug>` 를 지급하는데
  > 카탈로그에 없어서 **빈 아이콘**이 된다. 시즌에 넣을 거면 반드시 추가.
- 이모지는 기존과 겹치지 않게(코인 구분). champ 와 schamp 는 같은 이모지를 공유하고 이름만 "시즌"을 붙인다.

## 8. 시즌 편입 (선택)

- 관리자 시즌 생성 시 종목에 포함하면 끝. F1 포인트·MVP·명예의 전당·종목별 1등 스냅샷은
  `game_slug` 기반이라 **자동으로 편입**된다(`scoring` 방향도 자동 반영).

## 9. 검증 → 커밋 → 공지

- `npx tsc --noEmit` + `npm run build` 통과. 순수 로직은 노드로 대량 검증.
- 브라우저 확인이 필요하면 `src/app/dev-*` 임시 페이지를 만들고 **반드시 지운다.**
- `main` 에 바로 커밋·푸시.
- **업데이트 공지**(게시판)는 관리자 화면 → 게시판 → 공지 작성.

---

## 빠지기 쉬운 체크리스트 (요약)

- [ ] slug 확정(불변) / 이름·설명·scoring·tags·sort
- [ ] 로직 분리 + 노드 검증(순수 함수 대량 실행)
- [ ] `onGameOver` 중복 방지(`reported` ref), 판 종료 시 1회
- [ ] `touch-none select-none`(모바일 드래그 방지)
- [ ] `dynamic ssr:false`(랜덤·타이머·오디오·캔버스)
- [ ] **info/StartGate 문구 = 실제 구현**(시간·감점·선택지·크기)
- [ ] 아이콘(Icon) + **champ:<slug>** + **schamp:<slug>**(시즌 쓸 거면 필수)
- [ ] 어뷰징 하한 필요? (`api/games/record` `MIN_TOTAL` — 반응/타임 게임)
- [ ] best 표시 단위 = `formatScore` 와 일치
- [ ] 베타 테스트 → 공개 SQL → **베타 목록에서 제거**
- [ ] tsc + build 통과, dev-* 임시 페이지 삭제
- [ ] 커밋·푸시 + 업데이트 공지
- [ ] (선택) 시즌 종목 편입

## 아직 자동이 아닌 것(수동 챙기기)

- **1위/시즌 아이콘**은 게임 추가와 별개로 `icons.ts` 에 손으로 추가.
- **어뷰징 하한**은 게임 특성상 필요하면 record 라우트에 개별 추가.
- **CLAUDE.md 상단 "게임 4종" 표는 오래된 정보** — 정식 목록은 `ma_games`. 참고만.
