import { useState } from "react";
import { View } from "react-native";
import { Text } from "../../ui/Text";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Icon } from "../../ui/Icon";
import { colors } from "../../ui/tokens";
import { WEB_HOST } from "../../lib/links";
import { createStudio, slugify } from "./actions";

/**
 * First-run set-up card for a signed-in studio_admin with no studio yet — a
 * warm "Set up your studio" prompt over a minimal create form (name → live slug
 * preview, city). On success it calls createStudio and hands the new slug back
 * so the Shop tab can reload into the full profile editor.
 */
export function CreateStudioForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugPreview = slugify(name);

  async function handleCreate() {
    if (name.trim().length === 0) {
      setError("Give your studio a name.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createStudio({ name, city });
    setSaving(false);

    if (result.ok) {
      onCreated();
      return;
    }
    if (result.error === "not_authenticated") {
      setError("Your session has expired — please sign in again.");
    } else if (result.error === "slug_taken") {
      setError("That studio name is taken. Try a small variation.");
    } else if (result.error === "invalid") {
      setError("Give your studio a name.");
    } else {
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <View>
      {/* Warm intro */}
      <View className="mb-6 items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-8">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
          <Icon name="storefront-outline" size={26} color={colors.gold[400]} />
        </View>
        <Text variant="display" className="mb-2 text-center text-xl">
          Set up your studio
        </Text>
        <Text variant="body" className="max-w-[300px] text-center text-bone-500">
          Create your studio's brand and location. You'll add your artists and
          the rest of your details next.
        </Text>
      </View>

      <Field
        label="Studio name"
        value={name}
        onChangeText={setName}
        placeholder="Parlour Noir"
        autoCapitalize="words"
        autoCorrect={false}
        className="mb-1.5"
      />
      <Text variant="caption" className="mb-4 text-bone-500">
        {slugPreview.length >= 3
          ? `Public page: ${WEB_HOST}/s/${slugPreview}`
          : `Your public page lives at ${WEB_HOST}/s/…`}
      </Text>

      <Field
        label="City"
        value={city}
        onChangeText={setCity}
        placeholder="Manchester"
        autoCapitalize="words"
        autoCorrect={false}
        className="mb-4"
      />

      {error ? (
        <View className="mb-4 rounded-xl border border-negative/40 bg-negative/10 px-3.5 py-2.5">
          <Text variant="body" className="text-[13px] text-negative">
            {error}
          </Text>
        </View>
      ) : null}

      <Button
        label={saving ? "Creating…" : "Create studio"}
        variant="primary"
        loading={saving}
        onPress={handleCreate}
      />
    </View>
  );
}
