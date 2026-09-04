import type { Config } from "tailwindcss";

/** Map a CSS variable holding an RGB triple to a Tailwind colour with alpha support. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: v("canvas"),
        surface: v("surface"),
        "surface-2": v("surface-2"),
        "surface-inverse": v("surface-inverse"),
        border: v("border"),
        "border-strong": v("border-strong"),
        ink: { 1: v("ink-1"), 2: v("ink-2"), 3: v("ink-3"), inverse: v("ink-inverse") },
        brand: v("brand"),
        "brand-deep": v("brand-deep"),
        "brand-glow": v("brand-glow"),
        good: v("good"), "good-ink": v("good-ink"),
        warn: v("warn"), "warn-ink": v("warn-ink"),
        bad: v("bad"), "bad-ink": v("bad-ink"),
        role: {
          pic: v("role-pic"), dual: v("role-dual"), fo: v("role-fo"), sic: v("role-sic"), check: v("role-check"),
          "pic-ink": v("role-pic-ink"), "dual-ink": v("role-dual-ink"), "fo-ink": v("role-fo-ink"), "sic-ink": v("role-sic-ink"), "check-ink": v("role-check-ink"),
        },
        cat: {
          se: v("cat-se"), me: v("cat-me"), heli: v("cat-heli"), sim: v("cat-sim"),
          "se-ink": v("cat-se-ink"), "me-ink": v("cat-me-ink"), "heli-ink": v("cat-heli-ink"), "sim-ink": v("cat-sim-ink"),
        },
        chart: {
          1: v("chart-1"), 2: v("chart-2"), 3: v("chart-3"), 4: v("chart-4"),
          5: v("chart-5"), 6: v("chart-6"), 7: v("chart-7"), 8: v("chart-8"),
          grid: v("chart-grid"), area: v("chart-area"), ceiling: v("chart-ceiling"),
        },
      },
      borderRadius: {
        card: "var(--r-card)",
        control: "var(--r-control)",
        pill: "var(--r-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        pop: "var(--shadow-pop)",
        glow: "var(--shadow-glow)",
      },
      transitionDuration: { fast: "var(--dur-fast)", med: "var(--dur-med)", slow: "var(--dur-slow)" },
      transitionTimingFunction: { out: "var(--ease-out)", spring: "var(--ease-spring)" },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "16px" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "20px" }],
        md: ["15px", { lineHeight: "22px" }],
        lg: ["17px", { lineHeight: "24px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
        num: ["28px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
      },
      backgroundImage: {
        "gradient-aviation": "linear-gradient(135deg, rgb(var(--brand-deep)) 0%, #075985 35%, #1e293b 100%)",
        "gradient-cyan": "linear-gradient(135deg, #06b6d4 0%, rgb(var(--brand)) 100%)",
        "gradient-rose": "linear-gradient(135deg, #f43f5e 0%, #be123c 100%)",
      },
      animation: {
        "fade-up": "fadeUp 0.4s var(--ease-out) both",
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
