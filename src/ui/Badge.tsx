import { View } from "react-native";
import { Text } from "./Text";

type Tone = "neutral" | "oxblood" | "gold" | "positive" | "negative";

export interface BadgeProps {
  label: string;
  tone?: Tone;
  className?: string;
}

const TONE: Record<Tone, { container: string; label: string }> = {
  neutral: { container: "bg-ink-700 border border-ink-600", label: "text-bone-300" },
  oxblood: { container: "bg-oxblood-600/25 border border-oxblood-500", label: "text-oxblood-400" },
  gold: { container: "bg-gold-400/15 border border-gold-400/60", label: "text-gold-300" },
  positive: { container: "bg-positive/15 border border-positive/50", label: "text-positive" },
  negative: { container: "bg-negative/15 border border-negative/50", label: "text-negative" },
};

/**
 * A small status pill — booking states, tier labels, counts. Uppercase label
 * to match the web design system's metadata treatment.
 */
export function Badge({ label, tone = "neutral", className }: BadgeProps) {
  const t = TONE[tone];
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${t.container} ${className ?? ""}`}>
      <Text
        variant="label"
        className={`text-[10px] tracking-[1px] ${t.label}`}
      >
        {label}
      </Text>
    </View>
  );
}
