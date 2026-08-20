import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./content/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        line: "var(--line)",
        accent: "var(--accent)",
        "accent-muted": "var(--accent-muted)",
        "accent-foreground": "var(--accent-foreground)",
        link: "var(--link)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        handwritten: ["var(--font-handwritten)", "cursive"],
      },
      fontSize: {
        "2xs": "0.6875rem",
      },
      spacing: {
        4.5: "1.125rem",
        18: "4.5rem",
      },
      maxWidth: {
        "3xl": "48rem",
      },
    },
  },
  plugins: [],
};

export default config;
