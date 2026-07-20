import dynamic from "next/dynamic";

import type { GameEntry } from "./types";
import Game2048 from "./2048/Game2048";
import { FruitChain } from "./suika/FruitIcon";

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

// slug → 플레이 컴포넌트 + 설명. 새 게임은 여기 등록.
export const GAME_REGISTRY: Record<string, GameEntry> = {
  "2048": {
    Play: Game2048,
    info: {
      rows: [
        { label: "목표", text: "같은 숫자끼리 합쳐 2048 타일을 만드세요." },
        { label: "조작", text: "방향키 또는 스와이프. 판 위의 모든 타일이 그 방향으로 한 번에 밀립니다." },
        { label: "점수", text: "타일이 합쳐질 때마다 새로 만들어진 숫자만큼 오릅니다." },
        { label: "종료", text: "빈칸이 없고 합칠 타일도 없으면 끝나고, 그때 점수가 기록됩니다." },
      ],
      tip: "가장 큰 타일을 한쪽 구석에 붙여두고 그 줄을 건드리지 않으면 훨씬 오래 버팁니다.",
    },
  },
  suika: {
    Play: SuikaGame,
    info: {
      rows: [
        { label: "목표", text: "같은 과일끼리 닿게 해 더 큰 과일로 키우고, 마지막 수박까지 가보세요." },
        { label: "조작", text: "화면을 좌우로 훑어 위치를 잡고 손을 떼면 떨어집니다." },
        { label: "점수", text: "합쳐서 만든 과일이 클수록 많이 받습니다. 딸기 1점, 수박 55점." },
        { label: "종료", text: "점선 위로 과일이 1초 넘게 머무르면 끝납니다. 잠깐 튀어오르는 건 괜찮아요." },
      ],
      tip: "큰 과일을 아래에 깔고 작은 과일을 위에 얹으면 더미가 안정적입니다. 벽 쪽 좁은 틈은 나중에 손대기 어려우니 비워두세요.",
      Visual: FruitChain,
    },
  },
};
