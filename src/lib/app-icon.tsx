import { ImageResponse } from "next/og";

import { brainDataUri } from "./brain-mark";

// 매니페스트/애플 아이콘 생성. 심볼은 brain-mark.ts 와 공유한다.
// satori 의 인라인 SVG 지원이 제한적이라 data URI 이미지로 넘긴다.
export function appIconResponse(size: number): ImageResponse {
  const src = brainDataUri({ plate: true, size });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size }
  );
}
