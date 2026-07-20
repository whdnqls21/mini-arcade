import type { GameEntry } from "./types";
import Game2048 from "./2048/Game2048";

// slug → 플레이 컴포넌트. 새 게임은 여기 등록.
export const GAME_REGISTRY: Record<string, GameEntry> = {
  "2048": { Play: Game2048 },
};
