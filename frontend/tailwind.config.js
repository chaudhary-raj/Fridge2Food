/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Georgia", "serif"],
      },
      colors: {
        emerald: {
          50: "#f2f6ef",
          100: "#e4ecdf",
          200: "#ccdbc6",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#537b59",
          600: "#426548",
          700: "#33543a",
          800: "#065f46",
          900: "#064e3b",
        },
      },
    },
  },
  plugins: [],
};
