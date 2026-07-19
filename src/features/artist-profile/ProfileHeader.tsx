import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";

/**
 * A compact stack-screen header for the profile editor routes — the (artist)
 * stack runs headerShown:false, so each screen paints its own back chevron +
 * title. Optional right-hand slot (e.g. a Save button or an add action).
 */
export function ProfileHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-3 px-5 pb-3 pt-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        onPress={() => router.back()}
        className="h-9 w-9 items-center justify-center rounded-full border border-ink-700 bg-ink-900 active:opacity-80"
      >
        <Icon name="chevron-back" size={18} color={colors.bone[300]} />
      </Pressable>
      <View className="min-w-0 flex-1">
        <Text variant="display" numberOfLines={1} className="text-xl">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={1} className="mt-0.5">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? null}
    </View>
  );
}
