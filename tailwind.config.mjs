/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/app/**/*.{ts,tsx,html}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f7ff",
          500: "#5b6cff",
          600: "#4452f0",
          900: "#1a1f4e",
        },
      },
      animation: {
        "slide-in": "slide-in 0.35s ease-out",
      },
      keyframes: {
        "slide-in": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
