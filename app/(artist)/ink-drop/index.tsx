import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Field } from "../../../src/ui/Field";
import { Button } from "../../../src/ui/Button";
import { colors } from "../../../src/ui/tokens";
import { useAuth } from "../../../src/lib/auth";
import { getArtistContext } from "../../../src/features/artist/data";
import { MyDropRow } from "../../../src/features/ink-drop/MyDropRow";
import { relativeDropDate } from "../../../src/features/ink-drop/format";
import {
  listMyDrops,
  publishDrop,
  withdrawDrop,
  type MyDrop,
  type SlotType,
} from "../../../src/features/ink-drop/data";

type Status = "loading" | "ready" | "notartist" | "error";

const SLOTS: { key: SlotType; label: string; icon: React.ComponentProps<typeof Icon>["name"] }[] = [
  { key: "full_day", label: "Full day", icon: "sunny-outline" },
  { key: "half_day", label: "Half day", icon: "partly-sunny-outline" },
  { key: "hours", label: "A few hours", icon: "time-outline" },
];

/** yyyy-mm-dd for `offset` days from today (local). */
function isoForOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a pounds string ("120", "120.50", "£120") to integer pence, or null. */
function poundsToPence(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, "").trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export default function InkDropPublish() {
  const router = useRouter();
  const { session } = useAuth();

  const [status, setStatus] = useState<Status>("loading");
  const [myDrops, setMyDrops] = useState<MyDrop[]>([]);

  // Form state
  const [dropDate, setDropDate] = useState<string>(isoForOffset(1));
  const [slot, setSlot] = useState<SlotType>("full_day");
  const [hoursNote, setHoursNote] = useState("");
  const [dropPrice, setDropPrice] = useState("");
  const [normalPrice, setNormalPrice] = useState("");
  const [note, setNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const dayOptions = useMemo(
    () => Array.from({ length: 21 }, (_, i) => isoForOffset(i)),
    [],
  );

  const load = useCallback(async () => {
    if (!session) {
      setStatus("ready");
      return;
    }
    try {
      const ctx = await getArtistContext();
      if (!ctx) {
        setStatus("notartist");
        return;
      }
      const drops = await listMyDrops();
      setMyDrops(drops);
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

  const resetForm = useCallback(() => {
    setDropDate(isoForOffset(1));
    setSlot("full_day");
    setHoursNote("");
    setDropPrice("");
    setNormalPrice("");
    setNote("");
  }, []);

  const onPublish = useCallback(async () => {
    const dropPence = poundsToPence(dropPrice);
    if (dropPence === null) {
      Alert.alert("Add a drop price", "Enter the discounted price for this chair.");
      return;
    }
    const normalPence = normalPrice.trim() ? poundsToPence(normalPrice) : null;
    if (normalPence !== null && normalPence <= dropPence) {
      Alert.alert(
        "Check your prices",
        "The usual price should be higher than the drop price.",
      );
      return;
    }

    setPublishing(true);
    const result = await publishDrop({
      dropDate,
      slotType: slot,
      hoursNote: slot === "hours" ? hoursNote : null,
      normalPricePence: normalPence,
      dropPricePence: dropPence,
      note,
    });
    setPublishing(false);

    if (result.ok) {
      resetForm();
      await load();
      Alert.alert(
        "Ink Drop live",
        "Your open chair is now visible to customers nearby. First to claim books it.",
      );
      return;
    }

    if (result.error === "not_artist") {
      Alert.alert("Finish your studio setup", "Publish your artist profile first.");
    } else if (result.error === "invalid_input") {
      Alert.alert("Check the details", "Pick a date, slot and a valid drop price.");
    } else {
      Alert.alert("Couldn't publish", "Something went wrong. Please try again.");
    }
  }, [dropPrice, normalPrice, dropDate, slot, hoursNote, note, load, resetForm]);

  const onWithdraw = useCallback(
    (drop: MyDrop) => {
      Alert.alert(
        "Withdraw this drop?",
        "It will disappear from the customer list. You can publish a new one anytime.",
        [
          { text: "Keep it", style: "cancel" },
          {
            text: "Withdraw",
            style: "destructive",
            onPress: async () => {
              setWithdrawingId(drop.id);
              // Optimistic: flip to withdrawn locally, reconcile on result.
              const result = await withdrawDrop(drop.id);
              setWithdrawingId(null);
              if (result.ok) {
                setMyDrops((prev) =>
                  prev.map((d) =>
                    d.id === drop.id ? { ...d, status: "withdrawn" } : d,
                  ),
                );
              } else {
                Alert.alert(
                  "Couldn't withdraw",
                  "That drop couldn't be withdrawn. Pull to refresh and try again.",
                );
              }
            },
          },
        ],
      );
    },
    [],
  );

  const openDrops = myDrops.filter((d) => d.status === "open");
  const pastDrops = myDrops.filter((d) => d.status !== "open");

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-ink-800 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-lg border border-ink-700 bg-ink-900 active:opacity-80"
        >
          <Icon name="chevron-back" size={18} color={colors.bone[100]} />
        </Pressable>
        <View className="flex-1">
          <Text variant="displayBold" className="text-xl">
            Ink Drop
          </Text>
        </View>
        <Icon name="flash" size={20} color={colors.gold[400]} />
      </View>

      {status === "loading" ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.gold[400]} />
        </View>
      ) : !session ? (
        <Guard
          icon="flash-outline"
          title="Sign in to publish"
          body="Fill a quiet day by opening a discounted chair customers can claim."
          actionLabel="Sign in"
          onAction={() => router.push("/(auth)/login")}
        />
      ) : status === "notartist" ? (
        <Guard
          icon="brush-outline"
          title="Finish your studio setup"
          body="Once your artist profile is live you can publish Ink Drops here."
        />
      ) : status === "error" ? (
        <Guard
          icon="cloud-offline-outline"
          title="Couldn't load"
          body="Something went wrong. Go back and try again."
        />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Intro */}
            <View className="mb-6 rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4">
              <View className="flex-row items-center gap-2">
                <Icon name="flash" size={16} color={colors.gold[400]} />
                <Text variant="bodySemibold" className="text-gold-300">
                  Fill the empty chair
                </Text>
              </View>
              <Text variant="body" className="mt-1.5 text-[13px] text-bone-300">
                Drop a quiet day at a lower price. The first customer to claim it
                books a confirmed session — you keep the deposit rail as normal.
              </Text>
            </View>

            {/* Date */}
            <Text variant="label" className="mb-3 text-bone-500">
              Which day?
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 8, gap: 8 }}
              className="mb-6"
            >
              {dayOptions.map((iso) => {
                const active = iso === dropDate;
                return (
                  <Pressable
                    key={iso}
                    onPress={() => setDropDate(iso)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`min-w-[92px] items-center rounded-xl border px-3 py-2.5 ${
                      active
                        ? "border-gold-400/70 bg-gold-400/15"
                        : "border-ink-700 bg-ink-900"
                    }`}
                  >
                    <Text
                      variant={active ? "bodySemibold" : "bodyMedium"}
                      className={`text-[13px] ${active ? "text-gold-300" : "text-bone-300"}`}
                    >
                      {relativeDropDate(iso)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Slot type */}
            <Text variant="label" className="mb-3 text-bone-500">
              How long?
            </Text>
            <View className="mb-6 flex-row gap-2">
              {SLOTS.map((s) => {
                const active = s.key === slot;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSlot(s.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`flex-1 items-center gap-1.5 rounded-xl border px-2 py-3 ${
                      active
                        ? "border-gold-400/70 bg-gold-400/15"
                        : "border-ink-700 bg-ink-900"
                    }`}
                  >
                    <Icon
                      name={s.icon}
                      size={18}
                      color={active ? colors.gold[300] : colors.bone[500]}
                    />
                    <Text
                      variant="bodyMedium"
                      className={`text-[12px] ${active ? "text-gold-300" : "text-bone-300"}`}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {slot === "hours" ? (
              <Field
                label="Which hours? (optional)"
                value={hoursNote}
                onChangeText={setHoursNote}
                placeholder="e.g. 2–5pm"
                className="mb-6"
              />
            ) : null}

            {/* Prices */}
            <View className="mb-6 flex-row gap-3">
              <Field
                label="Drop price"
                value={dropPrice}
                onChangeText={setDropPrice}
                placeholder="£90"
                keyboardType="numeric"
                className="flex-1"
              />
              <Field
                label="Usual price (optional)"
                value={normalPrice}
                onChangeText={setNormalPrice}
                placeholder="£140"
                keyboardType="numeric"
                className="flex-1"
              />
            </View>

            {/* Note */}
            <Field
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Small flash pieces only"
              multiline
              className="mb-7"
            />

            <Button
              label="Publish Ink Drop"
              variant="gold"
              loading={publishing}
              onPress={onPublish}
            />

            {/* Your drops */}
            {openDrops.length > 0 ? (
              <>
                <Text variant="label" className="mb-3 mt-9 text-bone-500">
                  Your open drops
                </Text>
                <View className="gap-3">
                  {openDrops.map((d) => (
                    <MyDropRow
                      key={d.id}
                      drop={d}
                      withdrawing={withdrawingId === d.id}
                      onWithdraw={() => onWithdraw(d)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {pastDrops.length > 0 ? (
              <>
                <Text variant="label" className="mb-3 mt-9 text-bone-500">
                  Earlier drops
                </Text>
                <View className="gap-3">
                  {pastDrops.map((d) => (
                    <MyDropRow
                      key={d.id}
                      drop={d}
                      withdrawing={false}
                      onWithdraw={() => undefined}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Guard({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
        <Icon name={icon} size={26} color={colors.gold[400]} />
      </View>
      <Text variant="display" className="mb-2 text-center text-xl">
        {title}
      </Text>
      <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="primary" block={false} onPress={onAction} />
      ) : null}
    </View>
  );
}
