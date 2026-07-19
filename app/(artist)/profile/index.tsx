import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../../src/ui/Text";
import { Icon } from "../../../src/ui/Icon";
import { Field } from "../../../src/ui/Field";
import { Button } from "../../../src/ui/Button";
import { Artwork, monogram } from "../../../src/ui/Artwork";
import { colors } from "../../../src/ui/tokens";
import { publicPortfolioUrl } from "../../../src/lib/images";
import { useAuth } from "../../../src/lib/auth";
import { Chip } from "../../../src/features/book/Chip";
import { ProfileHeader } from "../../../src/features/artist-profile/ProfileHeader";
import { STYLE_OPTIONS } from "../../../src/features/artist-profile/format";
import {
  getEditableArtist,
  type EditableArtist,
} from "../../../src/features/artist-profile/data";
import {
  updateArtistAvatar,
  updateArtistProfile,
} from "../../../src/features/artist-profile/actions";
import { pickSingleImage } from "../../../src/features/artist-profile/pickImage";
import { uploadAvatarImage } from "../../../src/lib/portfolioUpload";

type Status = "loading" | "ready" | "notartist" | "error";

/** A form field's current value plus the last-saved baseline (for dirty check). */
interface Form {
  displayName: string;
  bio: string;
  city: string;
  styles: string[];
  instagram: string;
  tiktok: string;
}

function formFrom(a: EditableArtist): Form {
  return {
    displayName: a.displayName,
    bio: a.bio ?? "",
    city: a.city ?? "",
    styles: a.styles,
    instagram: a.instagram ?? "",
    tiktok: a.tiktok ?? "",
  };
}

export default function ProfileHub() {
  const router = useRouter();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [artist, setArtist] = useState<EditableArtist | null>(null);
  const [form, setForm] = useState<Form>({
    displayName: "",
    bio: "",
    city: "",
    styles: [],
    instagram: "",
    tiktok: "",
  });
  const [baseline, setBaseline] = useState<Form | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setArtist(a);
      const f = formFrom(a);
      setForm(f);
      setBaseline(f);
      setAvatarPath(a.avatarPath);
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

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return (
      form.displayName !== baseline.displayName ||
      form.bio !== baseline.bio ||
      form.city !== baseline.city ||
      form.instagram !== baseline.instagram ||
      form.tiktok !== baseline.tiktok ||
      form.styles.join("|") !== baseline.styles.join("|")
    );
  }, [form, baseline]);

  const toggleStyle = useCallback((style: string) => {
    setForm((prev) => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style],
    }));
  }, []);

  const onSave = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const res = await updateArtistProfile({
      displayName: form.displayName,
      bio: form.bio,
      city: form.city,
      styles: form.styles,
      instagram: form.instagram,
      tiktok: form.tiktok,
    });
    setSaving(false);
    if (res.ok) {
      setBaseline(form);
    } else {
      setError(res.error ?? "Couldn't save — please try again.");
    }
  }, [dirty, saving, form]);

  const onChangeAvatar = useCallback(async () => {
    if (uploadingAvatar) return;
    const picked = await pickSingleImage();
    if (!picked) return;

    setUploadingAvatar(true);
    const prev = avatarPath;
    const upload = await uploadAvatarImage(picked.uri, picked.mimeType);
    if (upload.error || !upload.path) {
      setUploadingAvatar(false);
      Alert.alert("Photo upload failed", upload.error ?? "Please try again.");
      return;
    }
    // Optimistic swap, revert the row write on failure.
    setAvatarPath(upload.path);
    const res = await updateArtistAvatar(upload.path);
    setUploadingAvatar(false);
    if (!res.ok) {
      setAvatarPath(prev);
      Alert.alert("Couldn't update your photo", res.error ?? "Please try again.");
    }
  }, [avatarPath, uploadingAvatar]);

  /* ── Non-ready states ──────────────────────────────────────────────── */

  if (status === "loading") {
    return (
      <Shell>
        <ProfileHeader title="Edit profile" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.gold[400]} />
          <Text variant="caption" className="mt-2">
            Loading your profile…
          </Text>
        </View>
      </Shell>
    );
  }

  if (status === "notartist" || status === "error") {
    const notartist = status === "notartist";
    return (
      <Shell>
        <ProfileHeader title="Edit profile" />
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
            <Icon
              name={notartist ? "brush-outline" : "cloud-offline-outline"}
              size={26}
              color={colors.gold[400]}
            />
          </View>
          <Text variant="display" className="mb-2 text-center text-xl">
            {notartist ? "Finish your studio setup" : "Couldn't load your profile"}
          </Text>
          <Text variant="body" className="max-w-[280px] text-center text-bone-500">
            {notartist
              ? "Once your artist profile is live you can edit it here."
              : "Something went wrong. Please go back and try again."}
          </Text>
        </View>
      </Shell>
    );
  }

  const avatarUri = publicPortfolioUrl(avatarPath);
  const initials = monogram(form.displayName || artist?.displayName || "?");

  return (
    <Shell>
      <ProfileHeader
        title="Edit profile"
        subtitle={artist ? `@${artist.handle}` : undefined}
        right={
          <Button
            label={saving ? "Saving…" : "Save"}
            variant="primary"
            size="md"
            block={false}
            loading={saving}
            disabled={!dirty}
            onPress={onSave}
            className="px-5"
          />
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View className="mb-7 mt-2 items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={onChangeAvatar}
            className="active:opacity-80"
          >
            <Artwork
              uri={avatarUri}
              seed={artist?.handle ?? "artist"}
              initials={initials}
              rounded="rounded-full"
              style={{ width: 96, height: 96 }}
            />
            <View className="absolute -bottom-1 -right-1 h-9 w-9 items-center justify-center rounded-full border-2 border-ink-950 bg-oxblood-500">
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.bone[100]} />
              ) : (
                <Icon name="camera" size={16} color={colors.bone[100]} />
              )}
            </View>
          </Pressable>
          <Text variant="caption" className="mt-3">
            Tap to change your photo
          </Text>
        </View>

        {error ? (
          <View className="mb-4 rounded-xl border border-negative/40 bg-negative/10 px-4 py-3">
            <Text variant="body" className="text-[13px] text-negative">
              {error}
            </Text>
          </View>
        ) : null}

        {/* Identity */}
        <Field
          label="Display name"
          value={form.displayName}
          onChangeText={(t) => setForm((p) => ({ ...p, displayName: t }))}
          placeholder="Your professional name"
          className="mb-4"
        />

        <View className="mb-4">
          <Text variant="label" className="mb-2 text-bone-300">
            Bio
          </Text>
          <View className="rounded-xl border border-ink-600 bg-ink-800 px-4 py-3">
            <BioInput
              value={form.bio}
              onChangeText={(t) => setForm((p) => ({ ...p, bio: t }))}
            />
          </View>
          <Text variant="caption" className="mt-1.5">
            A short line about your work — shown on your public page.
          </Text>
        </View>

        <Field
          label="City"
          value={form.city}
          onChangeText={(t) => setForm((p) => ({ ...p, city: t }))}
          placeholder="e.g. Manchester"
          className="mb-6"
        />

        {/* Styles */}
        <Text variant="label" className="mb-3 text-bone-300">
          Styles
        </Text>
        <View className="mb-6 flex-row flex-wrap gap-2">
          {STYLE_OPTIONS.map((style) => (
            <Chip
              key={style}
              label={style}
              selected={form.styles.includes(style)}
              onPress={() => toggleStyle(style)}
            />
          ))}
        </View>

        {/* Socials */}
        <Field
          label="Instagram"
          value={form.instagram}
          onChangeText={(t) => setForm((p) => ({ ...p, instagram: t }))}
          placeholder="username (without @)"
          autoCapitalize="none"
          autoCorrect={false}
          className="mb-4"
        />
        <Field
          label="TikTok"
          value={form.tiktok}
          onChangeText={(t) => setForm((p) => ({ ...p, tiktok: t }))}
          placeholder="username (without @)"
          autoCapitalize="none"
          autoCorrect={false}
          className="mb-7"
        />

        {/* Manage links */}
        <Text variant="label" className="mb-3 text-bone-500">
          Manage
        </Text>
        <View className="mb-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <ManageRow
            icon="pricetags-outline"
            label="Services & pricing"
            onPress={() => router.push("/(artist)/profile/services" as Href)}
            first
          />
          <ManageRow
            icon="calendar-outline"
            label="Availability"
            onPress={() => router.push("/(artist)/profile/availability" as Href)}
          />
          <ManageRow
            icon="images-outline"
            label="Portfolio"
            onPress={() => router.push("/(artist)/profile/portfolio" as Href)}
            last
          />
        </View>

        {/* View public page */}
        {artist?.published ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(`/(customer)/artist/${artist.handle}` as Href)
            }
            className="flex-row items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800 py-3.5 active:opacity-80"
          >
            <Icon name="open-outline" size={16} color={colors.gold[300]} />
            <Text variant="bodyMedium" className="text-[14px] text-gold-300">
              View public page
            </Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-900 py-3.5">
            <Icon name="eye-off-outline" size={16} color={colors.bone[500]} />
            <Text variant="caption">Your public page is hidden for now</Text>
          </View>
        )}
      </ScrollView>
    </Shell>
  );
}

/* ── Small local pieces ───────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-ink-950">
      {children}
    </SafeAreaView>
  );
}

/** A multi-line bio input matching the Field surface (Field is single-line). */
function BioInput({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (t: string) => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="Bold, considered blackwork — custom pieces drawn the week of your appointment."
      placeholderTextColor={colors.bone[500]}
      selectionColor={colors.gold[400]}
      multiline
      numberOfLines={4}
      style={{
        minHeight: 88,
        color: colors.bone[100],
        fontFamily: "Inter_400Regular",
        fontSize: 15,
        lineHeight: 22,
        textAlignVertical: "top",
      }}
    />
  );
}

function ManageRow({
  icon,
  label,
  onPress,
  first,
  last,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  onPress: () => void;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-ink-800 ${
        first ? "" : "border-t border-ink-700"
      }`}
    >
      <Icon name={icon} size={18} color={colors.gold[400]} />
      <Text variant="body" className="flex-1 text-bone-100">
        {label}
      </Text>
      <Icon name="chevron-forward" size={16} color={colors.bone[500]} />
    </Pressable>
  );
}
