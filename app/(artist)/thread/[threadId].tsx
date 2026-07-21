import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Artwork, monogram } from "../../../src/ui/Artwork";
import { colors } from "../../../src/ui/tokens";
import { useAuth } from "../../../src/lib/auth";
import { MessageBubble } from "../../../src/features/artist-messages/MessageBubble";
import { QuoteComposer } from "../../../src/features/artist-messages/QuoteComposer";
import { presentModerationMenu } from "../../../src/features/moderation/menu";
import {
  getArtistThread,
  sendMessage,
  markThreadRead,
} from "../../../src/features/artist-messages/data";
import { timeLabel, dayLabel } from "../../../src/features/messages/data";
import type {
  OtherParty,
  QuoteView,
  ThreadMessage,
} from "../../../src/features/artist-messages/types";

type Status = "loading" | "ready" | "notfound" | "error";

const POLL_MS = 10_000;

/** A rendered row: a day divider or a message. */
type Row =
  | { kind: "divider"; id: string; label: string }
  | { kind: "message"; id: string; message: ThreadMessage };

/**
 * Build the inverted-list rows from chronological messages: a day-divider row
 * precedes the first message of each day. The array is reversed so index 0
 * (the newest message) sits at the bottom of the inverted FlatList.
 */
function buildRows(messages: ThreadMessage[]): Row[] {
  const rows: Row[] = [];
  let lastDay: string | null = null;
  for (const m of messages) {
    if (m.dayLabel !== lastDay) {
      rows.push({
        kind: "divider",
        id: `divider-${m.dayLabel}-${m.id}`,
        label: m.dayLabel,
      });
      lastDay = m.dayLabel;
    }
    rows.push({ kind: "message", id: m.id, message: m });
  }
  return rows.reverse();
}

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [status, setStatus] = useState<Status>("loading");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [quotesById, setQuotesById] = useState<Record<string, QuoteView>>({});
  const [other, setOther] = useState<OtherParty | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);

  // Temp ids of optimistic messages currently in flight — preserved across
  // polls so a refetch doesn't drop a message that hasn't been persisted yet.
  const pendingRef = useRef<Set<string>>(new Set());

  const load = useCallback(
    async (initial: boolean) => {
      if (!threadId) return;
      if (!session) {
        setStatus("notfound");
        return;
      }
      try {
        const view = await getArtistThread(threadId);
        if (!view) {
          if (initial) setStatus("notfound");
          return;
        }
        setOther(view.other);
        setArtistId(view.artistId);
        setCustomerId(view.customerId);
        setQuotesById((prev) => ({ ...prev, ...view.quotesById }));
        setMessages((current) => {
          const pending = current.filter((m) => pendingRef.current.has(m.id));
          return [...view.messages, ...pending];
        });
        setStatus("ready");
        void markThreadRead(threadId);
      } catch {
        if (initial) setStatus("error");
      }
    },
    [threadId, session],
  );

  // Load on focus, then poll every 10s while focused (no realtime this phase).
  useFocusEffect(
    useCallback(() => {
      void load(true);
      if (!session) return;
      const id = setInterval(() => void load(false), POLL_MS);
      return () => clearInterval(id);
    }, [load, session]),
  );

  const rows = useMemo(() => buildRows(messages), [messages]);

  const onSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || !threadId || sending) return;

    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const optimistic: ThreadMessage = {
      id: tempId,
      mine: true,
      body: trimmed,
      attachmentPaths: [],
      quoteId: null,
      timeLabel: timeLabel(nowIso),
      dayLabel: dayLabel(nowIso),
      createdAtIso: nowIso,
    };

    pendingRef.current.add(tempId);
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSendError(null);
    setSending(true);

    const res = await sendMessage(threadId, trimmed);
    pendingRef.current.delete(tempId);
    setSending(false);

    if (res.ok && res.message) {
      const persisted = res.message;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? persisted : m)));
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      // Restore the text only if the composer is still empty (user hasn't typed
      // something new), so we never clobber a fresh draft.
      setDraft((cur) => (cur.length === 0 ? trimmed : cur));
      setSendError(res.error ?? "Couldn't send — try again.");
    }
  }, [draft, threadId, sending]);

  const onQuoteCreated = useCallback(
    (quote: QuoteView, message: ThreadMessage | undefined) => {
      setQuotesById((prev) => ({ ...prev, [quote.id]: quote }));
      if (message) {
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message],
        );
      }
    },
    [],
  );

  const canQuote = status === "ready" && !!artistId && !!customerId;

  const otherUserId = other?.userId ?? null;
  const onModerate = otherUserId
    ? () =>
        presentModerationMenu({
          subjectLabel: other?.name ?? "this client",
          targetType: "user",
          targetId: otherUserId,
          blockUserId: otherUserId,
          onBlocked: () => router.back(),
        })
    : undefined;

  if (status === "loading") {
    return (
      <View className="flex-1 bg-ink-950">
        <SafeAreaView edges={["top"]}>
          <ThreadHeader
            other={null}
            onBack={() => router.back()}
            onQuote={null}
          />
        </SafeAreaView>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.gold[400]} />
          <Text variant="caption" className="mt-2">
            Loading conversation…
          </Text>
        </View>
      </View>
    );
  }

  if (status === "notfound" || status === "error") {
    const notfound = status === "notfound";
    return (
      <View className="flex-1 bg-ink-950">
        <SafeAreaView edges={["top"]}>
          <ThreadHeader
            other={null}
            onBack={() => router.back()}
            onQuote={null}
          />
        </SafeAreaView>
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon
              name={notfound ? "chatbubble-outline" : "cloud-offline-outline"}
              size={26}
              color={colors.gold[400]}
            />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            {notfound ? "Conversation not found" : "Something went wrong"}
          </Text>
          <Text
            variant="body"
            className="max-w-[280px] text-center text-bone-500"
          >
            {notfound
              ? "This conversation may have moved, or you're signed out."
              : "We couldn't load this conversation. Please try again."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink-950">
      <SafeAreaView edges={["top"]} className="bg-ink-950">
        <ThreadHeader
          other={other}
          onBack={() => router.back()}
          onQuote={canQuote ? () => setQuoteOpen(true) : null}
          onMore={onModerate}
        />
      </SafeAreaView>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <FlatList
          data={rows}
          inverted
          keyExtractor={(r) => r.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            <View className="items-center px-8 pt-16">
              <Text variant="body" className="text-center text-bone-500">
                Reply to your client, or send them a quote to get the piece
                booked.
              </Text>
            </View>
          }
          renderItem={({ item }) =>
            item.kind === "divider" ? (
              <DayDivider label={item.label} />
            ) : (
              <MessageBubble
                message={item.message}
                quote={
                  item.message.quoteId
                    ? (quotesById[item.message.quoteId] ?? null)
                    : null
                }
              />
            )
          }
        />

        <Composer
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            if (sendError) setSendError(null);
          }}
          onSend={onSend}
          sending={sending}
          error={sendError}
        />
      </KeyboardAvoidingView>

      {canQuote && artistId && customerId ? (
        <QuoteComposer
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          threadId={threadId!}
          artistId={artistId}
          customerId={customerId}
          clientName={other?.name ?? "your client"}
          onCreated={onQuoteCreated}
        />
      ) : null}
    </View>
  );
}

function ThreadHeader({
  other,
  onBack,
  onQuote,
  onMore,
}: {
  other: OtherParty | null;
  onBack: () => void;
  onQuote: (() => void) | null;
  onMore?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2 border-b border-ink-800 px-3 py-2">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
      >
        <Icon name="chevron-back" size={22} color={colors.bone[100]} />
      </Pressable>

      {other ? (
        <View className="flex-1 flex-row items-center gap-3">
          <Artwork
            seed={other.userId ?? other.name}
            initials={monogram(other.name)}
            rounded="rounded-lg"
            style={{ width: 38, height: 38 }}
          />
          <View className="flex-1">
            <Text variant="bodySemibold" numberOfLines={1}>
              {other.name}
            </Text>
            {other.subtitle ? (
              <Text variant="caption" numberOfLines={1} className="mt-0.5">
                {other.subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View className="flex-1" />
      )}

      {onQuote ? (
        <Pressable
          onPress={onQuote}
          accessibilityRole="button"
          accessibilityLabel="Send a quote"
          className="flex-row items-center gap-1.5 rounded-full border border-gold-400/60 bg-gold-400/15 px-3 py-2 active:opacity-80"
        >
          <Icon name="reader-outline" size={15} color={colors.gold[300]} />
          <Text variant="bodySemibold" className="text-[13px] text-gold-300">
            Quote
          </Text>
        </Pressable>
      ) : null}

      {onMore ? (
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel="More options"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon name="ellipsis-horizontal" size={20} color={colors.bone[100]} />
        </Pressable>
      ) : null}
    </View>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <View className="my-2 flex-row items-center gap-3">
      <View className="h-px flex-1 bg-ink-800" />
      <Text variant="label" className="text-[10px] text-bone-500">
        {label}
      </Text>
      <View className="h-px flex-1 bg-ink-800" />
    </View>
  );
}

function Composer({
  value,
  onChangeText,
  onSend,
  sending,
  error,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  sending: boolean;
  error: string | null;
}) {
  const canSend = value.trim().length > 0 && !sending;
  return (
    <SafeAreaView
      edges={["bottom"]}
      className="border-t border-ink-800 bg-ink-900"
    >
      {error ? (
        <View className="flex-row items-center gap-1.5 px-4 pt-2">
          <Icon name="alert-circle-outline" size={13} color={colors.negative} />
          <Text variant="caption" className="text-negative">
            {error}
          </Text>
        </View>
      ) : null}
      <View className="flex-row items-end gap-2 px-3 py-2">
        <View className="flex-1 rounded-2xl border border-ink-600 bg-ink-800 px-3.5 py-1">
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="Message…"
            placeholderTextColor={colors.bone[500]}
            selectionColor={colors.gold[400]}
            multiline
            className="max-h-28 min-h-[36px] py-2 font-sans text-[15px] text-bone-100"
            style={{ textAlignVertical: "center" }}
          />
        </View>
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          className={`h-11 w-11 items-center justify-center rounded-full ${
            canSend ? "bg-oxblood-500" : "bg-ink-700"
          }`}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.bone[100]} />
          ) : (
            <Icon
              name="arrow-up"
              size={20}
              color={canSend ? colors.bone[100] : colors.bone[500]}
            />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
