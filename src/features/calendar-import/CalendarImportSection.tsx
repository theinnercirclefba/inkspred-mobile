import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import {
  importDeviceCalendar,
  listImportedBlocks,
  removeImportedBlock,
  type ImportedBlock,
} from "./data";

/**
 * "Your other calendar" — the availability screen's device-calendar import.
 * One tap pulls the phone's existing events in as busy blocks (so clients can
 * never double-book the artist), lists the upcoming imported blocks, and lets
 * the artist remove any block or re-sync at any time. Self-contained: owns its
 * own load/refresh state so the host screen stays untouched.
 */
export function CalendarImportSection() {
  const [blocks, setBlocks] = useState<ImportedBlock[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setBlocks(await listImportedBlocks());
    } catch {
      /* soft — the section simply shows the import button */
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onImport = useCallback(async () => {
    setImporting(true);
    const result = await importDeviceCalendar();
    setImporting(false);

    if (!result.ok) {
      if (result.error === "permission") {
        Alert.alert(
          "Calendar access needed",
          "Allow calendar access in Settings → InkSpred so we can mark your existing bookings as busy.",
        );
      } else {
        Alert.alert(
          "Couldn't import",
          "Please check your connection and try again.",
        );
      }
      return;
    }
    await refresh();
    Alert.alert(
      "Calendar synced",
      result.imported > 0
        ? `${result.imported} busy ${result.imported === 1 ? "time" : "times"} imported${
            result.skipped > 0 ? ` (${result.skipped} already in)` : ""
          }. Clients can't book over them.`
        : "You're up to date — nothing new to import.",
    );
  }, [refresh]);

  const onRemove = useCallback(
    (block: ImportedBlock) => {
      Alert.alert(
        "Remove busy time?",
        `${blockLabel(block)} will become bookable again.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              const ok = await removeImportedBlock(block.id);
              if (ok) setBlocks((prev) => prev.filter((b) => b.id !== block.id));
            },
          },
        ],
      );
    },
    [],
  );

  return (
    <View className="mt-8">
      <Text variant="display" className="text-xl">
        Your other calendar
      </Text>
      <Text variant="body" className="mt-1 mb-4 text-[13px] text-bone-500">
        Import busy times from your phone&rsquo;s calendar — Google, Apple or
        Outlook — so clients can never double-book you. Free, and only you see
        them.
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={importing}
        onPress={onImport}
        className="flex-row items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800 py-3.5 active:opacity-80"
      >
        {importing ? (
          <ActivityIndicator size="small" color={colors.gold[400]} />
        ) : (
          <Icon name="calendar-outline" size={16} color={colors.gold[300]} />
        )}
        <Text variant="bodyMedium" className="text-[14px] text-gold-300">
          {importing
            ? "Importing…"
            : blocks.length > 0
              ? "Re-sync calendar"
              : "Import from calendar"}
        </Text>
      </Pressable>

      {loaded && blocks.length > 0 ? (
        <View className="mt-4 rounded-2xl border border-ink-700 bg-ink-900">
          {blocks.slice(0, 12).map((b, i) => (
            <View
              key={b.id}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                i === 0 ? "" : "border-t border-ink-700"
              }`}
            >
              <Icon name="time-outline" size={15} color={colors.bone[500]} />
              <View className="min-w-0 flex-1">
                <Text variant="bodyMedium" numberOfLines={1} className="text-[13px]">
                  {blockLabel(b)}
                </Text>
                {b.title ? (
                  <Text variant="caption" numberOfLines={1} className="mt-0.5">
                    {b.title}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove busy time"
                hitSlop={8}
                onPress={() => onRemove(b)}
              >
                <Icon name="close-circle-outline" size={17} color={colors.bone[500]} />
              </Pressable>
            </View>
          ))}
          {blocks.length > 12 ? (
            <Text variant="caption" className="px-4 py-3 border-t border-ink-700">
              + {blocks.length - 12} more further out
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** "Tue 4 Aug · 12:00–15:00" (or "· all day" for midnight-to-23:59 blocks). */
function blockLabel(b: ImportedBlock): string {
  const s = new Date(b.startsAtIso);
  const e = new Date(b.endsAtIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "Busy";
  const day = s.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const allDay =
    s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 23;
  if (allDay) return `${day} · all day`;
  const t = (d: Date) =>
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${t(s)}–${t(e)}`;
}
