import { Tabs } from "expo-router";
import { Icon, type IconName } from "../../../src/ui/Icon";
import { colors, fonts } from "../../../src/ui/tokens";

const icon =
  (name: IconName) =>
  ({ color, size }: { color: string; size: number }) =>
    <Icon name={name} color={color} size={size} />;

export default function StudioTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold[400],
        tabBarInactiveTintColor: colors.bone[500],
        tabBarStyle: {
          backgroundColor: colors.ink[900],
          borderTopColor: colors.ink[700],
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.ink[950] },
      }}
    >
      <Tabs.Screen name="shop" options={{ title: "Shop", tabBarIcon: icon("storefront") }} />
      <Tabs.Screen name="artists" options={{ title: "Artists", tabBarIcon: icon("people") }} />
      <Tabs.Screen name="enquiries" options={{ title: "Enquiries", tabBarIcon: icon("mail") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings") }} />
    </Tabs>
  );
}
