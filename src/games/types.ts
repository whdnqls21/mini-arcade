import type { ComponentType } from "react";

// 각 게임 컴포넌트가 받는 공통 props.
export interface GamePlayProps {
  // 한 판 종료 시 점수 보고 → 페이지가 서버에 제출.
  onGameOver: (score: number, meta?: Record<string, unknown>) => void;
  bestScore: number | null;
  submitting: boolean;
  // 이어하기 저장을 계정별로 분리하기 위한 id. 비로그인 상태면 null.
  accountId: string | null;
}

// 플레이 화면에 붙는 설명. 라벨은 플레이어가 실제로 궁금해하는 순서대로 —
// 뭘 하는 게임인지 → 어떻게 조작하는지 → 점수는 어떻게 붙는지 → 언제 끝나는지.
export interface GameInfo {
  rows: { label: string; text: string }[];
  tip?: string;
  // 게임별 시각 자료 (예: 수박게임의 과일 단계). 없으면 생략.
  Visual?: ComponentType;
}

// 게임 목록 필터용 분류.
export type GameCategory = "merge" | "clear" | "reaction" | "match" | "focus";

export interface GameEntry {
  Play: ComponentType<GamePlayProps>;
  info?: GameInfo;
  // 게임 목록에 쓰는 아이콘. 게임에서 실제로 보게 될 것을 축소해 보여준다.
  Icon?: ComponentType<{ size?: number }>;
  category: GameCategory;
}
