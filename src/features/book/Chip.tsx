import { Pressable } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";

/**
 * A selectable pill used across the booking steps (placements, size, dates).
 * Selected state borrows the design system's gold accent; unselected is a quiet
 * ink surface. Disabled (e.g. past dates) drops opacity and stops presses.
 */
export function Chip({
  label,
  selected,
  disabled,
  onPress,
  className,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      hitSlop={4}
      className={`flex-row items-center gap-1.5 rounded-full border px-4 py-2.5 ${
        selected
          ? "border-gold-400/70 bg-gold-400/15"
          : "border-ink-600 bg-ink-800"
      } ${disabled ? "opacity-35" : ""} ${className ?? ""}`}
      style={({ pressed }) => (pressed && !disabled ? { opacity: 0.8 } : undefined)}
    >
      {selected ? (
        <Icon name="checkmark" size={14} color={colors.gold[300]} />
      ) : null}
      <Text
        variant={selected ? "bodySemibold" : "body"}
        className={`text-[14px] ${selected ? "text-gold-300" : "text-bone-300"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
