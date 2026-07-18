import { View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import { formatDate } from "./format";
import type { CustomerQuote } from "./data";

/**
 * A read-only quote an artist has sent — price, deposit, optional session count
 * and hold-expiry.
 *
 * Accepting / declining a quote is a server-action-only flow on the web (it
 * materialises a confirmed appointment through the service role), and isn't
 * callable from native yet. So this card is honest: it shows the figures and
 * points the customer to respond from the quote in their messages on the web
 * for now, rather than an Accept button that can't complete.
 */
export function QuoteCard({ quote }: { quote: CustomerQuote }) {
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

      {/* Honest respond-on-web note */}
      <View className="flex-row items-center gap-2 border-t border-ink-700 bg-ink-800 px-4 py-3">
        <Icon name="open-outline" size={14} color={colors.gold[400]} />
        <Text variant="caption" className="flex-1 text-bone-300">
          Respond from the quote in your messages on the web for now — accepting
          in the app is coming soon.
        </Text>
      </View>
    </View>
  );
}
