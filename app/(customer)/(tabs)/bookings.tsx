import { useCallback, useState, type ReactNode } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "../../../src/ui/Screen";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Button } from "../../../src/ui/Button";
import { EmptyState } from "../../../src/ui/EmptyState";
import { colors } from "../../../src/ui/tokens";
import { useAuth } from "../../../src/lib/auth";
import {
  getCustomerBookings,
  type CustomerBookings,
} from "../../../src/features/bookings/data";
import { PlanPotCard } from "../../../src/features/bookings/PlanPotCard";
import { AppointmentCard } from "../../../src/features/bookings/AppointmentCard";
import { RequestCard } from "../../../src/features/bookings/RequestCard";
import { QuoteCard } from "../../../src/features/bookings/QuoteCard";

type Status = "loading" | "ready" | "error";

const EMPTY: CustomerBookings = {
  quotes: [],
  upcoming: [],
  inPlan: [],
  requests: [],
  past: [],
};

export default function Bookings() {
  const router = useRouter();
  const { session } = useAuth();
  const [data, setData] = useState<CustomerBookings>(EMPTY);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setData(EMPTY);
      setStatus("ready");
      return;
    }
    try {
      const result = await getCustomerBookings();
      // null = signed out mid-flight; treat as empty rather than error.
      setData(result ?? EMPTY);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [session]);

  // Refresh on focus so a request sent from an artist profile shows up here.
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
      <Screen padded={false}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon name="calendar" size={26} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            Sign in to see your bookings
          </Text>
          <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
            Your upcoming sessions, spread-the-cost pots and requests live here
            once you're signed in.
          </Text>
          <Button
            label="Sign in"
            variant="primary"
            block={false}
            onPress={() => router.push("/(auth)/login")}
          />
        </View>
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen padded={false}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load"
          body="We couldn't load your bookings. Pull down to refresh and try again."
        />
      </Screen>
    );
  }

  const isEmpty =
    status === "ready" &&
    data.quotes.length === 0 &&
    data.upcoming.length === 0 &&
    data.inPlan.length === 0 &&
    data.requests.length === 0 &&
    data.past.length === 0;

  const refresh = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold[400]} />
  );

  if (isEmpty) {
    return (
      <Screen padded={false}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={refresh}
          showsVerticalScrollIndicator={false}
        >
          <EmptyState
            icon="calendar"
            title="No bookings yet"
            body="Once you request a session it shows up here — with your deposit status, plan progress and dates all in one calm place."
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20 }}
        refreshControl={refresh}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6">
          <Text variant="caption" className="text-bone-500">
            Your sessions
          </Text>
          <Text variant="displayBold" className="mt-1 text-3xl">
            My bookings
          </Text>
        </View>

        {data.quotes.length > 0 ? (
          <Section
            title="Quotes for you"
            hint={data.quotes.length === 1 ? "1 to review" : `${data.quotes.length} to review`}
          >
            {data.quotes.map((quote) => (
              <QuoteCard key={quote.id} quote={quote} />
            ))}
          </Section>
        ) : null}

        {data.inPlan.length > 0 ? (
          <Section title="Payment plan pot" hint="Spread the cost — no interest">
            {data.inPlan.map((booking) => (
              <PlanPotCard key={booking.id} booking={booking} />
            ))}
          </Section>
        ) : null}

        {data.upcoming.length > 0 ? (
          <Section title="Upcoming" hint={`${data.upcoming.length} scheduled`}>
            {data.upcoming.map((booking) => (
              <AppointmentCard key={booking.id} booking={booking} />
            ))}
          </Section>
        ) : null}

        {data.requests.length > 0 ? (
          <Section title="Requests" hint={`${data.requests.length} awaiting`}>
            {data.requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </Section>
        ) : null}

        {data.past.length > 0 ? (
          <Section title="Past">
            {data.past.map((booking) => (
              <AppointmentCard key={booking.id} booking={booking} past />
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-8">
      <View className="mb-3 flex-row items-baseline justify-between gap-3">
        <Text variant="display" className="text-xl">
          {title}
        </Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      <View className="gap-3">{children}</View>
    </View>
  );
}
