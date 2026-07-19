import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon, type IconName } from "../../../src/ui/Icon";
import { Button } from "../../../src/ui/Button";
import { Badge } from "../../../src/ui/Badge";
import { colors } from "../../../src/ui/tokens";
import { formatGBP } from "../../../src/lib/money";
import { AccountPanel } from "../../../src/features/account/AccountPanel";
import { useAuth } from "../../../src/lib/auth";
import {
  getArtistContext,
  getArtistDashboard,
  type ArtistDashboard,
  type DashboardAppointment,
} from "../../../src/features/artist/data";

type Status = "loading" | "ready" | "error";

const EMPTY: ArtistDashboard = {
  pendingRequestCount: 0,
  unreadMessageCount: 0,
  todayAppointments: [],
  weekEarningsPence: 0,
  weekDepositsPence: 0,
  weekDepositsCount: 0,
};

const REQUESTS_HREF = "/(artist)/(tabs)/requests" as Href;
const MESSAGES_HREF = "/(artist)/(tabs)/messages" as Href;
const MONEY_HREF = "/(artist)/(tabs)/money" as Href;

export default function Today() {
  const router = useRouter();
  const { session, profile, role } = useAuth();
  const [data, setData] = useState<ArtistDashboard>(EMPTY);
  const [isArtist, setIsArtist] = useState(true);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);

  const firstName = profile?.fullName?.trim().split(/\s+/)[0];

  const load = useCallback(async () => {
    if (!session) {
      setData(EMPTY);
      setStatus("ready");
      return;
    }
    try {
      const ctx = await getArtistContext();
      setIsArtist(!!ctx);
      if (!ctx) {
        setData(EMPTY);
        setStatus("ready");
        return;
      }
      const dashboard = await getArtistDashboard(ctx);
      setData(dashboard);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [session]);

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

  /* Signed out — branded sign-in prompt. */
  if (!session) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon name="sunny" size={26} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            Sign in to open your studio
          </Text>
          <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
            Your day at a glance — sessions, deposits due and new enquiries — is
            waiting once you're signed in.
          </Text>
          <Button
            label="Sign in"
            variant="primary"
            block={false}
            onPress={() => router.push("/(auth)/login")}
          />
        </View>
      </SafeAreaView>
    );
  }

  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.gold[400]}
    />
  );

  const sessions = data.todayAppointments;

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={refresh}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <Text variant="body" className="text-bone-500">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </Text>
          <Text variant="displayBold" className="mt-1 text-3xl">
            Today
          </Text>
        </View>

        {status === "error" ? (
          <View className="mb-8 items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-10">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
              <Icon name="cloud-offline-outline" size={24} color={colors.bone[500]} />
            </View>
            <Text variant="display" className="mb-2 text-center text-xl">
              Couldn't load today
            </Text>
            <Text variant="body" className="max-w-[280px] text-center text-bone-500">
              Pull down to refresh and try again.
            </Text>
          </View>
        ) : role === "artist" && !isArtist ? (
          <View className="mb-8 items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-10">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
              <Icon name="brush-outline" size={24} color={colors.gold[400]} />
            </View>
            <Text variant="display" className="mb-2 text-center text-xl">
              Finish your studio setup
            </Text>
            <Text variant="body" className="max-w-[280px] text-center text-bone-500">
              Once your artist profile is live, your sessions, deposits and
              enquiries appear here each morning.
            </Text>
          </View>
        ) : (
          <>
            {/* Today's sessions */}
            <Text variant="label" className="mb-3 text-bone-500">
              Today's sessions
            </Text>
            {sessions.length === 0 ? (
              <View className="mb-7 items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-9">
                <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
                  <Icon name="cafe-outline" size={24} color={colors.gold[400]} />
                </View>
                <Text variant="display" className="mb-2 text-center text-xl">
                  Nothing booked today
                </Text>
                <Text variant="body" className="max-w-[280px] text-center text-bone-500">
                  A clear chair. Confirmed sessions for today show up here with
                  their times and deposit status.
                </Text>
              </View>
            ) : (
              <View className="mb-7 gap-3">
                {sessions.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </View>
            )}

            {/* Snapshot stats */}
            <Text variant="label" className="mb-3 text-bone-500">
              This week
            </Text>
            <View className="mb-3 flex-row gap-3">
              <StatTile
                icon="file-tray-full-outline"
                label="Pending requests"
                value={String(data.pendingRequestCount)}
                tone={data.pendingRequestCount > 0 ? "gold" : "neutral"}
                onPress={() => router.push(REQUESTS_HREF)}
              />
              <StatTile
                icon="chatbubble-ellipses-outline"
                label="Unread messages"
                value={String(data.unreadMessageCount)}
                tone={data.unreadMessageCount > 0 ? "gold" : "neutral"}
                onPress={() => router.push(MESSAGES_HREF)}
              />
            </View>
            <View className="mb-7 flex-row gap-3">
              <StatTile
                icon="wallet-outline"
                label="Deposits collected"
                value={formatGBP(data.weekDepositsPence)}
                sub={`${data.weekDepositsCount} deposit${
                  data.weekDepositsCount === 1 ? "" : "s"
                }`}
                onPress={() => router.push(MONEY_HREF)}
              />
              <StatTile
                icon="trending-up-outline"
                label="Earnings"
                value={formatGBP(data.weekEarningsPence)}
                onPress={() => router.push(MONEY_HREF)}
              />
            </View>

            {/* Quick links */}
            <Text variant="label" className="mb-3 text-bone-500">
              Jump to
            </Text>
            <View className="mb-8 flex-row gap-3">
              <QuickLink
                icon="file-tray-full"
                label="Requests"
                onPress={() => router.push(REQUESTS_HREF)}
              />
              <QuickLink
                icon="chatbubble-ellipses"
                label="Messages"
                onPress={() => router.push(MESSAGES_HREF)}
              />
              <QuickLink
                icon="wallet"
                label="Money"
                onPress={() => router.push(MONEY_HREF)}
              />
            </View>
          </>
        )}

        {/* Account */}
        <Text variant="label" className="mb-3 text-bone-500">
          Account
        </Text>
        <AccountPanel />
      </ScrollView>
    </SafeAreaView>
  );
}

/** One confirmed session in today's timeline. */
function SessionRow({ session }: { session: DashboardAppointment }) {
  return (
    <View className="flex-row items-center gap-3.5 rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <View className="items-center">
        <Text variant="displayBold" className="text-lg text-bone-100">
          {session.startLabel}
        </Text>
        {session.durationLabel ? (
          <Text variant="caption" className="mt-0.5">
            {session.durationLabel}
          </Text>
        ) : null}
      </View>
      <View className="h-10 w-px bg-ink-700" />
      <View className="min-w-0 flex-1">
        <Text variant="bodySemibold" numberOfLines={1}>
          {session.client}
        </Text>
        <Text variant="body" numberOfLines={1} className="mt-0.5 text-[13px] text-bone-500">
          {session.piece}
        </Text>
      </View>
      {session.depositPence > 0 ? (
        <Badge
          label={session.depositPaid ? "Deposit paid" : "Deposit due"}
          tone={session.depositPaid ? "positive" : "gold"}
        />
      ) : null}
    </View>
  );
}

/** A tappable snapshot stat tile. */
function StatTile({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "gold";
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-1 rounded-2xl border border-ink-700 bg-ink-900 p-4 active:opacity-80"
    >
      <Icon
        name={icon}
        size={18}
        color={tone === "gold" ? colors.gold[400] : colors.bone[500]}
      />
      <Text
        variant="displayBold"
        className={`mt-3 text-2xl ${tone === "gold" ? "text-gold-300" : "text-bone-100"}`}
      >
        {value}
      </Text>
      <Text variant="caption" numberOfLines={1} className="mt-1">
        {label}
      </Text>
      {sub ? (
        <Text variant="caption" numberOfLines={1} className="mt-0.5 text-bone-500">
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A compact quick-link button. */
function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-1 items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-2 py-4 active:opacity-80"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl border border-ink-600 bg-ink-800">
        <Icon name={icon} size={18} color={colors.gold[400]} />
      </View>
      <Text variant="bodyMedium" className="text-[13px] text-bone-300">
        {label}
      </Text>
    </Pressable>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
