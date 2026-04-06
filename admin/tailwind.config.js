export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f9f4ed",
        dusk: "#1f1410",
        clay: "#d8cbb8",
        ember: "#ff4d1c",
        tide: "#0f6feb",
        fern: "#0e9d62",
        smoke: "#6b5c52",
        shell: "#fff9f3",
      },
      fontFamily: {
        inter: ["Inter", "Manrope", "sans-serif"],
        sora: ["Sora", "Inter", "sans-serif"],
      },
      boxShadow: {
        glow: "0 25px 65px rgba(26,20,16,0.18)",
        panel: "0 18px 40px rgba(31,20,16,0.12)",
      },
      keyframes: {
        pulseLive: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255,77,28,0.55)" },
          "50%": { boxShadow: "0 0 0 8px rgba(255,77,28,0)" },
        },
      },
      animation: {
        "pulse-live": "pulseLive 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};