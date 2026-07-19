import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Button } from "../../../src/ui/Button";
import { Field } from "../../../src/ui/Field";
import { colors } from "../../../src/ui/tokens";
import { useAuth } from "../../../src/lib/auth";
import { WEB_HOST, publicStudioUrl, openExternal } from "../../../src/lib/links";
import {
  getMyStudio,
  type ManagedStudio,
} from "../../../src/features/studio/data";
import { updateMyStudio } from "../../../src/features/studio/actions";
import { CreateStudioForm } from "../../../src/features/studio/CreateStudioForm";

type Status = "loading" | "ready" | "error";

/** The editable subset of a studio, as strings for the form. */
interface FormState {
  name: string;
  city: string;
  addressLine1: string;
  postcode: string;
  phone: string;
  instagram: string;
  description: string;
}

function toForm(studio: ManagedStudio): FormState {
  return {
    name: studio.name,
    city: studio.city ?? "",
    addressLine1: studio.addressLine1 ?? "",
    postcode: studio.postcode ?? "",
    phone: studio.phone ?? "",
    instagram: studio.instagram ?? "",
    description: studio.description ?? "",
  };
}

export default function Shop() {
  const router = useRouter();
  const { session } = useAuth();
  const [studio, setStudio] = useState<ManagedStudio | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setStudio(null);
      setStatus("ready");
      return;
    }
    try {
      const { studio: mine } = await getMyStudio();
      setStudio(mine);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /* Signed out — branded sign-in prompt. */
  if (!session) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon name="storefront" size={26} color={colors.gold[400]} />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            Sign in to open your studio
          </Text>
          <Text variant="body" className="mb-6 max-w-[280px] text-center text-bone-500">
            Your studio's shop front — its brand, location and roster — lives
            here once you're signed in.
          </Text>
          <Button
            label="Sign in"
            variant="primary"
            block={false}
            onPress={() => router.push("/(auth)/login")}
          />
        </View>
      </SafeAreaView>
    );
  }

  const refresh = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold[400]} />
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        refreshControl={refresh}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6">
          <Text variant="body" className="text-bone-500">
            Your studio
          </Text>
          <Text variant="displayBold" className="mt-1 text-3xl">
            Shop
          </Text>
        </View>

        {status === "error" ? (
          <ErrorCard />
        ) : status === "loading" ? (
          <View className="items-center py-16">
            <Text variant="body" className="text-bone-500">
              Loading…
            </Text>
          </View>
        ) : studio ? (
          <StudioProfileEditor studio={studio} onSaved={load} />
        ) : (
          <CreateStudioForm onCreated={load} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The studio's own profile, inline-editable, with a public-page link. */
function StudioProfileEditor({
  studio,
  onSaved,
}: {
  studio: ManagedStudio;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(studio));
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  // Re-seed the form whenever the underlying studio changes (e.g. after a
  // refetch), without clobbering an edit in progress on the same row.
  useEffect(() => {
    setForm(toForm(studio));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.id]);

  const dirty =
    form.name !== studio.name ||
    form.city !== (studio.city ?? "") ||
    form.addressLine1 !== (studio.addressLine1 ?? "") ||
    form.postcode !== (studio.postcode ?? "") ||
    form.phone !== (studio.phone ?? "") ||
    form.instagram !== (studio.instagram ?? "") ||
    form.description !== (studio.description ?? "");

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setNote(null);
  }

  async function handleSave() {
    if (form.name.trim().length === 0) {
      setNote({ text: "Your studio needs a name.", ok: false });
      return;
    }
    setSaving(true);
    setNote(null);
    const result = await updateMyStudio({
      name: form.name,
      city: form.city,
      addressLine1: form.addressLine1,
      postcode: form.postcode,
      phone: form.phone,
      instagram: form.instagram,
      description: form.description,
    });
    setSaving(false);

    if (result.ok) {
      setNote({ text: "Saved.", ok: true });
      onSaved();
      return;
    }
    setNote({
      text:
        result.error === "invalid"
          ? "Your studio needs a name."
          : result.error === "no_studio"
            ? "We couldn't find your studio. Pull down to refresh."
            : "Couldn't save your changes. Please try again.",
      ok: false,
    });
  }

  return (
    <View>
      {/* Public page link */}
      <Pressable
        accessibilityRole="link"
        onPress={() => openExternal(publicStudioUrl(studio.slug))}
        className="mb-6 flex-row items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4 active:opacity-80"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl border border-ink-600 bg-ink-800">
          <Icon name="globe-outline" size={18} color={colors.gold[400]} />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="bodySemibold" numberOfLines={1}>
            View public page
          </Text>
          <Text variant="caption" numberOfLines={1} className="mt-0.5">
            {WEB_HOST}/s/{studio.slug}
          </Text>
        </View>
        <Icon name="open-outline" size={18} color={colors.bone[500]} />
      </Pressable>
      <Text variant="caption" className="mb-6 -mt-4 px-1 text-bone-500">
        Opens your live studio page in the browser.
      </Text>

      <Text variant="label" className="mb-3 text-bone-500">
        Studio details
      </Text>

      <View className="gap-4">
        <Field
          label="Studio name"
          value={form.name}
          onChangeText={(t) => set("name", t)}
          placeholder="Parlour Noir"
          autoCapitalize="words"
        />
        <Field
          label="City"
          value={form.city}
          onChangeText={(t) => set("city", t)}
          placeholder="Manchester"
          autoCapitalize="words"
        />
        <Field
          label="Address"
          value={form.addressLine1}
          onChangeText={(t) => set("addressLine1", t)}
          placeholder="14 Tib Street, Northern Quarter"
          autoCapitalize="words"
        />
        <Field
          label="Postcode"
          value={form.postcode}
          onChangeText={(t) => set("postcode", t)}
          placeholder="M4 1SH"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Field
          label="Phone"
          value={form.phone}
          onChangeText={(t) => set("phone", t)}
          placeholder="0161 123 4567"
          keyboardType="phone-pad"
        />
        <Field
          label="Instagram"
          value={form.instagram}
          onChangeText={(t) => set("instagram", t.replace(/^@+/, ""))}
          placeholder="parlournoir"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label="Description"
          value={form.description}
          onChangeText={(t) => set("description", t)}
          placeholder="A private, appointment-only studio — a tight roster working in blackwork, fine-line and neo-traditional."
          multiline
          style={{ height: 108, paddingTop: 12, textAlignVertical: "top" }}
        />
      </View>

      {note ? (
        <View
          className={`mt-4 rounded-xl border px-3.5 py-2.5 ${
            note.ok
              ? "border-positive/40 bg-positive/10"
              : "border-negative/40 bg-negative/10"
          }`}
        >
          <Text
            variant="body"
            className={`text-[13px] ${note.ok ? "text-positive" : "text-negative"}`}
          >
            {note.text}
          </Text>
        </View>
      ) : null}

      <Button
        label={saving ? "Saving…" : "Save changes"}
        variant="primary"
        loading={saving}
        disabled={!dirty}
        onPress={handleSave}
        className="mt-5"
      />
    </View>
  );
}

function ErrorCard() {
  return (
    <View className="items-center rounded-2xl border border-ink-700 bg-ink-900 px-6 py-10">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
        <Icon name="cloud-offline-outline" size={24} color={colors.bone[500]} />
      </View>
      <Text variant="display" className="mb-2 text-center text-xl">
        Couldn't load your studio
      </Text>
      <Text variant="body" className="max-w-[280px] text-center text-bone-500">
        Pull down to refresh and try again.
      </Text>
    </View>
  );
}
