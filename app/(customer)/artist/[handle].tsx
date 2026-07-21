import { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { type ReactNode } from "react";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Button } from "../../../src/ui/Button";
import { Badge } from "../../../src/ui/Badge";
import { Stars } from "../../../src/ui/Stars";
import { Artwork, monogram } from "../../../src/ui/Artwork";
import { colors } from "../../../src/ui/tokens";
import { publicPortfolioUrl } from "../../../src/lib/images";
import { formatGBP, formatCompact, depositLabel } from "../../../src/lib/money";
import { styleLabel } from "../../../src/lib/geo";
import { openExternal } from "../../../src/lib/links";
import {
  getArtistByHandle,
  isFollowing as fetchIsFollowing,
  followArtist,
  unfollowArtist,
  type ArtistProfile,
  type ArtistPortfolioRow,
  type ArtistReviewRow,
} from "../../../src/lib/data/artists";
import {
  getExternalReviewConnection,
  type ExternalReviewConnection,
} from "../../../src/lib/data/reviews";
import { GoogleBadge } from "../../../src/features/reviews/GoogleBadge";
import { presentModerationMenu } from "../../../src/features/moderation/menu";
import { useAuth } from "../../../src/lib/auth";

type Status = "loading" | "ready" | "notfound" | "error";

export default function ArtistProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [status, setStatus] = useState<Status>("loading");
  const [artist, setArtist] = useState<ArtistProfile | null>(null);
  const [google, setGoogle] = useState<ExternalReviewConnection | null>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const openBooking = useCallback(() => {
    if (!artist) return;
    router.push(`/book/${artist.handle}`);
  }, [artist, router]);

  const load = useCallback(async () => {
    if (!handle) return;
    setStatus("loading");
    try {
      const profile = await getArtistByHandle(handle);
      if (!profile) {
        setStatus("notfound");
        return;
      }
      setArtist(profile);
      setStatus("ready");
      // Google/external badge — artist's own connection wins over the shop's.
      // Fully additive: a null (incl. table absent) simply renders no badge.
      void getExternalReviewConnection([profile.id, profile.studioId])
        .then(setGoogle)
        .catch(() => setGoogle(null));
      if (session) {
        const isF = await fetchIsFollowing(profile.id);
        setFollowing(isF);
      }
    } catch {
      setStatus("error");
    }
  }, [handle, session]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggleFollow = useCallback(async () => {
    if (!artist) return;
    if (!session) {
      router.push("/(auth)/login");
      return;
    }
    setFollowBusy(true);
    const next = !following;
    setFollowing(next); // optimistic
    try {
      if (next) await followArtist(artist.id);
      else await unfollowArtist(artist.id);
    } catch {
      setFollowing(!next); // revert
    } finally {
      setFollowBusy(false);
    }
  }, [artist, following, session, router]);

  if (status === "loading") {
    return <ProfileSkeleton onBack={() => router.back()} />;
  }

  if (status === "notfound" || status === "error") {
    return (
      <View className="flex-1 bg-ink-950">
        <TopBar onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon
              name={status === "notfound" ? "person-remove-outline" : "cloud-offline-outline"}
              size={26}
              color={colors.gold[400]}
            />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            {status === "notfound" ? "Artist not found" : "Something went wrong"}
          </Text>
          <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
            {status === "notfound"
              ? "This artist may have moved or isn't published yet."
              : "We couldn't load this profile. Please try again."}
          </Text>
          {status === "error" ? (
            <Button label="Try again" variant="secondary" block={false} onPress={load} />
          ) : (
            <Button label="Back to map" variant="secondary" block={false} onPress={() => router.back()} />
          )}
        </View>
      </View>
    );
  }

  if (!artist) return null;

  const avatarUrl = publicPortfolioUrl(artist.avatarPath);
  const followers = formatCompact(artist.followersCount);

  return (
    <View className="flex-1 bg-ink-950">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View className="relative">
          <View
            className="absolute inset-x-0 top-0 h-56"
            style={{ backgroundColor: colors.ink[900] }}
          />
          <View
            pointerEvents="none"
            className="absolute inset-x-0 top-0 h-56"
            style={{ backgroundColor: colors.oxblood[600], opacity: 0.18 }}
          />
          <SafeAreaView edges={["top"]}>
            <TopBar
              onBack={() => router.back()}
              floating
              onMore={
                session
                  ? () =>
                      presentModerationMenu({
                        subjectLabel: artist.displayName,
                        targetType: "artist",
                        targetId: artist.id,
                        blockUserId: artist.userId,
                        onBlocked: () => router.back(),
                      })
                  : undefined
              }
            />
            <View className="px-5 pt-4">
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  className="h-24 w-24 rounded-2xl border border-ink-600"
                  resizeMode="cover"
                />
              ) : (
                <Artwork
                  uri={null}
                  seed={artist.handle}
                  initials={monogram(artist.displayName)}
                  style={{ width: 96, height: 96 }}
                />
              )}

              <Text variant="displayBold" className="mt-4 text-3xl">
                {artist.displayName}
              </Text>

              <View className="mt-2 flex-row flex-wrap items-center gap-x-4 gap-y-1">
                {artist.ratingAvg !== null ? (
                  <View className="flex-row items-center gap-1.5">
                    <Stars rating={artist.ratingAvg} size={13} />
                    <Text variant="bodyMedium" className="text-[13px] text-bone-300">
                      {artist.ratingAvg.toFixed(1)}
                    </Text>
                    <Text variant="body" className="text-[13px] text-bone-500">
                      ({artist.reviewsCount})
                    </Text>
                  </View>
                ) : null}
                {artist.city ? (
                  <View className="flex-row items-center gap-1">
                    <Icon name="location-outline" size={14} color={colors.bone[500]} />
                    <Text variant="body" className="text-bone-300">
                      {artist.city}
                    </Text>
                  </View>
                ) : null}
                {followers ? (
                  <View className="flex-row items-center gap-1">
                    <Icon name="people-outline" size={14} color={colors.bone[500]} />
                    <Text variant="body" className="text-bone-300">
                      {followers} followers
                    </Text>
                  </View>
                ) : null}
                {artist.instagram ? (
                  <View className="flex-row items-center gap-1">
                    <Icon name="logo-instagram" size={14} color={colors.bone[500]} />
                    <Text variant="body" className="text-bone-300">
                      @{artist.instagram.replace(/^@/, "")}
                    </Text>
                  </View>
                ) : null}
              </View>

              {artist.styles.length > 0 ? (
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {artist.styles.map((s) => (
                    <Badge key={s} label={styleLabel(s)} tone="neutral" />
                  ))}
                </View>
              ) : null}

              {artist.financeEnabled ? (
                <View className="mt-3 flex-row items-center gap-1.5">
                  <Icon name="sparkles-outline" size={14} color={colors.gold[400]} />
                  <Text variant="bodyMedium" className="text-[13px] text-gold-300">
                    Spread the cost with InkSpred Plans
                  </Text>
                </View>
              ) : null}

              {google ? <GoogleBadge connection={google} className="mt-3" /> : null}

              {artist.bio ? (
                <Text variant="body" className="mt-4 text-bone-300">
                  {artist.bio}
                </Text>
              ) : null}

              <View className="mt-5 flex-row gap-3">
                <Button
                  label={following ? "Following" : "Follow"}
                  variant={following ? "secondary" : "primary"}
                  block={false}
                  loading={followBusy}
                  onPress={onToggleFollow}
                  className="flex-1"
                />
                <Button
                  label="Request booking"
                  variant="gold"
                  block={false}
                  onPress={openBooking}
                  className="flex-1"
                />
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Portfolio */}
        <Section title="Portfolio" count={artist.portfolio.length}>
          {artist.portfolio.length === 0 ? (
            <Text variant="body" className="text-bone-500">
              This artist hasn't published any work yet.
            </Text>
          ) : (
            <PortfolioGrid items={artist.portfolio} />
          )}
        </Section>

        {/* Services */}
        <Section title="Services" count={artist.services.length}>
          {artist.services.length === 0 ? (
            <Text variant="body" className="text-bone-500">
              No set services yet — request a booking to discuss your piece.
            </Text>
          ) : (
            <View className="gap-3">
              {artist.services.map((svc) => {
                const deposit = depositLabel(svc.deposit_type, svc.deposit_value);
                return (
                  <View
                    key={svc.id}
                    className="rounded-2xl border border-ink-700 bg-ink-900 p-4"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text variant="bodySemibold">{svc.name}</Text>
                        {svc.description ? (
                          <Text variant="body" className="mt-1 text-bone-500">
                            {svc.description}
                          </Text>
                        ) : null}
                        <View className="mt-2 flex-row items-center gap-3">
                          <View className="flex-row items-center gap-1">
                            <Icon name="time-outline" size={13} color={colors.bone[500]} />
                            <Text variant="caption">{formatDuration(svc.duration_min)}</Text>
                          </View>
                          {deposit ? (
                            <View className="flex-row items-center gap-1">
                              <Icon name="wallet-outline" size={13} color={colors.bone[500]} />
                              <Text variant="caption">{deposit}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View className="items-end">
                        <Text variant="caption" className="text-bone-500">
                          from
                        </Text>
                        <Text variant="bodySemibold" className="text-gold-300">
                          {formatGBP(svc.price_from_pence)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Section>

        {/* Reviews */}
        <Section title="Reviews" count={artist.reviewsCount}>
          {artist.reviews.length === 0 ? (
            <View className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
              <Text variant="body" className="text-bone-300">
                No reviews yet.
              </Text>
              <Text variant="body" className="mt-1 text-[13px] text-bone-500">
                Verified reviews appear here once clients have booked and sat
                through InkSpred.
              </Text>
            </View>
          ) : (
            <>
              {artist.ratingAvg !== null ? (
                <View className="mb-4 flex-row items-center gap-2">
                  <Stars rating={artist.ratingAvg} size={15} />
                  <Text variant="bodySemibold" className="text-bone-100">
                    {artist.ratingAvg.toFixed(1)}
                  </Text>
                  <Text variant="body" className="text-[13px] text-bone-500">
                    · {artist.reviewsCount} verified{" "}
                    {artist.reviewsCount === 1 ? "review" : "reviews"}
                  </Text>
                </View>
              ) : null}
              <View className="gap-3">
                {artist.reviews.map((review) => (
                  <ReviewRow key={review.id} review={review} />
                ))}
              </View>
              <Text variant="caption" className="mt-3">
                Verified reviews can only be left by clients who booked and sat
                through InkSpred.
              </Text>
            </>
          )}
        </Section>
      </ScrollView>

      {/* Sticky request-booking CTA */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-ink-700 bg-ink-900/95 px-5 pb-8 pt-3"
        pointerEvents="box-none"
      >
        <Button label="Request booking" variant="primary" onPress={openBooking} />
      </View>
    </View>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <View className="mt-8 px-5">
      <View className="mb-4 flex-row items-center gap-2">
        <Text variant="display" className="text-xl">
          {title}
        </Text>
        {typeof count === "number" && count > 0 ? (
          <Text variant="caption" className="text-bone-500">
            {count}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function PortfolioGrid({ items }: { items: ArtistPortfolioRow[] }) {
  const { width } = useWindowDimensions();
  const gap = 8;
  const cols = 3;
  const size = (width - 40 - gap * (cols - 1)) / cols; // 40 = px-5 * 2

  return (
    <View className="flex-row flex-wrap" style={{ gap }}>
      {items.map((item) => {
        const url = publicPortfolioUrl(item.image_path);
        return (
          <View key={item.id} style={{ width: size, height: size }}>
            <Artwork
              uri={url}
              seed={item.id}
              rounded="rounded-xl"
              style={{ width: size, height: size }}
            />
            {item.is_flash ? (
              <View className="absolute left-1.5 top-1.5">
                <Badge
                  label={item.flash_price_pence ? formatGBP(item.flash_price_pence) : "Flash"}
                  tone="gold"
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** A single published review — score, month/year and a Verified booking chip. */
function ReviewRow({ review }: { review: ArtistReviewRow }) {
  return (
    <View className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Stars rating={review.rating} size={14} allowHalf={false} />
        <Text variant="caption" className="text-bone-500">
          {reviewMonthYear(review.created_at)}
        </Text>
      </View>
      {review.body ? (
        <Text variant="body" className="mt-3 text-bone-300">
          &ldquo;{review.body}&rdquo;
        </Text>
      ) : null}
      <View className="mt-3 border-t border-ink-700 pt-3">
        <View className="flex-row items-center gap-1.5">
          <Icon name="checkmark-circle" size={14} color={colors.positive} />
          <Text variant="bodyMedium" className="text-[12px] text-positive">
            Verified booking
          </Text>
        </View>
      </View>
    </View>
  );
}

function TopBar({
  onBack,
  floating,
  onMore,
}: {
  onBack: () => void;
  floating?: boolean;
  onMore?: () => void;
}) {
  return (
    <View
      className={`flex-row items-center justify-between px-3 ${floating ? "pt-1" : "pt-2"}`}
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-full border border-ink-700 bg-ink-900/80"
      >
        <Icon name="chevron-back" size={20} color={colors.bone[100]} />
      </Pressable>
      {onMore ? (
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel="More options"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full border border-ink-700 bg-ink-900/80"
        >
          <Icon name="ellipsis-horizontal" size={20} color={colors.bone[100]} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ProfileSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-1 bg-ink-950">
      <SafeAreaView edges={["top"]}>
        <TopBar onBack={onBack} />
        <View className="px-5 pt-4">
          <View className="h-24 w-24 rounded-2xl bg-ink-800" />
          <View className="mt-4 h-8 w-2/3 rounded bg-ink-800" />
          <View className="mt-3 h-4 w-1/2 rounded bg-ink-800" />
          <View className="mt-4 flex-row gap-2">
            <View className="h-6 w-20 rounded-full bg-ink-800" />
            <View className="h-6 w-16 rounded-full bg-ink-800" />
          </View>
          <View className="mt-5 flex-row gap-3">
            <View className="h-11 flex-1 rounded-xl bg-ink-800" />
            <View className="h-11 flex-1 rounded-xl bg-ink-800" />
          </View>
          <View className="mt-8 h-6 w-32 rounded bg-ink-800" />
          <View className="mt-4 flex-row gap-2">
            {[0, 1, 2].map((i) => (
              <View key={i} className="h-24 flex-1 rounded-xl bg-ink-800" />
            ))}
          </View>
        </View>
        <View className="mt-6 flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color={colors.gold[400]} />
          <Text variant="caption">Loading profile…</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** "Jul 2026" from an ISO date; empty string on an unparseable value. */
function reviewMonthYear(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
