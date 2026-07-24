import dynamic from "next/dynamic";

import type { GameEntry } from "./types";
import Game2048 from "./2048/Game2048";
import { Icon2048 } from "./2048/Icon2048";
import { AppleIcon } from "./apple/AppleIcon";
import { DinoIcon } from "./dino/DinoIcon";
import { GreenlightIcon } from "./greenlight/GreenlightIcon";
import { MahjongIcon } from "./mahjong/MahjongIcon";
import { MemoryIcon } from "./memory/MemoryIcon";
import { PoopIcon } from "./poop/PoopIcon";
import { SchulteIcon } from "./schulte/SchulteIcon";
import { WhackIcon } from "./whack/WhackIcon";
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

// 크롬 다이노도 캔버스 + rAF 라 서버에서 렌더할 것이 없다.
const DinoGame = dynamic(() => import("./dino/DinoGame"), { ssr: false, loading: spinner });

// 카드 짝맞추기는 마운트 시 카드를 섞으므로(Math.random) SSR 을 끈다.
const MemoryGame = dynamic(() => import("./memory/MemoryGame"), { ssr: false, loading: spinner });

// 두더지 잡기도 rAF/랜덤 등장이라 서버에서 렌더할 것이 없다.
const WhackGame = dynamic(() => import("./whack/WhackGame"), { ssr: false, loading: spinner });

// 1 to 30 은 마운트 시 숫자를 섞으므로(Math.random) SSR 을 끈다.
const SchulteGame = dynamic(() => import("./schulte/SchulteGame"), { ssr: false, loading: spinner });

// 똥 피하기도 캔버스 + rAF 라 서버에서 렌더할 것이 없다.
const PoopGame = dynamic(() => import("./poop/PoopGame"), { ssr: false, loading: spinner });

// 그린라이트는 타이머/랜덤 기반이라 SSR 을 끈다.
const GreenlightGame = dynamic(() => import("./greenlight/GreenlightGame"), { ssr: false, loading: spinner });

// slug → 플레이 컴포넌트 + 설명. 새 게임은 여기 등록.
export const GAME_REGISTRY: Record<string, GameEntry> = {
  "2048": {
    Play: Game2048,
    Icon: Icon2048,
    tags: ["calc", "strategy"],
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
    tags: ["strategy"],
    info: {
      rows: [
        { label: "목표", text: "같은 과일끼리 닿게 해 더 큰 과일로 키우고, 마지막 수박까지 가보세요." },
        { label: "조작", text: "화면을 좌우로 훑어 위치를 잡고 손을 떼면 떨어집니다." },
        { label: "점수", text: "합쳐서 만든 과일이 클수록 많이 받습니다. 딸기 1점, 수박 55점." },
        { label: "종료", text: "점선 위로 과일이 2초 넘게 멈춰 있으면 끝납니다. 흔들리거나 잠깐 튀어오르는 건 괜찮아요." },
      ],
      tip: "큰 과일을 아래에 깔고 작은 과일을 위에 얹으면 더미가 안정적입니다. 벽 쪽 좁은 틈은 나중에 손대기 어려우니 비워두세요.",
      Visual: FruitChain,
    },
  },
  apple: {
    Play: AppleGame,
    Icon: AppleIcon,
    tags: ["calc", "focus"],
    info: {
      rows: [
        { label: "목표", text: "제한 시간 안에 사과를 최대한 많이 지우세요." },
        { label: "조작", text: "시작을 누른 뒤, 손가락으로 사각형을 그려 사과를 감쌉니다. 드래그하는 동안 현재 합이 위에 표시됩니다." },
        { label: "규칙", text: "감싼 사과의 숫자 합이 정확히 10일 때만 지워집니다. 지운 자리는 빈칸으로 남습니다." },
        { label: "점수", text: "지운 사과 개수가 그대로 점수입니다. 전부 지우면 130점." },
        { label: "종료", text: "시작을 누른 순간부터 80초입니다. 시간이 다 되거나 더 이상 10을 만들 수 없으면 끝납니다." },
      ],
      tip: "2와 8, 3과 7처럼 두 개짜리부터 찾으면 빠릅니다. 큰 숫자(8·9)는 짝이 적으니 먼저 처리하는 편이 좋아요.",
    },
  },
  mahjong: {
    Play: MahjongGame,
    Icon: MahjongIcon,
    tags: ["memory", "focus", "strategy"],
    info: {
      rows: [
        { label: "목표", text: "48장을 모두 지우세요. 다 지우는 데 걸린 시간이 기록입니다." },
        { label: "조작", text: "시작을 누른 뒤, 같은 과일 두 장을 차례로 누릅니다. 이을 수 있으면 연결선이 보이고 사라집니다." },
        { label: "규칙", text: "두 패를 잇는 길이 꺾임 2번 이하여야 합니다. 길은 빈칸만 지나며, 판 바깥으로 돌아가도 됩니다. 과일 8종이 각각 6장씩 있습니다." },
        { label: "기록", text: "짧을수록 상위입니다. 다 지우지 못하고 그만두면 기록에 남지 않습니다." },
        { label: "막힘", text: "이을 수 있는 짝이 하나도 없으면 남은 패를 자동으로 다시 깝니다. 따로 할 일은 없고, 그동안에도 시간은 흘러갑니다." },
      ],
      tip: "가장자리 패부터 걷어내면 안쪽 길이 열립니다. 눈에 보이는 짝을 아무거나 지우기보다, 여러 겹 쌓인 줄을 먼저 뚫는 편이 빠릅니다.",
    },
  },
  memory: {
    Play: MemoryGame,
    Icon: MemoryIcon,
    tags: ["memory"],
    info: {
      rows: [
        { label: "목표", text: "카드를 뒤집어 같은 과일 짝을 모두 맞추세요." },
        { label: "조작", text: "카드를 탭해 뒤집습니다. 두 장이 같으면 그대로, 다르면 다시 덮입니다." },
        { label: "기록", text: "10쌍을 모두 맞추는 데 걸린 시간이 기록입니다. 짧을수록 상위!" },
        { label: "팁", text: "다른 카드를 뒤집을 때 위치를 기억해두면 나중에 한 번에 맞출 수 있어요." },
      ],
      tip: "처음 몇 장은 어차피 모르니 빠르게 넘기고, 위치가 쌓이면 확실한 짝부터 지우세요.",
    },
  },
  whack: {
    Play: WhackGame,
    Icon: WhackIcon,
    tags: ["reflex"],
    info: {
      rows: [
        { label: "목표", text: "구멍에서 튀어나오는 두더지를 제한 시간 안에 최대한 많이 잡으세요." },
        { label: "조작", text: "두더지가 나온 구멍을 탭합니다. 잠깐 나왔다 사라지니 재빨리 눌러야 해요." },
        { label: "규칙", text: "빨간 눈에 화난 표정의 나쁜 두더지도 섞여 나옵니다. 누르면 점수가 2점 깎이니 건드리지 마세요." },
        { label: "점수", text: "잡은 두더지 하나당 1점. 시간이 갈수록 더 빨리, 더 많이 튀어나옵니다." },
        { label: "종료", text: "시작을 누른 순간부터 30초. 시간이 다 되면 그때 점수가 기록됩니다." },
      ],
      tip: "한곳만 노려보지 말고 판 전체를 넓게 보세요. 나쁜 두더지는 그냥 두면 알아서 사라집니다.",
    },
  },
  schulte: {
    Play: SchulteGame,
    Icon: SchulteIcon,
    tags: ["reflex", "focus"],
    info: {
      rows: [
        { label: "목표", text: "1부터 50까지 순서대로 모두 탭하세요. 걸린 시간이 기록입니다." },
        { label: "조작", text: "시작을 누른 뒤 숫자를 1→2→3… 순서로 탭합니다. 다음에 찾을 숫자는 위 '다음'에 표시돼요." },
        { label: "규칙", text: "5×5 판에 25개가 보이고, 낮은 수를 누르면 그 칸에 아직 안 나온 큰 수(26~50)가 랜덤으로 나타납니다. 후반 26~50은 누르면 빈칸이 돼요." },
        { label: "기록", text: "50까지 다 누른 시간이 기록입니다. 짧을수록 상위! 순서가 틀리면 잠깐 빨갛게 표시될 뿐 감점은 없어요." },
        { label: "종료", text: "50을 누르면 끝납니다. 시작 전 배치는 가려지고, 시작할 때마다 새로 섞입니다." },
      ],
      tip: "한 칸만 뚫어져라 보지 말고 판 전체를 시야에 담으세요. 다음 숫자 몇 개를 미리 찾아두면 훨씬 빨라집니다.",
    },
  },
  poop: {
    Play: PoopGame,
    Icon: PoopIcon,
    tags: ["reflex"],
    info: {
      rows: [
        { label: "목표", text: "위에서 떨어지는 똥을 피해 최대한 오래 버티세요." },
        { label: "조작", text: "아래 ◀ ▶ 버튼을 누르는 동안 졸라맨이 그 방향으로 움직입니다. 키보드는 좌우 화살표." },
        { label: "점수", text: "버틴 시간(초)이 그대로 점수입니다. 시간이 갈수록 똥이 더 빨리, 더 많이 떨어져요." },
        { label: "종료", text: "똥에 한 번이라도 맞으면 끝나고, 그때까지 버틴 시간이 기록됩니다." },
      ],
      tip: "한쪽 끝에 몰리면 피할 공간이 없어요. 가운데를 기준으로 최소한만 움직이며 틈을 노리세요.",
    },
  },
  dino: {
    Play: DinoGame,
    Icon: DinoIcon,
    tags: ["reflex"],
    info: {
      rows: [
        { label: "목표", text: "장애물을 뛰어넘으며 최대한 멀리 달리세요." },
        { label: "조작", text: "아래 버튼으로 조작합니다. 왼쪽은 슬라이드(누르는 동안), 오른쪽은 점프. 키보드는 아래=슬라이드, 스페이스/위=점프." },
        { label: "점수", text: "달린 거리가 그대로 점수입니다." },
        { label: "장애물", text: "초록 선인장은 점프로 넘고, 위에서 내려온 붉은 바는 몸을 낮춰 슬라이드로 지납니다. 달릴수록 빨라집니다." },
        { label: "종료", text: "장애물에 부딪히면 끝나고, 그때 점수가 기록됩니다." },
      ],
      tip: "장애물이 눈앞에 올 때까지 기다렸다 뛰는 편이 안전합니다. 너무 일찍 뛰면 도착 전에 내려앉아 부딪힙니다.",
    },
  },
  greenlight: {
    Play: GreenlightGame,
    Icon: GreenlightIcon,
    tags: ["reflex", "focus"],
    info: {
      rows: [
        { label: "목표", text: "빨간 화면이 초록으로 바뀌는 순간을 최대한 빨리 탭하세요." },
        { label: "조작", text: "화면 아무 데나 탭. 5라운드를 하고 각 반응 시간을 합산합니다." },
        { label: "규칙", text: "초록으로 바뀌기 전에 누르거나 사람이 반응할 수 없을 만큼 빨리 누르면 '너무 빨라요!'가 뜨고, 성급 페널티(+0.3초)가 합계에 붙습니다. 그 라운드는 다시 해요." },
        { label: "기록", text: "5라운드 합산 시간이 기록입니다. 짧을수록 상위!" },
        { label: "종료", text: "5라운드를 마치면 합산 시간이 기록됩니다. 중간에 그만두면 기록되지 않아요." },
      ],
      tip: "초록을 '예상'하지 말고 '반응'하세요. 미리 누르려다 성급 판정만 받습니다. 손가락은 화면 근처에 대기.",
    },
  },
};
