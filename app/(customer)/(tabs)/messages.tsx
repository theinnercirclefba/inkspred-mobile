import { useCallback, useRef, useState } from "react";
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
import { useAuth } from "../../../src/lib/auth";
import { listThreads } from "../../../src/features/messages/data";
import type { ThreadSummary } from "../../../src/features/messages/types";

type Status = "loading" | "ready" | "error";

const POLL_MS = 10_000;

export default function Messages() {
  const router = useRouter();
  const { session } = useAuth();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setThreads([]);
      setStatus("ready");
      return;
    }
    try {
      const rows = await listThreads();
      setThreads(rows);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [session]);

  // Refresh on focus, then poll every 10s while the tab is focused (no realtime
  // this phase). The interval is cleared on blur via the cleanup return.
  useFocusEffect(
    useCallback(() => {
      void load();
      if (!session) return;
      const id = setInterval(() => void load(), POLL_MS);
      return () => clearInterval(id);
    }, [load, session]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!session) {
    return (
      <Screen padded={false}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon name="chatbubble-ellipses-outline" size={26} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            Sign in to message artists
          </Text>
          <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
            Talk through your idea, share references and confirm details with your artist — all in one thread.
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
            title="Couldn't load messages"
            body="We couldn't load your conversations. Pull to refresh to try again."
          />
        </View>
      </Screen>
    );
  }

  if (status === "ready" && threads.length === 0) {
    return (
      <Screen padded={false}>
        <EmptyState
          icon="chatbubble-ellipses"
          title="No messages yet"
          body="Talk through your idea, share references and confirm details with your artist — all in one thread."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={
          <View className="mb-5">
            <Text variant="displayBold" className="text-3xl">
              Messages
            </Text>
            <Text variant="body" className="mt-1 text-bone-500">
              Your conversations with artists.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold[400]} />
        }
        renderItem={({ item }) => (
          <ThreadRow
            thread={item}
            onPress={() => router.push(`/(customer)/thread/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}

function ThreadRow({ thread, onPress }: { thread: ThreadSummary; onPress: () => void }) {
  const { other, preview, timeLabel, unreadCount } = thread;
  const avatarUrl = publicPortfolioUrl(other.avatarPath ?? null);
  const unread = unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-3 active:opacity-80"
    >
      <Artwork
        uri={avatarUrl}
        seed={other.handle ?? other.name}
        initials={monogram(other.name)}
        rounded="rounded-xl"
        style={{ width: 56, height: 56 }}
      />
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            variant={unread ? "bodySemibold" : "bodyMedium"}
            numberOfLines={1}
            className="flex-1"
          >
            {other.name}
          </Text>
          <Text variant="caption" className={unread ? "text-gold-300" : "text-bone-500"}>
            {timeLabel}
          </Text>
        </View>
        <View className="mt-0.5 flex-row items-center gap-2">
          <Text
            variant="body"
            numberOfLines={1}
            className={`flex-1 text-[13px] ${unread ? "text-bone-200" : "text-bone-500"}`}
          >
            {preview}
          </Text>
          {unread ? (
            <View className="min-w-[18px] items-center justify-center rounded-full bg-oxblood-500 px-1.5 py-0.5">
              <Text variant="caption" className="text-[10px] text-bone-100">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
