/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    screens: {
      xs: "400px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        navy: "#0F172A",
        surface: "#020617",
        elevated: "#111827",
        // Flat names — more reliable with JIT + colored shadows
        brand: "#2563EB",
        "brand-sky": "#38BDF8",
        accent: {
          green: "#22C55E",
          amber: "#F59E0B",
          red: "#EF4444",
        },
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "Tahoma",
          "Noto Sans Arabic",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 60px -12px rgba(56, 189, 248, 0.35)",
        "glow-sm": "0 0 40px -16px rgba(37, 99, 235, 0.25)",
        glass: "0 8px 32px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.06) inset",
        "glass-lg": "0 24px 64px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.08) inset",
      },
      keyframes: {
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "float-slower": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.7" },
        },
        "gradient-flow": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
        "zoom-soft": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "stat-float": {
          "0%, 100%": { transform: "translateY(0)", opacity: "0.92" },
          "50%": { transform: "translateY(-6px)", opacity: "1" },
        },
      },
      animation: {
        "float-slow": "float-slow 5s ease-in-out infinite",
        "float-slower": "float-slower 7s ease-in-out infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
        "gradient-flow": "gradient-flow 12s ease infinite",
        "zoom-soft": "zoom-soft 10s ease-in-out infinite",
        shimmer: "shimmer 8s ease-in-out infinite",
        "stat-float": "stat-float 5s ease-in-out infinite",
      },
      backgroundSize: {
        "300%": "300% 300%",
      },
    },
  },
  plugins: [],
};
