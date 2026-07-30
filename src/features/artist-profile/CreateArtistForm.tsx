import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../../ui/Text";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import { WEB_HOST } from "../../lib/links";
import { styleLabel } from "../../lib/geo";
import { STYLE_OPTIONS } from "./format";
import { createArtistProfile } from "./actions";
import { handlify, isHandleAvailable } from "../studio/actions";

/**
 * Self-serve artist profile creation — the native fix for the onboarding
 * dead-end where an artist-role user had NO way to make their artists row in
 * the app (the web has a whole wizard; the app had nothing).
 *
 * Deliberately minimal, mirroring CreateStudioForm's shape: name (drives a
 * live handle + availability check), city, style chips → publish immediately.
 * Everything else (portfolio via Instagram import, services, availability)
 * happens AFTER they're in — inline, not as signup gates. That's the
 * two-minute promise.
 */
export function CreateArtistForm({
  onCreated,
}: {
  /** Called with the final handle once the profile row exists. */
  onCreated: (handle: string) => void;
}) {
  const [name, setName] = useState("");
  const [handleEdit, setHandleEdit] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleState, setHandleState] = useState<
    "idle" | "checking" | "free" | "taken" | "invalid"
  >("idle");

  // Handle = explicit edit if the artist touched it, else derived from name.
  const handle = handlify(handleEdit ?? name);

  // Debounced availability probe, keyed to the latest value only.
  const probeSeq = useRef(0);
  useEffect(() => {
    if (handle.length < 3) {
      setHandleState(handle.length === 0 ? "idle" : "invalid");
      return;
    }
    setHandleState("checking");
    const seq = ++probeSeq.current;
    const timer = setTimeout(async () => {
      const free = await isHandleAvailable(handle);
      if (probeSeq.current === seq) setHandleState(free ? "free" : "taken");
    }, 350);
    return () => clearTimeout(timer);
  }, [handle]);

  function toggleStyle(style: string) {
    setStyles((current) =>
      current.includes(style)
        ? current.filter((s) => s !== style)
        : current.length >= 3
          ? current // keep it curated — three max
          : [...current, style],
    );
  }

  async function handleCreate() {
    if (name.trim().length === 0) {
      setError("Tell clients your name.");
      return;
    }
    if (handle.length < 3) {
      setError("Your handle needs at least 3 letters or numbers.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createArtistProfile({
      displayName: name,
      handle,
      city,
      styles,
    });
    setSaving(false);

    if (result.ok) {
      onCreated(result.handle);
      return;
    }
    if (result.error === "not_authenticated") {
      setError("Your session has expired — please sign in again.");
    } else if (result.error === "already_artist") {
      // A row appeared elsewhere (double-tap / another device) — that IS success.
      onCreated(handle);
    } else if (result.error === "invalid") {
      setError("Check your name and handle, then try again.");
    } else {
      setError("Something went wrong. Please try again.");
    }
  }

  const handleHint = (() => {
    switch (handleState) {
      case "checking":
        return { text: "Checking availability…", tone: "text-bone-500" };
      case "free":
        return { text: `Your page: ${WEB_HOST}/a/${handle}`, tone: "text-positive" };
      case "taken":
        return { text: "Taken — we'll add a number when you save.", tone: "text-gold-300" };
      case "invalid":
        return { text: "Use at least 3 letters or numbers.", tone: "text-gold-300" };
      default:
        return { text: `Your public page lives at ${WEB_HOST}/a/…`, tone: "text-bone-500" };
    }
  })();

  return (
    <View>
      {/* Warm intro */}
      <View className="mb-6 items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
          <Icon name="brush-outline" size={26} color={colors.gold[400]} />
        </View>
        <Text variant="display" className="mb-2 text-center text-xl">
          Set up your artist profile
        </Text>
        <Text variant="body" className="max-w-[300px] text-center text-bone-500">
          Two minutes and you're bookable. Portfolio next — you can pull it
          straight from Instagram.
        </Text>
      </View>

      <Field
        label="Artist name"
        value={name}
        onChangeText={setName}
        placeholder="Nova Reyes"
        autoCapitalize="words"
        autoCorrect={false}
        className="mb-4"
      />

      <Field
        label="Handle"
        value={handleEdit ?? handle}
        onChangeText={(t) => setHandleEdit(t)}
        placeholder="nova-reyes"
        autoCapitalize="none"
        autoCorrect={false}
        className="mb-1.5"
      />
      <Text variant="caption" className={`mb-4 ${handleHint.tone}`}>
        {handleHint.text}
      </Text>

      <Field
        label="City"
        value={city}
        onChangeText={setCity}
        placeholder="Nottingham"
        autoCapitalize="words"
        autoCorrect={false}
        className="mb-4"
      />

      <Text variant="label" className="mb-2 text-bone-500">
        Your styles (up to 3)
      </Text>
      <View className="mb-5 flex-row flex-wrap gap-2">
        {STYLE_OPTIONS.map((style) => {
          const active = styles.includes(style);
          return (
            <Pressable
              key={style}
              accessibilityRole="button"
              onPress={() => toggleStyle(style)}
              className={`rounded-full border px-3.5 py-2 active:opacity-80 ${
                active
                  ? "border-gold-400/70 bg-gold-400/15"
                  : "border-ink-600 bg-ink-800"
              }`}
            >
              <Text
                variant="bodyMedium"
                className={`text-[13px] ${active ? "text-gold-300" : "text-bone-300"}`}
              >
                {styleLabel(style)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View className="mb-4 rounded-xl border border-negative/40 bg-negative/10 px-3.5 py-2.5">
          <Text variant="body" className="text-[13px] text-negative">
            {error}
          </Text>
        </View>
      ) : null}

      <Button
        label={saving ? "Creating…" : "Create my profile"}
        variant="primary"
        loading={saving}
        onPress={handleCreate}
      />
      <Text variant="caption" className="mt-3 text-center text-bone-500">
        Live straight away — you can hide or edit it any time.
      </Text>
    </View>
  );
}
