import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f9fc", 100: "#e9eef7", 200: "#cbd5e7", 300: "#9eafd0",
          400: "#6c83b3", 500: "#46598e", 600: "#2f3f73", 700: "#1f2c5a",
          800: "#131c40", 900: "#0a0f29", 950: "#050818",
        },
      },
      backgroundImage: {
        "gradient-aviation": "linear-gradient(135deg, #0c4a6e 0%, #075985 35%, #1e293b 100%)",
        "gradient-cyan": "linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)",
        "gradient-emerald": "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        "gradient-amber": "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        "gradient-violet": "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
        "gradient-rose": "linear-gradient(135deg, #f43f5e 0%, #be123c 100%)",
        "gradient-card": "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)",
        "mesh-1":
          "radial-gradient(at 20% 0%, rgba(56,189,248,0.15) 0px, transparent 50%), " +
          "radial-gradient(at 80% 0%, rgba(139,92,246,0.18) 0px, transparent 50%), " +
          "radial-gradient(at 50% 100%, rgba(244,114,182,0.10) 0px, transparent 50%)",
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease-out both",
        "fade-in": "fadeIn 0.3s ease-out both",
      },
      keyframes: {
        fadeUp: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
    },
  },
  plugins: [],
};

export default config;
