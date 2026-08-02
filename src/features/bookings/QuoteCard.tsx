import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import { respondToQuote } from "../quotes/respond";
import { formatDate } from "./format";
import type { CustomerQuote } from "./data";

/**
 * A quote an artist has sent, on the My Bookings screen — price, deposit,
 * optional session count and hold-expiry, with real Accept / Decline actions
 * (the same server core as the web: accepting materialises the confirmed
 * appointment, ready for its deposit right above on this screen). Pass
 * `onChanged` so the screen refreshes once a response lands.
 */
export function QuoteCard({
  quote,
  onChanged,
}: {
  quote: CustomerQuote;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  const respond = useCallback(
    async (action: "accept" | "decline") => {
      setBusy(action);
      const result = await respondToQuote(quote.id, action);
      setBusy(null);
      if (!result.ok) {
        Alert.alert("Couldn't send your response", result.error);
        return;
      }
      onChanged?.();
      if (action === "accept") {
        Alert.alert(
          "Quote accepted",
          quote.depositPence > 0
            ? `Your booking is confirmed — it's now under Upcoming. Pay the ${formatGBP(quote.depositPence)} deposit there to lock it in.`
            : "Your booking is confirmed — it's now under Upcoming.",
        );
      }
    },
    [quote.id, quote.depositPence, onChanged],
  );

  const onAccept = useCallback(() => {
    Alert.alert(
      "Accept this quote?",
      `${formatGBP(quote.pricePence)} total${
        quote.depositPence > 0
          ? ` — you'll then pay the ${formatGBP(quote.depositPence)} deposit to lock in your booking`
          : ""
      }.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Accept", onPress: () => void respond("accept") },
      ],
    );
  }, [quote.pricePence, quote.depositPence, respond]);

  const onDecline = useCallback(() => {
    Alert.alert(
      "Decline this quote?",
      "Your artist will be told. You can keep chatting and they can send a new one.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () => void respond("decline"),
        },
      ],
    );
  }, [respond]);

  return (
    <View className="overflow-hidden rounded-2xl border border-gold-400/40 bg-ink-900">
      <View className="p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text variant="caption" numberOfLines={1}>
              {quote.artistName}
            </Text>
            <Text variant="display" numberOfLines={2} className="mt-0.5 text-lg">
              {quote.title}
            </Text>
          </View>
          <Badge label="Quote" tone="gold" />
        </View>

        {quote.description ? (
          <Text variant="body" numberOfLines={3} className="mt-2 text-[13px] text-bone-300">
            {quote.description}
          </Text>
        ) : null}

        {/* Figures */}
        <View className="mt-3 flex-row items-end gap-2">
          <Text variant="displayBold" className="text-2xl">
            {formatGBP(quote.pricePence)}
          </Text>
          {quote.sessionsCount && quote.sessionsCount > 1 ? (
            <Text variant="body" className="pb-0.5 text-bone-500">
              · {quote.sessionsCount} sessions
            </Text>
          ) : null}
        </View>

        <View className="mt-2 flex-row flex-wrap items-center gap-x-4 gap-y-1">
          {quote.depositPence > 0 ? (
            <View className="flex-row items-center gap-1">
              <Icon name="wallet-outline" size={13} color={colors.bone[500]} />
              <Text variant="caption">{formatGBP(quote.depositPence)} deposit to secure</Text>
            </View>
          ) : null}
          {quote.expiresAt ? (
            <View className="flex-row items-center gap-1">
              <Icon name="time-outline" size={13} color={colors.bone[500]} />
              <Text variant="caption">Holds until {formatDate(quote.expiresAt)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Respond */}
      <View className="flex-row gap-2.5 border-t border-ink-700 bg-ink-800 px-4 py-3">
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null}
          onPress={onDecline}
          className="flex-1 flex-row items-center justify-center rounded-xl border border-ink-600 bg-ink-900 py-2.5 active:opacity-80"
        >
          {busy === "decline" ? (
            <ActivityIndicator size="small" color={colors.bone[300]} />
          ) : (
            <Text variant="bodyMedium" className="text-[13px] text-bone-300">
              Decline
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy !== null}
          onPress={onAccept}
          className="flex-[1.6] flex-row items-center justify-center gap-1.5 rounded-xl bg-oxblood-500 py-2.5 active:opacity-85"
        >
          {busy === "accept" ? (
            <ActivityIndicator size="small" color={colors.bone[100]} />
          ) : (
            <>
              <Icon name="checkmark" size={14} color={colors.bone[100]} />
              <Text variant="bodySemibold" className="text-[13px] text-bone-100">
                Accept quote
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
