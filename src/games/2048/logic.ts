// 2048 타일 기반 엔진 — 각 타일에 id 를 부여해 위치 애니메이션이 가능하게 한다.
export type Dir = "left" | "right" | "up" | "down";
export const SIZE = 4;

export interface Tile {
  id: number;
  value: number;
  r: number; // 행 0~3
  c: number; // 열 0~3
  merged?: boolean; // 이번 이동에서 합쳐짐 → 팝 효과
  isNew?: boolean; // 이번 이동에서 새로 생성 → 등장 효과
}

const VEC: Record<Dir, [number, number]> = {
  left: [0, -1],
  right: [0, 1],
  up: [-1, 0],
  down: [1, 0],
};

function emptyCellGrid(): (Tile | null)[][] {
  return Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
}

export function gridFrom(tiles: Tile[]): number[][] {
  const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (const t of tiles) g[t.r][t.c] = t.value;
  return g;
}

export function emptyCells(tiles: Tile[]): [number, number][] {
  const g = gridFrom(tiles);
  const cells: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (g[r][c] === 0) cells.push([r, c]);
  return cells;
}

// 빈칸에 2(90%)/4(10%) 새 타일 추가. 자리 없으면 null.
export function spawn(tiles: Tile[], nextId: () => number, rnd: () => number = Math.random): Tile | null {
  const cells = emptyCells(tiles);
  if (cells.length === 0) return null;
  const [r, c] = cells[Math.floor(rnd() * cells.length)];
  return { id: nextId(), value: rnd() < 0.9 ? 2 : 4, r, c, isNew: true };
}

export function newGame(nextId: () => number, rnd: () => number = Math.random): Tile[] {
  const tiles: Tile[] = [];
  const a = spawn(tiles, nextId, rnd);
  if (a) tiles.push(a);
  const b = spawn(tiles, nextId, rnd);
  if (b) tiles.push(b);
  return tiles.map((t) => ({ ...t, isNew: false }));
}

// 이동 계획: 슬라이드/합치기 결과 타일 배열(합쳐진 타일은 merged, id 는 움직인 타일 유지 → 슬라이드).
export function planMove(tiles: Tile[], dir: Dir): { tiles: Tile[]; gained: number; moved: boolean } {
  const [dr, dc] = VEC[dir];
  const grid = emptyCellGrid();
  for (const t of tiles) grid[t.r][t.c] = { id: t.id, value: t.value, r: t.r, c: t.c };

  const rOrder = dr > 0 ? [3, 2, 1, 0] : [0, 1, 2, 3];
  const cOrder = dc > 0 ? [3, 2, 1, 0] : [0, 1, 2, 3];

  let gained = 0;
  let moved = false;
  const mergedCell = new Set<number>(); // 이미 합쳐진 목적 셀(연쇄 합치기 방지)

  for (const r of rOrder) {
    for (const c of cOrder) {
      const tile = grid[r][c];
      if (!tile) continue;

      // 진행 방향으로 가장 먼 빈칸 찾기
      let fr = r;
      let fc = c;
      while (true) {
        const tr = fr + dr;
        const tc = fc + dc;
        if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE || grid[tr][tc]) break;
        fr = tr;
        fc = tc;
      }
      // 그 너머 셀(합칠 후보)
      const tr = fr + dr;
      const tc = fc + dc;
      const next =
        tr >= 0 && tr < SIZE && tc >= 0 && tc < SIZE ? grid[tr][tc] : null;

      if (next && next.value === tile.value && !mergedCell.has(tr * SIZE + tc)) {
        // 합치기: 움직인 타일이 목적 셀로 슬라이드 후 값 2배 (stationary 제거)
        grid[r][c] = null;
        tile.r = tr;
        tile.c = tc;
        tile.value *= 2;
        tile.merged = true;
        grid[tr][tc] = tile; // next 덮어씀(제거)
        gained += tile.value;
        mergedCell.add(tr * SIZE + tc);
        moved = true;
      } else if (fr !== r || fc !== c) {
        grid[r][c] = null;
        tile.r = fr;
        tile.c = fc;
        grid[fr][fc] = tile;
        moved = true;
      }
    }
  }

  const out: Tile[] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c]) out.push(grid[r][c]!);
  return { tiles: out, gained, moved };
}

export function canMove(tiles: Tile[]): boolean {
  const g = gridFrom(tiles);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (g[r][c] === 0) return true;
      if (c + 1 < SIZE && g[r][c] === g[r][c + 1]) return true;
      if (r + 1 < SIZE && g[r][c] === g[r + 1][c]) return true;
    }
  }
  return false;
}
