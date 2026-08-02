import { View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import type { RequestView } from "./types";

/**
 * The booking request as the conversation's opening message — the customer's
 * side. Renders the structured enquiry (placement, size, budget, dates) as a
 * rich card, mirroring QuoteCard, with a live status chip so the customer sees
 * accepted/declined right where the conversation lives.
 */

const STATUS_CHIP: Record<
  RequestView["status"],
  { label: string; tone: "gold" | "positive" | "neutral" }
> = {
  pending: { label: "Pending", tone: "gold" },
  reviewing: { label: "Being reviewed", tone: "gold" },
  accepted: { label: "Accepted", tone: "positive" },
  declined: { label: "Declined", tone: "neutral" },
};

/** "Tue 4 Aug" from an ISO date string; empty on junk. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function datesLabel(dates: string[]): string {
  const pretty = dates.map(shortDate).filter(Boolean);
  if (pretty.length === 0) return "";
  if (pretty.length <= 2) return pretty.join(" or ");
  return `${pretty[0]} + ${pretty.length - 1} more`;
}

export function RequestCard({ request }: { request: RequestView }) {
  const chip = STATUS_CHIP[request.status];

  return (
    <View className="w-full overflow-hidden rounded-2xl border border-ink-700 bg-ink-800">
      <View className="flex-row items-center justify-between border-b border-ink-700 bg-ink-900/60 px-4 py-2.5">
        <View className="flex-row items-center gap-1.5">
          <Icon name="file-tray-full-outline" size={13} color={colors.gold[300]} />
          <Text variant="label" className="text-[10px] tracking-[1px] text-gold-300">
            Booking request
          </Text>
        </View>
        <Badge label={chip.label} tone={chip.tone} />
      </View>

      <View className="px-4 py-4">
        <Text variant="body" className="text-bone-100">
          {request.description}
        </Text>

        <View className="mt-3 gap-1.5 border-t border-ink-700 pt-3">
          {request.placement ? (
            <MetaRow label="Placement" value={request.placement} />
          ) : null}
          {request.sizeDesc ? <MetaRow label="Size" value={request.sizeDesc} /> : null}
          {request.budgetPence ? (
            <MetaRow label="Budget" value={`Around ${formatGBP(request.budgetPence)}`} />
          ) : null}
          {request.preferredDates.length > 0 ? (
            <MetaRow label="Dates" value={datesLabel(request.preferredDates)} />
          ) : null}
        </View>

        {request.status === "accepted" ? (
          <View className="mt-3 flex-row items-start gap-1.5">
            <Icon
              name="checkmark-circle"
              size={16}
              color={colors.positive}
              style={{ marginTop: 1 }}
            />
            <Text variant="body" className="flex-1 text-[13px] text-positive">
              Accepted — your booking is under way. Watch this thread for the
              details and your deposit.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="caption" className="text-bone-500">
        {label}
      </Text>
      <Text variant="caption" className="flex-1 text-right text-bone-300" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
