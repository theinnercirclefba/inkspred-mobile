/**
 * InkSpred design tokens — the single TS source of truth for colours and
 * fonts in the native app. These mirror apps/web/app/globals.css exactly so
 * the mobile app renders identically to the desktop artist dashboard.
 *
 * Prefer NativeWind classes (bg-ink-900, text-bone-100, …) for styling. Use
 * these consts only where a raw colour value is required — StatusBar, native
 * navigators, maps, gradients, shadows, icon `color` props.
 */

export const colors = {
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
} as const;

/**
 * Font family names as loaded by @expo-google-fonts in app/_layout.tsx.
 * Kept in sync with fontFamily in tailwind.config.js.
 */
export const fonts = {
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
  display: "Fraunces_600SemiBold",
  displayBold: "Fraunces_700Bold",
  blackletter: "PirataOne_400Regular",
} as const;

export type ColorScale = typeof colors;
