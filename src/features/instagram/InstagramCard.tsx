import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import {
  connectInstagram,
  getInstagramStatus,
  runInstagramImport,
  type InstagramStatus,
  type ImportResult,
} from "./data";

/**
 * The "Connect Instagram" card — the heart of 2-minute artist onboarding.
 *
 * Disconnected → one gold CTA ("Connect Instagram"): opens the OAuth round-trip
 * and refreshes itself when the deep link lands. Connected → @handle + a
 * one-tap "Import latest work" that pulls recent posts into the portfolio
 * (deduped server-side, so re-running is always safe).
 *
 * Self-contained: fetches its own status on mount, renders nothing while that
 * first look is in flight (no layout jump for the majority who are already
 * connected or haven't published yet), and never throws into the host screen.
 * `onImported` lets the portfolio screen refresh its grid after an import.
 */
export function InstagramCard({ onImported }: { onImported?: () => void }) {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [busy, setBusy] = useState<"connect" | "import" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [noteTone, setNoteTone] = useState<"good" | "bad">("good");

  const refresh = useCallback(async () => {
    setStatus(await getInstagramStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onConnect = useCallback(async () => {
    setBusy("connect");
    setNote(null);
    const result = await connectInstagram();
    if (result.ok) {
      setNote("Instagram connected.");
      setNoteTone("good");
      await refresh();
    } else if (!result.cancelled) {
      setNote(result.error ?? "Couldn't connect Instagram.");
      setNoteTone("bad");
    }
    setBusy(null);
  }, [refresh]);

  const onImport = useCallback(async () => {
    setBusy("import");
    setNote(null);
    const result: ImportResult = await runInstagramImport();
    if (result.ok) {
      setNote(
        result.imported > 0
          ? `Imported ${result.imported} new ${result.imported === 1 ? "piece" : "pieces"} from Instagram.`
          : "You're up to date — no new posts to import.",
      );
      setNoteTone("good");
      if (result.imported > 0) onImported?.();
    } else {
      setNote(
        result.error === "not_connected"
          ? "Instagram isn't connected yet."
          : result.error === "not_an_artist"
            ? "Finish your artist profile first."
            : "Import didn't finish — please try again.",
      );
      setNoteTone("bad");
    }
    setBusy(null);
  }, [onImported]);

  // First status still loading — render nothing rather than jumping layout.
  if (status === null) return null;

  return (
    <View className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl border border-ink-600 bg-ink-800">
          <Icon name="logo-instagram" size={18} color={colors.gold[400]} />
        </View>
        <View className="flex-1">
          <Text variant="bodySemibold">
            {status.connected ? "Instagram connected" : "Connect Instagram"}
          </Text>
          <Text variant="caption" className="mt-0.5">
            {status.connected
              ? `@${status.username ?? "your account"}${
                  status.mediaCount != null ? ` · ${status.mediaCount} posts` : ""
                }`
              : "Import your work straight into your portfolio."}
          </Text>
        </View>
        {status.connected ? (
          <Icon name="checkmark-circle" size={20} color={colors.positive} />
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={busy !== null}
        onPress={status.connected ? onImport : onConnect}
        className={`mt-3 flex-row items-center justify-center gap-2 rounded-xl py-3 active:opacity-80 ${
          status.connected
            ? "border border-ink-600 bg-ink-800"
            : "bg-gold-400"
        }`}
      >
        {busy ? (
          <ActivityIndicator
            size="small"
            color={status.connected ? colors.gold[300] : colors.ink[950]}
          />
        ) : (
          <Icon
            name={status.connected ? "download-outline" : "logo-instagram"}
            size={16}
            color={status.connected ? colors.gold[300] : colors.ink[950]}
          />
        )}
        <Text
          variant="bodySemibold"
          className={`text-[14px] ${
            status.connected ? "text-gold-300" : "text-ink-950"
          }`}
        >
          {busy === "connect"
            ? "Connecting…"
            : busy === "import"
              ? "Importing…"
              : status.connected
                ? "Import latest work"
                : "Connect Instagram"}
        </Text>
      </Pressable>

      {note ? (
        <Text
          variant="caption"
          className={`mt-2 text-center ${
            noteTone === "good" ? "text-positive" : "text-negative"
          }`}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}
