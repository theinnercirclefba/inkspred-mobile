import { View, Pressable } from "react-native";
import { Text } from "../../ui/Text";
import { Icon, type IconName } from "../../ui/Icon";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import type { BookingDraft, PayPref } from "./model";

/**
 * Step 3 — how you'd like to handle payment once the artist confirms. This is
 * a PREFERENCE, not a checkout: nothing is charged from the app at request
 * time and the request row has no column for it. When the artist confirms with
 * a deposit, checkout happens for real on My Bookings (Stripe). Only options
 * the app supports today are offered — no "arriving soon" products.
 */
export function StepPayment({
  financeEnabled: _financeEnabled,
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
          Just a preference for now — nothing is charged with your request. Once
          your artist confirms, you&rsquo;ll secure the session with a deposit
          right here in the app.
        </Text>
      </View>

      <View className="gap-3">
        <PrefCard
          icon="wallet-outline"
          title="Deposit now, balance on the day"
          body="Secure the slot with a card deposit as soon as your artist confirms, then settle the rest at the studio when you're in the chair."
          selected={draft.payPref === "deposit"}
          onPress={() => select("deposit")}
          accent
          badge="Most chosen"
        />

        <PrefCard
          icon="chatbubbles-outline"
          title="Talk it through first"
          body="Not sure yet? Discuss the piece, price and timings with your artist in messages before anything is paid."
          selected={draft.payPref === "discuss"}
          onPress={() => select("discuss")}
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
