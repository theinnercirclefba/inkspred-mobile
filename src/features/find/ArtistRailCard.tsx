import { Pressable, View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Artwork, monogram } from "../../ui/Artwork";
import { colors } from "../../ui/tokens";
import { publicPortfolioUrl } from "../../lib/images";
import { formatGBP, formatCompact } from "../../lib/money";
import { styleLabel } from "../../lib/geo";
import type { DirectoryArtist } from "../../lib/data/artists";

/** Width of a rail card — the parent uses this to snap and to scroll-to. */
export const RAIL_CARD_WIDTH = 300;

/**
 * A horizontal card in the map's bottom rail. Shows avatar/gradient, name,
 * city, styles, from-price and followers. Selected cards gain a gold hairline
 * so they read as the active pin's partner.
 */
export function ArtistRailCard({
  artist,
  selected,
  onPress,
  onOpen,
}: {
  artist: DirectoryArtist;
  selected: boolean;
  onPress: () => void;
  onOpen: () => void;
}) {
  const avatarUrl = publicPortfolioUrl(artist.avatarPath ?? artist.coverImagePath);
  const followers = formatCompact(artist.followersCount);
  const styles = artist.styles.slice(0, 2).map(styleLabel).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ width: RAIL_CARD_WIDTH }}
      className={`mr-3 rounded-2xl border bg-ink-900 p-3 ${
        selected ? "border-gold-400/70" : "border-ink-700"
      }`}
    >
      <View className="flex-row gap-3">
        <Artwork
          uri={avatarUrl}
          seed={artist.handle}
          initials={monogram(artist.displayName)}
          rounded="rounded-xl"
          style={{ width: 68, height: 68 }}
        />
        <View className="flex-1">
          <Text variant="bodySemibold" numberOfLines={1}>
            {artist.displayName}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            <Icon name="location-outline" size={12} color={colors.bone[500]} />
            <Text variant="caption" numberOfLines={1} className="flex-1">
              {artist.city ?? "United Kingdom"}
            </Text>
          </View>
          {styles ? (
            <Text variant="caption" numberOfLines={1} className="mt-1 text-bone-300">
              {styles}
            </Text>
          ) : null}
          <View className="mt-1.5 flex-row items-center gap-3">
            {artist.fromPricePence !== null ? (
              <Text variant="bodySemibold" className="text-[13px] text-gold-300">
                From {formatGBP(artist.fromPricePence)}
              </Text>
            ) : null}
            {followers ? (
              <View className="flex-row items-center gap-1">
                <Icon name="people-outline" size={12} color={colors.bone[500]} />
                <Text variant="caption">{followers}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        className="mt-3 h-9 flex-row items-center justify-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 active:opacity-80"
      >
        <Text variant="bodySemibold" className="text-[13px] text-bone-100">
          View profile
        </Text>
        <Icon name="arrow-forward" size={13} color={colors.bone[100]} />
      </Pressable>
    </Pressable>
  );
}
