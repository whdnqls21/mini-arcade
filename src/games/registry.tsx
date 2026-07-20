import dynamic from "next/dynamic";

import type { GameEntry } from "./types";
import Game2048 from "./2048/Game2048";
import { Icon2048 } from "./2048/Icon2048";
import { AppleIcon } from "./apple/AppleIcon";
import { DinoIcon } from "./dino/DinoIcon";
import { MahjongIcon } from "./mahjong/MahjongIcon";
import { FruitChain, SuikaIcon } from "./suika/FruitIcon";

// 수박게임은 물리 엔진(matter.js)을 쓰므로 별도 청크로 분리하고 SSR 을 끈다.
// 캔버스/AudioContext 는 브라우저에서만 의미가 있어 서버 렌더링할 이유가 없다.
const spinner = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-pitch-line border-t-grass" />
  </div>
);

const SuikaGame = dynamic(() => import("./suika/SuikaGame"), { ssr: false, loading: spinner });

// 사과게임도 캔버스로 그리므로 서버 렌더링할 이유가 없다.
const AppleGame = dynamic(() => import("./apple/AppleGame"), { ssr: false, loading: spinner });

// 사천성은 첫 렌더에서 판을 생성하므로 서버/클라이언트 결과가 달라진다. SSR 을 끈다.
const MahjongGame = dynamic(() => import("./mahjong/MahjongGame"), { ssr: false, loading: spinner });

// 공룡 달리기도 캔버스 + rAF 라 서버에서 렌더할 것이 없다.
const DinoGame = dynamic(() => import("./dino/DinoGame"), { ssr: false, loading: spinner });

// slug → 플레이 컴포넌트 + 설명. 새 게임은 여기 등록.
export const GAME_REGISTRY: Record<string, GameEntry> = {
  "2048": {
    Play: Game2048,
    Icon: Icon2048,
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
    Icon: SuikaIcon,
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
  apple: {
    Play: AppleGame,
    Icon: AppleIcon,
    info: {
      rows: [
        { label: "목표", text: "제한 시간 안에 사과를 최대한 많이 지우세요." },
        { label: "조작", text: "시작을 누른 뒤, 손가락으로 사각형을 그려 사과를 감쌉니다. 드래그하는 동안 현재 합이 위에 표시됩니다." },
        { label: "규칙", text: "감싼 사과의 숫자 합이 정확히 10일 때만 지워집니다. 지운 자리는 빈칸으로 남습니다." },
        { label: "점수", text: "지운 사과 개수가 그대로 점수입니다. 전부 지우면 80점." },
        { label: "종료", text: "시작을 누른 순간부터 90초입니다. 시간이 다 되거나 더 이상 10을 만들 수 없으면 끝납니다." },
      ],
      tip: "2와 8, 3과 7처럼 두 개짜리부터 찾으면 빠릅니다. 큰 숫자(8·9)는 짝이 적으니 먼저 처리하는 편이 좋아요.",
    },
  },
  mahjong: {
    Play: MahjongGame,
    Icon: MahjongIcon,
    info: {
      rows: [
        { label: "목표", text: "48장을 모두 지우세요. 다 지우는 데 걸린 시간이 기록입니다." },
        { label: "조작", text: "시작을 누른 뒤, 같은 과일 두 장을 차례로 누릅니다. 이을 수 있으면 연결선이 보이고 사라집니다." },
        { label: "규칙", text: "두 패를 잇는 길이 꺾임 2번 이하여야 합니다. 길은 빈칸만 지나며, 판 바깥으로 돌아가도 됩니다. 과일 8종이 각각 6장씩 있습니다." },
        { label: "기록", text: "짧을수록 상위입니다. 다 지우지 못하고 그만두면 기록에 남지 않습니다." },
        { label: "막힘", text: "이을 수 있는 짝이 없으면 섞기를 누르세요. 섞는 동안에도 시간은 흘러갑니다." },
      ],
      tip: "가장자리 패부터 걷어내면 안쪽 길이 열립니다. 눈에 보이는 짝을 아무거나 지우기보다, 여러 겹 쌓인 줄을 먼저 뚫는 편이 빠릅니다.",
    },
  },
  dino: {
    Play: DinoGame,
    Icon: DinoIcon,
    info: {
      rows: [
        { label: "목표", text: "장애물을 뛰어넘으며 최대한 멀리 달리세요." },
        { label: "조작", text: "화면을 탭하거나 스페이스·위쪽 화살표로 점프합니다. 공중에서는 다시 뛸 수 없습니다." },
        { label: "점수", text: "달린 거리가 그대로 점수입니다." },
        { label: "난이도", text: "달릴수록 빨라집니다. 처음에는 낮은 장애물만 나오고, 속도가 붙으면 높은 것과 무리가 섞입니다." },
        { label: "종료", text: "장애물에 부딪히면 끝나고, 그때 점수가 기록됩니다." },
      ],
      tip: "장애물이 눈앞에 올 때까지 기다렸다 뛰는 편이 안전합니다. 너무 일찍 뛰면 도착 전에 내려앉아 부딪힙니다.",
    },
  },
};
