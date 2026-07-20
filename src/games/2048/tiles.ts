// 타일 배색 — 게임판과 목록 아이콘이 같은 값을 쓰도록 한곳에 둔다.

export const TILE_BG: Record<number, string> = {
  2: "#1e2a38",
  4: "#233346",
  8: "#2f6f5e",
  16: "#2f8a6e",
  32: "#33a37c",
  64: "#37c08c",
  128: "#c9a227",
  256: "#d4ac2a",
  512: "#e0b62e",
  1024: "#eebf31",
  2048: "#f4c64e",
};

export const tileBg = (v: number) => TILE_BG[v] ?? "#f26d5b";
export const tileColor = (v: number) => (v <= 4 ? "#9db0c4" : v >= 128 ? "#0d1117" : "#eaf1f7");
export const tileFontSize = (v: number) => (v >= 1024 ? "1.05rem" : v >= 128 ? "1.3rem" : "1.55rem");
