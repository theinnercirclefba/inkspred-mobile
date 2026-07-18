import { View, Pressable } from "react-native";
import { Text } from "../../ui/Text";
import { colors } from "../../ui/tokens";

const STEP_LABELS = ["Piece", "Dates", "Payment", "Review"];

/**
 * Four-step progress row: a label + numbered dots. Visited steps are tappable
 * to jump back; unvisited ones are inert. Mirrors the web StepProgress.
 */
export function StepProgress({
  current,
  maxVisited,
  onSelect,
}: {
  current: number;
  maxVisited: number;
  onSelect: (step: number) => void;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text variant="caption" className="uppercase tracking-[1.5px] text-bone-500">
          Step {current + 1} of {STEP_LABELS.length}
        </Text>
        <Text variant="bodyMedium" className="text-[13px] text-bone-300">
          {STEP_LABELS[current]}
        </Text>
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const reachable = i <= maxVisited;
          return (
            <Pressable
              key={label}
              onPress={() => (reachable ? onSelect(i) : undefined)}
              disabled={!reachable}
              accessibilityRole="button"
              accessibilityLabel={`Step ${i + 1}: ${label}`}
              accessibilityState={{ selected: active, disabled: !reachable }}
              hitSlop={8}
              className="h-1.5 flex-1 rounded-full"
              style={{
                backgroundColor: active
                  ? colors.gold[400]
                  : done
                    ? "rgba(201,163,95,0.45)"
                    : colors.ink[700],
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
