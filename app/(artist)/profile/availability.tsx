import { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { colors } from "../../../src/ui/tokens";
import { useAuth } from "../../../src/lib/auth";
import { ProfileHeader } from "../../../src/features/artist-profile/ProfileHeader";
import {
  WEEKDAYS_MONDAY_FIRST,
  quarterHourSlots,
  timeDisplay,
} from "../../../src/features/artist-profile/format";
import {
  getEditableArtist,
  listMyAvailability,
} from "../../../src/features/artist-profile/data";
import { setWeekdayAvailability } from "../../../src/features/artist-profile/actions";

type Status = "loading" | "ready" | "notartist" | "error";

/** Per-weekday editable state (keyed by DB weekday index 0=Sun … 6=Sat). */
interface DayState {
  open: boolean;
  from: string; // "HH:MM"
  to: string; // "HH:MM"
}

const DEFAULT_OPEN = "11:00";
const DEFAULT_CLOSE = "19:00";

const SLOTS = quarterHourSlots(8, 22);

function emptyWeek(): Record<number, DayState> {
  const week: Record<number, DayState> = {};
  for (const day of WEEKDAYS_MONDAY_FIRST) {
    week[day.index] = { open: false, from: DEFAULT_OPEN, to: DEFAULT_CLOSE };
  }
  return week;
}

export default function AvailabilityScreen() {
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [artistId, setArtistId] = useState<string | null>(null);
  const [week, setWeek] = useState<Record<number, DayState>>(emptyWeek());
  const [savingWeekday, setSavingWeekday] = useState<number | null>(null);
  // The time being picked: which weekday + which edge (from/to), or null.
  const [picker, setPicker] = useState<{ weekday: number; edge: "from" | "to" } | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!session) {
      setStatus("notartist");
      return;
    }
    try {
      const a = await getEditableArtist();
      if (!a) {
        setStatus("notartist");
        return;
      }
      setArtistId(a.id);
      const rules = await listMyAvailability(a.id);
      const next = emptyWeek();
      for (const rule of rules) {
        next[rule.weekday] = {
          open: true,
          from: timeDisplay(rule.startTime),
          to: timeDisplay(rule.endTime),
        };
      }
      setWeek(next);
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

  const persist = useCallback(
    async (weekday: number, day: DayState) => {
      if (!artistId) return;
      setSavingWeekday(weekday);
      const res = await setWeekdayAvailability(
        artistId,
        weekday,
        day.open,
        day.from,
        day.to,
      );
      setSavingWeekday(null);
      if (!res.ok) {
        // Revert by reloading the authoritative state.
        void load();
      }
    },
    [artistId, load],
  );

  const toggleDay = useCallback(
    (weekday: number) => {
      setWeek((prev) => {
        const current = prev[weekday];
        const nextDay: DayState = { ...current, open: !current.open };
        const next = { ...prev, [weekday]: nextDay };
        void persist(weekday, nextDay);
        return next;
      });
    },
    [persist],
  );

  const setTime = useCallback(
    (weekday: number, edge: "from" | "to", value: string) => {
      setWeek((prev) => {
        const current = prev[weekday];
        const nextDay: DayState = { ...current, [edge]: value };
        // Keep the window valid: if close <= open, nudge close forward.
        if (edge === "from" && nextDay.to <= nextDay.from) {
          nextDay.to = nextDay.from;
        }
        const next = { ...prev, [weekday]: nextDay };
        if (nextDay.open && nextDay.to > nextDay.from) {
          void persist(weekday, nextDay);
        }
        return next;
      });
    },
    [persist],
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
      <ProfileHeader title="Availability" subtitle="Your weekly opening hours" />

      {status === "loading" ? (
        <SkeletonList />
      ) : status === "notartist" || status === "error" ? (
        <ErrorState notartist={status === "notartist"} />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
        >
          <Text variant="body" className="mb-4 text-[13px] text-bone-500">
            Toggle the days you take bookings and set the hours. Times save as you
            change them.
          </Text>
          <View className="gap-2.5">
            {WEEKDAYS_MONDAY_FIRST.map((day) => {
              const state = week[day.index];
              const busy = savingWeekday === day.index;
              return (
                <View
                  key={day.index}
                  className="rounded-2xl border border-ink-700 bg-ink-900 p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <Text variant="bodySemibold" className="text-bone-100">
                      {day.long}
                    </Text>
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: state.open, busy }}
                      onPress={() => toggleDay(day.index)}
                      className={`h-7 w-12 justify-center rounded-full px-0.5 ${
                        state.open ? "bg-oxblood-500" : "bg-ink-700"
                      }`}
                    >
                      <View
                        className={`h-6 w-6 rounded-full bg-bone-100 ${
                          state.open ? "self-end" : "self-start"
                        }`}
                      />
                    </Pressable>
                  </View>

                  {state.open ? (
                    <View className="mt-3 flex-row items-center gap-2">
                      <TimeButton
                        label={state.from}
                        onPress={() => setPicker({ weekday: day.index, edge: "from" })}
                      />
                      <Text variant="body" className="text-bone-500">
                        to
                      </Text>
                      <TimeButton
                        label={state.to}
                        onPress={() => setPicker({ weekday: day.index, edge: "to" })}
                      />
                      {busy ? (
                        <Icon
                          name="ellipsis-horizontal"
                          size={16}
                          color={colors.bone[500]}
                        />
                      ) : null}
                    </View>
                  ) : (
                    <Text variant="caption" className="mt-2">
                      Closed
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <TimeSelectSheet
        visible={picker !== null}
        current={
          picker ? week[picker.weekday][picker.edge] : DEFAULT_OPEN
        }
        title={picker?.edge === "to" ? "Closing time" : "Opening time"}
        onClose={() => setPicker(null)}
        onSelect={(value) => {
          if (picker) setTime(picker.weekday, picker.edge, value);
          setPicker(null);
        }}
      />
    </SafeAreaView>
  );
}

function TimeButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-xl border border-ink-600 bg-ink-800 px-3.5 py-2.5 active:opacity-80"
    >
      <Icon name="time-outline" size={15} color={colors.bone[500]} />
      <Text variant="bodyMedium" className="text-[14px] text-bone-100">
        {label}
      </Text>
    </Pressable>
  );
}

function TimeSelectSheet({
  visible,
  current,
  title,
  onClose,
  onSelect,
}: {
  visible: boolean;
  current: string;
  title: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[70%] rounded-t-3xl border-t border-ink-700 bg-ink-950 pb-8">
          <View className="flex-row items-center justify-between px-5 pb-3 pt-5">
            <Text variant="display" className="text-xl">
              {title}
            </Text>
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
            <View className="flex-row flex-wrap gap-2">
              {SLOTS.map((slot) => {
                const active = slot.label === current;
                return (
                  <Pressable
                    key={slot.value}
                    accessibilityRole="button"
                    onPress={() => onSelect(slot.label)}
                    className={`rounded-xl border px-3.5 py-2.5 active:opacity-80 ${
                      active ? "border-gold-400 bg-gold-400/15" : "border-ink-700 bg-ink-900"
                    }`}
                  >
                    <Text
                      variant="bodyMedium"
                      className={`text-[13px] ${active ? "text-gold-300" : "text-bone-300"}`}
                    >
                      {slot.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SkeletonList() {
  return (
    <View className="flex-1 px-5 pt-2">
      <View className="gap-2.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            className="h-[64px] rounded-2xl border border-ink-700 bg-ink-900"
            style={{ opacity: 0.6 - i * 0.08 }}
          />
        ))}
      </View>
    </View>
  );
}

function ErrorState({ notartist }: { notartist: boolean }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
        <Icon
          name={notartist ? "brush-outline" : "cloud-offline-outline"}
          size={24}
          color={colors.gold[400]}
        />
      </View>
      <Text variant="display" className="mb-2 text-center text-xl">
        {notartist ? "Finish your studio setup" : "Couldn't load availability"}
      </Text>
      <Text variant="body" className="max-w-[280px] text-center text-bone-500">
        {notartist
          ? "Once your artist profile is live you can set your hours here."
          : "Something went wrong. Please go back and try again."}
      </Text>
    </View>
  );
}
