import { Pressable, type PressableProps, View, ActivityIndicator } from "react-native";
import { Text } from "./Text";
import { colors } from "./tokens";

type Variant = "primary" | "secondary" | "gold" | "ghost";
type Size = "md" | "lg";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Stretch to fill the parent width. Default true. */
  block?: boolean;
  className?: string;
}

const CONTAINER: Record<Variant, string> = {
  // Oxblood — the primary brand action.
  primary: "bg-oxblood-500 border border-oxblood-500",
  // Quiet surface action on the dark canvas.
  secondary: "bg-ink-800 border border-ink-600",
  // Gold — premium, used sparingly (upgrades, spread-the-cost highlights).
  gold: "bg-gold-400 border border-gold-400",
  // No fill.
  ghost: "bg-transparent border border-transparent",
};

const LABEL: Record<Variant, string> = {
  primary: "text-bone-100",
  secondary: "text-bone-100",
  gold: "text-ink-950",
  ghost: "text-bone-300",
};

const SPINNER: Record<Variant, string> = {
  primary: colors.bone[100],
  secondary: colors.bone[100],
  gold: colors.ink[950],
  ghost: colors.bone[300],
};

const SIZE: Record<Size, string> = {
  md: "h-11 px-4",
  lg: "h-14 px-6",
};

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  block = true,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-xl ${SIZE[size]} ${
        CONTAINER[variant]
      } ${block ? "w-full" : "self-start"} ${isDisabled ? "opacity-50" : ""} ${
        className ?? ""
      }`}
      style={({ pressed }) => (pressed && !isDisabled ? { opacity: 0.85 } : undefined)}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={SPINNER[variant]} size="small" />
      ) : (
        <View className="flex-row items-center justify-center">
          <Text variant="bodySemibold" className={`text-[15px] ${LABEL[variant]}`}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
