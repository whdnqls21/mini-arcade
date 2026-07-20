// 타일 얼굴 — 수박게임의 과일 그림을 그대로 쓴다.
// 숫자+한자(萬/筒/索)는 작은 화면에서 구분이 잘 안 돼 과일로 바꿨다.

import { FRUITS } from "@/games/suika/fruits";

export interface Face {
  fruit: number; // FRUITS 인덱스
  bg: string; // 타일 바탕색
  name: string;
}

// 서로 색이 가장 멀리 떨어진 과일 8종만 고른다.
// (체리·딸기·사과는 다 붉고, 한라봉·감은 다 주황이라 함께 쓰지 않는다.)
const PICKS: { fruit: number; bg: string }[] = [
  { fruit: 0, bg: "#f4ccd0" }, // 체리 — 장미
  { fruit: 2, bg: "#dcd2f0" }, // 포도 — 라일락
  { fruit: 3, bg: "#fadfb8" }, // 한라봉 — 살구
  { fruit: 6, bg: "#e2eebd" }, // 배 — 라임
  { fruit: 7, bg: "#ecd9c6" }, // 복숭아 — 모래
  { fruit: 8, bg: "#f8efb6" }, // 파인애플 — 버터
  { fruit: 9, bg: "#cbe9d5" }, // 멜론 — 민트
  { fruit: 10, bg: "#c4dff0" }, // 수박 — 하늘
];

export const FACE_COUNT = PICKS.length;

// face id 1~8 → 얼굴
export function faceOf(id: number): Face {
  const p = PICKS[(id - 1) % PICKS.length];
  return { fruit: p.fruit, bg: p.bg, name: FRUITS[p.fruit].name };
}

export const TILE_EDGE = "rgba(0,0,0,0.18)";
