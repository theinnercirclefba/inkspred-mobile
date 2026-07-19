import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../ui/Text";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";

/**
 * Propose-a-time bottom sheet — a dependency-free date + 15-minute time +
 * duration picker. Confirming resolves the chosen wall-clock slot to a local
 * ISO start and a duration in minutes, which the caller feeds to
 * proposeSessionTime (end = start + duration).
 *
 * Kept free of any native datetime module so `expo export` stays clean: dates
 * are the next three weeks as chips, times are quarter-hour slots across the
 * working day, durations are the common sitting lengths.
 */

export interface ProposeTimeSheetProps {
  visible: boolean;
  /** Who/what the slot is for — shown in the header for context. */
  subtitle: string;
  /** Prefill in minutes (the service's length or an already-proposed slot). */
  initialDurationMin: number;
  /** Prefill start (a previously proposed time) as ISO, or null. */
  initialStartIso: string | null;
  onClose: () => void;
  /** Confirm — returns the local ISO start and the duration in minutes. */
  onConfirm: (startIso: string, durationMin: number) => void;
  /** True while the confirm write is in flight. */
  saving?: boolean;
}

const DAY_COUNT = 21;
const FIRST_HOUR = 8;
const LAST_HOUR = 21; // inclusive of :00 at 21
const DURATIONS: { label: string; min: number }[] = [
  { label: "30 min", min: 30 },
  { label: "1 h", min: 60 },
  { label: "1 h 30", min: 90 },
  { label: "2 h", min: 120 },
  { label: "3 h", min: 180 },
  { label: "4 h", min: 240 },
  { label: "6 h", min: 360 },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayChipLabel(d: Date): { weekday: string; day: string } {
  return {
    weekday: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d),
    day: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    }).format(d),
  };
}

function timeLabel(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function ProposeTimeSheet({
  visible,
  subtitle,
  initialDurationMin,
  initialStartIso,
  onClose,
  onConfirm,
  saving = false,
}: ProposeTimeSheetProps) {
  const initial = useMemo(() => {
    const base = initialStartIso ? new Date(initialStartIso) : null;
    const valid = base && !Number.isNaN(base.getTime()) ? base : null;
    return {
      day: valid ? startOfDay(valid) : null,
      hour: valid ? valid.getHours() : 11,
      // Snap any stored minute to the nearest quarter hour.
      minute: valid ? Math.round(valid.getMinutes() / 15) * 15 : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStartIso, visible]);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: DAY_COUNT }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const slots = useMemo(() => {
    const out: { hour: number; minute: number }[] = [];
    for (let h = FIRST_HOUR; h <= LAST_HOUR; h += 1) {
      for (let m = 0; m < 60; m += 15) {
        if (h === LAST_HOUR && m > 0) break; // stop at 21:00
        out.push({ hour: h, minute: m });
      }
    }
    return out;
  }, []);

  const [selectedDay, setSelectedDay] = useState<Date>(
    initial.day ?? days[0],
  );
  const [selectedHour, setSelectedHour] = useState<number>(initial.hour);
  const [selectedMinute, setSelectedMinute] = useState<number>(initial.minute);
  const [durationMin, setDurationMin] = useState<number>(
    Math.max(15, Math.round(initialDurationMin || 60)),
  );

  const confirm = () => {
    const start = new Date(selectedDay);
    start.setHours(selectedHour, selectedMinute, 0, 0);
    onConfirm(start.toISOString(), durationMin);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[86%] rounded-t-3xl border-t border-ink-700 bg-ink-950 pb-8">
          {/* Header */}
          <View className="flex-row items-start justify-between px-5 pb-3 pt-5">
            <View className="flex-1 pr-3">
              <Text variant="display" className="text-xl">
                Propose a time
              </Text>
              <Text
                variant="body"
                numberOfLines={1}
                className="mt-0.5 text-[13px] text-bone-500"
              >
                {subtitle}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full border border-ink-700 bg-ink-900 active:opacity-80"
            >
              <Icon name="close" size={18} color={colors.bone[300]} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
          >
            {/* Date */}
            <Text variant="label" className="mb-2.5 mt-1 text-bone-500">
              Date
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            >
              {days.map((d) => {
                const active = sameDay(d, selectedDay);
                const { weekday, day } = dayChipLabel(d);
                return (
                  <Pressable
                    key={d.toISOString()}
                    accessibilityRole="button"
                    onPress={() => setSelectedDay(d)}
                    className={`w-16 items-center rounded-2xl border px-2 py-3 active:opacity-80 ${
                      active
                        ? "border-gold-400 bg-gold-400/15"
                        : "border-ink-700 bg-ink-900"
                    }`}
                  >
                    <Text
                      variant="caption"
                      className={active ? "text-gold-300" : "text-bone-500"}
                    >
                      {weekday}
                    </Text>
                    <Text
                      variant="bodySemibold"
                      className={`mt-1 text-center text-[13px] ${
                        active ? "text-bone-100" : "text-bone-300"
                      }`}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Time */}
            <Text variant="label" className="mb-2.5 mt-5 text-bone-500">
              Start time
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {slots.map(({ hour, minute }) => {
                const active = hour === selectedHour && minute === selectedMinute;
                return (
                  <Pressable
                    key={`${hour}:${minute}`}
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedHour(hour);
                      setSelectedMinute(minute);
                    }}
                    className={`rounded-xl border px-3 py-2 active:opacity-80 ${
                      active
                        ? "border-gold-400 bg-gold-400/15"
                        : "border-ink-700 bg-ink-900"
                    }`}
                  >
                    <Text
                      variant="bodyMedium"
                      className={`text-[13px] ${
                        active ? "text-bone-100" : "text-bone-300"
                      }`}
                    >
                      {timeLabel(hour, minute)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Duration */}
            <Text variant="label" className="mb-2.5 mt-5 text-bone-500">
              Duration
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DURATIONS.map(({ label, min }) => {
                const active = min === durationMin;
                return (
                  <Pressable
                    key={min}
                    accessibilityRole="button"
                    onPress={() => setDurationMin(min)}
                    className={`rounded-xl border px-3.5 py-2 active:opacity-80 ${
                      active
                        ? "border-gold-400 bg-gold-400/15"
                        : "border-ink-700 bg-ink-900"
                    }`}
                  >
                    <Text
                      variant="bodyMedium"
                      className={`text-[13px] ${
                        active ? "text-bone-100" : "text-bone-300"
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View className="px-5 pt-4">
            <Button
              label={saving ? "Sending…" : "Send proposed time"}
              variant="primary"
              loading={saving}
              onPress={confirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
