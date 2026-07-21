import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Text } from "../../ui/Text";
import { Icon, type IconName } from "../../ui/Icon";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { colors } from "../../ui/tokens";
import { useAuth, type UserRole } from "../../lib/auth";
import { ACCOUNT_URL, PRIVACY_URL, openExternal } from "../../lib/links";

const ROLE_LABEL: Record<UserRole, string> = {
  customer: "Customer",
  artist: "Artist",
  studio_admin: "Studio",
};

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The signed-in identity card + account rows + sign-out, shared across every
 * role's account surface. Every row here must DO something — placeholder
 * "coming soon" rows are gone; anything not yet built simply doesn't render.
 */
export function AccountPanel() {
  const { profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/(auth)/login");
  }

  // Role-aware destination for profile editing; customers have no native
  // profile editor yet, so the row is simply absent for them.
  const editProfile =
    profile?.role === "artist"
      ? () => router.push("/(artist)/profile")
      : profile?.role === "studio_admin"
        ? () => router.push("/(studio)/(tabs)/shop")
        : null;

  return (
    <View className="gap-5">
      <View className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
        <View className="flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-2xl border border-ink-600 bg-ink-800">
            <Text variant="display" className="text-xl text-bone-100">
              {profile ? monogram(profile.fullName) : "?"}
            </Text>
          </View>
          <View className="flex-1">
            <Text variant="bodySemibold" numberOfLines={1}>
              {profile?.fullName ?? "Your account"}
            </Text>
            <Text variant="caption" numberOfLines={1} className="mt-0.5">
              {profile?.email ?? ""}
            </Text>
          </View>
          {profile ? <Badge label={ROLE_LABEL[profile.role]} tone="gold" /> : null}
        </View>
      </View>

      <View className="rounded-2xl border border-ink-700 bg-ink-900">
        {editProfile ? (
          <ActionRow
            icon="person-outline"
            label="Edit profile"
            onPress={editProfile}
            first
          />
        ) : null}
        <ActionRow
          icon="shield-checkmark-outline"
          label="Privacy & data"
          caption="Policy, terms and your rights"
          onPress={() => void openExternal(PRIVACY_URL)}
          first={!editProfile}
        />
        <ActionRow
          icon="trash-outline"
          label="Delete account"
          caption="Manage on the InkSpred website"
          onPress={() => void openExternal(ACCOUNT_URL)}
          last
        />
      </View>

      <Button label="Sign out" variant="secondary" loading={signingOut} onPress={onSignOut} />

      <Text variant="caption" className="text-center text-bone-500">
        Payment method controls arrive with the payments rollout.
      </Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  caption,
  onPress,
  first,
  last,
}: {
  icon: IconName;
  label: string;
  caption?: string;
  onPress: () => void;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-ink-800 ${
        first ? "" : "border-t border-ink-700"
      } ${first ? "rounded-t-2xl" : ""} ${last ? "rounded-b-2xl" : ""}`}
    >
      <Icon name={icon} size={18} color={colors.bone[300]} />
      <View className="flex-1">
        <Text variant="body" className="text-bone-100">
          {label}
        </Text>
        {caption ? (
          <Text variant="caption" className="mt-0.5">
            {caption}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-forward" size={16} color={colors.bone[500]} />
    </Pressable>
  );
}
