import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "../../../src/ui/Screen";
import { Text } from "../../../src/ui/Text";
import { Icon, type IconName } from "../../../src/ui/Icon";
import { EmptyState } from "../../../src/ui/EmptyState";
import { colors } from "../../../src/ui/tokens";
import { formatGBP } from "../../../src/lib/money";
import { getArtistContext } from "../../../src/features/artist/data";
import {
  getArtistMoney,
  type ArtistMoney,
  type MoneyPaymentRow,
} from "../../../src/features/artist/money";

type Status = "loading" | "ready" | "signedout";

/**
 * Money — the artist's real earnings picture: payments collected, upcoming
 * booked value and completed work, with a recent-payments feed. Everything is
 * live data scoped by RLS; the empty state only shows when there genuinely is
 * nothing yet.
 */
export default function Money() {
  const [status, setStatus] = useState<Status>("loading");
  const [money, setMoney] = useState<ArtistMoney | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const ctx = await getArtistContext();
    if (!ctx) {
      setStatus("signedout");
      return;
    }
    setMoney(await getArtistMoney(ctx));
    setStatus("ready");
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (status === "loading") {
    return (
      <Screen padded={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.gold[400]} />
          <Text variant="caption" className="mt-2">
            Totting up…
          </Text>
        </View>
      </Screen>
    );
  }

  if (status === "signedout" || !money) {
    return (
      <Screen padded={false}>
        <EmptyState
          icon="wallet"
          title="Sign in to see your takings"
          body="Deposits and booked work, totalled in pounds, live here."
        />
      </Screen>
    );
  }

  const nothingYet =
    money.collectedCount === 0 &&
    money.upcomingCount === 0 &&
    money.completedCount === 0;

  return (
    <Screen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.gold[400]}
          />
        }
      >
        <Text variant="body" className="text-bone-500">
          Your takings
        </Text>
        <Text variant="displayBold" className="mt-1 text-3xl">
          Money
        </Text>

        {nothingYet ? (
          <View className="mt-10">
            <EmptyState
              icon="wallet"
              title="No takings yet"
              body="When clients pay deposits and sessions complete, your earnings picture builds here — live, in pounds."
            />
          </View>
        ) : (
          <>
            {/* Headline stats */}
            <View className="mt-6 gap-3">
              <StatCard
                icon="card"
                label="Collected through InkSpred"
                value={formatGBP(money.collectedPence)}
                hint={
                  money.collectedCount === 1
                    ? "1 payment"
                    : `${money.collectedCount} payments`
                }
                accent
              />
              <View className="flex-row gap-3">
                <StatCard
                  icon="calendar"
                  label="Booked ahead"
                  value={formatGBP(money.upcomingValuePence)}
                  hint={
                    money.upcomingCount === 1
                      ? "1 session"
                      : `${money.upcomingCount} sessions`
                  }
                  compact
                />
                <StatCard
                  icon="checkmark-circle"
                  label="Completed"
                  value={formatGBP(money.completedValuePence)}
                  hint={
                    money.completedCount === 1
                      ? "1 session"
                      : `${money.completedCount} sessions`
                  }
                  compact
                />
              </View>
            </View>

            {/* Recent payments */}
            {money.recent.length > 0 ? (
              <View className="mt-8">
                <Text variant="display" className="mb-3 text-xl">
                  Recent payments
                </Text>
                <View className="rounded-2xl border border-ink-700 bg-ink-900">
                  {money.recent.map((p, i) => (
                    <PaymentRow
                      key={p.id}
                      payment={p}
                      first={i === 0}
                      last={i === money.recent.length - 1}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <Text variant="caption" className="mt-6 text-center text-bone-500">
              Deposits are paid through Stripe and settle to your account.
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
  compact,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <View
      className={`rounded-2xl border p-4 ${compact ? "flex-1" : ""} ${
        accent ? "border-gold-400/40 bg-gold-400/10" : "border-ink-700 bg-ink-900"
      }`}
    >
      <View className="flex-row items-center gap-1.5">
        <Icon
          name={icon}
          size={13}
          color={accent ? colors.gold[300] : colors.bone[500]}
        />
        <Text variant="caption" className={accent ? "text-gold-300" : undefined}>
          {label}
        </Text>
      </View>
      <Text
        variant="displayBold"
        className={`mt-2 ${compact ? "text-xl" : "text-3xl"} ${
          accent ? "text-gold-300" : "text-bone-100"
        }`}
      >
        {value}
      </Text>
      <Text variant="caption" className="mt-1 text-bone-500">
        {hint}
      </Text>
    </View>
  );
}

function PaymentRow({
  payment,
  first,
  last,
}: {
  payment: MoneyPaymentRow;
  first: boolean;
  last: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 ${
        first ? "" : "border-t border-ink-700"
      } ${last ? "rounded-b-2xl" : ""} ${first ? "rounded-t-2xl" : ""}`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl border border-ink-600 bg-ink-800">
        <Icon name="arrow-down" size={14} color={colors.positive} />
      </View>
      <View className="min-w-0 flex-1">
        <Text variant="bodySemibold" numberOfLines={1}>
          {payment.client}
        </Text>
        <Text variant="caption" numberOfLines={1} className="mt-0.5">
          {payment.piece}
          {payment.paidAtIso ? ` · ${dateLabel(payment.paidAtIso)}` : ""}
        </Text>
      </View>
      <Text variant="bodySemibold" className="text-positive">
        +{formatGBP(payment.amountPence)}
      </Text>
    </View>
  );
}

/** "12 Jul" from an ISO timestamp; empty on an unparseable value. */
function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
