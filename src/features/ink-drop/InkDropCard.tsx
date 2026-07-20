import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Artwork, monogram } from "../../ui/Artwork";
import { colors } from "../../ui/tokens";
import { publicPortfolioUrl } from "../../lib/images";
import { formatGBP } from "../../lib/money";
import type { OpenDrop } from "./data";
import {
  distanceLabel,
  relativeDropDate,
  savingsPercent,
  slotLabel,
} from "./format";

/**
 * A customer-facing Ink Drop card — the "fill-the-empty-chair" offer. Leads
 * with the artist and the day, states the slot, and frames the price as a warm
 * "was £X · now £Y" with a gold discount tag. The whole card claims on press.
 */
export function InkDropCard({
  drop,
  claiming,
  onClaim,
  onOpenArtist,
}: {
  drop: OpenDrop;
  claiming: boolean;
  onClaim: () => void;
  onOpenArtist: () => void;
}) {
  const avatarUrl = publicPortfolioUrl(drop.artist.avatarPath);
  const pct = savingsPercent(drop.normalPricePence, drop.dropPricePence);
  const dist = distanceLabel(drop.distanceMiles);
  const place = [drop.artist.city ?? "United Kingdom", dist]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      {/* Header: artist + date */}
      <View className="flex-row items-center gap-3">
        <Pressable onPress={onOpenArtist} accessibilityRole="button" hitSlop={4}>
          <Artwork
            uri={avatarUrl}
            seed={drop.artist.handle}
            initials={monogram(drop.artist.displayName)}
            rounded="rounded-xl"
            style={{ width: 52, height: 52 }}
          />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text variant="bodySemibold" numberOfLines={1}>
            {drop.artist.displayName}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            <Icon name="location-outline" size={12} color={colors.bone[500]} />
            <Text variant="caption" numberOfLines={1} className="flex-1">
              {place}
            </Text>
          </View>
        </View>
        {pct !== null ? (
          <View className="rounded-full border border-gold-400/60 bg-gold-400/15 px-2.5 py-1">
            <Text variant="label" className="text-[10px] tracking-[1px] text-gold-300">
              -{pct}%
            </Text>
          </View>
        ) : null}
      </View>

      {/* Slot + date row */}
      <View className="mt-3 flex-row items-center gap-2">
        <View className="flex-row items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5">
          <Icon name="calendar-outline" size={13} color={colors.gold[300]} />
          <Text variant="bodyMedium" className="text-[13px] text-bone-100">
            {relativeDropDate(drop.dropDate)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5">
          <Icon name="time-outline" size={13} color={colors.bone[500]} />
          <Text variant="bodyMedium" numberOfLines={1} className="text-[13px] text-bone-300">
            {slotLabel(drop.slotType, drop.hoursNote)}
          </Text>
        </View>
      </View>

      {drop.note ? (
        <Text variant="body" numberOfLines={2} className="mt-3 text-[13px] text-bone-300">
          {drop.note}
        </Text>
      ) : null}

      {/* Price + claim */}
      <View className="mt-4 flex-row items-end justify-between">
        <View>
          {drop.normalPricePence ? (
            <Text
              variant="caption"
              className="text-bone-500 line-through"
            >
              was {formatGBP(drop.normalPricePence)}
            </Text>
          ) : (
            <Text variant="caption" className="text-bone-500">
              Ink Drop price
            </Text>
          )}
          <Text variant="displayBold" className="text-2xl text-gold-300">
            {formatGBP(drop.dropPricePence)}
          </Text>
        </View>
        <Pressable
          onPress={onClaim}
          disabled={claiming}
          accessibilityRole="button"
          className={`h-11 min-w-[112px] flex-row items-center justify-center gap-1.5 rounded-xl border border-gold-400 bg-gold-400 px-4 ${
            claiming ? "opacity-70" : "active:opacity-85"
          }`}
        >
          {claiming ? (
            <ActivityIndicator size="small" color={colors.ink[950]} />
          ) : (
            <>
              <Icon name="flash" size={15} color={colors.ink[950]} />
              <Text variant="bodySemibold" className="text-[14px] text-ink-950">
                Claim
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
