// 수박게임 과일 단계 정의. 같은 단계 둘이 닿으면 다음 단계로 합쳐진다.
// 반지름은 월드 좌표 기준(engine.ts 의 WORLD_W = 320).

export interface Fruit {
  name: string;
  radius: number;
  color: string; // 본체
  shade: string; // 아래쪽 그림자 (원형 그라데이션 바깥쪽)
}

export const FRUITS: Fruit[] = [
  { name: "체리", radius: 13, color: "#f0596b", shade: "#b8323f" },
  { name: "딸기", radius: 17, color: "#f4705a", shade: "#bd4230" },
  { name: "포도", radius: 23, color: "#a06ae8", shade: "#6b3fae" },
  { name: "한라봉", radius: 28, color: "#f9a63a", shade: "#c07211" },
  { name: "감", radius: 34, color: "#ff9147", shade: "#c65c18" },
  { name: "사과", radius: 41, color: "#eb4d5c", shade: "#a82533" },
  { name: "배", radius: 47, color: "#cfdc5f", shade: "#93a028" },
  { name: "복숭아", radius: 54, color: "#ffb0a3", shade: "#d97a69" },
  { name: "파인애플", radius: 61, color: "#ffd357", shade: "#c79a1b" },
  { name: "멜론", radius: 69, color: "#8fdc84", shade: "#4f9f45" },
  { name: "수박", radius: 78, color: "#3fb55d", shade: "#1d7233" },
];

export const MAX_INDEX = FRUITS.length - 1;

// 떨어뜨릴 수 있는 건 앞 5단계까지 (원작과 동일).
export const DROPPABLE = 5;

// 합쳐서 newIndex 과일이 만들어졌을 때 얻는 점수 — 삼각수(1,3,6,10…).
export function mergeScore(newIndex: number): number {
  return (newIndex * (newIndex + 1)) / 2;
}

export function randomDropIndex(rnd: () => number = Math.random): number {
  return Math.floor(rnd() * DROPPABLE);
}
