// 슬라이드 퍼즐 규칙 엔진(화면과 분리 — 노드로 검증). 0 = 빈칸, 완성 = [1..N²-1, 0].
export const SIZE = 3;
export const CELLS = SIZE * SIZE;

export type Board = number[];

export function solvedBoard(): Board {
  const b: Board = [];
  for (let i = 1; i < CELLS; i++) b.push(i);
  b.push(0);
  return b;
}

export function isSolved(b: Board): boolean {
  for (let i = 0; i < CELLS - 1; i++) if (b[i] !== i + 1) return false;
  return b[CELLS - 1] === 0;
}

// 빈칸과 자리를 바꿀 수 있는(상하좌우 인접) 칸 인덱스들.
export function neighbors(blank: number): number[] {
  const r = Math.floor(blank / SIZE);
  const c = blank % SIZE;
  const out: number[] = [];
  if (r > 0) out.push(blank - SIZE);
  if (r < SIZE - 1) out.push(blank + SIZE);
  if (c > 0) out.push(blank - 1);
  if (c < SIZE - 1) out.push(blank + 1);
  return out;
}

// 완성 상태에서 '무작위 합법 이동'만 반복해 섞는다 → 결과는 항상 풀 수 있는 배치.
// 직전 자리로 되돌아가는 이동은 피해(왕복 방지) 더 잘 섞이게 한다. 혹시 완성으로 돌아오면 재시도.
export function shuffle(rand: () => number, moves = 250): Board {
  for (let attempt = 0; attempt < 5; attempt++) {
    const b = solvedBoard();
    let blank = CELLS - 1;
    let prev = -1;
    for (let i = 0; i < moves; i++) {
      const opts = neighbors(blank).filter((n) => n !== prev);
      const pick = opts[Math.floor(rand() * opts.length)];
      [b[blank], b[pick]] = [b[pick], b[blank]];
      prev = blank;
      blank = pick;
    }
    if (!isSolved(b)) return b;
  }
  return solvedBoard(); // 극히 드묾 — 그냥 완성 반환(재셔플은 호출부에서)
}
