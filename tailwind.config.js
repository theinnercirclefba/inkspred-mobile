/** @type {import('tailwindcss').Config} */
// Full InkSpred token palette — mirrors apps/web/app/globals.css exactly so the
// native app renders identically to the desktop artist dashboard.
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08080a",
          900: "#0d0d10",
          800: "#141419",
          700: "#1d1d24",
          600: "#2b2b34",
          500: "#3a3a45",
        },
        bone: {
          100: "#f4f1ea",
          300: "#cfcabd",
          500: "#918c7e",
        },
        oxblood: {
          600: "#7a2830",
          500: "#8f2f3a",
          400: "#a83a47",
        },
        gold: {
          400: "#c9a35f",
          300: "#dbbc80",
        },
        positive: "#8fb996",
        negative: "#cf6b6b",
      },
      fontFamily: {
        // Loaded via @expo-google-fonts in app/_layout.tsx
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        display: ["Fraunces_600SemiBold"],
        "display-bold": ["Fraunces_700Bold"],
        blackletter: ["PirataOne_400Regular"],
      },
    },
  },
  plugins: [],
};
