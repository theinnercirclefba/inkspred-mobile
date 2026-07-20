import { View, Pressable } from "react-native";
import { Icon } from "./Icon";
import { colors } from "./tokens";

export interface StarsProps {
  /** 0–5. May be fractional in display mode (rounded to nearest half). */
  rating: number;
  /** Icon size in px. Default 14. */
  size?: number;
  /**
   * When provided the row becomes an interactive 1–5 picker (whole stars only)
   * and calls back with the tapped value. Omit for a read-only display.
   */
  onRate?: (value: number) => void;
  /** Show half stars in display mode. Default true; ignored when interactive. */
  allowHalf?: boolean;
  className?: string;
}

const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Gold star rating — the single treatment used everywhere ratings appear
 * (artist profile header, review rows, the review sheet). Display mode renders
 * half stars; passing `onRate` turns it into a tappable whole-star picker.
 */
export function Stars({
  rating,
  size = 14,
  onRate,
  allowHalf = true,
  className,
}: StarsProps) {
  const interactive = typeof onRate === "function";

  return (
    <View
      className={`flex-row items-center ${className ?? ""}`}
      style={{ gap: interactive ? 6 : 2 }}
      accessibilityRole={interactive ? "adjustable" : "image"}
      accessibilityLabel={`${Math.round(rating * 10) / 10} out of 5 stars`}
    >
      {STARS.map((i) => {
        const filled = rating >= i;
        const half = !interactive && allowHalf && !filled && rating >= i - 0.5;
        const name = filled ? "star" : half ? "star-half" : "star-outline";
        const color = filled || half ? colors.gold[400] : colors.ink[500];

        if (!interactive) {
          return <Icon key={i} name={name} size={size} color={color} />;
        }
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`${i} star${i > 1 ? "s" : ""}`}
            hitSlop={6}
            onPress={() => onRate?.(i)}
            className="active:opacity-70"
          >
            <Icon name={name} size={size} color={color} />
          </Pressable>
        );
      })}
    </View>
  );
}
