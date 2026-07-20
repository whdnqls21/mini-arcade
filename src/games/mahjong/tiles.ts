// 타일 얼굴 — 3종류(만·통·삭) × 1~4. 합쳐서 12가지.

export interface Face {
  num: number;
  suit: "man" | "pin" | "sou";
  mark: string;
  color: string;
}

const SUITS = [
  { suit: "man" as const, mark: "萬", color: "#b83227" },
  { suit: "pin" as const, mark: "筒", color: "#1f7a6a" },
  { suit: "sou" as const, mark: "索", color: "#3d7a2a" },
];

// face id 1~12 → 얼굴
export function faceOf(id: number): Face {
  const s = SUITS[Math.floor((id - 1) / 4)];
  return { num: ((id - 1) % 4) + 1, ...s };
}

export const TILE_BG = "#efe4cf";
export const TILE_EDGE = "#c9b997";
