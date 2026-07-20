// 사천성(Shisen-Sho) 규칙 — 같은 타일 둘을 꺾임 2번 이하 경로로 이으면 제거된다.
// 경로는 빈칸만 지날 수 있고, 판 바깥을 돌아가는 것도 허용된다.

export const COLS = 8;
export const ROWS = 6;
export const FACES = 8; // 타일 종류 — 과일 8종
export const COPIES = 6; // 종류당 장수
export const TOTAL = FACES * COPIES; // 48장 = 24쌍

// 0 은 이미 지운 칸, 1~FACES 는 타일 종류.
export type Board = number[];

export interface Cell {
  c: number;
  r: number;
}

// 경로가 판 바깥으로 돌아갈 수 있어야 하므로 사방에 한 칸씩 여백을 둔 좌표계를 쓴다.
const PW = COLS + 2;
const PH = ROWS + 2;
const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const MAX_TURNS = 2;

export const cellOf = (i: number): Cell => ({ c: i % COLS, r: Math.floor(i / COLS) });
export const indexOf = (c: number, r: number) => r * COLS + c;

interface Node {
  x: number;
  y: number;
  dir: number;
  turns: number;
  prev: Node | null;
}

/**
 * a 와 b 를 이을 수 있으면 지나는 칸 목록(여백 좌표계)을 돌려준다. 없으면 null.
 * 화면에 연결선을 그려주기 위해 경로까지 반환한다.
 */
export function findPath(board: Board, a: Cell, b: Cell): { x: number; y: number }[] | null {
  const va = board[indexOf(a.c, a.r)];
  const vb = board[indexOf(b.c, b.r)];
  if (!va || !vb) return null;
  if (va !== vb) return null;
  if (a.c === b.c && a.r === b.r) return null;

  // 막힌 칸 표시. 출발/도착 타일 자신은 경로 판정에서 예외로 다룬다.
  const blocked = new Uint8Array(PW * PH);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[indexOf(c, r)]) blocked[(r + 1) * PW + (c + 1)] = 1;
    }
  }

  const sx = a.c + 1;
  const sy = a.r + 1;
  const gx = b.c + 1;
  const gy = b.r + 1;

  const best = new Int8Array(PW * PH * 4).fill(127);
  const queue: Node[] = [];
  for (let d = 0; d < 4; d++) {
    queue.push({ x: sx, y: sy, dir: d, turns: 0, prev: null });
  }

  for (let head = 0; head < queue.length; head++) {
    const s = queue[head];
    const [dx, dy] = DIRS[s.dir];
    const nx = s.x + dx;
    const ny = s.y + dy;
    if (nx < 0 || nx >= PW || ny < 0 || ny >= PH) continue;

    if (nx === gx && ny === gy) return rebuild(s, { x: gx, y: gy });
    if (blocked[ny * PW + nx]) continue;

    // 직진
    const straight = (ny * PW + nx) * 4 + s.dir;
    if (best[straight] > s.turns) {
      best[straight] = s.turns;
      queue.push({ x: nx, y: ny, dir: s.dir, turns: s.turns, prev: s });
    }
    // 꺾기
    if (s.turns < MAX_TURNS) {
      for (let nd = 0; nd < 4; nd++) {
        if (nd === s.dir) continue;
        const key = (ny * PW + nx) * 4 + nd;
        if (best[key] > s.turns + 1) {
          best[key] = s.turns + 1;
          queue.push({ x: nx, y: ny, dir: nd, turns: s.turns + 1, prev: s });
        }
      }
    }
  }
  return null;
}

function rebuild(end: Node, goal: { x: number; y: number }): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [goal];
  let cur: Node | null = end;
  while (cur) {
    const p = { x: cur.x, y: cur.y };
    // 같은 칸이 연속으로 들어가지 않게 한다(방향만 바뀐 상태들이 겹친다).
    if (out[0].x !== p.x || out[0].y !== p.y) out.unshift(p);
    cur = cur.prev;
  }
  return out;
}

export function canMatch(board: Board, a: Cell, b: Cell): boolean {
  return findPath(board, a, b) !== null;
}

/** 남은 타일 중 지금 지울 수 있는 짝이 하나라도 있는지. */
export function findAnyMove(board: Board): [Cell, Cell] | null {
  const byFace = new Map<number, number[]>();
  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (!v) continue;
    const list = byFace.get(v);
    if (list) list.push(i);
    else byFace.set(v, [i]);
  }
  for (const list of byFace.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = cellOf(list[i]);
        const b = cellOf(list[j]);
        if (canMatch(board, a, b)) return [a, b];
      }
    }
  }
  return null;
}

export function remaining(board: Board): number {
  let n = 0;
  for (const v of board) if (v) n++;
  return n;
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 역순 생성 — 짝을 하나씩 놓되, 놓는 시점의 판에서 그 짝이 이어지는지 확인한다.
 * 놓은 역순으로 지우면 반드시 끝까지 풀리므로 풀이 가능한 판이 보장된다.
 *
 * cells 를 지정하면 그 칸들만 사용한다(막혔을 때 섞기에 재사용).
 */
// 가장자리에서 얼마나 안쪽인지. 판이 거의 찼을 때 남은 빈칸이 안쪽이면
// 사방이 막혀 이을 수 없다. 안쪽부터 채우고 가장자리를 마지막에 남겨야 한다.
function innerness(i: number): number {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  return Math.min(c, COLS - 1 - c, r, ROWS - 1 - r);
}

function build(
  cells: number[],
  faces: number[],
  rnd: () => number
): { board: Board; order: [Cell, Cell][] } | null {
  const board: Board = new Array(COLS * ROWS).fill(0);
  // 안쪽 우선. 동점끼리는 무작위로 흔들어 매번 다른 판이 나오게 한다.
  const free = cells
    .map((i) => ({ i, key: innerness(i) + rnd() * 0.9 }))
    .sort((a, b) => b.key - a.key)
    .map((o) => o.i);
  const order: [Cell, Cell][] = [];

  const place = (ia: number, ib: number, face: number) => {
    board[ia] = face;
    board[ib] = face;
    return canMatch(board, cellOf(ia), cellOf(ib));
  };
  const unplace = (ia: number, ib: number) => {
    board[ia] = 0;
    board[ib] = 0;
  };

  for (let k = 0; k < faces.length; k++) {
    // 남은 칸이 넷이면 마지막 두 쌍을 한꺼번에 정한다.
    // 앞의 쌍만 보고 고르면 마지막 두 칸이 서로 못 잇는 자리로 남는 일이 잦다.
    if (free.length === 4 && k + 1 < faces.length) {
      const splits = shuffle(
        [
          [0, 1, 2, 3],
          [0, 2, 1, 3],
          [0, 3, 1, 2],
        ],
        rnd
      );
      let done = false;
      for (const [a, b, c, d] of splits) {
        const ia = free[a];
        const ib = free[b];
        const ic = free[c];
        const id = free[d];
        if (place(ia, ib, faces[k])) {
          if (place(ic, id, faces[k + 1])) {
            order.push([cellOf(ia), cellOf(ib)], [cellOf(ic), cellOf(id)]);
            free.length = 0;
            done = true;
            break;
          }
          unplace(ic, id);
        }
        unplace(ia, ib);
      }
      if (!done) return null;
      k++; // 두 쌍을 한 번에 처리했다
      continue;
    }

    let placed = false;
    // 안쪽 칸부터 훑어 처음 이어지는 자리에 놓는다.
    outer: for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        if (place(free[i], free[j], faces[k])) {
          order.push([cellOf(free[i]), cellOf(free[j])]);
          free.splice(j, 1);
          free.splice(i, 1);
          placed = true;
          break outer;
        }
        unplace(free[i], free[j]);
      }
    }
    if (!placed) return null;
  }
  return { board, order };
}

function facePairs(rnd: () => number): number[] {
  const pairs: number[] = [];
  for (let f = 1; f <= FACES; f++) {
    for (let k = 0; k < COPIES / 2; k++) pairs.push(f);
  }
  return shuffle(pairs, rnd);
}

/** 풀 수 있는 새 판. order 는 검증용 — 이 순서로 지우면 반드시 다 지워진다. */
export function buildBoard(rnd: () => number = Math.random): {
  board: Board;
  order: [Cell, Cell][];
} {
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => i);
  for (let attempt = 0; attempt < 200; attempt++) {
    const built = build(cells, facePairs(rnd), rnd);
    if (built) return built;
  }
  // 여기까지 오는 일은 사실상 없지만, 게임이 멈추는 것보다는 쉬운 판이 낫다.
  return buildTrivial(rnd);
}

// 최후의 보루 — 짝을 가로로 붙여 깐다. 맞닿은 두 칸은 언제나 이어지므로 반드시 풀린다.
function buildTrivial(rnd: () => number): { board: Board; order: [Cell, Cell][] } {
  const board: Board = new Array(COLS * ROWS).fill(0);
  const faces = facePairs(rnd);
  const order: [Cell, Cell][] = [];
  let k = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c += 2) {
      const face = faces[k++];
      board[indexOf(c, r)] = face;
      board[indexOf(c + 1, r)] = face;
      order.push([{ c, r }, { c: c + 1, r }]);
    }
  }
  return { board, order };
}

export function newBoard(rnd: () => number = Math.random): Board {
  return buildBoard(rnd).board;
}

/**
 * 막혔을 때 남은 타일을 다시 배치한다. 남은 칸/타일로 역순 생성을 다시 돌리므로
 * 섞고 나면 끝까지 풀 수 있는 상태가 된다.
 */
export function reshuffle(board: Board, rnd: () => number = Math.random): Board {
  const cells: number[] = [];
  const faces: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i]) {
      cells.push(i);
      faces.push(board[i]);
    }
  }
  // 같은 종류끼리 짝을 지어 pair 목록으로 만든다.
  const counts = new Map<number, number>();
  for (const f of faces) counts.set(f, (counts.get(f) ?? 0) + 1);
  const pairs: number[] = [];
  for (const [f, n] of counts) {
    for (let k = 0; k < Math.floor(n / 2); k++) pairs.push(f);
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    const built = build(cells, shuffle(pairs, rnd), rnd);
    if (built) return built.board;
  }
  return board; // 실패하면 원래 판을 유지한다(그대로 두는 편이 낫다)
}
