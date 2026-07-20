import { brainSvg } from "@/lib/brain-mark";

// 심볼 정의는 brain-mark.ts 한 곳에만 두고 여기서는 그리기만 한다.
// 사용자 입력이 섞이지 않는 우리 소유의 정적 문자열이라 dangerouslySetInnerHTML 로 넣어도 안전하다.
export function BrainMark({ size = 28, plate = false }: { size?: number; plate?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, display: "inline-block", lineHeight: 0 }}
      // 작을 때는 배선을 줄인 단순형이 더 잘 읽힌다.
      dangerouslySetInnerHTML={{ __html: brainSvg({ size, plate, simple: size <= 32 }) }}
    />
  );
}
