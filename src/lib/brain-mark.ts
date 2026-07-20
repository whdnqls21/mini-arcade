// 앱 심볼 — 회로가 흐르는 뇌. PWA 아이콘, 헤더, 파비콘이 전부 이 한 벌을 쓴다.
// 문자열로 만드는 이유: next/og(satori)는 JSX SVG 지원이 제한적이라 data URI 이미지로 넘기는 편이 안전하다.

// 심볼을 고칠 때마다 올린다. 아이콘 URL 에 붙어 캐시를 무효화한다.
export const ICON_VERSION = 2;

const GRASS = "#4de0c0";
const GRASS_DIM = "#2fb79a";
const GOLD = "#f4c64e";

// 왼쪽 반구 윤곽. 오른쪽은 이 경로를 좌우 반전해서 쓴다.
const HALF =
  "M32 6 C28 3 21 4 19 9 C13 8 9 13 11 18 C5 20 4 28 9 31 C5 35 7 42 13 43 C13 50 20 55 26 53 C28 56 31 56 32 55";

// 회로 배선 — 좌우 높이를 어긋나게 둬야 기계적인 대칭이 아니라 회로처럼 보인다.
const TRACES_LEFT = ["M32 15 H25 L21 19", "M32 27 H19", "M32 38 H24 L20 42"];
const TRACES_RIGHT = ["M32 21 H43 L47 25", "M32 33 H45", "M32 45 H40 L44 49"];
const NODES_LEFT: [number, number][] = [
  [21, 19],
  [19, 27],
  [20, 42],
];
const NODES_RIGHT: [number, number][] = [
  [47, 25],
  [45, 33],
  [44, 49],
];

export interface BrainMarkOptions {
  /** 둥근 배경판을 함께 그린다(앱 아이콘용). 없으면 배경 투명(헤더용). */
  plate?: boolean;
  size?: number;
  /**
   * 작게 쓸 때(약 32px 이하) 켠다. 배선과 노드를 줄이고 선을 굵혀서
   * 축소됐을 때 뭉개지지 않게 한다.
   */
  simple?: boolean;
}

export function brainSvg({ plate = false, size = 64, simple = false }: BrainMarkOptions = {}): string {
  // 배경판이 있으면 심볼을 안쪽으로 줄여 여백을 준다.
  const inner = plate
    ? `<g transform="translate(32 32) scale(0.68) translate(-32 -32)">${symbol(simple)}</g>`
    : symbol(simple);

  const bg = plate
    ? `<defs>
        <linearGradient id="bmBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#18202c"/>
          <stop offset="1" stop-color="#0d1117"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#bmBg)"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${bg}${inner}</svg>`;
}

function symbol(simple: boolean): string {
  const traceList = simple
    ? [TRACES_LEFT[1], TRACES_RIGHT[1]]
    : [...TRACES_LEFT, ...TRACES_RIGHT];
  const nodeList = simple ? [NODES_LEFT[1], NODES_RIGHT[1]] : [...NODES_LEFT, ...NODES_RIGHT];

  const outlineW = simple ? 4.5 : 3;
  const traceW = simple ? 3 : 2;
  const nodeR = simple ? 4.5 : 3;

  const traces = traceList.map((d) => `<path d="${d}"/>`).join("");
  const nodes = nodeList
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${nodeR}" fill="${GOLD}"/>`)
    .join("");

  return `
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <g stroke="${GRASS}" stroke-width="${outlineW}">
        <path d="${HALF}"/>
        <path d="${HALF}" transform="matrix(-1 0 0 1 64 0)"/>
      </g>
      <g stroke="${GRASS_DIM}" stroke-width="${traceW}">
        <path d="M32 6 V55"/>
        ${traces}
      </g>
      ${nodes}
    </g>`;
}

export function brainDataUri(options?: BrainMarkOptions): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(brainSvg(options))}`;
}
