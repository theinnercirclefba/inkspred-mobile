import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import type { LatLng } from "../../lib/geo";
import { useAuth } from "../../lib/auth";
import { InkDropCard } from "./InkDropCard";
import { claimDrop, listOpenDrops, type OpenDrop } from "./data";

type Status = "loading" | "ready" | "error";

/**
 * The customer's "Ink Drops near me" browser — revealed by the segmented
 * control at the top of Find. Loads open, future drops (nearest first when we
 * have a location), and claims one on tap: an optimistic spinner, a race-safe
 * server claim, then a calm hand-off to pay the deposit. Losing the race, or a
 * not-yet-deployed claim action, both resolve to gentle inline messaging.
 */
export function InkDropsList({ userLocation }: { userLocation: LatLng | null }) {
  const router = useRouter();
  const { session } = useAuth();
  const [drops, setDrops] = useState<OpenDrop[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listOpenDrops({ near: userLocation, limit: 60 });
      setDrops(rows);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [userLocation]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openArtist = useCallback(
    (handle: string) => router.push(`/(customer)/artist/${handle}`),
    [router],
  );

  const doClaim = useCallback(
    async (drop: OpenDrop) => {
      if (!session) {
        Alert.alert(
          "Sign in to claim",
          "Create a free account or sign in to claim an Ink Drop.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Sign in", onPress: () => router.push("/(auth)/login") },
          ],
        );
        return;
      }

      setClaimingId(drop.id);
      const result = await claimDrop(drop.id);
      setClaimingId(null);

      if (result.ok) {
        // Won the chair — remove it from the open list and hand off to pay.
        setDrops((prev) => prev.filter((d) => d.id !== drop.id));
        const deposit = result.depositPence
          ? `Your deposit of ${formatGBP(result.depositPence)} secures the slot.`
          : "Head to Bookings to pay your deposit and lock it in.";
        Alert.alert(
          "Chair claimed",
          `You've booked ${drop.artist.displayName}'s ${formatGBP(
            result.pricePence || drop.dropPricePence,
          )} Ink Drop. ${deposit}`,
          [
            { text: "Later", style: "cancel" },
            {
              text: "Pay deposit",
              onPress: () => router.push("/(customer)/(tabs)/bookings"),
            },
          ],
        );
        return;
      }

      switch (result.reason) {
        case "gone":
          setDrops((prev) => prev.filter((d) => d.id !== drop.id));
          Alert.alert(
            "Just gone",
            "Someone claimed this chair a moment ago. Here are the drops still open.",
          );
          break;
        case "not_authenticated":
          router.push("/(auth)/login");
          break;
        case "unavailable":
          Alert.alert(
            "Not quite ready",
            "Claiming Ink Drops isn't switched on yet. Try again shortly.",
          );
          break;
        default:
          Alert.alert(
            "Couldn't claim",
            "Something went wrong claiming that chair. Please try again.",
          );
      }
    },
    [session, router],
  );

  if (status === "loading") {
    return <ListSkeleton />;
  }

  if (status === "error") {
    return (
      <Notice
        icon="cloud-offline-outline"
        title="Couldn't load Ink Drops"
        body="Check your connection and pull to refresh."
      />
    );
  }

  if (drops.length === 0) {
    return (
      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={() => "x"}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold[400]}
          />
        }
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={
          <Notice
            icon="flash-outline"
            title="No Ink Drops just yet"
            body="When an artist opens a quiet day at a lower price, it lands here. Pull to refresh — new chairs appear through the week."
          />
        }
      />
    );
  }

  return (
    <FlatList
      data={drops}
      keyExtractor={(d) => d.id}
      renderItem={({ item }) => (
        <InkDropCard
          drop={item}
          claiming={claimingId === item.id}
          onClaim={() => doClaim(item)}
          onOpenArtist={() => openArtist(item.artist.handle)}
        />
      )}
      ItemSeparatorComponent={() => <View className="h-3" />}
      ListHeaderComponent={
        <View className="mb-4 flex-row items-center gap-2">
          <Icon name="flash" size={16} color={colors.gold[400]} />
          <Text variant="body" className="flex-1 text-[13px] text-bone-500">
            Last-minute openings near you — booked at a lower price.
          </Text>
        </View>
      }
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.gold[400]}
        />
      }
    />
  );
}

function ListSkeleton() {
  return (
    <View className="p-4">
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <View key={i} className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-[52px] w-[52px] rounded-xl bg-ink-800" />
              <View className="flex-1 gap-2">
                <View className="h-4 w-1/2 rounded bg-ink-800" />
                <View className="h-3 w-1/3 rounded bg-ink-800" />
              </View>
            </View>
            <View className="mt-4 flex-row items-end justify-between">
              <View className="h-7 w-24 rounded bg-ink-800" />
              <View className="h-11 w-28 rounded-xl bg-ink-800" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Notice({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  body: string;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
        <Icon name={icon} size={26} color={colors.gold[400]} />
      </View>
      <Text variant="display" className="mb-2 text-center text-xl">
        {title}
      </Text>
      <Text variant="body" className="max-w-[300px] text-center text-bone-500">
        {body}
      </Text>
    </View>
  );
}
