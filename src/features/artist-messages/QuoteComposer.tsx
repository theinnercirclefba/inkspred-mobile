import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Text } from "../../ui/Text";
import { Icon } from "../../ui/Icon";
import { Button } from "../../ui/Button";
import { colors } from "../../ui/tokens";
import { formatGBP } from "../../lib/money";
import { createQuote } from "./data";
import type { QuoteView, ThreadMessage } from "./types";

/**
 * QuoteComposer — the artist's bottom-sheet for sending a custom quote, the
 * native mirror of apps/web/components/quotes/QuoteComposer.
 *
 * Title, description, a price in £, a deposit entered as either a fixed £ amount
 * or a percentage of the price (live pence preview + deposit ≤ price
 * validation), an optional session count and expiry (7/14/30 days), and an
 * optional proposed session (date + 15-minute start time + duration). Submits
 * through createQuote, which inserts the quote row and posts it into the thread;
 * the persisted quote + message flow back through onCreated for an optimistic
 * append. Degrades softly: signed-out or failed sends surface a calm inline
 * note rather than throwing.
 */

/* ── Parsing + option tables (mirror the web composer) ──────────────── */

/** Parse a pounds string ("450", "450.50", "£1,200") into integer pence. */
function poundsToPence(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (cleaned.length === 0) return 0;
  const pounds = Number.parseFloat(cleaned);
  if (!Number.isFinite(pounds) || pounds < 0) return 0;
  return Math.round(pounds * 100);
}

/** Parse a percentage string ("40", "37.5") into a clamped 0–100 number. */
function parsePercent(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (cleaned.length === 0) return 0;
  const pct = Number.parseFloat(cleaned);
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return Math.min(100, pct);
}

/** Start-time options, 15-minute steps across a generous studio day. */
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let m = 7 * 60; m <= 21 * 60 + 45; m += 15) {
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    );
  }
  return out;
})();

/** 30-minute duration steps from 30 min to 8 h. */
const DURATION_OPTIONS: number[] = (() => {
  const out: number[] = [];
  for (let m = 30; m <= 480; m += 30) out.push(m);
  return out;
})();

/** "3 h" / "3 h 30 min" / "45 min" for the length picker. */
function humanDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** The next 21 days from tomorrow as {iso: YYYY-MM-DD, label: "Tue 22 Jul"}. */
function dateOptions(): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 21; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    out.push({ iso, label });
  }
  return out;
}

/** A local Date from the date (YYYY-MM-DD) + time (HH:MM) values. */
function localDate(dateStr: string, timeStr: string): Date {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, mo - 1, da, hh, mm);
}

type DepositMode = "fixed" | "percent";
type ExpiryDays = 0 | 7 | 14 | 30;

const EXPIRY_OPTIONS: ReadonlyArray<{ days: ExpiryDays; label: string }> = [
  { days: 0, label: "None" },
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
];

export interface QuoteComposerProps {
  open: boolean;
  onClose: () => void;
  threadId: string;
  artistId: string;
  customerId: string;
  clientName: string;
  /** Called after a successful send with the persisted quote + thread message. */
  onCreated?: (quote: QuoteView, message: ThreadMessage | undefined) => void;
}

export function QuoteComposer({
  open,
  onClose,
  threadId,
  artistId,
  customerId,
  clientName,
  onCreated,
}: QuoteComposerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [depositMode, setDepositMode] = useState<DepositMode>("fixed");
  const [depositFixed, setDepositFixed] = useState("");
  const [depositPercent, setDepositPercent] = useState("");
  const [sessions, setSessions] = useState("");
  const [expiryDays, setExpiryDays] = useState<ExpiryDays>(0);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(() => dateOptions(), []);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionDate, setSessionDate] = useState(dates[0]?.iso ?? "");
  const [sessionTime, setSessionTime] = useState("11:00");
  const [sessionDuration, setSessionDuration] = useState(120);

  // Seed the form fresh each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPrice("");
    setDepositMode("fixed");
    setDepositFixed("");
    setDepositPercent("");
    setSessions("");
    setExpiryDays(0);
    setStatus("idle");
    setError(null);
    setSessionOpen(false);
    setSessionDate(dates[0]?.iso ?? "");
    setSessionTime("11:00");
    setSessionDuration(120);
  }, [open, dates]);

  const pricePence = poundsToPence(price);
  const depositPence =
    depositMode === "fixed"
      ? poundsToPence(depositFixed)
      : Math.round((pricePence * parsePercent(depositPercent)) / 100);
  const depositPct =
    pricePence > 0 ? Math.round((depositPence / pricePence) * 100) : 0;

  const priceValid = pricePence > 0;
  const depositValid = depositPence >= 0 && depositPence <= pricePence;
  const titleValid = title.trim().length > 0;
  const canSubmit =
    titleValid && priceValid && depositValid && status !== "sending";

  const firstName = clientName.split(" ")[0] || "your client";

  async function submit() {
    if (!canSubmit) {
      if (!titleValid) setError("Add a title for the quote.");
      else if (!priceValid) setError("Add a price.");
      else if (!depositValid)
        setError("The deposit can't be more than the price.");
      return;
    }
    setError(null);
    setStatus("sending");

    const sessionsCount = (() => {
      const n = Number.parseInt(sessions, 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })();
    const expiresAt =
      expiryDays > 0
        ? new Date(Date.now() + expiryDays * 86_400_000).toISOString()
        : undefined;
    const proposedStartsAtIso =
      sessionOpen && sessionDate
        ? localDate(sessionDate, sessionTime).toISOString()
        : undefined;
    const proposedDurationMin = sessionOpen ? sessionDuration : undefined;

    const result = await createQuote({
      threadId,
      artistId,
      customerId,
      title: title.trim(),
      description: description.trim() || undefined,
      pricePence,
      depositPence,
      sessionsCount,
      expiresAt,
      proposedStartsAtIso,
      proposedDurationMin,
    });

    if (result.ok && result.quote) {
      setStatus("done");
      onCreated?.(result.quote, result.message);
      return;
    }
    setStatus("idle");
    setError(result.error ?? "Couldn't send that quote — try again.");
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        {/* Backdrop */}
        <Pressable
          className="absolute inset-0 bg-ink-950/80"
          onPress={onClose}
          accessibilityLabel="Close"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="max-h-[92%] overflow-hidden rounded-t-3xl border border-ink-700 bg-ink-900">
            {status === "done" ? (
              <View className="items-center px-6 py-10">
                <View className="h-12 w-12 items-center justify-center rounded-full border border-ink-600 bg-ink-800">
                  <Icon
                    name="checkmark-circle"
                    size={26}
                    color={colors.gold[400]}
                  />
                </View>
                <Text
                  variant="display"
                  className="mt-4 text-center text-xl"
                >
                  Quote sent to {firstName}
                </Text>
                <Text
                  variant="body"
                  className="mt-2 max-w-[300px] text-center text-bone-300"
                >
                  It&rsquo;s in their messages and their inbox. You&rsquo;ll be
                  notified the moment they accept.
                </Text>
                <Button
                  label="Done"
                  variant="secondary"
                  block={false}
                  className="mt-6"
                  onPress={onClose}
                />
              </View>
            ) : (
              <>
                {/* Header */}
                <View className="flex-row items-center justify-between border-b border-ink-800 px-5 py-4">
                  <View className="flex-row items-center gap-2">
                    <Icon
                      name="reader-outline"
                      size={16}
                      color={colors.gold[400]}
                    />
                    <Text variant="display" className="text-xl">
                      Send a quote
                    </Text>
                  </View>
                  <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={8}
                    className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
                  >
                    <Icon name="close" size={20} color={colors.bone[300]} />
                  </Pressable>
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ padding: 20, gap: 18 }}
                >
                  <Text variant="body" className="-mt-1 text-bone-500">
                    A priced proposal {firstName} can accept in one tap.
                  </Text>

                  {/* Title */}
                  <LabeledInput
                    label="Title"
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Half-sleeve, Japanese koi"
                    maxLength={120}
                  />

                  {/* Description */}
                  <LabeledInput
                    label="Description (optional)"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="What's included — style, size, number of sittings…"
                    maxLength={2000}
                    multiline
                  />

                  {/* Price */}
                  <View>
                    <FieldLabel>Price</FieldLabel>
                    <PrefixInput
                      prefix="£"
                      value={price}
                      onChangeText={setPrice}
                      placeholder="450"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  {/* Deposit — segmented fixed £ / % */}
                  <View>
                    <View className="flex-row items-center justify-between">
                      <FieldLabel className="mb-0">Deposit</FieldLabel>
                      <Segmented
                        options={[
                          { value: "fixed", label: "Fixed £" },
                          { value: "percent", label: "Percent %" },
                        ]}
                        value={depositMode}
                        onChange={(v) => setDepositMode(v as DepositMode)}
                      />
                    </View>
                    <View className="mt-2">
                      {depositMode === "fixed" ? (
                        <PrefixInput
                          prefix="£"
                          value={depositFixed}
                          onChangeText={setDepositFixed}
                          placeholder="100"
                          keyboardType="decimal-pad"
                        />
                      ) : (
                        <PrefixInput
                          prefix="%"
                          value={depositPercent}
                          onChangeText={setDepositPercent}
                          placeholder="25"
                          keyboardType="decimal-pad"
                        />
                      )}
                    </View>
                    <Text variant="caption" className="mt-2 text-bone-500">
                      {priceValid ? (
                        depositValid ? (
                          <>
                            Deposit{" "}
                            <Text variant="caption" className="text-bone-300">
                              {formatGBP(depositPence)}
                            </Text>{" "}
                            · balance{" "}
                            <Text variant="caption" className="text-bone-300">
                              {formatGBP(Math.max(0, pricePence - depositPence))}
                            </Text>
                            {depositMode === "fixed" && depositPct > 0
                              ? ` · ${depositPct}% of the price`
                              : ""}
                          </>
                        ) : (
                          <Text variant="caption" className="text-negative">
                            The deposit can&rsquo;t be more than the price.
                          </Text>
                        )
                      ) : (
                        "Enter a price to preview the deposit."
                      )}
                    </Text>
                  </View>

                  {/* Sessions + expiry */}
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <FieldLabel>Sessions (optional)</FieldLabel>
                      <PrefixInput
                        value={sessions}
                        onChangeText={setSessions}
                        placeholder="1"
                        keyboardType="number-pad"
                      />
                    </View>
                    <View className="flex-1">
                      <FieldLabel>Expires</FieldLabel>
                      <View className="flex-row flex-wrap gap-1.5">
                        {EXPIRY_OPTIONS.map((o) => (
                          <Chip
                            key={o.days}
                            label={o.label}
                            selected={expiryDays === o.days}
                            onPress={() => setExpiryDays(o.days)}
                          />
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Optional proposed session */}
                  <View className="border-t border-ink-800 pt-4">
                    {sessionOpen ? (
                      <View>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1.5">
                            <Icon
                              name="calendar-outline"
                              size={14}
                              color={colors.gold[400]}
                            />
                            <Text
                              variant="bodySemibold"
                              className="text-[13px] text-bone-300"
                            >
                              Proposed session
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => setSessionOpen(false)}
                            hitSlop={6}
                            className="active:opacity-70"
                          >
                            <Text variant="caption" className="text-bone-500">
                              Remove
                            </Text>
                          </Pressable>
                        </View>

                        <FieldLabel className="mb-1.5 mt-3">Date</FieldLabel>
                        <ChipScroller
                          items={dates.map((d) => ({
                            key: d.iso,
                            label: d.label,
                          }))}
                          selectedKey={sessionDate}
                          onSelect={setSessionDate}
                        />

                        <FieldLabel className="mb-1.5 mt-3">Start</FieldLabel>
                        <ChipScroller
                          items={TIME_OPTIONS.map((t) => ({
                            key: t,
                            label: t,
                          }))}
                          selectedKey={sessionTime}
                          onSelect={setSessionTime}
                        />

                        <FieldLabel className="mb-1.5 mt-3">Length</FieldLabel>
                        <ChipScroller
                          items={DURATION_OPTIONS.map((m) => ({
                            key: String(m),
                            label: humanDuration(m),
                          }))}
                          selectedKey={String(sessionDuration)}
                          onSelect={(k) => setSessionDuration(Number(k))}
                        />

                        <Text variant="caption" className="mt-2.5 text-bone-500">
                          They&rsquo;ll see the date on the quote; accepting books
                          it straight into this slot.
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => setSessionOpen(true)}
                        className="flex-row items-center gap-1.5 self-start active:opacity-70"
                      >
                        <Icon name="add" size={18} color={colors.gold[300]} />
                        <Text
                          variant="bodySemibold"
                          className="text-[14px] text-gold-300"
                        >
                          Add a session date
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {error ? (
                    <View className="flex-row items-center gap-1.5">
                      <Icon
                        name="alert-circle-outline"
                        size={14}
                        color={colors.negative}
                      />
                      <Text variant="caption" className="text-negative">
                        {error}
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>

                {/* Footer */}
                <View className="flex-row gap-3 border-t border-ink-800 px-5 pb-8 pt-4">
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={onClose}
                    className="flex-1"
                  />
                  <Button
                    label="Send quote"
                    variant="gold"
                    loading={status === "sending"}
                    disabled={!canSubmit}
                    onPress={() => void submit()}
                    className="flex-1"
                  />
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ── Small local controls ───────────────────────────────────────────── */

function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Text variant="label" className={`mb-2 text-bone-500 ${className ?? ""}`}>
      {children}
    </Text>
  );
}

function LabeledInput({
  label,
  multiline,
  ...rest
}: {
  label: string;
  multiline?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        placeholderTextColor={colors.bone[500]}
        selectionColor={colors.gold[400]}
        multiline={multiline}
        className={`rounded-xl border border-ink-600 bg-ink-800 px-3.5 font-sans text-[15px] text-bone-100 ${
          multiline ? "min-h-[80px] py-3" : "h-12 py-2"
        }`}
        style={multiline ? { textAlignVertical: "top" } : undefined}
        {...rest}
      />
    </View>
  );
}

function PrefixInput({
  prefix,
  ...rest
}: { prefix?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="h-12 flex-row items-center rounded-xl border border-ink-600 bg-ink-800 px-3.5">
      {prefix ? (
        <Text variant="body" className="pr-1 text-bone-500">
          {prefix}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.bone[500]}
        selectionColor={colors.gold[400]}
        className="h-12 flex-1 font-sans text-[15px] text-bone-100"
        {...rest}
      />
    </View>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row rounded-lg border border-ink-600 bg-ink-800 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`rounded-md px-2.5 py-1 ${active ? "bg-ink-600" : ""}`}
          >
            <Text
              variant="bodyMedium"
              className={`text-[12px] ${active ? "text-bone-100" : "text-bone-500"}`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-full border px-3 py-2 ${
        selected
          ? "border-gold-400 bg-gold-400/15"
          : "border-ink-600 bg-ink-800"
      }`}
    >
      <Text
        variant="bodyMedium"
        className={`text-[13px] ${selected ? "text-gold-300" : "text-bone-300"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChipScroller({
  items,
  selectedKey,
  onSelect,
}: {
  items: { key: string; label: string }[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 8, paddingRight: 8 }}
    >
      {items.map((it) => (
        <Chip
          key={it.key}
          label={it.label}
          selected={it.key === selectedKey}
          onPress={() => onSelect(it.key)}
        />
      ))}
    </ScrollView>
  );
}
