import { Stack } from "expo-router";
import { colors } from "../../src/ui/tokens";

/**
 * Customer stack. The tab bar lives in (tabs); the artist profile is pushed
 * over it as a full-screen route so it can present its own hero and a modal
 * booking sheet without the tab chrome.
 */
export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink[950] },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="artist/[handle]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="book/[handle]" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="thread/[threadId]" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
