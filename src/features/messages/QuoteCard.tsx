import { View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import type { QuoteStatus, QuoteView } from "./types";

/**
 * Read-only native quote card — the in-thread mirror of the web
 * components/quotes/QuoteCard. It draws the artist's priced proposal (title,
 * total, deposit, balance, sessions, hold expiry) and a status chip.
 *
 * Accepting a quote materialises a confirmed appointment via a service-role
 * server action the native client cannot call yet, so this card is purely
 * presentational: for a still-open ("sent") quote it shows an honest note that
 * acceptance happens on the web for now.
 */

const RESOLVED_CHIP: Record<
  QuoteStatus,
  { label: string; tone: "positive" | "neutral" } | null
> = {
  sent: null,
  accepted: { label: "Accepted", tone: "positive" },
  declined: { label: "Declined", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};

/** "Sat 19 Jul" — adds the year only when it isn't the current one. */
function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function QuoteCard({ quote }: { quote: QuoteView }) {
  const chip = RESOLVED_CHIP[quote.status];
  const balancePence = Math.max(0, quote.pricePence - quote.depositPence);

  return (
    <View className="w-full overflow-hidden rounded-2xl border border-ink-700 bg-ink-800">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-ink-700 bg-ink-900/60 px-4 py-2.5">
        <View className="flex-row items-center gap-1.5">
          <Icon name="reader-outline" size={13} color={colors.gold[300]} />
          <Text
            variant="label"
            className="text-[10px] tracking-[1px] text-gold-300"
          >
            Quote
          </Text>
        </View>
        {chip ? <Badge label={chip.label} tone={chip.tone} /> : null}
      </View>

      {/* Body */}
      <View className="px-4 py-4">
        <Text variant="display" className="text-lg leading-6">
          {quote.title}
        </Text>
        {quote.description ? (
          <Text variant="body" className="mt-2 text-bone-300">
            {quote.description}
          </Text>
        ) : null}

        <View className="mt-4 rounded-xl border border-ink-700 bg-ink-900/50 p-4">
          <View className="flex-row items-end justify-between gap-3">
            <View>
              <Text variant="label" className="text-[10px] text-bone-500">
                Total
              </Text>
              <Text variant="display" className="mt-0.5 text-2xl">
                {formatGBP(quote.pricePence)}
              </Text>
            </View>
            {quote.depositPence > 0 ? (
              <View className="items-end">
                <Text variant="label" className="text-[10px] text-bone-500">
                  Deposit to book
                </Text>
                <Text
                  variant="display"
                  className="mt-0.5 text-lg text-gold-300"
                >
                  {formatGBP(quote.depositPence)}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mt-3 gap-1.5 border-t border-ink-700 pt-3">
            {quote.depositPence > 0 ? (
              <DetailRow
                label="Balance on the day"
                value={formatGBP(balancePence)}
              />
            ) : null}
            {quote.sessionsCount && quote.sessionsCount > 1 ? (
              <DetailRow label="Sessions" value={String(quote.sessionsCount)} />
            ) : null}
            {quote.expiresAt ? (
              <DetailRow
                label={quote.status === "expired" ? "Expired" : "Hold expires"}
                value={formatExpiry(quote.expiresAt)}
              />
            ) : null}
          </View>
        </View>

        {quote.status === "accepted" ? (
          <View className="mt-3 flex-row items-start gap-1.5">
            <Icon
              name="checkmark-circle"
              size={16}
              color={colors.positive}
              style={{ marginTop: 1 }}
            />
            <Text variant="body" className="flex-1 text-[13px] text-positive">
              Accepted — pay the deposit to lock in your booking.
            </Text>
          </View>
        ) : quote.status === "sent" ? (
          <View className="mt-3 flex-row items-start gap-1.5">
            <Icon
              name="phone-portrait-outline"
              size={15}
              color={colors.bone[500]}
              style={{ marginTop: 1 }}
            />
            <Text variant="caption" className="flex-1 leading-4 text-bone-500">
              Accept &amp; book from the InkSpred web app for now — one-tap
              acceptance is coming to the app soon.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="caption" className="text-bone-500">
        {label}
      </Text>
      <Text variant="caption" className="text-bone-300">
        {value}
      </Text>
    </View>
  );
}
