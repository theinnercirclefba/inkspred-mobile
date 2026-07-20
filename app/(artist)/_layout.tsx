import { Stack } from "expo-router";
import { colors } from "../../src/ui/tokens";

/**
 * Artist stack. The tab bar lives in (tabs); a message thread is pushed over it
 * as a full-screen route so it owns its own header, composer and the quote
 * bottom-sheet without the tab chrome — mirroring the customer group.
 */
export default function ArtistLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink[950] },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="thread/[threadId]"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen name="ink-drop/index" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="profile/index" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="profile/services" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="profile/availability" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="profile/portfolio" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
