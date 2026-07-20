import { ImageResponse } from "next/og";

// 매니페스트/애플 아이콘 생성. 네온 아케이드 느낌: 둥근 사각 + 2x2 타일.
export function appIconResponse(size: number): ImageResponse {
  const pad = Math.round(size * 0.2);
  const gap = Math.round(size * 0.05);
  const cell = Math.round((size - pad * 2 - gap) / 2);
  const colors = ["#4de0c0", "#2fb79a", "#f4c64e", "#eaf1f7"];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #131a24 0%, #0d1117 100%)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", width: cell * 2 + gap, gap }}>
          {colors.map((c, i) => (
            <div key={i} style={{ width: cell, height: cell, borderRadius: Math.round(cell * 0.22), background: c }} />
          ))}
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
