import { Tabs } from "expo-router";
import { Icon, type IconName } from "../../../src/ui/Icon";
import { colors, fonts } from "../../../src/ui/tokens";

const icon =
  (name: IconName) =>
  ({ color, size }: { color: string; size: number }) =>
    <Icon name={name} color={color} size={size} />;

export default function ArtistTabsLayout() {
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
      <Tabs.Screen name="today" options={{ title: "Today", tabBarIcon: icon("sunny") }} />
      <Tabs.Screen name="requests" options={{ title: "Requests", tabBarIcon: icon("file-tray-full") }} />
      <Tabs.Screen name="messages" options={{ title: "Messages", tabBarIcon: icon("chatbubble-ellipses") }} />
      <Tabs.Screen name="clients" options={{ title: "Clients", tabBarIcon: icon("people") }} />
      <Tabs.Screen name="money" options={{ title: "Money", tabBarIcon: icon("wallet") }} />
    </Tabs>
  );
}
