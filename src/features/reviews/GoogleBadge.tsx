import { Pressable, View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import { openExternal } from "../../lib/links";
import type { ExternalReviewConnection } from "../../lib/data/reviews";

/**
 * Public, ToS-compliant Google rating pill — the native mirror of the web's
 * GoogleRatingBadge. Renders "G ★ {rating} · {count} reviews on Google" and,
 * when a Google URL is present, taps out to the place in the device browser.
 *
 * InkSpred only ever holds the AGGREGATE (rating + count); individual review
 * bodies are never stored (see 0019_external_reviews.sql). Renders nothing when
 * there is no usable rating, so it's safe to drop onto any surface behind a
 * simple `connection ? … : null`.
 */
export function GoogleBadge({
  connection,
  className,
}: {
  connection: ExternalReviewConnection;
  className?: string;
}) {
  if (connection.rating == null) return null;

  const rating = connection.rating;
  const count = connection.reviewCount ?? 0;
  const url = connection.url;

  const inner = (
    <View className="flex-row items-center gap-2 self-start rounded-full border border-ink-600 bg-ink-900 px-3.5 py-2">
      <Icon name="logo-google" size={14} color={colors.bone[100]} />
      <Icon name="star" size={13} color={colors.gold[400]} />
      <Text variant="bodyMedium" className="text-[13px] text-bone-100">
        {rating.toFixed(1)}
      </Text>
      <Text variant="body" className="text-[13px] text-bone-500">
        · {count.toLocaleString("en-GB")} {count === 1 ? "review" : "reviews"} on Google
      </Text>
      {url ? <Icon name="open-outline" size={13} color={colors.bone[500]} /> : null}
    </View>
  );

  if (!url) {
    return <View className={className}>{inner}</View>;
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${rating.toFixed(1)} on Google, ${count} reviews — opens Google`}
      onPress={() => openExternal(url)}
      className={`self-start active:opacity-80 ${className ?? ""}`}
    >
      {inner}
    </Pressable>
  );
}
