import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Button } from "../../../src/ui/Button";
import { Badge } from "../../../src/ui/Badge";
import { colors } from "../../../src/ui/tokens";
import { formatGBP } from "../../../src/lib/money";
import { useAuth } from "../../../src/lib/auth";
import {
  getMyStudio,
  type StudioRosterArtist,
} from "../../../src/features/studio/data";
import { removeStudioArtist } from "../../../src/features/studio/actions";
import { AddArtistSheet } from "../../../src/features/studio/AddArtistSheet";

type Status = "loading" | "ready" | "error";

const ROLE_TONE: Record<
  StudioRosterArtist["memberRole"],
  "gold" | "neutral" | "oxblood"
> = {
  owner: "gold",
  manager: "gold",
  resident: "neutral",
  guest: "oxblood",
};

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Artists() {
  const router = useRouter();
  const { session } = useAuth();
  const [roster, setRoster] = useState<StudioRosterArtist[]>([]);
  const [hasStudio, setHasStudio] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) {
      setRoster([]);
      setHasStudio(false);
      setStatus("ready");
      return;
    }
    try {
      const { studio } = await getMyStudio();
      setHasStudio(!!studio);
      setRoster(studio?.artists ?? []);
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

  const confirmRemove = useCallback(
    (artist: StudioRosterArtist) => {
      Alert.alert(
        `Remove ${artist.displayName}?`,
        "They'll come off your roster. Their own profile stays live — they keep it and can claim it later.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setRemovingId(artist.id);
              // Optimistic: drop the row immediately, restore on failure.
              const previous = roster;
              setRoster((prev) => prev.filter((a) => a.id !== artist.id));
              const result = await removeStudioArtist(artist.id);
              setRemovingId(null);
              if (!result.ok) {
                setRoster(previous);
                Alert.alert(
                  "Couldn't remove artist",
                  "Something went wrong. Please try again.",
                );
              } else {
                void load();
              }
            },
          },
        ],
      );
    },
    [roster, load],
  );

  /* Signed out — branded sign-in prompt. */
  if (!session) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon name="people" size={26} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            Sign in to manage your roster
          </Text>
          <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
            Add your artists and give each one a bookable profile under your
            studio's brand.
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
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold[400]} />
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        refreshControl={refresh}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 flex-row items-end justify-between">
          <View>
            <Text variant="body" className="text-bone-500">
              Your studio
            </Text>
            <Text variant="displayBold" className="mt-1 text-3xl">
              Artists
            </Text>
          </View>
          {hasStudio ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add artist"
              onPress={() => setSheetOpen(true)}
              className="h-11 flex-row items-center gap-1.5 rounded-xl border border-oxblood-500 bg-oxblood-500 px-3.5 active:opacity-85"
            >
              <Icon name="add" size={18} color={colors.bone[100]} />
              <Text variant="bodySemibold" className="text-[14px] text-bone-100">
                Add
              </Text>
            </Pressable>
          ) : null}
        </View>

        {status === "error" ? (
          <ErrorCard />
        ) : status === "loading" ? (
          <View className="items-center py-16">
            <Text variant="body" className="text-bone-500">
              Loading…
            </Text>
          </View>
        ) : !hasStudio ? (
          <NoStudioCard onGoToShop={() => router.push("/(studio)/(tabs)/shop")} />
        ) : roster.length === 0 ? (
          <EmptyRoster onAdd={() => setSheetOpen(true)} />
        ) : (
          <>
            <View className="gap-3">
              {roster.map((artist) => (
                <ArtistRow
                  key={artist.id}
                  artist={artist}
                  removing={removingId === artist.id}
                  onRemove={() => confirmRemove(artist)}
                />
              ))}
            </View>
            <View className="mt-5 flex-row items-start gap-2.5 rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-3">
              <Icon name="information-circle-outline" size={16} color={colors.gold[400]} />
              <Text variant="caption" className="flex-1 leading-[17px] text-bone-500">
                Each artist owns their profile — they can claim it later.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <AddArtistSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdded={load}
      />
    </SafeAreaView>
  );
}

function ArtistRow({
  artist,
  removing,
  onRemove,
}: {
  artist: StudioRosterArtist;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3.5 rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <View className="h-12 w-12 items-center justify-center rounded-2xl border border-ink-600 bg-ink-800">
        <Text variant="display" className="text-base text-bone-100">
          {monogram(artist.displayName)}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text variant="bodySemibold" numberOfLines={1} className="shrink">
            {artist.displayName}
          </Text>
          <Badge
            label={artist.memberRole}
            tone={ROLE_TONE[artist.memberRole]}
          />
        </View>
        <Text variant="caption" numberOfLines={1} className="mt-0.5">
          @{artist.handle}
          {artist.styles.length > 0 ? ` · ${artist.styles.slice(0, 3).join(", ")}` : ""}
        </Text>
        {artist.fromPricePence != null ? (
          <Text variant="caption" numberOfLines={1} className="mt-0.5 text-bone-500">
            From {formatGBP(artist.fromPricePence)}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${artist.displayName}`}
        hitSlop={8}
        disabled={removing}
        onPress={onRemove}
        className="h-9 w-9 items-center justify-center rounded-full border border-ink-700 bg-ink-800 active:opacity-80"
      >
        <Icon
          name={removing ? "hourglass-outline" : "close"}
          size={16}
          color={colors.bone[500]}
        />
      </Pressable>
    </View>
  );
}

function EmptyRoster({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-10">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
        <Icon name="people-outline" size={24} color={colors.gold[400]} />
      </View>
      <Text variant="display" className="mb-2 text-center text-xl">
        No artists yet
      </Text>
      <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
        Add your first artist and give them a bookable profile under your
        studio's brand.
      </Text>
      <Button label="Add an artist" variant="primary" block={false} onPress={onAdd} />
    </View>
  );
}

function NoStudioCard({ onGoToShop }: { onGoToShop: () => void }) {
  return (
    <View className="items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-10">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
        <Icon name="storefront-outline" size={24} color={colors.gold[400]} />
      </View>
      <Text variant="display" className="mb-2 text-center text-xl">
        Set up your studio first
      </Text>
      <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
        Create your studio on the Shop tab, then build your roster here.
      </Text>
      <Button label="Go to Shop" variant="primary" block={false} onPress={onGoToShop} />
    </View>
  );
}

function ErrorCard() {
  return (
    <View className="items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-10">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
        <Icon name="cloud-offline-outline" size={24} color={colors.bone[500]} />
      </View>
      <Text variant="display" className="mb-2 text-center text-xl">
        Couldn't load your roster
      </Text>
      <Text variant="body" className="max-w-[280px] text-center text-bone-500">
        Pull down to refresh and try again.
      </Text>
    </View>
  );
}
