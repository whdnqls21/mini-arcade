// 사과게임(Fruit Box) 규칙 — 드래그한 사각형 안 숫자의 합이 정확히 10이면 지워진다.
// 지운 자리는 비어 있는 채로 남고 새 사과가 채워지지 않는다.

export const COLS = 8;
export const ROWS = 11;
export const CELLS = COLS * ROWS;
export const TIME_LIMIT_MS = 90_000;
export const TARGET = 10;

// 0 은 이미 지워진 칸.
export type Board = number[];

export interface Cell {
  c: number;
  r: number;
}
export interface Rect {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

export const at = (board: Board, c: number, r: number) => board[r * COLS + c];

export function normalizeRect(a: Cell, b: Cell): Rect {
  return {
    c0: Math.min(a.c, b.c),
    r0: Math.min(a.r, b.r),
    c1: Math.max(a.c, b.c),
    r1: Math.max(a.r, b.r),
  };
}

// 누적합 — 사각형 합/개수를 매번 순회하지 않고 네 번의 덧뺄셈으로 구한다.
interface Prefix {
  sum: number[];
  cnt: number[];
}

function buildPrefix(board: Board): Prefix {
  const w = COLS + 1;
  const sum = new Array((ROWS + 1) * w).fill(0);
  const cnt = new Array((ROWS + 1) * w).fill(0);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = at(board, c, r);
      const i = (r + 1) * w + (c + 1);
      sum[i] = v + sum[i - 1] + sum[i - w] - sum[i - w - 1];
      cnt[i] = (v > 0 ? 1 : 0) + cnt[i - 1] + cnt[i - w] - cnt[i - w - 1];
    }
  }
  return { sum, cnt };
}

function query(p: number[], rect: Rect): number {
  const w = COLS + 1;
  const { c0, r0, c1, r1 } = rect;
  return (
    p[(r1 + 1) * w + (c1 + 1)] -
    p[r0 * w + (c1 + 1)] -
    p[(r1 + 1) * w + c0] +
    p[r0 * w + c0]
  );
}

export function rectStats(board: Board, rect: Rect): { sum: number; count: number } {
  const p = buildPrefix(board);
  return { sum: query(p.sum, rect), count: query(p.cnt, rect) };
}

// 합이 정확히 10이고 사과가 하나 이상 들어 있어야 유효하다.
export function isValid(board: Board, rect: Rect): boolean {
  const { sum, count } = rectStats(board, rect);
  return sum === TARGET && count > 0;
}

// 지운 개수를 돌려주고, 새 보드를 반환한다(원본 불변).
export function clearRect(board: Board, rect: Rect): { board: Board; cleared: number } {
  const next = board.slice();
  let cleared = 0;
  for (let r = rect.r0; r <= rect.r1; r++) {
    for (let c = rect.c0; c <= rect.c1; c++) {
      const i = r * COLS + c;
      if (next[i] > 0) {
        next[i] = 0;
        cleared++;
      }
    }
  }
  return { board: next, cleared };
}

// 남아 있는 수 중 합이 10인 사각형이 몇 개인지. 0 이면 더 진행할 수 없는 판.
export function countMoves(board: Board): number {
  const p = buildPrefix(board);
  let n = 0;
  for (let r0 = 0; r0 < ROWS; r0++) {
    for (let r1 = r0; r1 < ROWS; r1++) {
      for (let c0 = 0; c0 < COLS; c0++) {
        for (let c1 = c0; c1 < COLS; c1++) {
          const rect = { c0, r0, c1, r1 };
          if (query(p.sum, rect) === TARGET && query(p.cnt, rect) > 0) n++;
        }
      }
    }
  }
  return n;
}

// 시작부터 지울 게 거의 없는 판이 나오지 않도록 최소 해의 수를 보장한다.
const MIN_OPENING_MOVES = 24;
const MAX_TRIES = 40;

export function newBoard(rnd: () => number = Math.random): Board {
  let best: Board = [];
  let bestMoves = -1;
  for (let t = 0; t < MAX_TRIES; t++) {
    const board = Array.from({ length: CELLS }, () => 1 + Math.floor(rnd() * 9));
    const moves = countMoves(board);
    if (moves > bestMoves) {
      bestMoves = moves;
      best = board;
    }
    if (moves >= MIN_OPENING_MOVES) return board;
  }
  // 끝까지 기준을 못 넘기면 그중 가장 나은 판을 쓴다.
  return best;
}
