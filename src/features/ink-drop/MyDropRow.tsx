import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import type { MyDrop } from "./data";
import { formatDropDate, savingsLabel, slotLabel } from "./format";

const STATUS_BADGE: Record<
  MyDrop["status"],
  { label: string; tone: "gold" | "positive" | "neutral" }
> = {
  open: { label: "Open", tone: "gold" },
  claimed: { label: "Claimed", tone: "positive" },
  expired: { label: "Expired", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

/**
 * One of the artist's own drops in the manage list. Open drops can be
 * withdrawn; claimed/expired/withdrawn are read-only. Shows the was/now price
 * and the slot at a glance.
 */
export function MyDropRow({
  drop,
  withdrawing,
  onWithdraw,
}: {
  drop: MyDrop;
  withdrawing: boolean;
  onWithdraw: () => void;
}) {
  const badge = STATUS_BADGE[drop.status];
  const saving = savingsLabel(drop.normalPricePence, drop.dropPricePence);
  const dimmed = drop.status === "expired" || drop.status === "withdrawn";

  return (
    <View
      className={`rounded-2xl border border-ink-700 bg-ink-900 p-4 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text variant="bodySemibold" numberOfLines={1}>
            {formatDropDate(drop.dropDate)}
          </Text>
          <Text variant="caption" numberOfLines={1} className="mt-0.5 text-bone-300">
            {slotLabel(drop.slotType, drop.hoursNote)}
          </Text>
        </View>
        <Badge label={badge.label} tone={badge.tone} />
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <Text variant="bodySemibold" className="text-[15px] text-gold-300">
          {formatGBP(drop.dropPricePence)}
        </Text>
        {drop.normalPricePence ? (
          <Text variant="caption" className="text-bone-500 line-through">
            {formatGBP(drop.normalPricePence)}
          </Text>
        ) : null}
        {saving ? (
          <Text variant="caption" className="text-bone-500">
            · {saving}
          </Text>
        ) : null}
      </View>

      {drop.note ? (
        <Text variant="body" numberOfLines={2} className="mt-2 text-[13px] text-bone-500">
          {drop.note}
        </Text>
      ) : null}

      {drop.status === "open" ? (
        <Pressable
          onPress={onWithdraw}
          disabled={withdrawing}
          accessibilityRole="button"
          className={`mt-3 h-9 flex-row items-center justify-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 ${
            withdrawing ? "opacity-70" : "active:opacity-80"
          }`}
        >
          {withdrawing ? (
            <ActivityIndicator size="small" color={colors.bone[300]} />
          ) : (
            <>
              <Icon name="close-circle-outline" size={14} color={colors.bone[300]} />
              <Text variant="bodySemibold" className="text-[13px] text-bone-300">
                Withdraw
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
