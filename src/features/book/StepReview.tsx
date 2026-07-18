import { type ReactNode } from "react";
import { View, Pressable } from "react-native";
import { Text } from "../../ui/Text";
import { Icon, type IconName } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import type { ArtistServiceRow } from "../../lib/data/artists";
import {
  formatIsoShort,
  sizeLabel,
  type BookingDraft,
  type PayPref,
} from "./model";

const PAY_PREF_LABEL: Record<PayPref, string> = {
  deposit: "Deposit now, balance on the day",
  plan: "InkSpred Plan — saving ahead",
  klarna: "Split it with Klarna (arriving)",
};

/**
 * Step 4 — review. A read-back of every choice with quick "Edit" jumps back to
 * the relevant step. The submit button lives in the wizard footer.
 */
export function StepReview({
  artistName,
  service,
  draft,
  budgetPence,
  onEdit,
}: {
  artistName: string;
  service: ArtistServiceRow | null;
  draft: BookingDraft;
  budgetPence: number | null;
  onEdit: (step: number) => void;
}) {
  const pieceName = service ? service.name : "Custom piece";
  const size = sizeLabel(draft.size);

  return (
    <View className="gap-7">
      <View>
        <Text variant="display" className="text-2xl">
          Review your request
        </Text>
        <Text variant="body" className="mt-1.5 text-bone-300">
          Here&rsquo;s what {artistName} will see. Nothing is booked or charged until
          they reply.
        </Text>
      </View>

      {/* The piece */}
      <ReviewBlock title="The piece" onEdit={() => onEdit(0)}>
        <Row icon="brush-outline" value={pieceName} />
        {draft.placement ? <Row icon="body-outline" value={draft.placement} /> : null}
        {size ? <Row icon="resize-outline" value={size} /> : null}
        {draft.description.trim() ? (
          <Row icon="document-text-outline" value={draft.description.trim()} />
        ) : null}
        {budgetPence != null ? (
          <Row icon="cash-outline" value={`${formatGBP(budgetPence)} budget (guide)`} />
        ) : null}
      </ReviewBlock>

      {/* Dates */}
      <ReviewBlock title="Preferred dates" onEdit={() => onEdit(1)}>
        {draft.flexible ? (
          <Row icon="sparkles-outline" value="Flexible — any date works" />
        ) : draft.dates.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {draft.dates.map((iso) => (
              <View
                key={iso}
                className="rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5"
              >
                <Text variant="bodyMedium" className="text-[13px] text-bone-300">
                  {formatIsoShort(iso)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Row icon="calendar-outline" value="No dates chosen" />
        )}
      </ReviewBlock>

      {/* Payment preference */}
      <ReviewBlock title="Payment preference" onEdit={() => onEdit(2)}>
        <Row
          icon="wallet-outline"
          value={draft.payPref ? PAY_PREF_LABEL[draft.payPref] : "No preference yet"}
        />
        <Text variant="caption" className="text-bone-500">
          A preference only — you&rsquo;ll arrange the actual payment with the artist.
        </Text>
      </ReviewBlock>
    </View>
  );
}

function ReviewBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <View className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text variant="label" className="text-bone-300">
          {title}
        </Text>
        <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button">
          <Text variant="bodyMedium" className="text-[13px] text-gold-300">
            Edit
          </Text>
        </Pressable>
      </View>
      <View className="gap-2.5">{children}</View>
    </View>
  );
}

function Row({ icon, value }: { icon: IconName; value: string }) {
  return (
    <View className="flex-row items-start gap-2.5">
      <View className="mt-0.5">
        <Icon name={icon} size={15} color={colors.bone[500]} />
      </View>
      <Text variant="body" className="flex-1 text-bone-100">
        {value}
      </Text>
    </View>
  );
}
