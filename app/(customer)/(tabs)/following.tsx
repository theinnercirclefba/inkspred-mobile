import { useCallback, useState } from "react";
import { View, FlatList, Pressable, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "../../../src/ui/Screen";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Button } from "../../../src/ui/Button";
import { EmptyState } from "../../../src/ui/EmptyState";
import { Artwork, monogram } from "../../../src/ui/Artwork";
import { colors } from "../../../src/ui/tokens";
import { publicPortfolioUrl } from "../../../src/lib/images";
import { formatGBP, formatCompact } from "../../../src/lib/money";
import { styleLabel } from "../../../src/lib/geo";
import {
  listFollowedArtists,
  unfollowArtist,
  type DirectoryArtist,
} from "../../../src/lib/data/artists";
import { useAuth } from "../../../src/lib/auth";

type Status = "loading" | "ready" | "error";

export default function Following() {
  const router = useRouter();
  const { session } = useAuth();
  const [artists, setArtists] = useState<DirectoryArtist[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setArtists([]);
      setStatus("ready");
      return;
    }
    try {
      const rows = await listFollowedArtists();
      setArtists(rows);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [session]);

  // Refresh on focus so a follow made on a profile shows up here.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Optimistically drop the artist; on failure re-insert at the same index.
  const onUnfollow = useCallback(async (artist: DirectoryArtist) => {
    let index = -1;
    setArtists((prev) => {
      index = prev.findIndex((a) => a.id === artist.id);
      if (index === -1) return prev;
      return prev.filter((a) => a.id !== artist.id);
    });
    if (index === -1) return;
    try {
      await unfollowArtist(artist.id);
    } catch {
      setArtists((prev) => {
        if (prev.some((a) => a.id === artist.id)) return prev; // already back
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, artist);
        return next;
      });
    }
  }, []);

  if (!session) {
    return (
      <Screen padded={false}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon name="heart-outline" size={26} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            Sign in to follow artists
          </Text>
          <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
            Follow the artists you love and their fresh work surfaces here first.
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
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load"
            body="We couldn't load who you follow. Pull to refresh to try again."
          />
        </View>
      </Screen>
    );
  }

  if (status === "ready" && artists.length === 0) {
    return (
      <Screen padded={false}>
        <EmptyState
          icon="heart"
          title="Nothing followed yet"
          body="Follow artists you love and their fresh flash, guest spots and open days will surface here first."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={artists}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={
          <View className="mb-5">
            <Text variant="displayBold" className="text-3xl">
              Following
            </Text>
            <Text variant="body" className="mt-1 text-bone-500">
              {artists.length} {artists.length === 1 ? "artist" : "artists"} you follow.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold[400]} />
        }
        renderItem={({ item }) => (
          <FollowRow
            artist={item}
            onPress={() => router.push(`/(customer)/artist/${item.handle}`)}
            onUnfollow={() => onUnfollow(item)}
          />
        )}
      />
    </Screen>
  );
}

function FollowRow({
  artist,
  onPress,
  onUnfollow,
}: {
  artist: DirectoryArtist;
  onPress: () => void;
  onUnfollow: () => void;
}) {
  const avatarUrl = publicPortfolioUrl(artist.avatarPath ?? artist.coverImagePath);
  const followers = formatCompact(artist.followersCount);
  const styles = artist.styles.slice(0, 3).map(styleLabel).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-3 active:opacity-80"
    >
      <Artwork
        uri={avatarUrl}
        seed={artist.handle}
        initials={monogram(artist.displayName)}
        rounded="rounded-xl"
        style={{ width: 60, height: 60 }}
      />
      <View className="flex-1">
        <Text variant="bodySemibold" numberOfLines={1}>
          {artist.displayName}
        </Text>
        <Text variant="caption" numberOfLines={1} className="mt-0.5">
          {artist.city ?? "United Kingdom"}
        </Text>
        {styles ? (
          <Text variant="caption" numberOfLines={1} className="mt-1 text-bone-300">
            {styles}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1">
        {artist.fromPricePence !== null ? (
          <Text variant="bodySemibold" className="text-[13px] text-gold-300">
            {formatGBP(artist.fromPricePence)}
          </Text>
        ) : null}
        {followers ? <Text variant="caption">{followers}</Text> : null}
      </View>
      <Pressable
        onPress={onUnfollow}
        accessibilityRole="button"
        accessibilityLabel={`Unfollow ${artist.displayName}`}
        hitSlop={10}
        className="h-10 w-10 items-center justify-center rounded-full border border-ink-700 bg-ink-800 active:opacity-70"
      >
        <Icon name="heart" size={18} color={colors.oxblood[400]} />
      </Pressable>
    </Pressable>
  );
}
