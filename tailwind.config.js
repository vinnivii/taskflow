/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
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
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "rotateY(-6deg) rotateX(3deg) translateY(0px)" },
          "50%":       { transform: "rotateY(-6deg) rotateX(3deg) translateY(-10px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.7", transform: "translate(-50%, -50%) scale(1)" },
          "50%":       { opacity: "1",   transform: "translate(-50%, -50%) scale(1.12)" },
        },
        "particle-blink": {
          "0%, 100%": { opacity: "0.2" },
          "50%":       { opacity: "0.9" },
        },
        "shine": {
          "0%":   { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        "icon-wiggle": {
          "0%":   { transform: "rotate(0deg)" },
          "15%":  { transform: "rotate(-18deg) scale(1.2)" },
          "30%":  { transform: "rotate(14deg) scale(1.2)" },
          "45%":  { transform: "rotate(-10deg)" },
          "60%":  { transform: "rotate(8deg)" },
          "75%":  { transform: "rotate(-4deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
        "icon-bounce": {
          "0%":   { transform: "translateY(0) scale(1)" },
          "30%":  { transform: "translateY(-6px) scale(1.15)" },
          "55%":  { transform: "translateY(2px) scale(0.95)" },
          "75%":  { transform: "translateY(-3px) scale(1.05)" },
          "100%": { transform: "translateY(0) scale(1)" },
        },
        "icon-shake": {
          "0%":   { transform: "translateX(0)" },
          "15%":  { transform: "translateX(-5px) rotate(-6deg)" },
          "30%":  { transform: "translateX(4px) rotate(4deg)" },
          "45%":  { transform: "translateX(-3px) rotate(-3deg)" },
          "60%":  { transform: "translateX(2px)" },
          "100%": { transform: "translateX(0)" },
        },
        "icon-spin-pop": {
          "0%":   { transform: "rotate(0deg) scale(1)" },
          "40%":  { transform: "rotate(180deg) scale(1.25)" },
          "100%": { transform: "rotate(360deg) scale(1)" },
        },
        "icon-pulse-ring": {
          "0%":   { transform: "scale(1)", opacity: "1" },
          "50%":  { transform: "scale(1.3)", opacity: "0.7" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        "caret-blink":     "caret-blink 1.25s ease-out infinite",
        "fade-up":         "fade-up 0.6s ease-out both",
        "fade-in":         "fade-in 0.5s ease-out both",
        "float":           "float 5s ease-in-out infinite",
        "glow-pulse":      "glow-pulse 4s ease-in-out infinite",
        "particle-blink":  "particle-blink 3s ease-in-out infinite",
        "shine":           "shine 4s linear infinite",
        "icon-wiggle":     "icon-wiggle 0.5s ease-in-out",
        "icon-bounce":     "icon-bounce 0.5s ease-in-out",
        "icon-shake":      "icon-shake 0.5s ease-in-out",
        "icon-spin-pop":   "icon-spin-pop 0.5s ease-in-out",
        "icon-pulse-ring": "icon-pulse-ring 0.5s ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}