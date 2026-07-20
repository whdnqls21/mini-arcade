// 2048 순수 로직 (UI/랜덤 주입 분리, 테스트 가능).
export type Grid = number[][]; // 4x4, 0 = 빈칸
export type Dir = "left" | "right" | "up" | "down";

export const SIZE = 4;

export function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function clone(g: Grid): Grid {
  return g.map((r) => [...r]);
}

function transpose(g: Grid): Grid {
  const out = emptyGrid();
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) out[j][i] = g[i][j];
  return out;
}

function reverseRows(g: Grid): Grid {
  return g.map((r) => [...r].reverse());
}

// 한 행을 왼쪽으로 밀고 합치기
function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const nums = row.filter((n) => n !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const merged = nums[i] * 2;
      out.push(merged);
      gained += merged;
      i++; // 한 번 합치면 다음 건너뜀
    } else {
      out.push(nums[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { row: out, gained };
}

export function move(grid: Grid, dir: Dir): { grid: Grid; gained: number; moved: boolean } {
  let g = clone(grid);
  if (dir === "right") g = reverseRows(g);
  else if (dir === "up") g = transpose(g);
  else if (dir === "down") g = reverseRows(transpose(g));

  let gained = 0;
  const slid = g.map((row) => {
    const r = slideRowLeft(row);
    gained += r.gained;
    return r.row;
  });

  let result = slid;
  if (dir === "right") result = reverseRows(slid);
  else if (dir === "up") result = transpose(slid);
  else if (dir === "down") result = transpose(reverseRows(slid));

  const moved = JSON.stringify(result) !== JSON.stringify(grid);
  return { grid: result, gained, moved };
}

export function emptyCells(g: Grid): [number, number][] {
  const cells: [number, number][] = [];
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) if (g[i][j] === 0) cells.push([i, j]);
  return cells;
}

// 빈칸에 2(90%)/4(10%) 추가. rnd 주입 가능(기본 Math.random).
export function spawn(g: Grid, rnd: () => number = Math.random): Grid {
  const cells = emptyCells(g);
  if (cells.length === 0) return g;
  const [i, j] = cells[Math.floor(rnd() * cells.length)];
  const out = clone(g);
  out[i][j] = rnd() < 0.9 ? 2 : 4;
  return out;
}

// 더 이상 움직일 수 없으면 게임 오버
export function canMove(g: Grid): boolean {
  if (emptyCells(g).length > 0) return true;
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      if (j + 1 < SIZE && g[i][j] === g[i][j + 1]) return true;
      if (i + 1 < SIZE && g[i][j] === g[i + 1][j]) return true;
    }
  }
  return false;
}

export function newGame(rnd: () => number = Math.random): Grid {
  return spawn(spawn(emptyGrid(), rnd), rnd);
}
