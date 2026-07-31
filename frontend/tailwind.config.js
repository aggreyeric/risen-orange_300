/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#07060d", 900: "#0d0b16", 850: "#13101f", 800: "#1a1628", 700: "#25203a" },
        brand: { 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed" },
        accent: { 400: "#22d3ee", 500: "#06b6d4" },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-ring": "pulseRing 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(139,92,246,0.4)" }, "70%": { boxShadow: "0 0 0 8px rgba(139,92,246,0)" }, "100%": { boxShadow: "0 0 0 0 rgba(139,92,246,0)" } },
      },
    },
  },
  plugins: [],
};
