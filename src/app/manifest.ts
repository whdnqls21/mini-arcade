import type { MetadataRoute } from "next";

import { ICON_VERSION } from "@/lib/brain-mark";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "뇌지컬 대전",
    short_name: "뇌지컬",
    description: "친구들과 퍼즐 게임으로 기록 경쟁",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d1117",
    theme_color: "#0d1117",
    lang: "ko",
    icons: [
      { src: `/icon.svg?v=${ICON_VERSION}`, sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: `/icon-192?v=${ICON_VERSION}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icon-512?v=${ICON_VERSION}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/icon-192?v=${ICON_VERSION}`, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: `/icon-512?v=${ICON_VERSION}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
