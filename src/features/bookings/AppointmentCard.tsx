import { useState } from "react";
import { View, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import { formatDateTime } from "./format";
import { payDeposit } from "./payDeposit";
import type { CustomerBooking } from "./data";

/**
 * A single upcoming or past appointment row: artist, piece, date/time and
 * deposit status. `past` mutes the icon and shows a "Completed" chip.
 *
 * An awaiting-deposit booking carries a live "Pay deposit" button — Stripe
 * Checkout in an in-app browser sheet via {@link payDeposit}; on success the
 * webhook records the payment and `onPaid` refetches so the card flips to
 * "Deposit paid" from server truth. The row taps through to the artist.
 */
export function AppointmentCard({
  booking,
  past = false,
  reviewed = false,
  onLeaveReview,
  onPaid,
}: {
  booking: CustomerBooking;
  past?: boolean;
  /** Past only: whether the customer has already reviewed this session. */
  reviewed?: boolean;
  /** Past + un-reviewed only: opens the leave-a-review sheet. */
  onLeaveReview?: () => void;
  /** Called after a successful deposit payment so the list refetches. */
  onPaid?: () => void;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const canOpen = booking.artistHandle.length > 0;
  const canReview = past && !reviewed && typeof onLeaveReview === "function";

  async function onPayDeposit() {
    if (paying) return;
    setPaying(true);
    const result = await payDeposit(booking.id);
    setPaying(false);
    if (result.ok) {
      onPaid?.();
    } else if (!result.cancelled && result.error) {
      Alert.alert("Deposit not taken", result.error);
    }
  }

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
              <>
                <Badge label="Completed" tone="neutral" />
                {reviewed ? <Badge label="★ Reviewed" tone="gold" /> : null}
              </>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Pay your ${formatGBP(booking.depositPence)} deposit`}
              onPress={onPayDeposit}
              disabled={paying}
              hitSlop={6}
              className={`mt-3 flex-row items-center gap-2 self-start rounded-xl px-4 py-2.5 ${
                paying ? "bg-oxblood-500/60" : "bg-oxblood-500 active:opacity-85"
              }`}
            >
              {paying ? (
                <ActivityIndicator size="small" color={colors.bone[100]} />
              ) : (
                <Icon name="lock-closed" size={14} color={colors.bone[100]} />
              )}
              <Text variant="bodySemibold" className="text-[13px] text-bone-100">
                {paying
                  ? "Opening secure checkout…"
                  : `Pay deposit · ${formatGBP(booking.depositPence)}`}
              </Text>
            </Pressable>
          ) : null}

          {canReview ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Leave a review for ${booking.artistName}`}
              onPress={onLeaveReview}
              hitSlop={6}
              className="mt-3 flex-row items-center gap-1.5 self-start rounded-xl border border-gold-400/60 bg-gold-400/10 px-3 py-2 active:opacity-80"
            >
              <Icon name="star-outline" size={14} color={colors.gold[300]} />
              <Text variant="bodySemibold" className="text-[13px] text-gold-300">
                Leave a review
              </Text>
            </Pressable>
          ) : null}
        </View>

        {canOpen && !canReview ? (
          <Icon name="chevron-forward" size={18} color={colors.bone[500]} />
        ) : null}
      </View>
    </Pressable>
  );
}
