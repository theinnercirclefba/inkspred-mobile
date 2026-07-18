import { useMemo } from "react";
import { View, Pressable } from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import { buildWeeks, formatIsoShort, type BookingDraft } from "./model";

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Step 2 — preferred dates. An "any date works" toggle up top, then eight
 * week rows of day cells (Mon–Sun). Multi-select; past days are inert. No
 * external date library — weeks come from model.buildWeeks.
 */
export function StepDates({
  draft,
  update,
}: {
  draft: BookingDraft;
  update: (patch: Partial<BookingDraft>) => void;
}) {
  const weeks = useMemo(() => buildWeeks(), []);
  const selected = new Set(draft.dates);

  const toggleDate = (iso: string) => {
    const next = new Set(draft.dates);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    // Choosing a specific day clears the "flexible" flag — they're alternatives.
    update({ dates: [...next].sort(), flexible: false });
  };

  return (
    <View className="gap-7">
      <View>
        <Text variant="display" className="text-2xl">
          Preferred dates
        </Text>
        <Text variant="body" className="mt-1.5 text-bone-300">
          Tap any days that could work over the next eight weeks. Pick a few — the
          artist confirms the exact slot.
        </Text>
      </View>

      {/* Flexible toggle */}
      <Pressable
        onPress={() =>
          update({ flexible: !draft.flexible, dates: draft.flexible ? draft.dates : [] })
        }
        accessibilityRole="switch"
        accessibilityState={{ checked: draft.flexible }}
        className={`flex-row items-center gap-3 rounded-2xl border p-4 ${
          draft.flexible ? "border-gold-400/70 bg-ink-800" : "border-ink-700 bg-ink-900"
        }`}
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
      >
        <View
          className={`h-9 w-9 items-center justify-center rounded-lg border ${
            draft.flexible ? "border-gold-400 bg-gold-400/15" : "border-ink-600 bg-ink-800"
          }`}
        >
          <Icon
            name="sparkles-outline"
            size={16}
            color={draft.flexible ? colors.gold[300] : colors.bone[500]}
          />
        </View>
        <View className="flex-1">
          <Text variant="bodySemibold" className={draft.flexible ? "text-gold-300" : undefined}>
            I&rsquo;m flexible
          </Text>
          <Text variant="caption" className="mt-0.5 text-bone-500">
            Any date works — let the artist suggest one.
          </Text>
        </View>
        <View
          className={`h-5 w-5 items-center justify-center rounded-full border ${
            draft.flexible ? "border-gold-400 bg-gold-400" : "border-ink-500"
          }`}
        >
          {draft.flexible ? <Icon name="checkmark" size={13} color={colors.ink[950]} /> : null}
        </View>
      </Pressable>

      {/* Selected summary */}
      {draft.dates.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {draft.dates.map((iso) => (
            <Pressable
              key={iso}
              onPress={() => toggleDate(iso)}
              className="flex-row items-center gap-1.5 rounded-full border border-gold-400/60 bg-gold-400/15 px-3 py-1.5"
            >
              <Text variant="bodyMedium" className="text-[13px] text-gold-300">
                {formatIsoShort(iso)}
              </Text>
              <Icon name="close" size={13} color={colors.gold[300]} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Weekday header */}
      <View>
        <View className="mb-2 flex-row">
          {WEEKDAY_INITIALS.map((d, i) => (
            <View key={i} className="flex-1 items-center">
              <Text variant="caption" className="text-bone-500">
                {d}
              </Text>
            </View>
          ))}
        </View>

        <View className="gap-3">
          {weeks.map((week) => (
            <View key={week.label}>
              <Text variant="caption" className="mb-1.5 text-bone-500">
                {week.label}
              </Text>
              <View className="flex-row">
                {week.days.map((day) => {
                  const isSel = selected.has(day.iso);
                  return (
                    <View key={day.iso} className="flex-1 items-center">
                      <Pressable
                        onPress={() => (day.isPast ? undefined : toggleDate(day.iso))}
                        disabled={day.isPast}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSel, disabled: day.isPast }}
                        className={`h-10 w-10 items-center justify-center rounded-xl border ${
                          isSel
                            ? "border-gold-400/70 bg-gold-400/20"
                            : day.isPast
                              ? "border-transparent"
                              : "border-ink-700 bg-ink-900"
                        }`}
                        style={({ pressed }) =>
                          pressed && !day.isPast ? { opacity: 0.8 } : undefined
                        }
                      >
                        <Text
                          variant={isSel ? "bodySemibold" : "body"}
                          className={`text-[13px] ${
                            isSel
                              ? "text-gold-300"
                              : day.isPast
                                ? "text-ink-500"
                                : day.isWeekend
                                  ? "text-bone-500"
                                  : "text-bone-300"
                          }`}
                        >
                          {day.dayOfMonth}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
