import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import { formatDateTime } from "./format";
import type { CustomerBooking } from "./data";

/**
 * A single upcoming or past appointment row: artist, piece, date/time and
 * deposit status. `past` mutes the icon and shows a "Completed" chip.
 *
 * Deposit checkout is a server-action-only flow on the web (Stripe), not yet
 * callable from native — so an awaiting-deposit booking shows an honest "pay
 * from the app soon" note beneath the amount rather than a button that can't
 * work. The row taps through to the artist's profile.
 */
export function AppointmentCard({
  booking,
  past = false,
}: {
  booking: CustomerBooking;
  past?: boolean;
}) {
  const router = useRouter();
  const canOpen = booking.artistHandle.length > 0;

  return (
    <Pressable
      accessibilityRole={canOpen ? "button" : undefined}
      disabled={!canOpen}
      onPress={
        canOpen
          ? () => router.push(`/(customer)/artist/${booking.artistHandle}`)
          : undefined
      }
      className={`rounded-2xl border border-ink-700 bg-ink-900 p-4 ${
        canOpen ? "active:opacity-80" : ""
      }`}
    >
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-800">
          <Icon
            name="calendar"
            size={16}
            color={past ? colors.bone[500] : colors.gold[400]}
          />
        </View>

        <View className="min-w-0 flex-1">
          <Text variant="caption" numberOfLines={1}>
            {booking.artistName}
          </Text>
          <Text variant="bodySemibold" numberOfLines={2} className="mt-0.5">
            {booking.piece}
          </Text>
          {booking.startsAtIso ? (
            <Text variant="body" className="mt-1 text-[13px] text-bone-300">
              {past ? "" : "Session: "}
              {formatDateTime(booking.startsAtIso)}
            </Text>
          ) : !past ? (
            <Text variant="body" className="mt-1 text-[13px] text-bone-500">
              Awaiting a session time from your artist
            </Text>
          ) : null}

          {/* Status / deposit line */}
          <View className="mt-2.5 flex-row items-center gap-2">
            {past ? (
              <Badge label="Completed" tone="neutral" />
            ) : booking.depositPaid ? (
              <Badge label="Deposit paid" tone="positive" />
            ) : booking.awaitingDeposit ? (
              <Badge
                label={`Deposit · ${formatGBP(booking.depositPence)}`}
                tone="gold"
              />
            ) : booking.depositPence > 0 ? (
              <Badge
                label={`Deposit due · ${formatGBP(booking.depositPence)}`}
                tone="gold"
              />
            ) : null}
          </View>

          {!past && booking.awaitingDeposit ? (
            <Text variant="caption" className="mt-1.5">
              Pay your deposit from the app soon — we're finishing checkout here.
            </Text>
          ) : null}
        </View>

        {canOpen ? (
          <Icon name="chevron-forward" size={18} color={colors.bone[500]} />
        ) : null}
      </View>
    </Pressable>
  );
}
