import type { Config } from "tailwindcss";

/**
 * All in one converter — Bright Professional design system.
 * Brand: #2563EB (primary), #7C3AED (secondary), #06B6D4 (accent).
 * Colors are wired through CSS variables (see globals.css) so shadcn/ui
 * primitives, dark mode, and ad-hoc utilities all stay in sync.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 60px -15px hsl(var(--primary) / 0.45)",
        "glow-lg": "0 0 120px -20px hsl(var(--primary) / 0.5)",
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -8px rgb(15 23 42 / 0.08)",
        "card-hover":
          "0 1px 2px 0 rgb(15 23 42 / 0.06), 0 24px 48px -12px rgb(15 23 42 / 0.18)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(120deg, hsl(var(--primary)) 0%, hsl(var(--secondary)) 50%, hsl(var(--accent)) 100%)",
        // Vibrant multi-colour wash for the playful landing redesign.
        "fun-gradient":
          "linear-gradient(120deg, #ff5f6d 0%, #ffc371 22%, #f9c80e 40%, #06d6a0 60%, #2563eb 80%, #7c3aed 100%)",
        "rainbow-gradient":
          "linear-gradient(90deg, #ff5f6d, #ffc371, #f9c80e, #06d6a0, #06b6d4, #2563eb, #7c3aed, #ff5f6d)",
        "grid-pattern":
          "linear-gradient(to right, hsl(var(--border) / 0.6) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.6) 1px, transparent 1px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-24px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        // ── Playful redesign keyframes ──────────────────────────
        blob: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)", borderRadius: "42% 58% 63% 37% / 41% 44% 56% 59%" },
          "33%": { transform: "translate(24px, -32px) scale(1.08)", borderRadius: "60% 40% 34% 66% / 56% 64% 36% 44%" },
          "66%": { transform: "translate(-22px, 18px) scale(0.94)", borderRadius: "38% 62% 56% 44% / 62% 38% 62% 38%" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
        "bounce-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "rainbow-pan": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "spin-reverse": {
          to: { transform: "rotate(-360deg)" },
        },
        // Waving hand — rotates about the wrist, then rests between waves.
        wave: {
          "0%, 60%, 100%": { transform: "rotate(0deg)" },
          "10%, 30%, 50%": { transform: "rotate(15deg)" },
          "20%, 40%": { transform: "rotate(-9deg)" },
        },
        // Twinkling sparkle — scales + fades in and out.
        twinkle: {
          "0%, 100%": { transform: "scale(0.55)", opacity: "0.3" },
          "50%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "gradient-shift": "gradient-shift 8s ease infinite",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 9s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
        "pulse-glow": "pulse-glow 4s ease-in-out infinite",
        blob: "blob 14s ease-in-out infinite",
        wiggle: "wiggle 3s ease-in-out infinite",
        "bounce-slow": "bounce-slow 4s ease-in-out infinite",
        "rainbow-pan": "rainbow-pan 6s linear infinite",
        "spin-reverse": "spin-reverse 2.4s linear infinite",
        wave: "wave 2.5s ease-in-out infinite",
        twinkle: "twinkle 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
