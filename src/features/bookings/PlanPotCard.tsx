import { View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import { formatDate } from "./format";
import type { CustomerBooking } from "./data";

/**
 * The layaway "pot" card for an in-plan booking — the native mirror of the web
 * PlanPotCard. Reuses the plan flow's visual language: pence-precise figures, a
 * progress bar towards 100%, next-instalment date and the "no credit / no
 * interest" reassurance. The session unlocks once the pot reaches 100%.
 *
 * The web uses an oxblood→gold gradient bar and a radial header wash; native has
 * no gradient primitive, so we approximate with a solid gold fill and a subtle
 * oxblood-tinted header overlay (the same pattern the artist-profile hero uses).
 */
export function PlanPotCard({ booking }: { booking: CustomerBooking }) {
  const plan = booking.plan;
  if (!plan) return null;

  const remainingPence = Math.max(plan.totalPence - plan.paidPence, 0);
  const pct =
    plan.totalPence > 0
      ? Math.min(100, Math.round((plan.paidPence / plan.totalPence) * 100))
      : 0;
  const complete = pct >= 100;

  return (
    <View className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
      {/* Header — oxblood wash approximated with a tinted overlay. */}
      <View className="relative px-5 pt-5 pb-4">
        <View
          pointerEvents="none"
          className="absolute inset-0"
          style={{ backgroundColor: colors.oxblood[600], opacity: 0.16 }}
        />

        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text variant="label" numberOfLines={1}>
              InkSpred Plan · {booking.artistName}
            </Text>
            <Text variant="display" numberOfLines={2} className="mt-1 text-lg">
              {booking.piece}
            </Text>
          </View>
          <Badge
            label={complete ? "Fully funded" : `${pct}% funded`}
            tone={complete ? "positive" : "gold"}
          />
        </View>

        {/* Paid vs total */}
        <View className="mt-4 flex-row items-baseline gap-2">
          <Text variant="displayBold" className="text-3xl">
            {formatGBP(plan.paidPence)}
          </Text>
          <Text variant="body" className="text-bone-500">
            of {formatGBP(plan.totalPence)} in the pot
          </Text>
        </View>

        {/* Progress bar */}
        <View className="mt-3">
          <View className="h-2.5 w-full overflow-hidden rounded-full bg-ink-700">
            <View
              className="h-full rounded-full bg-gold-400"
              style={{ width: `${pct}%` }}
            />
          </View>
          <View className="mt-1.5 flex-row items-center justify-between">
            <Text variant="caption">
              {plan.instalmentsPaid} of {plan.instalmentsTotal} payments made
            </Text>
            <Text variant="caption">
              {complete ? "Ready to book" : `${formatGBP(remainingPence)} to go`}
            </Text>
          </View>
        </View>
      </View>

      <View className="border-t border-ink-700 px-5 py-4">
        {/* Unlock line */}
        <View className="flex-row items-center gap-2">
          <Icon
            name={complete ? "shield-checkmark" : "lock-closed"}
            size={15}
            color={complete ? colors.positive : colors.gold[400]}
          />
          {complete ? (
            <Text variant="body" className="flex-1 text-[13px] text-bone-100">
              Pot complete — pick your session date with {booking.artistName}.
            </Text>
          ) : (
            <Text variant="body" className="flex-1 text-[13px] text-bone-300">
              Session unlocks at 100%.
            </Text>
          )}
        </View>

        {/* Next instalment */}
        {!complete && plan.nextDueIso && plan.nextAmountPence != null ? (
          <View className="mt-3 flex-row items-center justify-between rounded-xl border border-ink-600 bg-ink-800 px-4 py-3">
            <View>
              <Text variant="caption">Next payment</Text>
              <Text variant="bodyMedium" className="mt-0.5 text-[13px]">
                {formatDate(plan.nextDueIso)}
              </Text>
            </View>
            <Text variant="display" className="text-lg">
              {formatGBP(plan.nextAmountPence)}
            </Text>
          </View>
        ) : null}

        <Text variant="caption" className="mt-3">
          No credit · No interest · Held against your booking
        </Text>
      </View>
    </View>
  );
}
