import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Share, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen } from "../../../src/ui/Screen";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { EmptyState } from "../../../src/ui/EmptyState";
import { colors } from "../../../src/ui/tokens";
import { publicArtistUrl } from "../../../src/lib/links";
import {
  listArtistClients,
  type ClientsView,
  type ClientRow,
} from "../../../src/features/clients/data";

type Status = "loading" | "ready" | "noartist" | "error";

/**
 * The artist's client book — every customer with a real booking, upcoming
 * sessions first, tap-through to the existing message thread. The invite action
 * shares the artist's public booking link with a prewritten message, so moving
 * an existing client base onto InkSpred is one tap.
 */
export default function Clients() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [view, setView] = useState<ClientsView | null>(null);

  const load = useCallback(async () => {
    try {
      const v = await listArtistClients();
      if (!v) {
        setStatus("noartist");
        return;
      }
      setView(v);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onInvite = useCallback(() => {
    if (!view?.handle) return;
    const url = publicArtistUrl(view.handle);
    void Share.share({
      message: `I'm now taking bookings on InkSpred — pick your piece and grab your spot here: ${url}`,
    });
  }, [view?.handle]);

  if (status === "loading") {
    return (
      <Screen padded={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.gold[400]} />
          <Text variant="caption" className="mt-2">
            Loading clients…
          </Text>
        </View>
      </Screen>
    );
  }

  if (status === "noartist" || status === "error") {
    return (
      <Screen padded={false}>
        <EmptyState
          icon="people"
          title={status === "noartist" ? "Set up your profile first" : "Something went wrong"}
          body={
            status === "noartist"
              ? "Create your artist profile from the Today tab and your client book will build itself from your bookings."
              : "We couldn't load your clients. Pull down or reopen the tab to try again."
          }
        />
      </Screen>
    );
  }

  const clients = view?.clients ?? [];

  return (
    <Screen scroll>
      <View className="mb-5">
        <Text variant="body" className="text-bone-500">
          Your client book
        </Text>
        <Text variant="displayBold" className="mt-1 text-3xl">
          Clients
        </Text>
        <Text variant="body" className="mt-1 text-bone-500">
          {clients.length === 0
            ? "Everyone who books you lands here automatically."
            : `${clients.length} ${clients.length === 1 ? "client" : "clients"} — upcoming sessions first.`}
        </Text>
      </View>

      {view?.handle ? (
        <Pressable
          accessibilityRole="button"
          onPress={onInvite}
          className="mb-6 flex-row items-center gap-3 rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4 active:opacity-80"
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl border border-gold-400/40 bg-gold-400/10">
            <Icon name="paper-plane-outline" size={18} color={colors.gold[300]} />
          </View>
          <View className="flex-1">
            <Text variant="bodySemibold" className="text-gold-300">
              Invite your clients
            </Text>
            <Text variant="body" className="mt-0.5 text-[13px] text-bone-300">
              Share your booking link by message, WhatsApp or Instagram.
            </Text>
          </View>
          <Icon name="chevron-forward" size={16} color={colors.bone[500]} />
        </Pressable>
      ) : null}

      {clients.length === 0 ? (
        <View className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <Text variant="bodySemibold">No clients yet</Text>
          <Text variant="body" className="mt-1 text-[13px] text-bone-500">
            When someone books you, they appear here with their session history.
            Invite your existing clients above to bring them across.
          </Text>
        </View>
      ) : (
        <View className="rounded-2xl border border-ink-700 bg-ink-900">
          {clients.map((c, i) => (
            <ClientRowView
              key={c.customerId}
              client={c}
              first={i === 0}
              last={i === clients.length - 1}
              onPress={
                c.threadId
                  ? () => router.push(`/(artist)/thread/${c.threadId}`)
                  : undefined
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Tue 4 Aug" from an ISO timestamp. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function ClientRowView({
  client,
  first,
  last,
  onPress,
}: {
  client: ClientRow;
  first: boolean;
  last: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3.5 ${
        first ? "" : "border-t border-ink-700"
      } ${first ? "rounded-t-2xl" : ""} ${last ? "rounded-b-2xl" : ""} ${
        onPress ? "active:bg-ink-800" : ""
      }`}
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl border border-ink-600 bg-ink-800">
        <Text variant="bodySemibold" className="text-bone-300">
          {initials(client.name)}
        </Text>
      </View>

      <View className="min-w-0 flex-1">
        <Text variant="bodySemibold" numberOfLines={1}>
          {client.name}
        </Text>
        <Text variant="caption" numberOfLines={1} className="mt-0.5">
          {client.sessions} {client.sessions === 1 ? "session" : "sessions"}
          {client.nextIso
            ? `  ·  Next ${shortDate(client.nextIso)}`
            : client.lastIso
              ? `  ·  Last ${shortDate(client.lastIso)}`
              : ""}
        </Text>
      </View>

      {client.nextIso ? (
        <View className="rounded-full border border-gold-400/50 bg-gold-400/10 px-2.5 py-1">
          <Text variant="caption" className="text-[11px] text-gold-300">
            Booked
          </Text>
        </View>
      ) : null}

      {onPress ? (
        <Icon name="chatbubble-ellipses-outline" size={16} color={colors.bone[500]} />
      ) : null}
    </Pressable>
  );
}
