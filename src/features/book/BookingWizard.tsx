import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Button } from "../../ui/Button";
import { colors } from "../../ui/tokens";
import { useAuth } from "../../lib/auth";
import type { ArtistProfile } from "../../lib/data/artists";
import {
  INITIAL_DRAFT,
  MIN_DESCRIPTION,
  SIZE_OPTIONS,
  type BookingDraft,
} from "./model";
import { createBookingRequest } from "./data";
import { StepProgress } from "./StepProgress";
import { StepPiece } from "./StepPiece";
import { StepDates } from "./StepDates";
import { StepPayment } from "./StepPayment";
import { StepReview } from "./StepReview";
import { SuccessScreen } from "./SuccessScreen";

const TOTAL_STEPS = 4;

/**
 * The native booking wizard. A single stack screen that hosts four internal
 * steps — piece → dates → payment preference → review — with a progress row, a
 * springy slide between steps and a sticky footer. Submits a booking_requests
 * row directly via the RLS-scoped anon client (see ./data), routing a signed-
 * out visitor to login first.
 */
export function BookingWizard({ artist }: { artist: ArtistProfile }) {
  const router = useRouter();
  const { session } = useAuth();

  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [draft, setDraft] = useState<BookingDraft>(INITIAL_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // Slide/fade transition, re-triggered whenever the step changes.
  const anim = useRef(new Animated.Value(1)).current;
  const [direction, setDirection] = useState(1);
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [step, anim]);

  const update = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const service = useMemo(
    () => artist.services.find((s) => s.id === draft.serviceId) ?? null,
    [artist.services, draft.serviceId],
  );

  const budgetPence = useMemo<number | null>(() => {
    const typed = parseInt(draft.budgetPounds, 10);
    if (Number.isFinite(typed) && typed > 0) return typed * 100;
    if (service) return service.price_from_pence;
    return null;
  }, [draft.budgetPounds, service]);

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return (
          draft.placement !== null &&
          draft.size !== null &&
          draft.description.trim().length >= MIN_DESCRIPTION
        );
      case 1:
        return draft.flexible || draft.dates.length > 0;
      // Payment preference is optional; review is always valid.
      default:
        return true;
    }
  }, [step, draft]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(TOTAL_STEPS - 1, next));
      setDirection(clamped >= step ? 1 : -1);
      setStep(clamped);
      setMaxVisited((prev) => Math.max(prev, clamped));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    [step],
  );

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setError(null);

    if (!session) {
      // Native login doesn't yet consume a return path, so send them to login;
      // they'll re-open the artist and book once signed in. (Return-to-flow is
      // an API-phase follow-up.)
      router.push("/(auth)/login");
      return;
    }

    const sizeOption = SIZE_OPTIONS.find((s) => s.key === draft.size) ?? null;
    const sizeDesc = sizeOption
      ? `${sizeOption.label} · ${sizeOption.detail}`
      : null;

    setSubmitting(true);
    const result = await createBookingRequest({
      artistId: artist.id,
      serviceId: draft.serviceId,
      placement: draft.placement,
      sizeDesc,
      description: draft.description.trim(),
      preferredDates: draft.dates,
      budgetPence,
    });

    if (result.ok) {
      setSubmitted(true);
      return;
    }

    setSubmitting(false);
    if (result.error === "not_authenticated") {
      router.push("/(auth)/login");
      return;
    }
    setError(
      "We couldn't send your request just now. Nothing was submitted — please try again in a moment.",
    );
  }, [submitting, session, draft, artist.id, budgetPence, router]);

  if (submitted) {
    return (
      <View className="flex-1 bg-ink-950">
        <SafeAreaView edges={["top", "bottom"]} className="flex-1">
          <SuccessScreen
            artistName={artist.displayName}
            onDone={() => router.replace("/(customer)/(tabs)/bookings")}
          />
        </SafeAreaView>
      </View>
    );
  }

  const isReview = step === TOTAL_STEPS - 1;
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [direction > 0 ? 28 : -28, 0],
  });

  return (
    <View className="flex-1 bg-ink-950">
      <SafeAreaView edges={["top"]}>
        <TopBar
          onBack={() => (step === 0 ? router.back() : goTo(step - 1))}
          artistName={artist.displayName}
        />
        <View className="px-5 pt-2">
          <StepProgress current={step} maxVisited={maxVisited} onSelect={goTo} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        >
          <Animated.View style={{ opacity: anim, transform: [{ translateX }] }}>
            {step === 0 && (
              <StepPiece
                services={artist.services}
                artistName={artist.displayName}
                draft={draft}
                update={update}
              />
            )}
            {step === 1 && <StepDates draft={draft} update={update} />}
            {step === 2 && (
              <StepPayment
                financeEnabled={artist.financeEnabled}
                draft={draft}
                update={update}
              />
            )}
            {step === 3 && (
              <StepReview
                artistName={artist.displayName}
                service={service}
                draft={draft}
                budgetPence={budgetPence}
                onEdit={goTo}
              />
            )}
          </Animated.View>

          {error ? (
            <View className="mt-5 flex-row items-start gap-2 rounded-xl border border-oxblood-500/40 bg-oxblood-600/15 px-3 py-2.5">
              <Icon name="alert-circle-outline" size={16} color={colors.oxblood[400]} />
              <Text variant="body" className="flex-1 text-[13px] text-bone-300">
                {error}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky footer */}
      <View className="border-t border-ink-700 bg-ink-900/95 px-5 pb-8 pt-3">
        {isReview ? (
          <Button
            label={session ? `Send request to ${artist.displayName}` : "Sign in to send"}
            variant="gold"
            loading={submitting}
            onPress={handleSubmit}
          />
        ) : (
          <Button
            label="Continue"
            variant="primary"
            disabled={!stepValid}
            onPress={() => goTo(step + 1)}
          />
        )}
      </View>
    </View>
  );
}

function TopBar({
  onBack,
  artistName,
}: {
  onBack: () => void;
  artistName: string;
}) {
  return (
    <View className="flex-row items-center gap-3 px-3 pt-2">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-full border border-ink-700 bg-ink-900/80"
      >
        <Icon name="chevron-back" size={20} color={colors.bone[100]} />
      </Pressable>
      <View className="flex-1">
        <Text variant="caption" className="uppercase tracking-[1.5px] text-bone-500">
          Request booking
        </Text>
        <Text variant="bodySemibold" numberOfLines={1}>
          {artistName}
        </Text>
      </View>
    </View>
  );
}
