import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0c10",
        paper: "#f2eee3",
        muted: "#9a9a94",
        lime: "#d9ff3f",
        amber: "#ffb62e",
        ember: "#ff5a3c",
        line: "rgba(255,255,255,0.08)",
      },
      fontFamily: {
        grotesk: ['"Space Grotesk"', "sans-serif"],
        serifit: ['"Instrument Serif"', "serif"],
        display: ['"Fraunces"', "serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: { card: "20px" },
    },
  },
  plugins: [],
} satisfies Config;
