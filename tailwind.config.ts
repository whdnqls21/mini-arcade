import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // 다크 네온 아케이드 테마
        pitch: {
          base: "#0d1117",
          alt: "#131a24",
          card: "rgba(255,255,255,0.05)",
          line: "rgba(255,255,255,0.08)",
        },
        grass: {
          DEFAULT: "#4de0c0",
          soft: "#2fb79a",
          deep: "#1c6b5c",
        },
        gold: {
          DEFAULT: "#f4c64e",
          soft: "#caa23c",
        },
        ink: {
          DEFAULT: "#eaf1f7",
          dim: "#9db0c4",
          faint: "#6f7f92",
        },
        danger: "#ff6b6b",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        numeric: ["var(--font-numeric)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.4)",
        glow: "0 0 0 1px rgba(77,224,192,0.35), 0 0 24px rgba(77,224,192,0.18)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
