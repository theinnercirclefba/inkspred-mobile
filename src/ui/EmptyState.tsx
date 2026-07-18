import { View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { colors } from "./tokens";

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body: string;
  className?: string;
}

/**
 * The branded empty state used across every placeholder screen in this
 * foundation stage — a centred icon medallion, Fraunces title and a muted
 * one-line description. Real content replaces these in later stages.
 */
export function EmptyState({ icon, title, body, className }: EmptyStateProps) {
  return (
    <View className={`flex-1 items-center justify-center px-8 ${className ?? ""}`}>
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
        <Icon name={icon} size={26} color={colors.gold[400]} />
      </View>
      <Text variant="display" className="mb-2 text-center text-xl">
        {title}
      </Text>
      <Text variant="body" className="max-w-[280px] text-center text-bone-500">
        {body}
      </Text>
    </View>
  );
}
