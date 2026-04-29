/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./companion.html", "./spotlight.html", "./reminder.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#0a0e17",
          panel: "#0d1220",
          border: "rgba(255, 255, 255, 0.1)",
          accent: "#00ffc8",
          warn: "#ff6b35",
          error: "#ff3355",
          text: "#e0e6ed",
          muted: "#6b7a8d",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateX(-50%) translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateX(-50%) translateY(0)" },
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
