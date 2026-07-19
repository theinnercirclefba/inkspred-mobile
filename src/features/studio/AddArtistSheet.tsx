import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../ui/Text";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Icon } from "../../ui/Icon";
import { Chip } from "../book/Chip";
import { colors } from "../../ui/tokens";
import { STYLE_OPTIONS } from "../artist-profile/format";
import { WEB_HOST } from "../../lib/links";
import {
  addStudioArtist,
  handlify,
  isHandleAvailable,
} from "./actions";

/**
 * The "Add artist" bottom sheet — collects name, handle (with a live
 * availability probe), styles and a short bio, then calls addStudioArtist, which
 * creates a real, published /a/{handle} profile and a resident membership. The
 * copy makes clear the artist owns their profile and can claim it later.
 *
 * Built dependency-free (a plain Modal + ScrollView) to match ProposeTimeSheet
 * so `expo export` stays clean.
 */

type HandleState = "idle" | "checking" | "free" | "taken" | "invalid";

export interface AddArtistSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful add so the roster can refetch. */
  onAdded: () => void;
}

export function AddArtistSheet({ visible, onClose, onAdded }: AddArtistSheetProps) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleEdited, setHandleEdited] = useState(false);
  const [styles, setStyles] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [handleState, setHandleState] = useState<HandleState>("idle");

  const effectiveHandle = handleEdited ? handle : handlify(name);
  const probeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards a stale probe (name kept typing) from overwriting a newer result.
  const probeSeq = useRef(0);

  function reset() {
    setName("");
    setHandle("");
    setHandleEdited(false);
    setStyles([]);
    setBio("");
    setNote(null);
    setHandleState("idle");
  }

  // Debounced availability probe whenever the effective handle changes.
  useEffect(() => {
    if (!visible) return;
    if (probeTimer.current) clearTimeout(probeTimer.current);

    const candidate = handlify(effectiveHandle);
    if (candidate.length < 3) {
      setHandleState(candidate.length === 0 ? "idle" : "invalid");
      return;
    }

    setHandleState("checking");
    const seq = ++probeSeq.current;
    probeTimer.current = setTimeout(async () => {
      const free = await isHandleAvailable(candidate);
      if (probeSeq.current !== seq) return; // superseded
      setHandleState(free ? "free" : "taken");
    }, 400);

    return () => {
      if (probeTimer.current) clearTimeout(probeTimer.current);
    };
  }, [effectiveHandle, visible]);

  function toggleStyle(style: string) {
    setStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style],
    );
  }

  async function handleAdd() {
    if (name.trim().length === 0) {
      setNote("Give the artist a name.");
      return;
    }
    setSaving(true);
    setNote(null);
    const result = await addStudioArtist({
      name,
      handle: effectiveHandle,
      styles,
      bio,
    });
    setSaving(false);

    if (result.ok) {
      reset();
      onAdded();
      onClose();
      return;
    }
    if (result.error === "no_studio") {
      setNote("Set up your studio on the Shop tab first, then add artists.");
    } else if (result.error === "not_authenticated") {
      setNote("Your session has expired — please sign in again.");
    } else if (result.error === "invalid") {
      setNote("Give the artist a name.");
    } else {
      setNote("Something went wrong adding the artist. Please try again.");
    }
  }

  const handleHint = (() => {
    switch (handleState) {
      case "checking":
        return { text: "Checking availability…", tone: "text-bone-500" };
      case "free":
        return { text: "Handle is available.", tone: "text-positive" };
      case "taken":
        return { text: "Taken — we'll add a number when you save.", tone: "text-gold-300" };
      case "invalid":
        return { text: "Use at least 3 letters or numbers.", tone: "text-gold-300" };
      default:
        return { text: "Auto-derived from the name — edit if you like.", tone: "text-bone-500" };
    }
  })();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[90%] rounded-t-3xl border-t border-ink-700 bg-ink-950 pb-8">
          {/* Header */}
          <View className="flex-row items-start justify-between px-5 pb-3 pt-5">
            <View className="flex-1 pr-3">
              <Text variant="display" className="text-xl">
                Add an artist
              </Text>
              <Text variant="body" numberOfLines={1} className="mt-0.5 text-[13px] text-bone-500">
                They'll get their own bookable profile at {WEB_HOST}/a/…
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
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
          >
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Oliver J"
              autoCapitalize="words"
              autoCorrect={false}
              className="mb-4"
            />

            <Field
              label="Profile handle"
              value={effectiveHandle}
              onChangeText={(t) => {
                setHandleEdited(true);
                setHandle(handlify(t));
              }}
              placeholder="oliver-j"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text variant="caption" className={`mt-1.5 ${handleHint.tone}`}>
              {handleHint.text}
            </Text>

            {/* Styles */}
            <Text variant="label" className="mb-2.5 mt-5 text-bone-500">
              Styles
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {STYLE_OPTIONS.map((style) => (
                <Chip
                  key={style}
                  label={style}
                  selected={styles.includes(style)}
                  onPress={() => toggleStyle(style)}
                />
              ))}
            </View>

            {/* Bio */}
            <Field
              label="Short bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Bold, considered blackwork — custom pieces drawn the week of your appointment."
              multiline
              numberOfLines={3}
              className="mt-5"
              style={{ height: 92, paddingTop: 12, textAlignVertical: "top" }}
            />

            {/* Ownership note */}
            <View className="mt-5 flex-row items-start gap-2.5 rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-3">
              <Icon name="information-circle-outline" size={16} color={colors.gold[400]} />
              <Text variant="caption" className="flex-1 leading-[17px] text-bone-500">
                Each artist owns their profile — they can claim it later. When they
                join InkSpred, bookings and messages flow straight to them.
              </Text>
            </View>

            {note ? (
              <View className="mt-4 rounded-xl border border-gold-400/30 bg-gold-400/10 px-3.5 py-2.5">
                <Text variant="body" className="text-[13px] text-gold-300">
                  {note}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View className="flex-row gap-3 px-5 pt-4">
            <Button
              label="Cancel"
              variant="secondary"
              onPress={onClose}
              disabled={saving}
              className="flex-1"
            />
            <Button
              label={saving ? "Adding…" : "Add artist"}
              variant="primary"
              loading={saving}
              onPress={handleAdd}
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
