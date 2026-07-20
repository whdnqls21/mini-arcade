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

export interface GameEntry {
  Play: ComponentType<GamePlayProps>;
}
