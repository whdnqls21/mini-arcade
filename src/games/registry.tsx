import dynamic from "next/dynamic";

import type { GameEntry } from "./types";
import Game2048 from "./2048/Game2048";

// 수박게임은 물리 엔진(matter.js)을 쓰므로 별도 청크로 분리하고 SSR 을 끈다.
// 캔버스/AudioContext 는 브라우저에서만 의미가 있어 서버 렌더링할 이유가 없다.
const SuikaGame = dynamic(() => import("./suika/SuikaGame"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-pitch-line border-t-grass" />
    </div>
  ),
});

// slug → 플레이 컴포넌트. 새 게임은 여기 등록.
export const GAME_REGISTRY: Record<string, GameEntry> = {
  "2048": { Play: Game2048 },
  suika: { Play: SuikaGame },
};
