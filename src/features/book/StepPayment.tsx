import { View, Pressable } from "react-native";
import { Text } from "../../ui/Text";
import { Icon, type IconName } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import type { BookingDraft, PayPref } from "./model";

/**
 * Step 3 — how you'd like to pay LATER. This is a PREFERENCE, not a checkout:
 * nothing is charged from the app and the request row has no column for it. It
 * simply tells the artist how the customer is thinking about paying once the
 * piece is confirmed. Copy stays honest — never "pay later", the InkSpred Plan
 * is saving-ahead (not credit), and Klarna is flagged as still arriving.
 */
export function StepPayment({
  financeEnabled,
  draft,
  update,
}: {
  financeEnabled: boolean;
  draft: BookingDraft;
  update: (patch: Partial<BookingDraft>) => void;
}) {
  const select = (payPref: PayPref) =>
    update({ payPref: draft.payPref === payPref ? null : payPref });

  return (
    <View className="gap-7">
      <View>
        <Text variant="display" className="text-2xl">
          How you&rsquo;d like to pay
        </Text>
        <Text variant="body" className="mt-1.5 text-bone-300">
          Just a preference for now — nothing is charged. You&rsquo;ll sort the
          actual payment with the artist once your piece is confirmed.
        </Text>
      </View>

      <View className="gap-3">
        <PrefCard
          icon="wallet-outline"
          title="Deposit now, balance on the day"
          body="Secure the slot with a deposit, then settle the rest at the studio when you're in the chair."
          selected={draft.payPref === "deposit"}
          onPress={() => select("deposit")}
        />

        <PrefCard
          icon="sparkles-outline"
          title="InkSpred Plan"
          body="Save toward your tattoo in steady instalments. It's not credit and it's not a loan — you're paying ahead, and the chair is yours once it's covered."
          selected={draft.payPref === "plan"}
          onPress={() => select("plan")}
          accent
          badge={financeEnabled ? "Most chosen" : undefined}
          note={
            financeEnabled
              ? undefined
              : "This artist hasn't switched plans on yet — pop it as a preference and they'll be in touch."
          }
        />

        <PrefCard
          icon="card-outline"
          title="Split it with Klarna"
          body="Klarna Pay in 3, interest-free. Klarna is the lender, not InkSpred. We're finishing the integration."
          selected={draft.payPref === "klarna"}
          onPress={() => select("klarna")}
          badge="Arriving"
        />
      </View>

      {/* Quiet reassurance */}
      <View className="flex-row flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        <Reassure icon="shield-checkmark-outline" label="Deposits protected" />
        <Reassure icon="lock-closed-outline" label="Payments by Stripe" />
        <Reassure icon="scale-outline" label="InkSpred is not a lender" />
      </View>
    </View>
  );
}

function PrefCard({
  icon,
  title,
  body,
  selected,
  onPress,
  accent,
  badge,
  note,
}: {
  icon: IconName;
  title: string;
  body: string;
  selected: boolean;
  onPress: () => void;
  accent?: boolean;
  badge?: string;
  note?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`rounded-2xl border p-4 ${
        selected
          ? "border-gold-400/70 bg-ink-800"
          : accent
            ? "border-gold-400/30 bg-ink-800"
            : "border-ink-700 bg-ink-900"
      }`}
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
    >
      <View className="flex-row items-start gap-3">
        <View
          className={`h-10 w-10 items-center justify-center rounded-xl border ${
            accent ? "border-gold-400/40 bg-gold-400/10" : "border-ink-600 bg-ink-800"
          }`}
        >
          <Icon
            name={icon}
            size={18}
            color={accent ? colors.gold[300] : colors.bone[300]}
          />
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              variant="bodySemibold"
              className={accent ? "text-gold-300" : undefined}
            >
              {title}
            </Text>
            {badge ? <Badge label={badge} tone={accent ? "gold" : "neutral"} /> : null}
          </View>
          <Text variant="body" className="mt-1.5 text-[13px] leading-[19px] text-bone-300">
            {body}
          </Text>
          {note ? (
            <Text variant="caption" className="mt-2 text-bone-500">
              {note}
            </Text>
          ) : null}
        </View>

        <View
          className={`h-5 w-5 items-center justify-center rounded-full border ${
            selected ? "border-gold-400 bg-gold-400" : "border-ink-500"
          }`}
        >
          {selected ? <Icon name="checkmark" size={13} color={colors.ink[950]} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function Reassure({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon name={icon} size={13} color={colors.bone[500]} />
      <Text variant="caption" className="text-bone-500">
        {label}
      </Text>
    </View>
  );
}
