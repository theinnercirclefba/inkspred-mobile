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
  type CustomerBooking,
  type CustomerBookings,
} from "../../../src/features/bookings/data";
import {
  getReviewedAppointmentIds,
  submitReview,
} from "../../../src/lib/data/reviews";
import { PlanPotCard } from "../../../src/features/bookings/PlanPotCard";
import { AppointmentCard } from "../../../src/features/bookings/AppointmentCard";
import { ReviewSheet } from "../../../src/features/bookings/ReviewSheet";
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

  // Which past appointments already carry a review. Kept as a superset of what
  // the server reports so an optimistic "just reviewed" survives a refresh.
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [reviewTarget, setReviewTarget] = useState<CustomerBooking | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) {
      setData(EMPTY);
      setStatus("ready");
      return;
    }
    try {
      const result = await getCustomerBookings();
      // null = signed out mid-flight; treat as empty rather than error.
      const bookings = result ?? EMPTY;
      setData(bookings);
      setStatus("ready");
      // Fetch which completed sessions already have a review, folding the result
      // into any optimistic ids we already hold.
      const pastIds = bookings.past.map((b) => b.id);
      if (pastIds.length > 0) {
        const serverReviewed = await getReviewedAppointmentIds(pastIds);
        setReviewed((prev) => new Set([...prev, ...serverReviewed]));
      }
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

  const openReview = useCallback((booking: CustomerBooking) => {
    setReviewError(null);
    setReviewTarget(booking);
  }, []);

  const closeReview = useCallback(() => {
    if (submitting) return;
    setReviewTarget(null);
    setReviewError(null);
  }, [submitting]);

  const handleSubmitReview = useCallback(
    async (rating: number, body: string) => {
      if (!reviewTarget) return;
      setSubmitting(true);
      setReviewError(null);
      const result = await submitReview({
        appointmentId: reviewTarget.id,
        artistId: reviewTarget.artistId,
        rating,
        body,
      });
      setSubmitting(false);

      // A pre-existing review (23505 → "already") is as good as a fresh one.
      if (result.ok || result.error === "already") {
        setReviewed((prev) => new Set(prev).add(reviewTarget.id)); // optimistic
        setReviewTarget(null);
        return;
      }
      setReviewError(
        result.error === "signed_out"
          ? "Please sign in again to leave your review."
          : "We couldn't post your review just now. Please try again.",
      );
    },
    [reviewTarget],
  );

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
              <AppointmentCard
                key={booking.id}
                booking={booking}
                past
                reviewed={reviewed.has(booking.id)}
                onLeaveReview={() => openReview(booking)}
              />
            ))}
          </Section>
        ) : null}
      </ScrollView>

      <ReviewSheet
        visible={reviewTarget !== null}
        artistName={reviewTarget?.artistName ?? ""}
        piece={reviewTarget?.piece ?? ""}
        saving={submitting}
        error={reviewError}
        onClose={closeReview}
        onSubmit={handleSubmitReview}
      />
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
