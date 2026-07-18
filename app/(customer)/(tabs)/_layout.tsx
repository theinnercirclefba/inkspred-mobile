import { Tabs } from "expo-router";
import { Icon, type IconName } from "../../../src/ui/Icon";
import { colors, fonts } from "../../../src/ui/tokens";

const icon =
  (name: IconName) =>
  ({ color, size }: { color: string; size: number }) =>
    <Icon name={name} color={color} size={size} />;

export default function CustomerTabsLayout() {
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
      <Tabs.Screen name="find" options={{ title: "Find", tabBarIcon: icon("search") }} />
      <Tabs.Screen name="following" options={{ title: "Following", tabBarIcon: icon("heart") }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings", tabBarIcon: icon("calendar") }} />
      <Tabs.Screen name="messages" options={{ title: "Messages", tabBarIcon: icon("chatbubble-ellipses") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: icon("person-circle") }} />
    </Tabs>
  );
}
